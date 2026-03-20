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

		async generateCicd(payload: any): Promise<CicdOutput> {
		if (!this.client) {
			return {
				dockerfile: 'FROM node:20-alpine\nWORKDIR /app\nCOPY . .\nRUN npm ci\nCMD ["npm","start"]',
				dockerCompose: 'version: "3"\nservices:\n  app:\n    build: .\n    ports:\n      - "3000:3000"\n',
				githubActions: 'name: CI\non: [push]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n',
				kubernetes: 'apiVersion: apps/v1\nkind: Deployment\n...',
				env: 'PORT=3000\nNODE_ENV=production',
				validation: 'No validation issues found',
				explanation: 'Explanation of the setup',
				setupInstructions: '1. Configure env\n2. Run docker-compose up',
			};
		}

		const prompt = [
			'You are a senior DevOps engineer, cloud architect, and infrastructure automation expert.',
			'Your job is to intelligently assist with DevOps configurations for real-world production systems.',
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
			`Action Type: ${payload.actionType || 'generate'}`,
			'',
			'-------------------------',
			'INSTRUCTIONS',
			'-------------------------',
			'Step 1: Understand the architecture (frontend, backend, database, services)',
			'Step 2: Based on Action Type:',
			'### IF ACTION_TYPE = "generate"',
			'- Generate complete production-ready setup including Dockerfile, docker-compose, CI/CD, Kubernetes, .env',
			'### IF ACTION_TYPE = "modify"',
			'- Update ONLY the necessary parts. Keep existing structure intact.',
			'### IF ACTION_TYPE = "validate"',
			'- Identify security issues, missing env variables, bad practices, incorrect ports',
			'### IF ACTION_TYPE = "explain"',
			'- Explain each part of the configuration',
			'',
			'-------------------------',
			'RULES',
			'-------------------------',
			'- Use best practices (security, scalability)',
			'- Avoid hardcoding secrets. Use environment variables',
			'- Keep configs clean and readable',
			'',
			'IMPORTANT: Return strict JSON with the following exact keys: dockerfile, dockerCompose, githubActions, kubernetes, env, validation, explanation, setupInstructions.',
			'For keys that are not relevant to the user request or action type, return "Not required" or "Not applicable".'
		].join('\n');

		return this.generateJson<CicdOutput>(prompt);
	}

	private async generateJson<T>(prompt: string): Promise<T> {
		try {
			const response = await this.client!.chat.completions.create({
				model: this.model,
				temperature: 0.2,
				max_tokens: 4000,
				
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

                        let cleanContent = content.trim();
                        if (cleanContent.startsWith('```json')) {
                            cleanContent = cleanContent.replace(/^```json\n?/, '').replace(/```$/, '').trim();
                        } else if (cleanContent.startsWith('```')) {
                            cleanContent = cleanContent.replace(/^```\n?/, '').replace(/```$/, '').trim();
                        }

                        try {
                            return JSON.parse(cleanContent) as T;
                        } catch (parseError) {
                            console.error("AI JSON Parse Error:", parseError, "Content:", cleanContent);
                            throw new InternalServerErrorException('AI returned invalid JSON');
                        }
                } catch (error) {
                        console.error("AI Request Error:", error);
                        throw new InternalServerErrorException(
                                `AI request failed: ${error instanceof Error ? error.message : 'unknown error'}`
                        );
                }
        }
}