import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import * as XLSX from 'xlsx';

const port = Number(process.env.PORT || 8080);
const sourceUrl = process.env.FEISHU_SOURCE_URL || 'https://my.feishu.cn/wiki/UdAtwwZlJiULwskzEe5cSYJZnMe?table=tbl1eASN11JYwTo8&view=vewJRfkcoh';
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://asiz13.github.io';
let browser;
let activeSync;

function send(response, status, payload, origin) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': origin || allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin'
  });
  response.end(JSON.stringify(payload));
}

function value(row, names) {
  const key = Object.keys(row).find(candidate => names.includes(String(candidate).trim()));
  if (!key || row[key] === null || row[key] === undefined) return '';
  if (Array.isArray(row[key])) return row[key].map(item => item?.text ?? item?.name ?? item).join('、').trim();
  return String(row[key]).trim();
}

function dateValue(raw) {
  if (!raw) return '';
  if (typeof raw === 'number') {
    const date = XLSX.SSF.parse_date_code(raw);
    if (date) return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
  }
  const text = String(raw).trim();
  const match = text.match(/(20\d{2})[年./-](\d{1,2})[月./-](\d{1,2})/);
  return match ? `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}` : text;
}

function stableId(sourceKey) {
  return `feishu-${createHash('sha256').update(sourceKey).digest('hex')}`;
}

function recordsFromWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('The Feishu export has no worksheet.');
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return rows.flatMap(row => {
    const company = value(row, ['公司名称', '公司', '单位名称', '招聘单位', '招聘企业', '企业名称']);
    if (!company) return [];
    const position = value(row, ['岗位名称', '招聘岗位', '职位名称', '工作岗位', '岗位']);
    const city = value(row, ['工作地点', '工作城市', '招聘城市', '城市', '工作地']);
    const recordId = value(row, ['record_id', 'recordId', '记录ID', '记录 id', 'ID', 'id']);
    const sourceKey = recordId ? `feishu|${recordId}` : `feishu-export|${company}|${position}|${city}`;
    const source = 'my.feishu.cn';
    return [{
      id: stableId(sourceKey), sourceKey, company, position,
      recordType: value(row, ['招聘类型', '记录类型', '类型']) || (position ? '岗位明细' : '招聘公告'),
      major: value(row, ['所属行业', '行业', '专业要求', '所需专业', '专业']), city,
      category: value(row, ['企业性质', '企业类型', '单位性质', '类别']),
      education: value(row, ['学历要求', '学历', '招聘对象', '面向对象']),
      startDate: dateValue(value(row, ['报名开始', '开始报名', '网申开始', '投递开始'])),
      deadline: dateValue(value(row, ['报名截止', '截止时间', '网申截止', '投递截止'])),
      salaryText: value(row, ['工资', '薪资', '薪酬']), salaryMin: null, source,
      publishedAt: dateValue(value(row, ['发布时间', '发布日期', '公告日期', '发布于'])),
      url: `${sourceUrl}&record=${encodeURIComponent(recordId)}`, verified: true, sourceType: 'feishu-export'
    }];
  });
}

async function getBrowser() {
  if (!browser) browser = await chromium.launch({ headless: true, acceptDownloads: true });
  return browser;
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

async function exportGuestFile() {
  const context = await (await getBrowser()).newContext({ acceptDownloads: true });
  const page = await context.newPage();
  try {
    await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(2500);
    if (/login|passport|accounts\.feishu/i.test(page.url())) return { status: 'login_required', message: 'The Feishu link is not guest-exportable.' };
    const bodyText = await page.locator('body').innerText().catch(() => '');
    if (/请登录|登录后查看|无权访问|没有权限/.test(bodyText) && !/导出/.test(bodyText)) return { status: 'login_required', message: 'The Feishu link requires login or permission.' };
    let exportMenu = await firstVisible([page.getByRole('menuitem', { name: '导出', exact: true }), page.getByText('导出', { exact: true })]);
    if (!exportMenu) {
      const more = await firstVisible([
        page.getByRole('button', { name: /更多|更多操作/ }),
        page.locator('button[aria-label*="更多"], button[title*="更多"]'),
        page.locator('button').filter({ hasText: /^\s*\.\.\.\s*$/ })
      ]);
      if (more) {
        await more.click();
        await page.waitForTimeout(500);
      }
      exportMenu = await firstVisible([page.getByRole('menuitem', { name: '导出', exact: true }), page.getByText('导出', { exact: true })]);
    }
    if (!exportMenu) return { status: 'permission_required', message: 'Guest view is available, but export permission is not available.' };
    await exportMenu.click();
    const option = await firstVisible([page.getByText('Excel/CSV 文件', { exact: true }), page.getByText(/Excel\s*\/\s*CSV\s*文件/)]);
    if (!option) return { status: 'permission_required', message: 'The Excel/CSV export option is not available to guests.' };
    const downloadPromise = page.waitForEvent('download', { timeout: 90000 });
    await option.click();
    const download = await downloadPromise;
    const filePath = await download.path();
    if (!filePath) throw new Error('Feishu did not provide a downloaded file.');
    return { status: 'downloaded', buffer: await readFile(filePath), filename: download.suggestedFilename() };
  } finally {
    await context.close();
  }
}

async function sync() {
  if (activeSync) return activeSync;
  activeSync = (async () => {
    const exported = await exportGuestFile();
    if (exported.status !== 'downloaded') return exported;
    const records = recordsFromWorkbook(exported.buffer);
    return { status: 'imported', format: exported.filename, recordCount: records.length, records };
  })().finally(() => { activeSync = null; });
  return activeSync;
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (origin && origin !== allowedOrigin) return send(response, 403, { status: 'forbidden_origin' }, origin);
  if (request.method === 'OPTIONS') return send(response, 204, {}, origin);
  const pathname = request.url?.split('?')[0];
  if (pathname === '/health' && request.method === 'GET') return send(response, 200, { status: 'ready', service: 'findwork-feishu-cloud-sync' }, origin);
  if (pathname !== '/sync' || !['GET', 'POST'].includes(request.method || '')) return send(response, 404, { status: 'not_found' }, origin);
  try {
    const payload = await sync();
    return send(response, payload.status === 'imported' ? 200 : 403, payload, origin);
  } catch (error) {
    return send(response, 500, { status: 'error', message: error instanceof Error ? error.message : String(error) }, origin);
  }
});

server.listen(port, '0.0.0.0', () => console.log(`Findwork cloud sync listening on port ${port}`));
