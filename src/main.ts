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

  // Enable CORS for Next.js frontend
  app.enableCors({
    origin: '*', // Adjust to specific URL (e.g. http://localhost:3000) in production
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Enable global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`🚀 NestJS Backend running on: http://localhost:${port}/api`);
}
bootstrap();
