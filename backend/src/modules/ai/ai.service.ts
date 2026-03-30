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
								'X-Title': 'DevMate AI',
							}
							: undefined,
			  })
			: null;
	}

	async reviewCode(code: string, language: string): Promise<ReviewOutput> {
		if (!this.client) {
			return {
				bugs: ['OPENAI_API_KEY is not configured. AI output is unavailable.'],
				improvements: ['Set OPENAI_API_KEY to enable rich review insights.'],
				optimizations: ['Use batched linting and static analysis for baseline checks.'],
			};
		}

		const prompt = [
			'You are a senior code reviewer.',
			'Return strict JSON with keys: bugs, improvements, optimizations.',
			'Each value must be an array of concise strings.',
			`Language: ${language}`,
			`Code:\n${code}`,
		].join('\n\n');

		return this.generateJson<ReviewOutput>(prompt);
	}

	async debugError(errorLog: string): Promise<DebugOutput> {
		if (!this.client) {
			return {
				explanation: 'OPENAI_API_KEY is not configured, so AI debugging is disabled.',
				rootCause: 'Missing OpenAI credentials in backend environment.',
				fixSteps: [
					'Set OPENAI_API_KEY in backend environment.',
					'Restart backend service.',
					'Retry the debug request.',
				],
			};
		}

		const prompt = [
			'You are a debugging assistant for production systems.',
			'Return strict JSON with keys: explanation, rootCause, fixSteps.',
			'fixSteps must be an ordered array of actionable steps.',
			`Error log:\n${errorLog}`,
		].join('\n\n');

		return this.generateJson<DebugOutput>(prompt);
	}

		async generateCicd(payload: CicdPayload): Promise<CicdOutput> {
		const action = this.normalizeAction(payload.actionType);

		if (!this.client) {
			return this.normalizeCicdOutput(
			{
				dockerfile: 'FROM node:20-alpine\nWORKDIR /app\nCOPY . .\nRUN npm ci\nCMD ["npm","start"]',
				dockerCompose: 'version: "3"\nservices:\n  app:\n    build: .\n    ports:\n      - "3000:3000"\n',
				githubActions: 'name: CI\non: [push]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n',
				kubernetes: 'apiVersion: apps/v1\nkind: Deployment\n...',
				env: 'PORT=3000\nNODE_ENV=production',
				validation: 'No validation issues found in the provided configuration. Add existing config to perform a deeper analysis.',
				explanation: 'This setup packages your app into containers, orchestrates services with docker-compose, and automates CI with GitHub Actions.',
				setupInstructions: '1. Configure env\n2. Run docker-compose up',
			},
			action,
			payload,
			);
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

		const raw = await this.generateJson<Partial<CicdOutput>>(prompt);
		return this.normalizeCicdOutput(raw, action, payload);
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