import * as Joi from 'joi';

export const validationSchema = Joi.object({
	NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
	PORT: Joi.number().default(4000),
	FRONTEND_URL: Joi.string().uri().default('http://localhost:3000'),
	CORS_ORIGINS: Joi.string().allow('').optional(),
	DATABASE_URL: Joi.string().required(),
	DB_POOL_MAX: Joi.number().integer().min(1).max(100).default(20),
	DB_IDLE_TIMEOUT_MS: Joi.number().integer().min(5000).default(30000),
	DB_CONNECTION_TIMEOUT_MS: Joi.number().integer().min(1000).default(10000),
	JWT_SECRET: Joi.when('NODE_ENV', {
		is: 'production',
		then: Joi.string().min(16).required(),
		otherwise: Joi.string().min(16).default('dev_only_secret_change_me_123'),
	}),
	OPENAI_API_KEY: Joi.string().allow('').optional(),
	OPENAI_BASE_URL: Joi.string().uri().allow('').optional(),
	OPENAI_MODEL: Joi.string().default('gpt-4.1-mini'),
	GITHUB_CLIENT_ID: Joi.string().allow(''),
	GITHUB_CLIENT_SECRET: Joi.string().allow(''),
	GITHUB_REDIRECT_URI: Joi.string().uri().allow(''),
	GITHUB_REDIRECT_URL: Joi.string().uri().allow(''),
});
