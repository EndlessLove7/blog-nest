import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedRequest } from './authenticated-user';

interface JwtPayload {
  sub: number;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const match = authorization?.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      throw new UnauthorizedException('请先登录');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(match[1]);
    } catch {
      throw new UnauthorizedException('登录凭证无效或已过期');
    }

    if (
      typeof payload !== 'object' ||
      payload === null ||
      !Number.isInteger(payload.sub)
    ) {
      throw new UnauthorizedException('登录凭证无效或已过期');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, username: true, createdAt: true },
    });
    if (!user) {
      throw new UnauthorizedException('登录凭证对应的用户不存在');
    }

    request.user = user;
    return true;
  }
}
