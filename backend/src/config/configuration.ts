export default () => ({
	nodeEnv: process.env.NODE_ENV ?? 'development',
	port: Number(process.env.PORT ?? 4000),
	frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
	corsOrigins: process.env.CORS_ORIGINS ?? process.env.FRONTEND_URL ?? 'http://localhost:3000',
	databaseUrl: process.env.DATABASE_URL,
	dbPoolMax: Number(process.env.DB_POOL_MAX ?? 20),
	dbIdleTimeoutMs: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30000),
	dbConnectionTimeoutMs: Number(process.env.DB_CONNECTION_TIMEOUT_MS ?? 10000),
	jwtSecret: process.env.JWT_SECRET,
	openAiApiKey: process.env.OPENAI_API_KEY,
	openAiBaseUrl: process.env.OPENAI_BASE_URL,
	openAiModel: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
	github: {
		clientId: process.env.GITHUB_CLIENT_ID ?? '',
		clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
		redirectUri: process.env.GITHUB_REDIRECT_URI ?? process.env.GITHUB_REDIRECT_URL ?? '',
	},
});
