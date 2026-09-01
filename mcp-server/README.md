# findwork Feishu MCP

This MCP server uses a visible persistent browser profile to export the Feishu table as CSV, then runs the existing collector to rebuild `recruitment_data.json` and both HTML workbench files. It never receives or stores a password. When Feishu requires login or permission verification, the tool returns `login_required` or `permission_required`; complete that step in the visible browser and call `continue_feishu_export`.

## Install

From this directory (the dependency is already installed in this workspace):

```powershell
npm install
```

The server automatically uses the installed Edge or Chrome executable. If neither browser is installed, run `npx playwright install chromium` once.

Add this server to your Codex MCP configuration (`%USERPROFILE%\\.codex\\config.toml`):

```toml
[mcp_servers.findwork_feishu]
command = "node"
args = ["D:\\Codex\\findwork\\mcp-server\\server.mjs"]

[mcp_servers.findwork_feishu.env]
FINDWORK_REPO = "D:\\Codex\\findwork"
```

Restart Codex after saving the configuration. For a review-first flow, call `export_feishu_csv`, complete any login or permission step in the visible browser, call `continue_feishu_export`, check `sync_status`, then call `publish_workbench_to_github` with `push=true`. For a single flow, call `sync_feishu_to_github` with `push=true`; if login is needed, complete it in the browser and call the same tool again. The separate `deploy-pages.yml` workflow redeploys GitHub Pages after a successful push.

The MCP server is an interactive local bridge. It cannot run inside GitHub Actions with your personal Chrome login session. The repository workflow is manual only; the no-local-computer flow uses the cloud service described below.

When the Feishu export is XLSX, the MCP converts the first worksheet to `feishu_export.csv` before running the collector. The CSV is treated as a complete snapshot, so added, changed, and deleted rows are reflected in the generated workbench data.

When this MCP is running in Codex, the deployed workbench refresh button also calls its local bridge at `http://127.0.0.1:32123/sync`. That click updates the current browser session immediately and keeps its data in browser local storage. A static GitHub Pages site cannot write files back to GitHub without a server-side GitHub credential; the daily GitHub workflow still needs Feishu API secrets for unattended updates.

## Cloud deployment

For a no-local-computer workflow, deploy `cloud-server.mjs` as a web service. The included `Dockerfile` is ready for Render, Railway, Cloud Run, or a VPS. Set `ALLOWED_ORIGIN=https://asiz13.github.io` and `FEISHU_SOURCE_URL` to the public table URL. The service exposes `POST /sync`; the workbench refresh button must point to that URL. This service uses guest export only and returns `login_required` or `permission_required` when Feishu does not allow unauthenticated export.

GitHub Pages cannot run this Docker service itself. Put the code in the same repository if desired, but deploy the `mcp-server` directory to a web-service provider and use its HTTPS URL in the page. No GitHub login is needed by workbench users.

For Render, create a Web Service from this repository and use the included `render.yaml` blueprint. Set `FEISHU_SOURCE_URL` to the public Feishu table URL, deploy, then put the generated service URL plus `/sync` into `REMOTE_MCP_URL` in `index.html`. Push that one-line configuration change to GitHub. After that, clicking refresh calls the cloud service directly; it no longer depends on Codex or the local computer.
