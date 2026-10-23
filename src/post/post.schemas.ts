import { z } from 'zod';

export const articleIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const coverImageUrlSchema = z
  .string()
  .max(500)
  .refine((value) => {
    if (value.startsWith('/')) {
      return /^\/uploads\/[A-Za-z0-9-]+\.(jpg|png|webp)$/i.test(value);
    }
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }, '封面地址必须为有效 URL 或本地上传路径');

export const articleListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  keyword: z.string().trim().max(100).optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const createArticleSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().min(1).max(1_000_000),
  coverImageUrl: coverImageUrlSchema.optional(),
});

export const updateArticleSchema = createArticleSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, '至少提供一个需要修改的字段');

export type ArticleIdParams = z.infer<typeof articleIdSchema>;
export type ArticleListQuery = z.infer<typeof articleListSchema>;
export type CreateArticleInput = z.infer<typeof createArticleSchema>;
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;
