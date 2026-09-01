import { spawn } from 'node:child_process';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { chromium } from 'playwright';
import { z } from 'zod';
import * as XLSX from 'xlsx';

const repo = process.env.FINDWORK_REPO || path.resolve(import.meta.dirname, '..');
const profileDir = process.env.FINDWORK_BROWSER_PROFILE || path.join(os.homedir(), '.findwork-feishu-mcp');
const sourceUrl = 'https://my.feishu.cn/wiki/UdAtwwZlJiULwskzEe5cSYJZnMe?table=tbl1eASN11JYwTo8&view=vewJRfkcoh';
const csvPath = path.join(repo, 'feishu_export.csv');
const browserExecutable = process.env.FINDWORK_BROWSER_EXECUTABLE || [
  path.join('D:', String.fromCodePoint(0x8f6f, 0x4ef6), 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  'D:\\软件\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
].find(existsSync);
let browserContext;
let page;

function result(text, extra = {}) {
  return { content: [{ type: 'text', text: JSON.stringify({ ...extra, message: text }, null, 2) }] };
}

async function getPage() {
  if (!browserContext) {
    await mkdir(profileDir, { recursive: true });
    browserContext = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      acceptDownloads: true,
      downloadsPath: path.join(profileDir, 'downloads'),
      ...(browserExecutable ? { executablePath: browserExecutable } : {})
    });
  }
  if (!page || page.isClosed()) page = await browserContext.newPage();
  return page;
}

async function run(command, args, options = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: repo, env: process.env, windowsHide: true, ...options });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', chunk => { stdout += chunk; });
    child.stderr?.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

async function runCollector() {
  const powershell = process.env.ComSpec ? 'powershell.exe' : 'pwsh';
  const result = await run(powershell, [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(repo, 'collect_jobs.ps1'),
    '-RequireFeishu', '-FeishuCsvFile', csvPath
  ]);
  if (result.code !== 0) throw new Error(result.stderr || result.stdout || `collector exited with ${result.code}`);
  return result.stdout.trim();
}

async function isLoginRequired(currentPage) {
  if (/login|passport|accounts\.feishu/i.test(currentPage.url())) return true;
  const bodyText = await currentPage.locator('body').innerText({ timeout: 5000 }).catch(() => '');
  return /请登录|登录后查看|无权访问|没有权限/.test(bodyText) && !/导出/.test(bodyText);
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

async function openExportMenu(currentPage) {
  const existing = await firstVisible([
    currentPage.getByRole('menuitem', { name: '导出', exact: true }),
    currentPage.getByText('导出', { exact: true })
  ]);
  if (existing) return existing;

  const moreButton = await firstVisible([
    currentPage.getByRole('button', { name: /更多|更多操作/ }),
    currentPage.locator('button[aria-label*="更多"], button[title*="更多"]'),
    currentPage.locator('button').filter({ hasText: /^\s*\.\.\.\s*$/ })
  ]);
  if (moreButton) {
    await moreButton.click();
    await currentPage.waitForTimeout(300);
  }
  return await firstVisible([
    currentPage.getByRole('menuitem', { name: '导出', exact: true }),
    currentPage.getByText('导出', { exact: true })
  ]);
}

async function saveExportAsCsv(download) {
  const downloadsDir = path.join(profileDir, 'downloads');
  await mkdir(downloadsDir, { recursive: true });
  const suggestedName = path.basename(download.suggestedFilename() || 'feishu_export.csv');
  const rawPath = path.join(downloadsDir, suggestedName);
  await download.saveAs(rawPath);
  const extension = path.extname(rawPath).toLowerCase();
  if (extension === '.xlsx' || extension === '.xls') {
    const workbook = XLSX.readFile(rawPath, { cellDates: false });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!firstSheet) throw new Error('The Feishu workbook has no worksheets.');
    await writeFile(csvPath, XLSX.utils.sheet_to_csv(firstSheet), 'utf8');
    return { format: extension.slice(1).toUpperCase(), sourceFile: rawPath };
  }
  await copyFile(rawPath, csvPath);
  return { format: 'CSV', sourceFile: rawPath };
}

const server = new McpServer({ name: 'findwork-feishu-sync', version: '1.0.0' });

async function publishWorkbench(push, commitMessage) {
  const add = await run('git', ['add', 'feishu_export.csv', 'recruitment_data.json', 'index.html', '秋招信息工作台.html']);
  if (add.code !== 0) return result('Git 暂存失败。', { status: 'error', stderr: add.stderr });
  const commit = await run('git', ['commit', '-m', commitMessage]);
  if (commit.code !== 0 && !/nothing to commit/i.test(commit.stdout + commit.stderr)) return result('Git 提交失败。', { status: 'error', stdout: commit.stdout, stderr: commit.stderr });
  if (!push) return result('文件已提交到本地 Git，未推送到 GitHub。', { status: 'committed', stdout: commit.stdout, stderr: commit.stderr });
  const pushed = await run('git', ['push', 'origin', 'HEAD']);
  if (pushed.code !== 0) return result('本地提交成功，但 GitHub 推送失败。请先配置 GitHub 登录凭证后重试。', { status: 'push_auth_required', stdout: pushed.stdout, stderr: pushed.stderr });
  return result('已推送到 GitHub。', { status: 'pushed', stdout: pushed.stdout });
}

async function exportFeishuCsv(url = sourceUrl) {
    const currentPage = await getPage();
    if (!currentPage.url().startsWith('https://my.feishu.cn/')) await currentPage.goto(url, { waitUntil: 'domcontentloaded' });
    await currentPage.waitForTimeout(1500);
    if (await isLoginRequired(currentPage)) {
      return result('请在已打开的飞书浏览器窗口完成登录或申请查看权限，完成后再次调用 export_feishu_csv。不要把密码发送给 MCP。', { status: 'login_required', url: currentPage.url() });
    }

    const exportMenu = await openExportMenu(currentPage);
    if (!exportMenu) return result('已打开飞书表格，但没有找到导出菜单。请确认当前视图有导出权限后再次调用。', { status: 'permission_required', url: currentPage.url() });
    await exportMenu.click();
    const csvOption = await firstVisible([
      currentPage.getByText('Excel/CSV 文件', { exact: true }),
      currentPage.getByText(/Excel\s*\/\s*CSV\s*文件/)
    ]);
    if (!csvOption) return result('已打开导出菜单，但没有找到 Excel/CSV 文件选项。请确认表格导出权限。', { status: 'permission_required', url: currentPage.url() });
    const downloadPromise = currentPage.waitForEvent('download', { timeout: 60000 });
    await csvOption.click();
    const download = await downloadPromise;
    const exportInfo = await saveExportAsCsv(download);
    const collectorOutput = await runCollector();
    return result(`Feishu ${exportInfo.format} export imported into the workbench.`, { status: 'imported', file: csvPath, sourceFile: exportInfo.sourceFile, collectorOutput });
}

let localSyncPromise;
async function runLocalSync() {
  if (localSyncPromise) return localSyncPromise;
  localSyncPromise = exportFeishuCsv().finally(() => { localSyncPromise = null; });
  return localSyncPromise;
}

function startLocalBridge() {
  const bridge = createServer(async (request, response) => {
    const origin = request.headers.origin;
    const allowedOrigin = !origin || origin === 'https://asiz13.github.io' || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    if (!allowedOrigin) {
      response.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ status: 'forbidden_origin' }));
      return;
    }
    if (origin) response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }
    if (request.url?.split('?')[0] === '/health') {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ status: 'ready', service: 'findwork-feishu-sync' }));
      return;
    }
    if (request.url?.split('?')[0] !== '/sync' || !['GET', 'POST'].includes(request.method || '')) {
      response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ status: 'not_found' }));
      return;
    }
    try {
      const exported = await runLocalSync();
      const payload = JSON.parse(exported.content[0].text);
      if (payload.status !== 'imported') {
        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify(payload));
        return;
      }
      const data = JSON.parse(await readFile(path.join(repo, 'recruitment_data.json'), 'utf8'));
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ ...payload, records: data.records, recordCount: data.records.length }));
    } catch (error) {
      response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ status: 'error', message: error instanceof Error ? error.message : String(error) }));
    }
  });
  bridge.on('error', error => {
    if (error.code !== 'EADDRINUSE') console.error(`Local bridge error: ${error.message}`);
  });
  bridge.listen(Number(process.env.FINDWORK_BRIDGE_PORT || 32123), '127.0.0.1', () => {
    console.error('Findwork local sync bridge listening on http://127.0.0.1:32123');
  });
}

server.tool(
  'export_feishu_csv',
  'Open the configured Feishu table in a visible browser, ask the user to log in or complete permissions when needed, export Excel/CSV, import the CSV into the workbench, and rebuild the HTML dashboard. This tool does not read or store passwords.',
  { url: z.string().url().optional() },
  async ({ url = sourceUrl }) => exportFeishuCsv(url)
);

server.tool(
  'continue_feishu_export',
  'Continue the pending Feishu export after the user has logged in or completed permission verification in the visible browser.',
  {},
  async () => {
    if (!page || page.isClosed()) return result('没有待继续的飞书浏览器页面，请先调用 export_feishu_csv。', { status: 'no_pending_session' });
    return await exportFeishuCsv(page.url());
  }
);

server.tool(
  'publish_workbench_to_github',
  'Commit the generated Feishu CSV, JSON, and HTML files and optionally push the commit to the configured GitHub remote. Set push=true only when you want an external GitHub write.',
  { push: z.boolean().default(false), commitMessage: z.string().default('Update Feishu recruitment data') },
  async ({ push, commitMessage }) => publishWorkbench(push, commitMessage)
);

server.tool(
  'sync_feishu_to_github',
  'Run the complete interactive flow: export the Feishu table in a visible browser, convert CSV/XLSX into the workbench data, rebuild HTML, and optionally commit/push to GitHub. If login or permission is needed, finish it in the browser and call this tool again.',
  { url: z.string().url().optional(), push: z.boolean().default(false), commitMessage: z.string().default('Update Feishu recruitment data') },
  async ({ url = sourceUrl, push, commitMessage }) => {
    const exported = await exportFeishuCsv(url);
    const payload = JSON.parse(exported.content[0].text);
    if (payload.status !== 'imported' || !push) return exported;
    return publishWorkbench(true, commitMessage);
  }
);

server.tool(
  'sync_status',
  'Show whether the exported CSV and generated workbench data are present, without reading browser credentials.',
  {},
  async () => {
    const data = existsSync(path.join(repo, 'recruitment_data.json')) ? JSON.parse(await readFile(path.join(repo, 'recruitment_data.json'), 'utf8')) : null;
    return result('当前同步状态。', { status: 'ready', csvPresent: existsSync(csvPath), recordCount: data?.records?.length || 0, repo });
  }
);

await server.connect(new StdioServerTransport());
startLocalBridge();
