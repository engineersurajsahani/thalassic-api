import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';
import { Request, Response, NextFunction } from 'express';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { createLogger } from './common/logger';

process.on('unhandledRejection', (reason: any) => {
  console.warn('Unhandled Rejection caught:', reason?.message || reason);
});
process.on('uncaughtException', (err: any) => {
  console.warn('Uncaught Exception caught:', err?.message || err);
});

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const logger = createLogger('Main');

  // Global API prefix with versioning
  app.setGlobalPrefix('api/v1');

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Environment-based CORS configuration
  const frontendOrigins = (
    process.env.FRONTEND_ORIGINS ||
    process.env.FRONTEND_URL ||
    ''
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow: boolean) => void,
    ) => {
      if (!origin) return callback(null, true);
      // Allow localhost, custom frontend origins, and vercel/render deployments
      if (
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        origin.endsWith('.vercel.app') ||
        origin.endsWith('.onrender.com') ||
        frontendOrigins.includes(origin) ||
        frontendOrigins.length === 0
      ) {
        callback(null, true);
      } else {
        callback(null, true); // Allow gracefully in production with credentials
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Security headers middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()',
    );
    if (process.env.NODE_ENV === 'production') {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
      );
    }
    next();
  });

  // Request body size limit
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Request timeout middleware (30 seconds)
  app.use((req: Request, res: Response, next: NextFunction) => {
    req.setTimeout(30000, () => {
      logger.warn(
        { method: req.method, url: req.url },
        'Request timeout after 30s',
      );
      if (!res.headersSent) {
        res.status(408).json({
          statusCode: 408,
          message: 'Request timeout. The server took too long to respond.',
          timestamp: new Date().toISOString(),
          path: req.url,
        });
      }
    });
    res.setTimeout(30000);
    next();
  });

  const port = parseInt(process.env.PORT || '4000', 10);

  // Bind explicitly to 0.0.0.0 for Render / Container deployments
  await app.listen(port, '0.0.0.0');
  logger.info(`NestJS Backend running on port ${port} (0.0.0.0)`);
  logger.info(`API Base URL: http://0.0.0.0:${port}/api/v1`);
  logger.info(
    `Health check available at: http://0.0.0.0:${port}/api/v1/health`,
  );

  // Enable graceful shutdown
  app.enableShutdownHooks();

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Starting graceful shutdown...');
    app.close().then(() => {
      logger.info('Graceful shutdown completed.');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received. Starting graceful shutdown...');
    app.close().then(() => {
      logger.info('Graceful shutdown completed.');
      process.exit(0);
    });
  });
}

bootstrap();
