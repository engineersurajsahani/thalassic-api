import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';
import { Request, Response, NextFunction } from 'express';
import { ThrottlerGuard } from '@nestjs/throttler';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { createLogger } from './common/logger';

// ISSUE-026: REMOVED DNS monkeypatch — this was a hack that breaks normal DNS resolution
// Supabase hosts should resolve normally via DNS

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  const logger = createLogger('Main');
  // ISSUE-045: Log startup info with Pino instead of console.log
  
  // Set global API prefix with versioning
  // ISSUE-041: Added /api/v1 prefix for API versioning
  app.setGlobalPrefix('api/v1');
  

  
  // ISSUE-062: Add global exception filter for consistent error handling
  app.useGlobalFilters(new GlobalExceptionFilter());


  // ISSUE-025: Environment-based CORS configuration
  // In production, only allow the actual frontend origin
  const frontendOrigins = (process.env.FRONTEND_ORIGINS || '').split(',').filter(Boolean);
  const corsOrigins = frontendOrigins.length > 0
    ? frontendOrigins
    : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001'];

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow: boolean) => void) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      if (corsOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS policy: This origin is not allowed.'), false);
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // ISSUE-069: Add security headers using Helmet-like middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    // Prevent MIME-type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // XSS Protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Permissions Policy
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    // ISSUE-067: HSTS header for HTTPS enforcement (only in production)
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // ISSUE-070: Configure body parser with size limit to prevent DoS
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  const port = process.env.PORT || 4000;
  
  // ISSUE-043: Add request timeout middleware (30 seconds)
  app.use((req: Request, res: Response, next: NextFunction) => {
    req.setTimeout(30000, () => {
      logger.warn({ method: req.method, url: req.url }, 'Request timeout after 30s');
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
  
  await app.listen(port);
  logger.info(`NestJS Backend running on: http://localhost:${port}/api/v1`);
  logger.info(`Health check available at: http://localhost:${port}/api/v1/health`);
  
  // ISSUE-044: Enable graceful shutdown
  app.enableShutdownHooks();
  
  // Handle SIGTERM and SIGINT for graceful shutdown
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
