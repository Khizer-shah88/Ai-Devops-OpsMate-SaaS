import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface ReviewOutput {
	bugs: string[];
	improvements: string[];
	optimizations: string[];
}

export interface DebugOutput {
	explanation: string;
	rootCause: string;
	fixSteps: string[];
}

export interface CicdOutput {
	dockerfile: string;
	dockerCompose: string;
	githubActions: string;
	kubernetes: string;
	env: string;
	validation: string;
	explanation: string;
	setupInstructions: string;
}

type CicdAction = 'generate' | 'modify' | 'validate' | 'explain';

type CicdPayload = {
	projectDescription?: string;
	stackInfo?: string;
	cloudProvider?: string;
	mode?: string;
	existingConfig?: string;
	userRequest?: string;
	actionType?: string;
};

@Injectable()
export class AiService {
	private readonly client: OpenAI | null;
	private readonly model: string;

	constructor(private readonly configService: ConfigService) {
		const apiKey = this.configService.get<string>('openAiApiKey', { infer: true });
		const configuredBaseUrl = this.configService.get<string>('openAiBaseUrl', { infer: true })?.trim();
		const isOpenRouterKey = apiKey?.startsWith('sk-or-v1-') ?? false;
		const baseURL = configuredBaseUrl || (isOpenRouterKey ? 'https://openrouter.ai/api/v1' : undefined);

		this.model =
			this.configService.get<string>('openAiModel', { infer: true }) ??
			(isOpenRouterKey ? 'openai/gpt-4.1-mini' : 'gpt-4.1-mini');

		this.client = apiKey
			? new OpenAI({
					apiKey,
					baseURL,
					defaultHeaders:
						baseURL?.includes('openrouter.ai')
							? {
								'HTTP-Referer': this.configService.get<string>('frontendUrl', { infer: true }) ?? 'http://localhost:3000',
								'X-Title': 'DevMat AI',
							}
							: undefined,
			  })
			: null;
	}

	async reviewCode(code: string, language: string): Promise<ReviewOutput> {
		if (!this.client) {
			return this.heuristicReview(code, language);
		}

		const prompt = [
			'You are a senior code reviewer.',
			'Return strict JSON with keys: bugs, improvements, optimizations.',
			'Each value must be an array of concise strings.',
			`Language: ${language}`,
			`Code:\n${code}`,
		].join('\n\n');

		try {
			return await this.generateJson<ReviewOutput>(prompt);
		} catch (error) {
			console.error('AI review failed, using heuristic fallback:', error);
			return this.heuristicReview(code, language);
		}
	}

	async debugError(errorLog: string): Promise<DebugOutput> {
		if (!this.client) {
			return this.heuristicDebug(errorLog);
		}

		const prompt = [
			'You are a debugging assistant for production systems.',
			'Return strict JSON with keys: explanation, rootCause, fixSteps.',
			'fixSteps must be an ordered array of actionable steps.',
			`Error log:\n${errorLog}`,
		].join('\n\n');

		try {
			return await this.generateJson<DebugOutput>(prompt);
		} catch (error) {
			console.error('AI debug failed, using heuristic fallback:', error);
			return this.heuristicDebug(errorLog);
		}
	}

	async generateCicd(payload: CicdPayload): Promise<CicdOutput> {
		const action = this.normalizeAction(payload.actionType);

		if (!this.client) {
			return this.normalizeCicdOutput(this.heuristicCicdTemplates(payload), action, payload);
		}

		const prompt = [
			'You are a Senior DevOps Engineer with expertise in Docker, Kubernetes, CI/CD, AWS/GCP, and full-stack production systems.',
			'Generate complete, production-ready DevOps outputs customized to the provided repository context.',
			'Never return boilerplate templates or generic placeholder configurations.',
			'',
			'-------------------------',
			'CONTEXT',
			'-------------------------',
			`Project Description: ${payload.projectDescription || 'N/A'}`,
			`Tech Stack: ${payload.stackInfo || 'N/A'}`,
			`Cloud Target: ${payload.cloudProvider || 'N/A'}`,
			`Mode: ${payload.mode || 'N/A'}`,
			`Existing Configuration (if any): ${payload.existingConfig || 'N/A'}`,
			`User Request: ${payload.userRequest || 'N/A'}`,
			`Action Type: ${action}`,
			'',
			'-------------------------',
			'INSTRUCTIONS',
			'-------------------------',
			'Step 1: Analyze architecture, runtime, scripts, services, ports, and dependency boundaries from the given context.',
			'Step 2: Infer required services and production networking for frontend/backend/db/cache/worker split.',
			'Step 3: Produce output specific to the selected action.',
			'Action behavior requirements:',
			'- generate: return production-ready config content for dockerfile, dockerCompose, githubActions, kubernetes, env, with repo-specific commands and service names.',
			'- modify: return updated versions of only the relevant config files and explain what changed with technical precision.',
			'- validate: prioritize validation findings with concrete issues, risks, and fixes in `validation` and concise guidance in `setupInstructions`.',
			'- explain: prioritize human-readable architecture explanation in `explanation` and implementation guidance in `setupInstructions`.',
			'',
			'-------------------------',
			'RULES',
			'-------------------------',
			'- Use best practices (security, scalability, observability).',
			'- Avoid hardcoding secrets. Use environment variables.',
			'- Keep configs clean and readable, but fully executable.',
			'- Do not invent files/services that conflict with detected repository layout.',
			'- Use real script commands from detected package/tooling context whenever provided.',
			'- Use concrete ports/env keys only when inferred; if unknown, state assumption in setupInstructions.',
			'- Every JSON value must be a string (no arrays, no objects).',
			'- For irrelevant keys, return exactly "Not required".',
			'',
			'IMPORTANT: Return strict JSON with the following exact keys: dockerfile, dockerCompose, githubActions, kubernetes, env, validation, explanation, setupInstructions.',
			'Response must contain meaningful content for the selected action and must not be empty.'
		].join('\n');

		try {
			const raw = await this.generateJson<Partial<CicdOutput>>(prompt);
			return this.normalizeCicdOutput(raw, action, payload);
		} catch (error) {
			console.error('AI CI/CD generation failed, using heuristic templates:', error);
			return this.normalizeCicdOutput(this.heuristicCicdTemplates(payload), action, payload);
		}
	}

	private heuristicCicdTemplates(payload: CicdPayload): Partial<CicdOutput> {
		const stack = payload.stackInfo || payload.projectDescription || 'Node.js application';
		const cloud = payload.cloudProvider || 'local';
		return {
			dockerfile: [
				'FROM node:20-alpine AS deps',
				'WORKDIR /app',
				'COPY package*.json ./',
				'RUN npm ci',
				'',
				'FROM node:20-alpine AS builder',
				'WORKDIR /app',
				'COPY --from=deps /app/node_modules ./node_modules',
				'COPY . .',
				'RUN npm run build || true',
				'',
				'FROM node:20-alpine AS runner',
				'WORKDIR /app',
				'ENV NODE_ENV=production',
				'COPY --from=builder /app ./',
				'EXPOSE 3000',
				'CMD ["npm", "start"]',
			].join('\n'),
			dockerCompose: [
				'services:',
				'  app:',
				'    build: .',
				'    ports:',
				'      - "3000:3000"',
				'    environment:',
				'      NODE_ENV: production',
				'      PORT: 3000',
				'    restart: unless-stopped',
				'    healthcheck:',
				'      test: ["CMD", "wget", "-qO-", "http://localhost:3000/"]',
				'      interval: 20s',
				'      timeout: 5s',
				'      retries: 5',
			].join('\n'),
			githubActions: [
				'name: CI',
				'on:',
				'  push:',
				'    branches: [main]',
				'  pull_request:',
				'jobs:',
				'  build:',
				'    runs-on: ubuntu-latest',
				'    steps:',
				'      - uses: actions/checkout@v4',
				'      - uses: actions/setup-node@v4',
				'        with:',
				'          node-version: 20',
				'          cache: npm',
				'      - run: npm ci',
				'      - run: npm test --if-present',
				'      - run: npm run build --if-present',
			].join('\n'),
			kubernetes: [
				'apiVersion: apps/v1',
				'kind: Deployment',
				'metadata:',
				'  name: app',
				'spec:',
				'  replicas: 2',
				'  selector:',
				'    matchLabels:',
				'      app: app',
				'  template:',
				'    metadata:',
				'      labels:',
				'        app: app',
				'    spec:',
				'      containers:',
				'        - name: app',
				'          image: app:latest',
				'          ports:',
				'            - containerPort: 3000',
				'          readinessProbe:',
				'            httpGet:',
				'              path: /',
				'              port: 3000',
			].join('\n'),
			env: 'PORT=3000\nNODE_ENV=production',
			validation: this.heuristicValidation(payload),
			explanation: [
				`Generated production-oriented templates for ${stack}.`,
				`Target environment hint: ${cloud}.`,
				'Docker multi-stage build, compose healthcheck, GitHub Actions CI, and a basic Kubernetes deployment are included.',
			].join('\n'),
			setupInstructions: [
				'1. Save Dockerfile, compose, and workflow files into the repository.',
				'2. Set required secrets in GitHub Actions.',
				'3. Validate with `docker compose config` and a feature-branch CI run.',
			].join('\n'),
		};
	}

	private heuristicReview(code: string, language: string): ReviewOutput {
		const bugs: string[] = [];
		const improvements: string[] = [];
		const optimizations: string[] = [];
		const lines = code.split(/\r?\n/);
		const lower = code.toLowerCase();

		if (!code.trim()) {
			return {
				bugs: ['No code was provided for review.'],
				improvements: ['Paste a code snippet to receive actionable findings.'],
				optimizations: [],
			};
		}

		lines.forEach((line, index) => {
			const n = index + 1;
			if (/eval\s*\(/.test(line)) {
				bugs.push(`Line ${n}: Avoid eval(); it enables code injection.`);
			}
			if (/innerHTML\s*=/.test(line) && !/DOMPurify|sanitize/i.test(line)) {
				bugs.push(`Line ${n}: Assigning to innerHTML without sanitization risks XSS.`);
			}
			if (/password\s*=\s*['"][^'"]+['"]/i.test(line) || /api[_-]?key\s*=\s*['"][^'"]+['"]/i.test(line)) {
				bugs.push(`Line ${n}: Hardcoded secret detected; move credentials to environment variables.`);
			}
			if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(line) || /catch\s*\{\s*\}/.test(line)) {
				bugs.push(`Line ${n}: Empty catch block swallows errors; log or rethrow.`);
			}
			if (/console\.(log|debug|info)\s*\(/.test(line)) {
				improvements.push(`Line ${n}: Replace console logging with a structured logger in production paths.`);
			}
			if (/any\b/.test(line) && /typescript|ts|tsx/i.test(language)) {
				improvements.push(`Line ${n}: Prefer a concrete type over \`any\` for safer refactoring.`);
			}
			if (/TODO|FIXME|HACK/.test(line)) {
				improvements.push(`Line ${n}: Resolve outstanding ${line.match(/TODO|FIXME|HACK/)?.[0]} marker before shipping.`);
			}
			if (/SELECT\s+\*\s+FROM/i.test(line)) {
				optimizations.push(`Line ${n}: Prefer explicit column lists instead of SELECT * for clearer contracts and less IO.`);
			}
			if (/for\s*\(\s*let\s+\w+\s*=\s*0/.test(line) && /length/.test(code)) {
				optimizations.push(`Line ${n}: Consider map/filter/reduce or cached length for hot loops when readability allows.`);
			}
		});

		if (/var\s+\w+/.test(code) && /javascript|typescript|js|ts/i.test(language)) {
			improvements.push('Prefer const/let over var to avoid function-scoped leakage.');
		}
		if (!/try\s*\{/.test(code) && /(fetch|axios|http|await)/i.test(code)) {
			improvements.push('Async/network calls appear without try/catch; add explicit error handling.');
		}
		if (/password|token|secret/i.test(lower) && !/process\.env|getenv|configservice/i.test(lower)) {
			improvements.push('Sensitive identifiers appear without env/config usage; confirm secrets are never committed.');
		}
		if (lines.length > 120) {
			optimizations.push('Large snippet detected; split into smaller pure functions for easier testing and review.');
		}
		if (bugs.length === 0) {
			bugs.push('No high-confidence defect patterns matched in this snippet.');
		}
		if (improvements.length === 0) {
			improvements.push(`Add unit tests covering happy path and failure cases for this ${language} code.`);
		}
		if (optimizations.length === 0) {
			optimizations.push('Profile hot paths and add input validation at trust boundaries.');
		}

		return {
			bugs: bugs.slice(0, 12),
			improvements: improvements.slice(0, 12),
			optimizations: optimizations.slice(0, 12),
		};
	}

	private heuristicDebug(errorLog: string): DebugOutput {
		const log = errorLog.trim();
		if (!log) {
			return {
				explanation: 'No error log was provided.',
				rootCause: 'Empty input',
				fixSteps: ['Paste the full stack trace or error message and retry.'],
			};
		}

		const patterns: Array<{ match: RegExp; explanation: string; rootCause: string; steps: string[] }> = [
			{
				match: /ECONNREFUSED|connect ECONNREFUSED/i,
				explanation: 'The process tried to open a TCP connection and the target refused it, usually because the dependency is down or the host/port is wrong.',
				rootCause: 'Upstream service unreachable on the configured host/port',
				steps: [
					'Confirm the dependency (DB, Redis, API) is running.',
					'Verify host/port in env vars match the live service.',
					'Check firewall/docker network connectivity between services.',
					'Retry after the dependency healthcheck is green.',
				],
			},
			{
				match: /ENOTFOUND|getaddrinfo/i,
				explanation: 'DNS resolution failed for a hostname referenced by the application.',
				rootCause: 'Invalid or unreachable hostname',
				steps: [
					'Validate the hostname spelling in configuration.',
					'Check local DNS / container DNS settings.',
					'Use an IP or service name that exists on the current network.',
				],
			},
			{
				match: /EADDRINUSE|address already in use/i,
				explanation: 'The server attempted to bind a port that is already occupied.',
				rootCause: 'Port conflict',
				steps: [
					'Identify the process holding the port and stop it, or choose another PORT.',
					'Ensure only one instance of the service is running locally.',
				],
			},
			{
				match: /JWT|unauthorized|401|invalid token|TokenExpired/i,
				explanation: 'Authentication failed while validating a bearer/session token.',
				rootCause: 'Missing, expired, or incorrectly signed JWT/credentials',
				steps: [
					'Log in again to obtain a fresh access token.',
					'Confirm JWT_SECRET and issuer/audience match between issuer and verifier.',
					'Ensure the Authorization header uses `Bearer <token>`.',
				],
			},
			{
				match: /Prisma|P1001|P2021|P2002|migration/i,
				explanation: 'A database access or schema mismatch error was raised by Prisma/Postgres.',
				rootCause: 'Database connectivity or schema drift',
				steps: [
					'Verify DATABASE_URL and that Postgres is reachable.',
					'Run `npx prisma migrate deploy` to align schema.',
					'Inspect unique constraints if this is a duplicate-key (P2002) failure.',
				],
			},
			{
				match: /Cannot find module|MODULE_NOT_FOUND/i,
				explanation: 'Node could not resolve a required package or local file.',
				rootCause: 'Missing dependency or incorrect import path',
				steps: [
					'Run `npm ci` / `npm install` in the package that failed.',
					'Confirm the import path and that the file exists after build.',
					'Rebuild if the missing module is a compile output.',
				],
			},
			{
				match: /TypeError:\s*Cannot read propert(y|ies) of (undefined|null)/i,
				explanation: 'Code accessed a property on a null/undefined value.',
				rootCause: 'Missing null-check on optional data',
				steps: [
					'Inspect the stack frame line and guard optional values.',
					'Validate API/DB responses before nested property access.',
					'Add a regression test for the empty/partial payload case.',
				],
			},
			{
				match: /OutOfMemory|JavaScript heap out of memory|ENOMEM/i,
				explanation: 'The process exhausted available memory while handling the workload.',
				rootCause: 'Memory pressure / unbounded allocation',
				steps: [
					'Raise Node heap only as a temporary mitigation (`NODE_OPTIONS=--max-old-space-size`).',
					'Stream large payloads instead of buffering entire files in memory.',
					'Look for leaks in caches, event listeners, or unbounded arrays.',
				],
			},
			{
				match: /CORS|Not allowed by CORS/i,
				explanation: 'The browser blocked a cross-origin request based on server CORS policy.',
				rootCause: 'Frontend origin not allow-listed by the API',
				steps: [
					'Add the frontend origin to FRONTEND_URL / CORS_ORIGINS.',
					'Restart the API after updating CORS configuration.',
					'Confirm the browser is calling the expected API base URL.',
				],
			},
			{
				match: /timeout|ETIMEDOUT|TimeoutError/i,
				explanation: 'An operation exceeded its allotted time waiting for a response.',
				rootCause: 'Slow or hung dependency / insufficient timeout budget',
				steps: [
					'Identify which call timed out from the stack/log context.',
					'Check dependency latency and connection pools.',
					'Increase timeout only after confirming the dependency is healthy.',
				],
			},
		];

		const hit = patterns.find((pattern) => pattern.match.test(log));
		if (hit) {
			return {
				explanation: hit.explanation,
				rootCause: hit.rootCause,
				fixSteps: hit.steps,
			};
		}

		const firstLine = log.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? 'Unknown error';
		return {
			explanation: `Heuristic analysis of the provided log. Leading signal: ${firstLine.slice(0, 240)}`,
			rootCause: 'Unrecognized error pattern — needs stack-context correlation',
			fixSteps: [
				'Capture the full stack trace including the first application frame.',
				'Reproduce with the same env vars and input payload.',
				'Search logs for the same error code around the failure timestamp.',
				'Add OPENAI_API_KEY for deeper LLM-assisted diagnosis when heuristics are insufficient.',
			],
		};
	}

	private normalizeAction(actionType?: string): CicdAction {
		if (actionType === 'modify' || actionType === 'validate' || actionType === 'explain') {
			return actionType;
		}

		return 'generate';
	}

	private stringifyValue(value: unknown): string {
		if (typeof value === 'string') {
			return value.trim();
		}

		if (value == null) {
			return '';
		}

		if (Array.isArray(value)) {
			return value.map((item) => `- ${String(item)}`).join('\n').trim();
		}

		if (typeof value === 'object') {
			try {
				return JSON.stringify(value, null, 2);
			} catch {
				return String(value);
			}
		}

		return String(value).trim();
	}

	private heuristicValidation(payload: CicdPayload): string {
		const source = `${payload.existingConfig ?? ''}\n${payload.userRequest ?? ''}`.toLowerCase();
		const findings: string[] = [];

		if (!payload.existingConfig?.trim()) {
			findings.push('No existing configuration was provided; paste Dockerfile, compose, or workflow YAML for file-level validation.');
		}

		if (!source.includes('healthcheck')) {
			findings.push('Missing health checks; add container and service health probes to improve reliability.');
		}

		if (!source.includes('read_only')) {
			findings.push('Containers may run with writable root filesystem; consider read-only rootfs where possible.');
		}

		if (!source.includes('restart:')) {
			findings.push('No restart policy detected; add restart policy to improve recovery behavior.');
		}

		if (!source.includes('resource') && !source.includes('limits')) {
			findings.push('Resource limits are not visible; define CPU and memory limits to prevent noisy-neighbor issues.');
		}

		if (findings.length === 0) {
			return 'No critical issues detected from the provided input. Recommended next step: run security scanning (Trivy/Snyk), lint workflows, and execute smoke tests in CI.';
		}

		return findings.join('\n');
	}

	private heuristicExplanation(payload: CicdPayload): string {
		const stack = payload.stackInfo?.trim() || payload.projectDescription?.trim() || 'your application stack';
		const cloud = payload.cloudProvider?.trim() || 'your target cloud';
		return [
			`This CI/CD plan containerizes ${stack} using Docker, then builds and tests on every push via GitHub Actions.`,
			`Deployment targets ${cloud} with environment-driven configuration to avoid hardcoded secrets.`,
			'Kubernetes manifests are intended for scalable runtime deployment, while docker-compose is optimized for local/dev environments.',
			'Use branch protections, required checks, and staged environments (dev/staging/prod) before production rollout.',
		].join('\n');
	}

	private normalizeCicdOutput(raw: Partial<CicdOutput>, action: CicdAction, payload: CicdPayload): CicdOutput {
		const dockerfile = this.stringifyValue(raw.dockerfile);
		const dockerCompose = this.stringifyValue(raw.dockerCompose);
		const githubActions = this.stringifyValue(raw.githubActions);
		const kubernetes = this.stringifyValue(raw.kubernetes);
		const env = this.stringifyValue(raw.env);
		let validation = this.stringifyValue(raw.validation);
		let explanation = this.stringifyValue(raw.explanation);
		let setupInstructions = this.stringifyValue(raw.setupInstructions);

		if (action === 'validate' && !validation) {
			validation = this.heuristicValidation(payload);
		}

		if (action === 'explain' && !explanation) {
			explanation = this.heuristicExplanation(payload);
		}

		if (!setupInstructions) {
			setupInstructions = [
				'1. Save generated files in the repository root or service folder.',
				'2. Validate locally with docker compose config and workflow linting.',
				'3. Run CI on a feature branch before merging to main.',
			].join('\n');
		}

		const keepConfigs = action === 'generate' || action === 'modify';

		return {
			dockerfile: keepConfigs ? dockerfile || 'Not required' : 'Not required',
			dockerCompose: keepConfigs ? dockerCompose || 'Not required' : 'Not required',
			githubActions: keepConfigs ? githubActions || 'Not required' : 'Not required',
			kubernetes: keepConfigs ? kubernetes || 'Not required' : 'Not required',
			env: keepConfigs ? env || 'Not required' : 'Not required',
			validation: validation || (action === 'validate' ? this.heuristicValidation(payload) : 'Not required'),
			explanation: explanation || (action === 'explain' ? this.heuristicExplanation(payload) : 'Not required'),
			setupInstructions,
		};
	}

	private async generateJson<T>(prompt: string): Promise<T> {
		try {
			const response = await this.client!.chat.completions.create({
				model: this.model,
				temperature: 0.2,
				max_tokens: 1800,
				
				messages: [
					{
						role: 'system',
						content: 'Always return ONLY valid JSON. Do not include any conversational text or markdown formatting. Output must start with { and end with }.',
					},
					{ role: 'user', content: prompt },
				],
			});

			const content = response.choices[0]?.message?.content;

			if (!content) {
				throw new InternalServerErrorException('Empty AI response');
			}

			const cleanContent = this.stripCodeFence(content.trim());

			try {
				return this.parseJsonWithFallback<T>(cleanContent);
			} catch {
				const repaired = await this.repairJsonContent(cleanContent);
				return this.parseJsonWithFallback<T>(repaired);
			}
		} catch (error) {
			console.error('AI Request Error:', error);
			throw new InternalServerErrorException(
				`AI request failed: ${error instanceof Error ? error.message : 'unknown error'}`,
			);
		}
	}

	private async repairJsonContent(brokenJson: string): Promise<string> {
		const response = await this.client!.chat.completions.create({
			model: this.model,
			temperature: 0,
			max_tokens: 1800,
			messages: [
				{
					role: 'system',
					content:
						'Return only valid JSON. Do not include markdown, comments, or explanation. Preserve original meaning.',
				},
				{
					role: 'user',
					content: [
						'The following content should be JSON but is invalid.',
						'Fix it and return ONLY valid JSON.',
						'',
						brokenJson,
					].join('\n'),
				},
			],
		});

		const content = response.choices[0]?.message?.content?.trim();
		if (!content) {
			throw new InternalServerErrorException('AI JSON repair failed: empty response');
		}

		return this.stripCodeFence(content);
	}

	private stripCodeFence(text: string) {
		if (text.startsWith('```json')) {
			return text.replace(/^```json\n?/, '').replace(/```$/, '').trim();
		}

		if (text.startsWith('```')) {
			return text.replace(/^```\n?/, '').replace(/```$/, '').trim();
		}

		return text;
	}

	private parseJsonWithFallback<T>(text: string): T {
		const normalized = this.normalizeJsonText(text);

		const direct = this.tryParseJson<T>(normalized);
		if (direct !== undefined) {
			return direct;
		}

		// Some models return a JSON string containing escaped JSON.
		const nested = this.tryParseNestedJsonString<T>(normalized);
		if (nested !== undefined) {
			return nested;
		}

		const candidates = this.extractJsonObjectCandidates(normalized);
		for (const candidate of candidates) {
			const parsed = this.tryParseJson<T>(candidate);
			if (parsed !== undefined) {
				return parsed;
			}
		}

		console.error('AI JSON Parse Error: unable to parse content', normalized);
		throw new InternalServerErrorException('AI returned invalid JSON');
	}

	private normalizeJsonText(text: string): string {
		return text
			.replace(/[\u201C\u201D]/g, '"')
			.replace(/[\u2018\u2019]/g, "'")
			.trim();
	}

	private tryParseJson<T>(raw: string): T | undefined {
		const candidates = [
			raw,
			raw.replace(/,\s*([}\]])/g, '$1'),
		];

		for (const candidate of candidates) {
			try {
				return JSON.parse(candidate) as T;
			} catch {
				// Continue trying fallback variants.
			}
		}

		return undefined;
	}

	private tryParseNestedJsonString<T>(raw: string): T | undefined {
		try {
			const outer = JSON.parse(raw);
			if (typeof outer !== 'string') {
				return undefined;
			}
			return this.tryParseJson<T>(outer);
		} catch {
			return undefined;
		}
	}

	private extractJsonObjectCandidates(text: string): string[] {
		const results: string[] = [];
		let depth = 0;
		let start = -1;
		let inString = false;
		let escaped = false;

		for (let i = 0; i < text.length; i += 1) {
			const ch = text[i];

			if (inString) {
				if (escaped) {
					escaped = false;
					continue;
				}
				if (ch === '\\') {
					escaped = true;
					continue;
				}
				if (ch === '"') {
					inString = false;
				}
				continue;
			}

			if (ch === '"') {
				inString = true;
				continue;
			}

			if (ch === '{') {
				if (depth === 0) {
					start = i;
				}
				depth += 1;
				continue;
			}

			if (ch === '}') {
				if (depth > 0) {
					depth -= 1;
					if (depth === 0 && start !== -1) {
						results.push(text.slice(start, i + 1));
						start = -1;
					}
				}
			}
		}

		return results.sort((a, b) => b.length - a.length);
	}
}