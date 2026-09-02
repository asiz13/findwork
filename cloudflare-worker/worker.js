const ALLOWED_ORIGIN = 'https://asiz13.github.io';

function response(body, status = 200, origin = ALLOWED_ORIGIN) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin'
    }
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    if (origin && origin !== ALLOWED_ORIGIN) return response({ status: 'forbidden_origin' }, 403, origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': origin || ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin'
    }});
    if (!['GET', 'POST'].includes(request.method) || new URL(request.url).pathname !== '/refresh') return response({ status: 'not_found' }, 404, origin || ALLOWED_ORIGIN);
    if (!env.GITHUB_TOKEN || !env.GITHUB_REPOSITORY || !env.GITHUB_WORKFLOW_ID) return response({ status: 'error', message: 'Worker GitHub settings are incomplete.' }, 500, origin || ALLOWED_ORIGIN);

    const githubResponse = await fetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/actions/workflows/${env.GITHUB_WORKFLOW_ID}/dispatches`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        'User-Agent': 'findwork-refresh-worker',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ref: env.GITHUB_BRANCH || 'main' })
    });
    if (!githubResponse.ok) return response({ status: 'error', message: `GitHub workflow dispatch failed: HTTP ${githubResponse.status}` }, 502, origin || ALLOWED_ORIGIN);
    return response({ status: 'queued', message: 'Recruitment data refresh queued.' }, 202, origin || ALLOWED_ORIGIN);
  }
};
