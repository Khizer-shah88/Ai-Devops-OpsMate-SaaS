import {
	CallHandler,
	ExecutionContext,
	Injectable,
	Logger,
	NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
	private readonly logger = new Logger('HTTP');

	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		if (context.getType() !== 'http') {
			return next.handle();
		}

		const request = context.switchToHttp().getRequest<Request>();
		const response = context.switchToHttp().getResponse<Response>();
		const start = Date.now();

		return next.handle().pipe(
			tap({
				next: () => {
					const duration = Date.now() - start;
					const requestId = response.getHeader('x-request-id') || '-';
					this.logger.log(
						`${request.method} ${request.originalUrl} ${response.statusCode} ${duration}ms reqId=${requestId}`,
					);
				},
				error: () => {
					const duration = Date.now() - start;
					const requestId = response.getHeader('x-request-id') || '-';
					this.logger.error(
						`${request.method} ${request.originalUrl} ${response.statusCode || 500} ${duration}ms reqId=${requestId}`,
					);
				},
			}),
		);
	}
}
