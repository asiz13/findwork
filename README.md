# 全国秋招信息工作台

The generated `index.html` is deployed to GitHub Pages. Public Feishu and JobKoi data are collected by GitHub Actions; the workbench refresh flow uses a small Cloudflare Worker to trigger that cloud task.

Important: `update-wuhan.yml` must be uploaded to `.github/workflows/update-wuhan.yml`, not to the repository root. GitHub only recognizes workflow files inside `.github/workflows/`.

## GitHub setup

1. Confirm the Feishu share link can be viewed and exported by a guest; no Feishu app or collaborator is required.
2. Under **Settings -> Pages**, set the source to **GitHub Actions**.
3. Deploy `cloudflare-worker/worker.js` and configure it as described in `cloudflare-worker/README.md`.
4. Set `WORKFLOW_TRIGGER_URL` in `index.html` to the Worker `/refresh` URL.
5. Run **Actions -> Update nationwide recruitment data -> Run workflow** once to verify the public sources.

The table and view IDs are configured in `.github/workflows/update-wuhan.yml`. The collector uses Feishu record IDs when available and a normalized company/position/city key across both sources, so identical records are written only once. Feishu records take priority over JobKoi duplicates.

The public Feishu page URL can be used by the cloud sync service only when guests are allowed to export Excel/CSV. If guest export is disabled, the Feishu Base owner must change that permission or provide an official API app.

The workbench also has an **Import Feishu CSV** button. Use it when a CSV has been exported locally or the sync service is unavailable; the file is parsed in the browser and its records are written immediately to the nationwide job pool. Feishu rows are replaced as a snapshot, while manual and image-note records are preserved.

## CSV fallback

If the Base owner cannot authorize an app, export the view from Feishu using **... -> Export -> Excel/CSV file**. Rename the exported CSV to `feishu_export.csv`, upload it to the repository root, and run the workflow manually. The workflow imports the complete CSV on every run, so the CSV is the source snapshot: replace it with a new export whenever the Feishu table changes. The CSV should include a company column such as `公司名称`; other recognized columns include `岗位名称`, `企业性质`, `所属行业`, `工作地点`, `学历要求`, `报名开始`, `报名截止`, and `薪资`.

## MCP browser automation

The local MCP bridge is in `mcp-server/`. It opens the Feishu page in a persistent visible browser, exports the CSV, runs the collector, and can optionally commit and push the generated files. It does not read or store passwords. If Feishu requires login or permission, complete that in the browser window and call `continue_feishu_export`.

Install and configure it with the instructions in `mcp-server/README.md`. You can call `sync_feishu_to_github` with `push=false` to export and verify first, then call it again with `push=true` to publish. The separate `export_feishu_csv`, `continue_feishu_export`, `sync_status`, and `publish_workbench_to_github` tools are available when you want each stage separately.
