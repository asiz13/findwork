import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import * as XLSX from 'xlsx';

const repo = path.resolve(import.meta.dirname, '..');
const feishuUrl = process.env.FEISHU_SOURCE_URL || 'https://my.feishu.cn/wiki/UdAtwwZlJiULwskzEe5cSYJZnMe?table=tbl1eASN11JYwTo8&view=vewJRfkcoh';
const jobkoiUrl = process.env.JOBKOI_SOURCE_URL || 'https://jobkoi.cn/app/opportunities';
const outputPath = path.join(repo, 'recruitment_data.json');
const csvPath = path.join(repo, 'feishu_export.csv');
const years = new Date().getFullYear();

function text(value) {
  if (Array.isArray(value)) return value.map(item => text(item)).filter(Boolean).join('、');
  if (value && typeof value === 'object') return text(value.text ?? value.name ?? '');
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function value(row, names) {
  const key = Object.keys(row).find(candidate => names.includes(String(candidate).trim()));
  return key ? text(row[key]) : '';
}

function dateValue(raw) {
  if (raw === null || raw === undefined || raw === '') return '';
  if (typeof raw === 'number') {
    const date = XLSX.SSF.parse_date_code(raw);
    if (date) return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
  }
  const input = text(raw);
  const full = input.match(/(20\d{2})\D+(\d{1,2})\D+(\d{1,2})/);
  if (full) return `${full[1]}-${full[2].padStart(2, '0')}-${full[3].padStart(2, '0')}`;
  const short = input.match(/(\d{1,2})月(\d{1,2})日/);
  return short ? `${years}-${short[1].padStart(2, '0')}-${short[2].padStart(2, '0')}` : input;
}

function stableId(key) {
  return `job-${createHash('sha256').update(key).digest('hex')}`;
}

function salaryMinimum(raw) {
  const match = text(raw).replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

async function firstVisible(locators) {
  for (const locator of locators) {
    const count = await locator.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      if (await candidate.isVisible().catch(() => false)) return candidate;
    }
  }
  return null;
}

async function exportFeishuRows(page) {
  await page.goto(feishuUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2000);
  if (/login|passport|accounts\.feishu/i.test(page.url())) throw new Error('Feishu public link requires login.');
  const body = await page.locator('body').innerText().catch(() => '');
  if (/请登录|登录后查看|无权访问|没有权限/.test(body) && !/导出/.test(body)) throw new Error('Feishu public link is not guest-readable.');
  let exportMenu = await firstVisible([
    page.getByRole('menuitem', { name: '导出', exact: true }),
    page.getByText('导出', { exact: true })
  ]);
  if (!exportMenu) {
    const more = await firstVisible([
      page.getByRole('button', { name: /更多|更多操作/ }),
      page.locator('button[aria-label*="更多"], button[title*="更多"]'),
      page.locator('button').filter({ hasText: /^\s*\.\.\.\s*$/ })
    ]);
    if (more) {
      await more.click();
      await page.waitForTimeout(500);
      exportMenu = await firstVisible([
        page.getByRole('menuitem', { name: '导出', exact: true }),
        page.getByText('导出', { exact: true })
      ]);
    }
  }
  if (!exportMenu) throw new Error('Feishu export menu is not available to guests.');
  await exportMenu.click();
  const option = await firstVisible([
    page.getByText('Excel/CSV 文件', { exact: true }),
    page.getByText(/Excel\s*\/\s*CSV\s*文件/)
  ]);
  if (!option) throw new Error('Feishu Excel/CSV export is not available to guests.');
  const downloadPromise = page.waitForEvent('download', { timeout: 90000 });
  await option.click();
  const download = await downloadPromise;
  const filePath = await download.path();
  if (!filePath) throw new Error('Feishu did not provide an export file.');
  const workbook = XLSX.read(await readFile(filePath), { type: 'buffer', cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('Feishu export has no worksheet.');
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

async function readFeishuCsvSnapshot() {
  const workbook = XLSX.read(await readFile(csvPath), { type: 'buffer', cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('feishu_export.csv has no worksheet.');
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

async function loadFeishuRows(page) {
  try {
    const rows = await readFeishuCsvSnapshot();
    console.log('Using repository feishu_export.csv snapshot.');
    return rows;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return exportFeishuRows(page);
  }
}

function feishuRecords(rows) {
  return rows.flatMap(row => {
    const company = value(row, ['公司名称', '公司', '单位名称', '招聘单位', '招聘企业', '企业名称']);
    if (!company) return [];
    const position = value(row, ['岗位名称', '招聘岗位', '职位名称', '工作岗位', '岗位']);
    const city = value(row, ['工作地点', '工作城市', '招聘城市', '城市', '工作地']);
    const recordId = value(row, ['record_id', 'recordId', '记录ID', '记录 id', 'ID', 'id']);
    const sourceKey = recordId ? `feishu|${recordId}` : `feishu-export|${company}|${position}|${city}`;
    const salaryText = value(row, ['工资', '薪资', '薪酬']);
    return [{
      id: stableId(sourceKey), sourceKey, company, position,
      recordType: value(row, ['招聘类型', '记录类型', '类型']) || (position ? '岗位明细' : '招聘公告'),
      major: value(row, ['所属行业', '行业', '专业要求', '所需专业', '专业']), city,
      category: value(row, ['企业性质', '企业类型', '单位性质', '类别']),
      education: value(row, ['学历要求', '学历', '招聘对象', '面向对象']),
      startDate: dateValue(value(row, ['报名开始', '开始报名', '网申开始', '投递开始'])),
      deadline: dateValue(value(row, ['报名截止', '截止时间', '网申截止', '投递截止'])),
      salaryText, salaryMin: salaryMinimum(salaryText), source: 'my.feishu.cn',
      publishedAt: dateValue(value(row, ['发布时间', '发布日期', '公告日期', '发布于'])),
      url: `${feishuUrl}${recordId ? `&record=${encodeURIComponent(recordId)}` : ''}`,
      verified: true, sourceType: 'feishu-export'
    }];
  });
}

async function scrapeJobkoi(page) {
  await page.goto(jobkoiUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4500);
  const records = [];
  let currentPage = 0;
  let totalPages = 1;
  while (currentPage < totalPages) {
    const pageText = await page.locator('body').innerText();
    const pageMatch = pageText.match(/当前第\s*(\d+)\s*页，共\s*([\d,]+)\s*页/);
    currentPage = pageMatch ? Number(pageMatch[1]) : currentPage + 1;
    totalPages = pageMatch ? Number(pageMatch[2].replace(/,/g, '')) : totalPages;
    const rows = await page.locator('table tbody tr').evaluateAll(elements => elements.map(row => ({
      text: row.innerText,
      cells: Array.from(row.querySelectorAll('td')).map(cell => cell.innerText),
      company: row.querySelector('strong')?.textContent || '',
      positions: Array.from(row.querySelectorAll('td:first-child li')).map(item => item.textContent || ''),
      links: Array.from(row.querySelectorAll('a')).map(link => link.href)
    })));
    for (const row of rows) {
      const company = text(row.company);
      if (!company || !row.text.includes('2027届') || row.text.includes('实习')) continue;
      const cells = row.cells;
      const positions = row.positions.map(text).filter(Boolean);
      if (!positions.length) positions.push('');
      const applyUrl = row.links.find(url => !/qcc\.com/i.test(url)) || 'https://jobkoi.cn/app/opportunities';
      for (const position of positions) {
        const city = text(cells[5]);
        const sourceKey = `jobkoi|${company}|${position}|${city}`;
        records.push({
          id: stableId(sourceKey), sourceKey, company, position,
          recordType: position ? '岗位明细' : '招聘公告', major: text(cells[2]), city,
          category: ({ 民营: '民企', '高校/科研院所': '事业单位', 合资: '合资' })[text(cells[3])] || text(cells[3]),
          education: '', startDate: dateValue(cells[6]), deadline: dateValue(cells[7]),
          salaryText: '', salaryMin: null, source: 'jobkoi.cn', publishedAt: dateValue(cells[6]),
          url: applyUrl, verified: false, sourceType: 'jobkoi'
        });
      }
    }
    if (currentPage >= totalPages) break;
    const next = page.getByRole('button', { name: '下一页', exact: true });
    if (await next.count() !== 1 || !(await next.isEnabled())) throw new Error(`JobKoi pagination stopped at page ${currentPage}.`);
    const previousFirstRow = rows[0]?.text || '';
    await next.click();
    await page.waitForFunction(oldText => document.querySelector('table tbody tr')?.innerText !== oldText, previousFirstRow, { timeout: 15000 });
  }
  if (!records.length) throw new Error('JobKoi returned no 2027 campus records.');
  return records;
}

function normalize(value) {
  return text(value).toLowerCase().replace(/[\s\-_/、，,。；;:：()（）【】\[\]]/g, '');
}

function canonicalKey(record) {
  return [normalize(record.company), normalize(record.position), normalize(record.city)].join('|');
}

function priority(record) {
  if (record.sourceType === 'feishu' || record.sourceType === 'feishu-export') return 4;
  if (record.sourceType === 'company-official') return 3;
  if (record.sourceType === 'jobkoi') return 2;
  return 1;
}

function dedupe(records) {
  const result = new Map();
  for (const record of records) {
    const key = canonicalKey(record);
    const previous = result.get(key);
    if (!previous || priority(record) > priority(previous)) result.set(key, record);
  }
  return [...result.values()];
}

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ acceptDownloads: true });
  const feishuPage = await context.newPage();
  const jobkoiPage = await context.newPage();
  const [feishuResult, jobkoiResult] = await Promise.allSettled([
    loadFeishuRows(feishuPage),
    scrapeJobkoi(jobkoiPage)
  ]);
  const feishuAvailable = feishuResult.status === 'fulfilled';
  const jobkoiAvailable = jobkoiResult.status === 'fulfilled';
  if (!feishuAvailable) console.warn(`Feishu source unavailable: ${feishuResult.reason?.message || feishuResult.reason}`);
  if (!jobkoiAvailable) console.warn(`JobKoi source unavailable: ${jobkoiResult.reason?.message || jobkoiResult.reason}`);
  if (!feishuAvailable && !jobkoiAvailable) throw new Error('All public sources failed.');
  const feishuRows = feishuAvailable ? feishuResult.value : [];
  const jobkoiRecords = jobkoiAvailable ? jobkoiResult.value : [];
  const existing = JSON.parse(await readFile(outputPath, 'utf8'));
  const replaceTypes = new Set();
  if (feishuAvailable) ['feishu', 'feishu-export'].forEach(type => replaceTypes.add(type));
  if (jobkoiAvailable) replaceTypes.add('jobkoi');
  const preserved = (existing.records || []).filter(record => !replaceTypes.has(record.sourceType));
  const records = dedupe([...preserved, ...feishuRecords(feishuRows), ...jobkoiRecords]);
  if (!records.length) throw new Error('No public source records were collected.');
  const output = {
    generatedAt: new Date().toISOString(), scope: '全国',
    notice: '全国 2027 届校园招聘公开数据：飞书游客导出与 JobKoi 校招信息速递统一采集；同公司、同岗位、同城市只保留一条，优先保留飞书和企业官方记录。',
    records
  };
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Collected Feishu ${feishuRecords(feishuRows).length} records and JobKoi ${jobkoiRecords.length} records; saved ${records.length} deduplicated records.`);
} finally {
  await browser.close();
}
