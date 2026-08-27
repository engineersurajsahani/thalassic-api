import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

const dnsModule = require('dns');
const originalLookup = dnsModule.lookup;
dnsModule.lookup = (hostname: string, options: any, callback: any) => {
  let cb = callback;
  let opt = options;
  if (typeof options === 'function') {
    cb = options;
    opt = {};
  }
  if (hostname === 'expzlbadryzwvsxfmads.supabase.co') {
    if (opt && opt.all) {
      return cb(null, [{ address: '104.18.38.10', family: 4 }]);
    }
    return cb(null, '104.18.38.10', 4);
  }
  return originalLookup(hostname, options, callback);
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Set global API prefix
  app.setGlobalPrefix('api');

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Enable global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
  }));

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`🚀 NestJS Backend running on: http://localhost:${port}/api`);
}
bootstrap();
