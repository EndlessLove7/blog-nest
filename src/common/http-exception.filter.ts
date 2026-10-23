import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = this.mapPrismaError(exception);
      response.status(mapped.status).json({
        code: mapped.status,
        data: null,
        msg: mapped.message,
      });
      return;
    }

    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;
    const body =
      exception instanceof HttpException ? exception.getResponse() : undefined;

    if (status >= 500) {
      this.logger.error(
        `Request failed: ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const responseBody =
      typeof body === 'object' && body !== null
        ? (body as Record<string, unknown>)
        : undefined;
    const issueList = responseBody?.issues;
    const originalMessage = responseBody?.message;
    const message =
      Array.isArray(originalMessage) && originalMessage.every((item) => typeof item === 'string')
        ? originalMessage.join(', ')
        : typeof originalMessage === 'string'
          ? originalMessage
          : status >= 500
            ? '服务器内部错误'
            : typeof body === 'string'
              ? body
              : '请求失败';

    response.status(status).json({
      code: status,
      data: Array.isArray(issueList) ? issueList : null,
      msg: message,
    });
  }

  private mapPrismaError(
    error: Prisma.PrismaClientKnownRequestError,
  ): { status: number; message: string } {
    if (error.code === 'P2002') {
      return { status: 409, message: '用户名已被注册' };
    }
    if (error.code === 'P2025') {
      return { status: 404, message: '资源不存在' };
    }
    if (error.code === 'P2003') {
      return { status: 400, message: '关联资源不存在' };
    }
    this.logger.error('Database request failed', error.stack);
    return { status: 500, message: '服务器内部错误' };
  }
}
