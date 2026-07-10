import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from './common/pipes/validation.pipe';
import { AllExceptionsFilter } from './common/filters/all-exception.filter';
import { PrismaClientExceptionFilter } from './common/filters/prisma.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AuthGuard } from './common/guards/auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { JwtService } from '@nestjs/jwt';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefixes and configuration
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: true, // Allow all origins for dev
    credentials: true,
  });

  // Global Pipes & Filters
  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalFilters(
    new AllExceptionsFilter(),
    new PrismaClientExceptionFilter(app.getHttpAdapter()),
  );

  // Global Guards
  const jwtService = app.get(JwtService);
  const reflector = app.get(Reflector);
  app.useGlobalGuards(
    new AuthGuard(jwtService, reflector),
    new RolesGuard(reflector),
  );

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Hari Om Thalassic API')
    .setDescription('The API documentation for Hari Om Thalassic platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 5050;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}/api`);
  console.log(`Swagger documentation: http://localhost:${port}/api/docs`);
}
bootstrap();
