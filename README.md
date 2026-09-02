# 全国秋招信息工作台

工作台部署在 GitHub Pages。岗位数据由仓库中的 `seed_jobs.csv` 和 JobKoi 公开岗位列表生成，不使用飞书应用、飞书文档权限或 Render。

## 云端刷新

1. GitHub Actions 使用 `mcp-server/public-sources.mjs` 读取 CSV，并逐页抓取 `https://jobkoi.cn/app/opportunities`。
2. 采集器只保留 2027 届非实习记录，自动删除已过期公告。
3. 相同公司、岗位、城市只保留一条，链接优先使用企业官网或官方投递页。
4. 页面点击“刷新数据”调用 `cloudflare-worker/worker.js`，Worker 触发 `.github/workflows/update-wuhan.yml`。

Worker 配置：`GITHUB_REPOSITORY=asiz13/findwork`、`GITHUB_WORKFLOW_ID=update-wuhan.yml`、`GITHUB_BRANCH=main`，并将 GitHub Token 只保存为 Worker Secret。页面中的 `WORKFLOW_TRIGGER_URL` 必须填写 Worker 的 `/refresh` 地址。

## 数据规则

`seed_jobs.csv` 是已导入的初始岗位快照。CSV 和 JobKoi 中的飞书、Lark、微信、企查查链接会被过滤；没有企业官网链接的记录使用 JobKoi 公开岗位列表作为来源入口。日期截止且早于当天的公告不会写入数据。

GitHub Pages 设置为 **GitHub Actions** 后，可在 **Actions -> Update nationwide recruitment data -> Run workflow** 手动验证一次。定时任务为每天北京时间 08:00。
