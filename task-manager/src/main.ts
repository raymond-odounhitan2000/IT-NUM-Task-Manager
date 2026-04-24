import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config/dist/config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  app.setGlobalPrefix('api', { exclude: ['metrics'] });
  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  app.use(
    helmet({
      contentSecurityPolicy: isProduction ? undefined : false,
    }),
  );
  const allowedOrigins = configService
    .get<string>('ALLOWED_ORIGINS', '')
    .split(',');

  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  if (configService.get<string>('NODE_ENV') !== 'production') {
    const host = configService.get<string>('HOST', 'localhost');
    const description = [
      'API de gestion de tâches',
      '',
      "**Dashboards d'observabilité :**",
      `- [Grafana](http://${host}:3001) — métriques et dashboards`,
      `- [Prometheus](http://${host}:9090) — scraping / requêtes PromQL`,
      `- [cAdvisor](http://${host}:8080) — métriques conteneurs`,
    ].join('\n');

    const config = new DocumentBuilder()
      .setTitle('Task-Manager API')
      .setDescription(description)
      .setVersion('1.0')
      .addTag('tasks')
      .addTag('auth')
      .addTag('users')
      .addBearerAuth()
      .build();
    const documentFactory = () => SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, documentFactory);
  }

  app.useGlobalPipes(
    new ValidationPipe({
      stopAtFirstError: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap().catch((error) => {
  console.error('Bootstrap failed:', error);
  process.exit(1);
});
