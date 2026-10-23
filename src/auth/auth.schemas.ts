import { z } from 'zod';

const credentials = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[A-Za-z0-9_]+$/, '用户名只能包含英文字母、数字和下划线'),
  password: z
    .string()
    .min(8)
    .refine(
      (value) => Buffer.byteLength(value, 'utf8') <= 72,
      '密码最多为 72 字节',
    ),
});

export const registerSchema = credentials;
export const loginSchema = credentials;
export type Credentials = z.infer<typeof credentials>;
