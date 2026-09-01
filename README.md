# 全国秋招信息工作台

The generated `index.html` is deployed to GitHub Pages. The old scheduled GitHub update has been disabled; the workbench refresh flow uses the cloud sync service instead.

Important: `update-wuhan.yml` must be uploaded to `.github/workflows/update-wuhan.yml`, not to the repository root. GitHub only recognizes workflow files inside `.github/workflows/`.

## GitHub setup

1. Create a Feishu app and grant it read-only Bitable access.
2. Add the app as a reader of the Feishu Base.
3. Add these repository secrets under **Settings -> Secrets and variables -> Actions**:
   - `FEISHU_APP_ID`
   - `FEISHU_APP_SECRET`
   - `FEISHU_APP_TOKEN`
4. Under **Settings -> Pages**, set the source to **GitHub Actions**.
5. Run **Actions -> Update nationwide recruitment data -> Run workflow** once to verify the configuration.

The table and view IDs are configured in `.github/workflows/update-wuhan.yml`. The collector uses the Feishu record ID as the stable key, so additions, edits, and deletions are reflected on the next run without duplicate rows.

The public Feishu page URL can be used by the cloud sync service only when guests are allowed to export Excel/CSV. If guest export is disabled, the Feishu Base owner must change that permission or provide an official API app.

## CSV fallback

If the Base owner cannot authorize an app, export the view from Feishu using **... -> Export -> Excel/CSV file**. Rename the exported CSV to `feishu_export.csv`, upload it to the repository root, and run the workflow manually. The workflow imports the complete CSV on every run, so the CSV is the source snapshot: replace it with a new export whenever the Feishu table changes. The CSV should include a company column such as `公司名称`; other recognized columns include `岗位名称`, `企业性质`, `所属行业`, `工作地点`, `学历要求`, `报名开始`, `报名截止`, and `薪资`.

## MCP browser automation

The local MCP bridge is in `mcp-server/`. It opens the Feishu page in a persistent visible browser, exports the CSV, runs the collector, and can optionally commit and push the generated files. It does not read or store passwords. If Feishu requires login or permission, complete that in the browser window and call `continue_feishu_export`.

Install and configure it with the instructions in `mcp-server/README.md`. You can call `sync_feishu_to_github` with `push=false` to export and verify first, then call it again with `push=true` to publish. The separate `export_feishu_csv`, `continue_feishu_export`, `sync_status`, and `publish_workbench_to_github` tools are available when you want each stage separately.
