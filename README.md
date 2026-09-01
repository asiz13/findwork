# 全国秋招信息工作台

GitHub Actions runs the data collection every day at 00:00 UTC, which is 08:00 in China Standard Time. The generated `index.html` is deployed to GitHub Pages.

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

The public Feishu page URL alone is not an API credential. To import the complete table, use the official API setup above, or export the Feishu view as CSV/XLSX and convert that export into `recruitment_data.json` before uploading it.
