import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Blog Nest API')
    .setDescription('与 node-blog 共用 MySQL 数据模型的博客 API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '127.0.0.1');
}
bootstrap();
