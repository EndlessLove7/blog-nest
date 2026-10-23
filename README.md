# Blog Nest

NestJS 博客 API，与同级的 `node-blog` 共用 MySQL 数据库和 Prisma 数据模型。NestJS 版本采用模块、控制器、服务、守卫、拦截器和异常过滤器组织代码。

## 环境与启动

需要 Node.js 20 或更高版本，以及可访问的 MySQL 数据库。将 `.env.example` 复制为 `.env`，填写数据库连接和至少 32 个字符的 JWT 密钥：

```sh
cp .env.example .env
```

设置 `DATABASE_URL` 指向 `node-blog` 使用的数据库。首次建库时可执行迁移；如果同级项目已经应用相同的初始迁移，则不会重复创建表：

```sh
npm install
npm run prisma:generate
npm run db:deploy
npm run start:dev
```

服务默认监听 `http://127.0.0.1:3001`，可通过 `PORT` 修改。Swagger 文档地址为 `http://127.0.0.1:3001/docs`。

数据库模型与 `node-blog` 一致：`User` 保存用户名和密码哈希，`Article` 保存文章并关联作者。密码用 bcrypt 哈希存储；文章删除用户时由数据库级联删除。不要提交 `.env` 或真实凭据。

## 现在的 NestJS 如何分层

当前项目的请求处理流程如下。路由匹配由底层 HTTP 适配器完成；Nest 注册的全局中间件先于路由处理器执行，匹配到路由后再进入 Nest 的请求生命周期：

```text
HTTP 请求
  ↓
HTTP 适配器与全局中间件
（Nest 内置 JSON 请求体解析；当前未配置自定义中间件、CORS 或请求日志）
  ↓
路由匹配：按 HTTP 方法和路径选择 Controller 处理方法
  ↓
路由级中间件（当前未配置）
  ↓
Guard：验证 JWT（受保护的接口）
  ↓
拦截器进入：可在后续处理前执行逻辑
   ↓
Zod 管道：校验请求参数
   ↓
Controller → Service → PrismaService → MySQL
   ↓
拦截器返回：包装成功响应并返回 HTTP 响应

若请求处理过程中抛出异常：
异常过滤器 → 统一错误响应
```

启动入口是 [src/main.ts](./src/main.ts)：创建 Nest 应用、设置 Swagger，并启动 HTTP 监听。访问 `/docs` 可以查看自动生成的接口文档。

[AppModule](./src/app.module.ts) 是应用的根模块，负责加载环境配置、Prisma、认证和文章功能模块，并注册全局异常过滤器与响应拦截器。Nest 的模块（Module）负责组合功能，依赖注入则负责把服务提供给需要它的 Controller 或其他 Service。

各层职责如下：

- **Controller**：定义 HTTP 路由，接收路径、查询和请求体参数，调用 Service，并通过 Swagger 装饰器描述接口。例如 [post.controller.ts](./src/post/post.controller.ts)。
- **Zod 管道（Pipe）**：在 Controller 方法执行前验证和解析输入，校验规则集中在 [post.schemas.ts](./src/post/post.schemas.ts)。无效输入会交给全局异常过滤器转换为统一错误响应。
- **Guard**：在管道和 Controller 方法之前执行。受保护的路由会验证 `Authorization: Bearer <token>`，确认 JWT 有效且对应用户仍存在，并把当前用户提供给后续逻辑。例如 [jwt-auth.guard.ts](./src/auth/jwt-auth.guard.ts)。
- **Service**：封装业务规则和数据库操作。例如文章创建时从已认证用户确定作者，更新和删除时只允许作者本人操作；实现位于 [post.service.ts](./src/post/post.service.ts)。
- **PrismaService**：封装 Prisma Client 的连接生命周期，让 Service 使用类型化的 Prisma API 访问 MySQL；实现位于 [prisma.service.ts](./src/prisma/prisma.service.ts)。
- **全局拦截器和异常过滤器**：[响应拦截器](./src/common/response.interceptor.ts)在 Guard 之后进入处理链，在 Pipe 和 Controller 执行前可运行前置逻辑；成功结果返回时再运行后置逻辑并包装响应。异常不会被成功包装逻辑当作正常结果处理，而由[异常过滤器](./src/common/http-exception.filter.ts)整理为统一错误格式。过滤器只在异常发生时处理，不是正常请求的固定后续步骤。

Nest 的主要生命周期顺序是：中间件 → Guard → 拦截器进入 → Pipe → Controller/Service → 拦截器返回。底层适配器负责路由匹配；如果使用路由级中间件，它会在匹配到对应请求后、Nest Guard 之前执行。Nest 请求生命周期内发生的异常会进入异常处理路径，由异常过滤器生成错误响应；中间件阶段的错误则还取决于底层 HTTP 适配器的错误处理方式。

## 接口

注册与登录接口公开：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/auth/register` | 注册账号，需提供 `username`、`password` |
| `POST` | `/api/auth/login` | 登录并获取 JWT |
| `GET` | `/api/auth/me` | 获取当前用户，需 Bearer JWT |

账号名为 3–32 位英文字母、数字或下划线；密码至少 8 个字符且最多 72 个 UTF-8 字节。用户名会转为小写存储。

文章列表和详情公开；创建、更新和删除需要登录。更新和删除只允许文章作者操作。两个路径前缀均可用：`/api/articles`（与 `node-blog` 一致）和原有的 `/posts`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/articles`、`/posts` | 分页列出文章；支持 `page`、`pageSize`、`keyword`、`order` 查询参数 |
| `GET` | `/api/articles/:id`、`/posts/:id` | 获取文章详情 |
| `POST` | `/api/articles`、`/posts` | 创建文章，需 `title`、`content`，可选 `coverImageUrl`；作者取自 JWT |
| `PATCH` | `/api/articles/:id`、`/posts/:id` | 更新本人文章的标题、内容或封面地址 |
| `DELETE` | `/api/articles/:id`、`/posts/:id` | 删除本人文章 |

登录后在请求头中携带 `Authorization: Bearer <token>`。所有成功响应统一为 `{ "code": 0, "data": ..., "msg": "请求成功" }`；错误响应使用 `{ "code": 状态码, "data": ..., "msg": "错误说明" }`。

## Postman

导入 `postman/blog-nest.postman_collection.json`，运行 **Blog Nest CRUD** collection。Collection 会注册唯一用户名、登录取得 JWT，然后测试用户信息及文章的创建、查询、更新和删除。

## 检查

```sh
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand
```
