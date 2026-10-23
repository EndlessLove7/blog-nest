import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/authenticated-user';
import {
  ArticleListQuery,
  CreateArticleInput,
  UpdateArticleInput,
} from './post.schemas';

const articleInclude = {
  author: { select: { id: true, username: true } },
} satisfies Prisma.ArticleInclude;

@Injectable()
export class PostService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ArticleListQuery) {
    const where: Prisma.ArticleWhereInput = query.keyword
      ? {
          OR: [
            { title: { contains: query.keyword } },
            { content: { contains: query.keyword } },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.article.findMany({
        where,
        orderBy: [
          { createdAt: query.order },
          { id: query.order },
        ],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: articleInclude,
      }),
      this.prisma.article.count({ where }),
    ]);
    return {
      items,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async findOne(id: number) {
    const article = await this.prisma.article.findUnique({
      where: { id },
      include: articleInclude,
    });
    if (!article) {
      throw new NotFoundException('文章不存在');
    }
    return article;
  }

  create(input: CreateArticleInput, userId: number) {
    return this.prisma.article.create({
      data: { ...input, userId },
      include: articleInclude,
    });
  }

  async update(id: number, user: AuthenticatedUser, input: UpdateArticleInput) {
    const result = await this.prisma.article.updateMany({
      where: { id, userId: user.id },
      data: input,
    });
    if (result.count === 0) {
      throw new NotFoundException('文章不存在或无权修改');
    }
    return this.findOne(id);
  }

  async remove(id: number, user: AuthenticatedUser) {
    const result = await this.prisma.article.deleteMany({
      where: { id, userId: user.id },
    });
    if (result.count === 0) {
      throw new NotFoundException('文章不存在或无权删除');
    }
    return { id };
  }
}
