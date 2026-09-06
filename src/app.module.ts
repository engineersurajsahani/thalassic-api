import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // ISSUE-020: Rate limiting module configuration
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 60000, limit: 100 },
      { name: 'long', ttl: 3600000, limit: 1000 },
    ]),
    // ISSUE-001, ISSUE-010: TypeORM configuration for PostgreSQL with connection pooling
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.SUPABASE_URL?.replace('https://', '').split('.')[0] || 'db.xxxxxx.supabase.co',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'postgres',
      password: process.env.SUPABASE_DB_PASSWORD || process.env.SUPABASE_SERVICE_ROLE_KEY || 'postgres',
      database: process.env.DB_NAME || 'postgres',
      entities: [
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
      ],
      synchronize: false,
      logging: process.env.NODE_ENV === 'development',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      extra: {
        max: 20,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
      },
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
    // ISSUE-020: Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // ISSUE-062: Global exception filter for consistent error handling
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule { }
