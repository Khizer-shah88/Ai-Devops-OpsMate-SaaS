export default () => ({
	nodeEnv: process.env.NODE_ENV ?? 'development',
	port: Number(process.env.PORT ?? 4000),
	frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
	databaseUrl: process.env.DATABASE_URL,
	jwtSecret: process.env.JWT_SECRET,
	openAiApiKey: process.env.OPENAI_API_KEY,
	openAiBaseUrl: process.env.OPENAI_BASE_URL,
	openAiModel: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
});
