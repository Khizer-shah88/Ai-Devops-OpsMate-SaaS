import {
	ArgumentsHost,
	Catch,
	ExceptionFilter,
	HttpException,
	HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
	catch(exception: unknown, host: ArgumentsHost): void {
		const ctx = host.switchToHttp();
		const request = ctx.getRequest<Request>();
		const response = ctx.getResponse<Response>();

		const isHttpException = exception instanceof HttpException;
		const status = isHttpException
			? exception.getStatus()
			: HttpStatus.INTERNAL_SERVER_ERROR;

		const exceptionResponse = isHttpException ? exception.getResponse() : null;
		let message: string | string[] = 'Internal server error';

		if (typeof exceptionResponse === 'string') {
			message = exceptionResponse;
		} else if (
			exceptionResponse &&
			typeof exceptionResponse === 'object' &&
			'message' in exceptionResponse
		) {
			message =
				(exceptionResponse as { message?: string | string[] }).message ?? message;
		}

		response.status(status).json({
			statusCode: status,
			message,
			path: request.url,
			method: request.method,
			timestamp: new Date().toISOString(),
			requestId: response.getHeader('x-request-id') || null,
		});
	}
}
