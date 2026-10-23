import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiUnauthorizedResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../auth/authenticated-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  articleIdSchema,
  articleListSchema,
  ArticleIdParams,
  ArticleListQuery,
  CreateArticleInput,
  createArticleSchema,
  UpdateArticleInput,
  updateArticleSchema,
} from './post.schemas';
import { PostService } from './post.service';

@ApiTags('文章')
@Controller(['posts', 'api/articles'])
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Get()
  @ApiOperation({ summary: '分页获取文章列表（公开）' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, example: 10 })
  @ApiQuery({ name: 'keyword', required: false })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'] })
  @ApiOkResponse({ description: '文章列表和分页信息' })
  findAll(
    @Query(new ZodValidationPipe(articleListSchema))
    query: ArticleListQuery,
  ) {
    return this.postService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取文章详情（公开）' })
  @ApiParam({ name: 'id', description: '文章 ID', type: Number })
  @ApiOkResponse({ description: '文章和作者信息' })
  findOne(
    @Param(new ZodValidationPipe(articleIdSchema)) params: ArticleIdParams,
  ) {
    return this.postService.findOne(params.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建文章（需要登录）' })
  @ApiBody({
    schema: {
      example: {
        title: 'NestJS 入门',
        content: '文章正文',
        coverImageUrl: 'https://example.com/cover.png',
      },
      type: 'object',
      required: ['title', 'content'],
      properties: {
        title: { type: 'string', maxLength: 200 },
        content: { type: 'string', maxLength: 1000000 },
        coverImageUrl: { type: 'string', maxLength: 500 },
      },
    },
  })
  @ApiCreatedResponse({ description: '创建后的文章及作者信息' })
  @ApiUnauthorizedResponse({ description: '需要有效的 Bearer JWT' })
  create(
    @Body(new ZodValidationPipe(createArticleSchema)) body: CreateArticleInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.postService.create(body, user.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新本人文章（需要登录）' })
  @ApiParam({ name: 'id', description: '文章 ID', type: Number })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', maxLength: 200 },
        content: { type: 'string', maxLength: 1000000 },
        coverImageUrl: { type: 'string', maxLength: 500 },
      },
      example: { title: '更新后的标题' },
    },
  })
  @ApiOkResponse({ description: '更新后的文章' })
  @ApiUnauthorizedResponse({ description: '需要有效的 Bearer JWT' })
  update(
    @Param(new ZodValidationPipe(articleIdSchema)) params: ArticleIdParams,
    @Body(new ZodValidationPipe(updateArticleSchema)) body: UpdateArticleInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.postService.update(params.id, user, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除本人文章（需要登录）' })
  @ApiParam({ name: 'id', description: '文章 ID', type: Number })
  @ApiOkResponse({ description: '已删除文章的 ID' })
  @ApiUnauthorizedResponse({ description: '需要有效的 Bearer JWT' })
  remove(
    @Param(new ZodValidationPipe(articleIdSchema)) params: ArticleIdParams,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.postService.remove(params.id, user);
  }
}
