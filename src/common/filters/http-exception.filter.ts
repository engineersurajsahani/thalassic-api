import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { createLogger } from '../logger';

interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
  timestamp: string;
  path?: string;
  requestId?: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = createLogger('GlobalExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status: number;
    let errorMessage: string | string[];
    let errorType: string = 'UnknownError';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        errorMessage = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, unknown>;
        errorMessage = (resp.message as string | string[]) || exception.message;
        errorType = (resp.error as string) || 'HttpException';
      } else {
        errorMessage = exception.message;
      }
      errorType = errorType || exception.name;
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorMessage = exception.message;
      errorType = exception.name;
      this.logger.error(exception, 'Unhandled Error');
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorMessage = 'Internal server error';
      errorType = 'UnknownError';
    }

    const errorResponse: ErrorResponse = {
      statusCode: status,
      message: errorMessage,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: (request as any).requestId,
    };

    if (errorType && status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      errorResponse.error = errorType;
    }

    response.status(status).json(errorResponse);
  }
}
