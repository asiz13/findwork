import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import * as XLSX from 'xlsx';

const repo = path.resolve(import.meta.dirname, '..');
const jobkoiUrl = process.env.JOBKOI_SOURCE_URL || 'https://jobkoi.cn/app/opportunities';
const seedPath = process.env.SEED_CSV_PATH || path.join(repo, 'seed_jobs.csv');
const outputPath = path.join(repo, 'recruitment_data.json');
const currentYear = new Date().getFullYear();
const today = new Date().toISOString().slice(0, 10);

function text(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join('、');
  if (value && typeof value === 'object') return text(value.text ?? value.name ?? '');
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function stableId(key) {
  return `job-${createHash('sha256').update(key).digest('hex')}`;
}

function normalize(value) {
  return text(value).toLowerCase().replace(/[\s\-_/,、，。；;:：()（）【】\[\]]/g, '');
}

function canonicalKey(record) {
  return [normalize(record.company), normalize(record.position), normalize(record.city)].join('|');
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
  if (short) return `${currentYear}-${short[1].padStart(2, '0')}-${short[2].padStart(2, '0')}`;
  return '';
}

function isExpired(deadline) {
  return /^20\d{2}-\d{2}-\d{2}$/.test(deadline) && deadline < today;
}

function officialUrl(raw) {
  const value = text(raw).replace(/&amp;/g, '&');
  if (!/^https?:\/\//i.test(value)) return '';
  try {
    const host = new URL(value).hostname.toLowerCase();
    if (/feishu|larksuite|weixin\.qq\.com|mp\.weixin|jobkoi\.cn|qcc\.com/.test(host)) return '';
    return value;
  } catch {
    return '';
  }
}

function csvValue(row, names) {
  const key = Object.keys(row).find(candidate => names.includes(String(candidate).trim()));
  return key ? text(row[key]) : '';
}

function csvRecords(rows) {
  return rows.flatMap(row => {
    const rowText = Object.values(row).map(text).join(' ');
    const company = csvValue(row, ['公司名称', '公司', '单位名称', '招聘单位', '招聘企业', '企业名称']);
    const audience = csvValue(row, ['招聘对象', '面向对象']);
    if (!company || !/2027/.test(audience || rowText) || /实习|intern/i.test(rowText)) return [];
    const position = csvValue(row, ['岗位', '岗位名称', '招聘岗位', '职位名称', '工作岗位']) || '';
    const city = csvValue(row, ['工作地点', '工作城市', '招聘城市', '城市', '工作地']);
    const deadline = dateValue(csvValue(row, ['截止时间', '报名截止', '网申截止', '投递截止']));
    if (isExpired(deadline)) return [];
    const sourceKey = `csv|${company}|${position}|${city}`;
    const url = officialUrl(csvValue(row, ['投递链接'])) || officialUrl(csvValue(row, ['相关公告'])) || jobkoiUrl;
    const category = csvValue(row, ['企业性质', '企业类型', '单位性质', '类别']);
    return [{
      id: stableId(sourceKey), sourceKey, company, position,
      recordType: csvValue(row, ['招聘类型', '记录类型', '类型']) || (position ? '岗位明细' : '招聘公告'),
      major: csvValue(row, ['所属行业', '行业', '专业要求', '所需专业', '专业']), city,
      category: ({ 央国企: '央企', 民营: '民企', 银行: '银行', '中外合资': '合资' })[category] || category,
      education: csvValue(row, ['学历要求', '学历']), startDate: '', deadline,
      salaryText: '', salaryMin: null, source: 'CSV导入',
      publishedAt: dateValue(csvValue(row, ['更新时间', '发布时间', '发布日期'])), url,
      verified: Boolean(officialUrl(csvValue(row, ['投递链接']))), sourceType: 'csv-import'
    }];
  });
}

async function readSeedRows() {
  try {
    const workbook = XLSX.read(await readFile(seedPath), { type: 'buffer', cellDates: false });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new Error('seed_jobs.csv has no worksheet.');
    return XLSX.utils.sheet_to_json(sheet, { defval: '' });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function scrapeJobkoi(page) {
  await page.goto(jobkoiUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4500);
  const records = [];
  let pagesRead = 0;
  let rowsRead = 0;
  let currentPage = 0;
  let totalPages = 1;
  while (currentPage < totalPages) {
    const pageText = await page.locator('body').innerText();
    const pageMatch = pageText.match(/当前第\s*(\d+)\s*页，共\s*([\d,]+)\s*页/);
    if (!pageMatch) throw new Error(`JobKoi page count was not found while reading page ${currentPage + 1}.`);
    currentPage = Number(pageMatch[1]);
    totalPages = Number(pageMatch[2].replace(/,/g, ''));
    pagesRead = Math.max(pagesRead, currentPage);
    const rows = await page.locator('table tbody tr').evaluateAll(elements => elements.map(row => ({
      text: row.innerText,
      cells: Array.from(row.querySelectorAll('td')).map(cell => cell.innerText),
      company: row.querySelector('strong')?.textContent || '',
      positions: Array.from(row.querySelectorAll('td:first-child li')).map(item => item.textContent || ''),
      links: Array.from(row.querySelectorAll('a')).map(link => link.href)
    })));
    rowsRead += rows.length;
    console.log(`JobKoi page ${currentPage}/${totalPages}: ${rows.length} rows read, ${records.length} active records so far.`);
    for (const row of rows) {
      const company = text(row.company);
      if (!company || !row.text.includes('2027届') || row.text.includes('实习')) continue;
      const cells = row.cells;
      const positions = row.positions.map(text).filter(Boolean);
      if (!positions.length) positions.push('');
      const deadline = dateValue(cells[7]);
      if (isExpired(deadline)) continue;
      const applyUrl = row.links.find(url => officialUrl(url)) || jobkoiUrl;
      for (const position of positions) {
        const city = text(cells[5]);
        const sourceKey = `jobkoi|${company}|${position}|${city}`;
        records.push({
          id: stableId(sourceKey), sourceKey, company, position,
          recordType: position ? '岗位明细' : '招聘公告', major: text(cells[2]), city,
          category: ({ 民营: '民企', '高校/科研院所': '事业单位', 合资: '合资' })[text(cells[3])] || text(cells[3]),
          education: '', startDate: dateValue(cells[6]), deadline,
          salaryText: '', salaryMin: null, source: 'jobkoi.cn', publishedAt: dateValue(cells[6]),
          url: applyUrl, verified: applyUrl !== jobkoiUrl, sourceType: 'jobkoi'
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
  if (!records.length) throw new Error('JobKoi returned no active 2027 campus records.');
  if (pagesRead !== totalPages) throw new Error(`JobKoi pagination incomplete: read ${pagesRead} of ${totalPages} pages.`);
  return { records, pagesRead, totalPages, rowsRead };
}

function priority(record) {
  if (record.sourceType === 'jobkoi') return 2;
  if (record.sourceType === 'csv-import') return 1;
  return 0;
}

function dedupe(records) {
  const result = new Map();
  for (const record of records) {
    if (!record.company || isExpired(record.deadline)) continue;
    const key = canonicalKey(record);
    const previous = result.get(key);
    if (!previous || priority(record) > priority(previous)) result.set(key, record);
  }
  return [...result.values()];
}

const seedRows = await readSeedRows();
const existing = JSON.parse(await readFile(outputPath, 'utf8'));
const preserved = (existing.records || []).filter(record => ['manual', 'image-note'].includes(record.sourceType));
let jobkoiRecords = [];
let jobkoiStats = { pagesRead: 0, totalPages: 0, rowsRead: 0 };
if (process.env.SKIP_JOBKOI !== '1') {
  const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  try {
    const context = await browser.newContext();
    const result = await scrapeJobkoi(await context.newPage());
    jobkoiRecords = result.records;
    jobkoiStats = { pagesRead: result.pagesRead, totalPages: result.totalPages, rowsRead: result.rowsRead };
  } finally {
    await browser.close();
  }
}
const records = dedupe([...preserved, ...csvRecords(seedRows), ...jobkoiRecords]);
if (!records.length) throw new Error('No active CSV or JobKoi records were collected.');
const output = {
  generatedAt: new Date().toISOString(), scope: '全国',
  notice: '全国 2027 届校园招聘数据：CSV 初始数据与 JobKoi 公开岗位列表统一导入；已过滤实习、非 2027 届和已过期公告；同公司、同岗位、同城市只保留一条，链接优先使用企业官网或官方投递页。',
  stats: { csvRows: seedRows.length, csvRecords: csvRecords(seedRows).length, jobkoi: { ...jobkoiStats, records: jobkoiRecords.length }, activeRecords: records.length },
  records
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`Imported ${csvRecords(seedRows).length} CSV records and scraped ${jobkoiRecords.length} JobKoi records across ${jobkoiStats.pagesRead}/${jobkoiStats.totalPages || 0} pages (${jobkoiStats.rowsRead} rows); saved ${records.length} active deduplicated records.`);
