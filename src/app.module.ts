import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseModule } from './modules/supabase/supabase.module';
import { MasterModule } from './modules/master/master.module';
import { AuthModule } from './modules/auth/auth.module';
import { SeafarerModule } from './modules/seafarer/seafarer.module';
import { AgentAdminModule } from './modules/agent-admin/agent-admin.module';
import { AgentModule } from './modules/agent/agent.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { CompanyModule } from './modules/company/company.module';
import { FinanceModule } from './modules/finance/finance.module';
import { PartnerPricingModule } from './modules/partner-pricing/partner-pricing.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import {
  User,
  SeafarerProfile,
  Document,
  Enrollment,
  Course,
  SeaServiceRecord,
  AgentMetadata,
  Company,
  CompanyAdmin,
  CompanyCrew,
  ReferralLead,
  Commission,
  CommissionStatusHistory,
  Invoice,
  Payment,
  Settlement,
  AuditLog,
  PartnerApplication,
  SupportTicket,
  Notification,
  PlatformSettings,
} from './entities';

const ALL_ENTITIES = [
  User,
  SeafarerProfile,
  Document,
  Enrollment,
  Course,
  SeaServiceRecord,
  AgentMetadata,
  Company,
  CompanyAdmin,
  CompanyCrew,
  ReferralLead,
  Commission,
  CommissionStatusHistory,
  Invoice,
  Payment,
  Settlement,
  AuditLog,
  PartnerApplication,
  SupportTicket,
  Notification,
  PlatformSettings,
];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Rate limiting module configuration
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 60000, limit: 100 },
      { name: 'long', ttl: 3600000, limit: 1000 },
    ]),
    // TypeORM configuration with DATABASE_URL support for Render / Supabase
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const dbUrl = configService.get<string>('DATABASE_URL');
        if (dbUrl && (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://'))) {
          return {
            type: 'postgres',
            url: dbUrl,
            entities: ALL_ENTITIES,
            synchronize: false,
            logging: configService.get('NODE_ENV') === 'development',
            ssl: { rejectUnauthorized: false },
            retryAttempts: 3,
            retryDelay: 3000,
            extra: {
              max: 20,
              connectionTimeoutMillis: 10000,
              idleTimeoutMillis: 30000,
            },
          };
        }

        const host = configService.get<string>('DB_HOST') || '127.0.0.1';
        const password = configService.get<string>('SUPABASE_DB_PASSWORD') || configService.get<string>('DB_PASSWORD') || 'postgres';

        return {
          type: 'postgres',
          host,
          port: parseInt(configService.get('DB_PORT') || '5432', 10),
          username: configService.get('DB_USER') || 'postgres',
          password,
          database: configService.get('DB_NAME') || 'postgres',
          entities: ALL_ENTITIES,
          synchronize: false,
          logging: false,
          ssl: false,
          retryAttempts: 1,
          retryDelay: 1000,
          extra: {
            max: 5,
            connectionTimeoutMillis: 3000,
            idleTimeoutMillis: 10000,
          },
        };
      },
      inject: [ConfigService],
    }),
    SupabaseModule,
    AuthModule,
    MasterModule,
    SeafarerModule,
    AgentAdminModule,
    AgentModule,
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
