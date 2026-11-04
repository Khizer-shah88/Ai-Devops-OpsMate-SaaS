/**
 * End-to-end module verification against a running local API.
 * Usage: node scripts/verify-modules.mjs
 * Never prints secrets.
 */

const API = process.env.API_URL || 'http://localhost:4000';

async function req(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  }
  return data;
}

function pass(name, detail) {
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, err) {
  console.error(`FAIL  ${name} — ${err.message || err}`);
}

async function main() {
  const results = { passed: 0, failed: 0 };

  async function check(name, fn) {
    try {
      const detail = await fn();
      pass(name, detail);
      results.passed += 1;
    } catch (error) {
      fail(name, error);
      results.failed += 1;
    }
  }

  let token = '';

  await check('health', async () => {
    const health = await req('/health');
    if (health.status !== 'ok') throw new Error('status not ok');
    return `ai.configured=${health.ai?.configured} provider=${health.ai?.provider} model=${health.ai?.model}`;
  });

  await check('auth/login', async () => {
    const login = await req('/auth/login', {
      method: 'POST',
      body: { email: 'demo@devmate.ai', password: 'demo1234' },
    });
    if (!login.accessToken) throw new Error('missing accessToken');
    token = login.accessToken;
    return `user=${login.user?.email}`;
  });

  await check('review-code', async () => {
    const result = await req('/review-code', {
      method: 'POST',
      token,
      body: {
        language: 'typescript',
        code: [
          'export function pay(amount: any) {',
          '  const apiKey = "sk-live-hardcoded";',
          '  eval(amount);',
          '  return amount * 1.1',
          '}',
        ].join('\n'),
      },
    });
    const bugs = Array.isArray(result.bugs) ? result.bugs.length : 0;
    if (bugs < 1) throw new Error('expected at least one bug finding');
    return `bugs=${bugs} improvements=${result.improvements?.length ?? 0}`;
  });

  await check('debug-error', async () => {
    const result = await req('/debug-error', {
      method: 'POST',
      token,
      body: {
        errorLog:
          'PrismaClientInitializationError: P1001: Can\'t reach database server at `localhost:5432`\n    at MainModule.onModuleInit',
      },
    });
    if (!result.explanation || !result.rootCause || !Array.isArray(result.fixSteps)) {
      throw new Error('invalid debug shape');
    }
    return `steps=${result.fixSteps.length}`;
  });

  await check('generate-cicd', async () => {
    const result = await req('/generate-cicd', {
      method: 'POST',
      token,
      body: {
        projectDescription: 'NestJS + Next.js SaaS',
        stackInfo: 'NestJS, Next.js, PostgreSQL, Prisma',
        cloudProvider: 'local',
        actionType: 'generate',
      },
    });
    if (!result.dockerfile || result.dockerfile.length < 20) throw new Error('weak dockerfile');
    if (!result.githubActions || result.githubActions.length < 20) throw new Error('weak githubActions');
    return `dockerfile=${result.dockerfile.length}c actions=${result.githubActions.length}c`;
  });

  let projectId = '';
  let analysisJson = '';

  await check('devops/analyze-package', async () => {
    const result = await req('/devops/analyze-package', {
      method: 'POST',
      token,
      body: {
        projectName: 'verify-app',
        cloudTarget: 'local',
        packageJson: JSON.stringify({
          name: 'verify-app',
          dependencies: {
            next: '16.0.0',
            react: '19.0.0',
            '@nestjs/common': '11.0.0',
            '@prisma/client': '7.0.0',
          },
          scripts: { build: 'next build', start: 'next start' },
        }),
      },
    });
    const services = result.analysis?.services?.length ?? 0;
    if (services < 2) throw new Error(`expected multi-service detection, got ${services}`);
    projectId = result.project?.id || '';
    analysisJson = JSON.stringify(result.analysis || {});
    return `services=${services} projectId=${projectId ? 'yes' : 'no'}`;
  });

  await check('devops/log-analyzer', async () => {
    const result = await req('/devops/log-analyzer', {
      method: 'POST',
      token,
      body: {
        context: 'GitHub Actions deploy',
        log: 'Error: connect ECONNREFUSED 127.0.0.1:6379\nredis connection failed during cache warm-up',
      },
    });
    if (!result.rootCause) throw new Error('missing rootCause');
    return `rootCause=${String(result.rootCause).slice(0, 60)}`;
  });

  await check('devops/generate-infra', async () => {
    const result = await req('/devops/generate-infra', {
      method: 'POST',
      token,
      body: {
        cloudTarget: 'local',
        actionType: 'generate',
        projectId: projectId || undefined,
        analysisJson: analysisJson || undefined,
        userRequest: 'Generate production Dockerfile, compose, and GitHub Actions for this monorepo.',
      },
    });
    const files = result.files?.length ?? 0;
    if (files < 3) throw new Error(`expected infra files, got ${files}`);
    return `files=${files}`;
  });

  await check('history', async () => {
    const stats = await req('/history?stats=true', { token });
    const history = await req('/history?limit=5', { token });
    return `total=${stats.totalRequests} recent=${Array.isArray(history) ? history.length : 0}`;
  });

  await check('devops/github/status', async () => {
    const status = await req('/devops/github/status', { token });
    return `connected=${status.connected}`;
  });

  console.log('');
  console.log(`Result: ${results.passed} passed, ${results.failed} failed`);
  process.exit(results.failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
