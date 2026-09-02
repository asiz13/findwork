# findwork public-source collector

Production synchronization runs in GitHub Actions. The collector reads public Feishu and JobKoi data with a headless browser, then writes `recruitment_data.json`. The Cloudflare Worker only starts the GitHub workflow and never receives Feishu credentials.

## Local verification

From this directory:

```powershell
npm install
npx playwright install chromium
node public-sources.mjs
```

This is only for debugging; production does not depend on the local computer. The collector keeps one record for each normalized company, position, and city combination. Feishu records take priority over company-official records, then JobKoi records.
