# findwork public-source collector

生产采集只使用仓库中的 `seed_jobs.csv` 和 JobKoi 公开岗位列表，不访问飞书，也不需要任何账号权限。采集器输出 `recruitment_data.json`，供 GitHub Pages 工作台使用。

## 本地验证

```powershell
npm install
npx playwright install chromium
node public-sources.mjs
```

生产环境由 GitHub Actions 执行，不依赖本机。采集器会过滤非 2027 届、实习、已过期公告，并按公司、岗位、城市去重；链接优先保留企业官网或官方投递页。
