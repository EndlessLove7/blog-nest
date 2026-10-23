import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, { code: number; data: T; msg: string }>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<{ code: number; data: T; msg: string }> {
    return next.handle().pipe(
      map((data) => ({ code: 0, data, msg: '请求成功' })),
    );
  }
}
