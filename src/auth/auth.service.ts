import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { Credentials } from './auth.schemas';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(input: Credentials) {
    const username = input.username.toLowerCase();
    const passwordHash = await hash(input.password, 12);
    return this.prisma.user.create({
      data: { username, passwordHash },
      select: { id: true, username: true, createdAt: true },
    });
  }

  async login(input: Credentials) {
    const user = await this.prisma.user.findUnique({
      where: { username: input.username.toLowerCase() },
    });
    if (!user || !(await compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const token = await this.jwtService.signAsync({ sub: user.id });
    return {
      token,
      user: { id: user.id, username: user.username, createdAt: user.createdAt },
    };
  }
}
