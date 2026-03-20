import * as Joi from 'joi';

export const validationSchema = Joi.object({
	NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
	PORT: Joi.number().default(4000),
	FRONTEND_URL: Joi.string().uri().default('http://localhost:3000'),
	DATABASE_URL: Joi.string().required(),
	JWT_SECRET: Joi.when('NODE_ENV', {
		is: 'production',
		then: Joi.string().min(16).required(),
		otherwise: Joi.string().min(16).default('dev_only_secret_change_me_123'),
	}),
	OPENAI_API_KEY: Joi.string().allow('').optional(),
	OPENAI_BASE_URL: Joi.string().uri().allow('').optional(),
	OPENAI_MODEL: Joi.string().default('gpt-4.1-mini'),
});
