import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { allEntities } from './entities';
import { SupabaseModule } from './modules/supabase/supabase.module';
import { MasterModule } from './modules/master/master.module';
import { AuthModule } from './modules/auth/auth.module';
import { SeafarerModule } from './modules/seafarer/seafarer.module';
import { PartnerAdminModule } from './modules/partner-admin/partner-admin.module';
import { PartnerModule } from './modules/partner/partner.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { CompanyModule } from './modules/company/company.module';
import { FinanceModule } from './modules/finance/finance.module';
import { PartnerPricingModule } from './modules/partner-pricing/partner-pricing.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Rate limiting module configuration
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 60000, limit: 100 },
      { name: 'long', ttl: 3600000, limit: 1000 },
    ]),
    // Authoritative TypeORM Configuration
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbUrl = configService.get<string>('DATABASE_URL');
        const supabaseUrl = configService.get<string>('SUPABASE_URL');
        const isProd = configService.get<string>('NODE_ENV') === 'production';

        if (dbUrl) {
          return {
            type: 'postgres',
            url: dbUrl,
            entities: allEntities,
            synchronize: false,
            autoLoadEntities: true,
            logging: !isProd,
            ssl: isProd ? { rejectUnauthorized: false } : false,
          };
        }

        const host =
          configService.get<string>('DB_HOST') ||
          (supabaseUrl
            ? `db.${supabaseUrl.replace('https://', '').split('.')[0]}.supabase.co`
            : 'localhost');
        const port = parseInt(
          configService.get<string>('DB_PORT') || '5432',
          10,
        );
        const username = configService.get<string>('DB_USER') || 'postgres';
        const password =
          configService.get<string>('SUPABASE_DB_PASSWORD') ||
          configService.get<string>('DB_PASSWORD') ||
          'postgres';
        const database = configService.get<string>('DB_NAME') || 'postgres';

        return {
          type: 'postgres',
          host,
          port,
          username,
          password,
          database,
          entities: allEntities,
          synchronize: false,
          autoLoadEntities: true,
          logging: !isProd,
          ssl: isProd ? { rejectUnauthorized: false } : false,
        };
      },
    }),
    TypeOrmModule.forFeature(allEntities),
    // Core Application Modules
    SupabaseModule,
    AuthModule,
    MasterModule,
    SeafarerModule,
    PartnerAdminModule,
    PartnerModule,
    InvoicesModule,
    CompanyModule,
    FinanceModule,
    PartnerPricingModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
