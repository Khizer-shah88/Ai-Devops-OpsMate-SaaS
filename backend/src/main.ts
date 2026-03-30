import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { randomUUID } from 'crypto';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.enableShutdownHooks();

  const trustedOrigins = new Set(
    [process.env.FRONTEND_URL, process.env.CORS_ORIGINS]
      .filter(Boolean)
      .flatMap((value) =>
        String(value)
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean),
      ),
  );

  if (trustedOrigins.size === 0) {
    trustedOrigins.add('http://localhost:3000');
  }

  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  app.use((req, res, next) => {
    const requestId = req.headers['x-request-id'] || randomUUID();
    res.setHeader('x-request-id', String(requestId));
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('x-frame-options', 'DENY');
    res.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
    res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('x-xss-protection', '0');
    next();
  });

  const requestBuckets = new Map<string, { count: number; resetAt: number }>();
  app.use((req, res, next) => {
    const now = Date.now();
    const minute = 60_000;
    const key = `${req.ip}:${req.method}:${req.path}`;
    const limit = req.path.startsWith('/auth') ? 20 : 120;
    const current = requestBuckets.get(key);

    if (!current || current.resetAt <= now) {
      requestBuckets.set(key, { count: 1, resetAt: now + minute });
      return next();
    }

    current.count += 1;
    if (current.count > limit) {
      res.setHeader('retry-after', Math.ceil((current.resetAt - now) / 1000));
      return res.status(429).json({
        statusCode: 429,
        message: 'Too many requests. Please retry shortly.',
        requestId: res.getHeader('x-request-id'),
      });
    }

    next();
  });

  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of requestBuckets.entries()) {
      if (value.resetAt <= now) {
        requestBuckets.delete(key);
      }
    }
  }, 60_000).unref();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || trustedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
  });

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`Server is running on port ${port}`);
}
bootstrap();
