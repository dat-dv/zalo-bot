import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { AppModule } from './app.module';
import {
  loadEnvironment,
  printEnvValidationBanner,
  validateEnvironment,
} from './config/env.validator';

async function bootstrap() {
  // Load environment variables
  loadEnvironment();

  // Fail fast: without this, missing values fall back to unsafe defaults in configuration.ts.
  const envValidation = validateEnvironment();
  if (!envValidation.isValid) {
    printEnvValidationBanner(envValidation.errors);
    process.exit(1);
  }

  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Security & Performance Middlewares
  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );
  app.use(compression());
  app.use(cookieParser());

  // Validation DTO toàn cục
  app.useGlobalPipes(
    new ValidationPipe({
      // 1. Tự động loại bỏ các field thừa không được khai báo trong DTO (Chống Mass Assignment Attack)
      whitelist: true,
      // 2. KHÔNG ném lỗi 400 khi có field lạ: field thừa chỉ bị loại bỏ (whitelist) để client cũ vẫn chạy
      forbidNonWhitelisted: false,
      // 3. Tự động ép kiểu dữ liệu payload về đúng kiểu khai báo trong DTO (VD: string '123' -> number 123)
      transform: true,
    }),
  );

  app.setGlobalPrefix('api', {
    exclude: ['health'],
  });
  app.enableShutdownHooks();

  // 3. Configure Swagger OpenAPI Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Zalo Bot Assistant API')
    .setDescription('Hệ thống API RESTful cho trợ lý ảo Zalo (ZCA) kết hợp Google Workspace và AI.')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT Authorization',
        description: 'Nhập JWT Access Token để xác thực',
        in: 'header',
      },
      'bearer-jwt',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Zalo Bot API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
    },
  });

  const configService = app.get(ConfigService);
  const port = configService.getOrThrow<number>('port');
  const appUrl = configService.getOrThrow<string>('appUrl');
  const webOrigin = configService.getOrThrow<string>('webOrigin');
  const corsAllowAll = configService.getOrThrow<boolean>('cors.allowAll');

  const corsOrigins = [webOrigin];
  if (process.env.NODE_ENV !== 'production') corsOrigins.push('http://localhost:5173');
  if (corsAllowAll) {
    app.enableCors({ origin: true, credentials: true });
  } else if (corsOrigins.some(Boolean)) {
    app.enableCors({ origin: corsOrigins.filter(Boolean), credentials: true });
  } else {
    app.enableCors({ origin: true, credentials: true });
  }

  await app.listen(port);

  logger.log(`🚀 Web Server is listening on port ${port}`);
  logger.log(`📚 Swagger OpenAPI Docs: ${appUrl}/api/docs`);
  logger.log(`🌐 Public OAuth Callback URL: ${appUrl}/api/oauth2callback`);
}

// Global Process Resilience Guards
process.on('unhandledRejection', (reason: unknown) => {
  const logger = new Logger('UnhandledRejection');
  let message = 'Unknown rejection';
  if (reason instanceof Error) {
    message = reason.stack || reason.message;
  } else if (typeof reason === 'string') {
    message = reason;
  } else if (typeof reason === 'object' && reason !== null) {
    try {
      message = JSON.stringify(reason);
    } catch {
      message = '[Non-serializable object]';
    }
  }
  logger.error(`Unhandled Promise Rejection trapped: ${message}`);
});

process.on('uncaughtException', (error: Error) => {
  const logger = new Logger('UncaughtException');
  logger.error(`Uncaught Exception trapped: ${error.stack || error.message}`);
});

bootstrap().catch((err) => {
  const logger = new Logger('Bootstrap');
  logger.error('Fatal error starting application', err);
  process.exit(1);
});
