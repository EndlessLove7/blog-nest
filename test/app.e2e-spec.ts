import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

interface TestUser {
  id: number;
  username: string;
  passwordHash: string;
  createdAt: Date;
}

interface TestArticle {
  id: number;
  title: string;
  content: string;
  coverImageUrl?: string;
  userId: number;
  createdAt: Date;
  updatedAt: Date;
}

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const users: TestUser[] = [];
    const articles: TestArticle[] = [];
    let nextUserId = 1;
    let nextArticleId = 1;
    const prismaMock = {
      user: {
        create: jest.fn(
          async ({
            data,
            select,
          }: {
            data: { username: string; passwordHash: string };
            select?: { id: boolean; username: boolean; createdAt: boolean };
          }) => {
            const user = {
              id: nextUserId++,
              ...data,
              createdAt: new Date(),
            };
            users.push(user);
            return select
              ? {
                  id: user.id,
                  username: user.username,
                  createdAt: user.createdAt,
                }
              : user;
          },
        ),
        findUnique: jest.fn(
          async ({
            where,
            select,
          }: {
            where: { id?: number; username?: string };
            select?: { id: boolean; username: boolean; createdAt: boolean };
          }) => {
            const user = users.find(
              (item) =>
                item.id === where.id || item.username === where.username,
            );
            if (!user) {
              return null;
            }
            return select
              ? {
                  id: user.id,
                  username: user.username,
                  createdAt: user.createdAt,
                }
              : user;
          },
        ),
      },
      article: {
        findMany: jest.fn(async () =>
          articles.map((article) => ({
            ...article,
            author: users.find((user) => user.id === article.userId),
          })),
        ),
        count: jest.fn(async () => articles.length),
        findUnique: jest.fn(async ({ where }: { where: { id: number } }) => {
          const article = articles.find((item) => item.id === where.id);
          return article
            ? {
                ...article,
                author: users.find((user) => user.id === article.userId),
              }
            : null;
        }),
        create: jest.fn(
          async ({
            data,
          }: {
            data: {
              title: string;
              content: string;
              coverImageUrl?: string;
              userId: number;
            };
          }) => {
            const article = {
              id: nextArticleId++,
              ...data,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            articles.push(article);
            return {
              ...article,
              author: users.find((user) => user.id === article.userId),
            };
          },
        ),
        updateMany: jest.fn(
          async ({
            where,
            data,
          }: {
            where: { id: number; userId: number };
            data: Partial<TestArticle>;
          }) => {
            const article = articles.find(
              (item) =>
                item.id === where.id && item.userId === where.userId,
            );
            if (!article) {
              return { count: 0 };
            }
            Object.assign(article, data);
            return { count: 1 };
          },
        ),
        deleteMany: jest.fn(
          async ({ where }: { where: { id: number; userId: number } }) => {
            const index = articles.findIndex(
              (item) =>
                item.id === where.id && item.userId === where.userId,
            );
            if (index === -1) {
              return { count: 0 };
            }
            articles.splice(index, 1);
            return { count: 1 };
          },
        ),
      },
    };
    const moduleBuilder = Test.createTestingModule({
      imports: [AppModule],
    });
    moduleBuilder
      .overrideProvider(PrismaService)
      .useValue(prismaMock);
    const moduleFixture: TestingModule = await moduleBuilder.compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect({
        code: 0,
        data: 'Hello World!',
        msg: '请求成功',
      });
  });

  it('registers, authenticates, and protects article CRUD', async () => {
    const credentials = {
      username: 'test_user',
      password: 'test-password-123',
    };
    const registered = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(credentials)
      .expect(201);
    expect(registered.body.data.passwordHash).toBeUndefined();

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(credentials)
      .expect(200);
    const token = login.body.data.token as string;

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.username).toBe(credentials.username);
        expect(body.data.passwordHash).toBeUndefined();
      });

    await request(app.getHttpServer())
      .post('/api/articles')
      .send({ title: 'Protected', content: 'Needs a token' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/articles')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '', content: 'Invalid title' })
      .expect(400)
      .expect(({ body }) => {
        expect(body.code).toBe(400);
        expect(body.msg).toBe('参数校验失败');
      });

    const created = await request(app.getHttpServer())
      .post('/api/articles')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Protected', content: 'Needs a token' })
      .expect(201);
    const articleId = created.body.data.id as number;

    await request(app.getHttpServer())
      .patch(`/posts/${articleId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated' })
      .expect(200)
      .expect(({ body }) => expect(body.data.title).toBe('Updated'));

    await request(app.getHttpServer())
      .get(`/api/articles/${articleId}`)
      .expect(200)
      .expect(({ body }) =>
        expect(body.data.author.username).toBe(credentials.username),
      );

    await request(app.getHttpServer())
      .delete(`/api/articles/${articleId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(({ body }) => expect(body.data.id).toBe(articleId));
  });

  it('returns the unified validation error shape', async () => {
    await request(app.getHttpServer())
      .get('/api/articles?page=0')
      .expect(400)
      .expect(({ body }) => {
        expect(body.code).toBe(400);
        expect(body.msg).toBe('参数校验失败');
        expect(body.data).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'page' }),
          ]),
        );
      });
  });
});
