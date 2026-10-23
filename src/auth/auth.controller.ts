import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOperation,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from './authenticated-user';
import { AuthService } from './auth.service';
import { Credentials, loginSchema, registerSchema } from './auth.schemas';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

@ApiTags('认证')
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: '注册账号' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['username', 'password'],
      properties: {
        username: { type: 'string', example: 'alice' },
        password: { type: 'string', example: 'password123' },
      },
    },
  })
  @ApiCreatedResponse({ description: '注册成功，返回用户信息（不包含密码哈希）' })
  register(
    @Body(new ZodValidationPipe(registerSchema)) body: Credentials,
  ) {
    return this.authService.register(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '登录并获取 JWT' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['username', 'password'],
      properties: {
        username: { type: 'string', example: 'alice' },
        password: { type: 'string', example: 'password123' },
      },
    },
  })
  @ApiOkResponse({ description: 'JWT 和当前用户信息' })
  @ApiUnauthorizedResponse({ description: '用户名或密码错误' })
  login(@Body(new ZodValidationPipe(loginSchema)) body: Credentials) {
    return this.authService.login(body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前登录用户' })
  @ApiOkResponse({ description: '当前用户信息' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
}
