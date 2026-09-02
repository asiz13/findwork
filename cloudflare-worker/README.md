# Findwork refresh worker

This Worker is the public refresh endpoint for the GitHub Pages workbench. It stores the GitHub token server-side and triggers the `update-wuhan.yml` workflow. It does not access Feishu credentials and does not expose the GitHub token to the browser.

Create a Worker from `worker.js`, then configure these Worker variables/secrets:

- `GITHUB_REPOSITORY`: `asiz13/findwork`
- `GITHUB_WORKFLOW_ID`: `update-wuhan.yml`
- `GITHUB_BRANCH`: `main`
- Secret `GITHUB_TOKEN`: a fine-grained GitHub token with Actions: Read and write permission for this repository

The endpoint used by the workbench is `https://<your-worker-subdomain>.workers.dev/refresh`.
