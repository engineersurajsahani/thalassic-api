import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

import {
  User,
  Institute,
  Course,
  CourseInstitute,
  SeafarerProfile,
  SeaServiceRecord,
  Document,
  Company,
  CompanyAdmin,
  CompanySeafarer,
  Partner,
  PartnerAdmin,
  PartnerReferral,
  PartnerCoursePricing,
  PartnerPricingProposal,
  Enrollment,
  Invoice,
  InvoiceCounter,
  Payment,
  PartnerPayable,
  Settlement,
  SettlementItem,
  SupportTicket,
  SupportTicketReply,
  Notification,
  AuditLog,
  PlatformSettings,
} from './entities';

export const allEntities = [
  User,
  Institute,
  Course,
  CourseInstitute,
  SeafarerProfile,
  SeaServiceRecord,
  Document,
  Company,
  CompanyAdmin,
  CompanySeafarer,
  Partner,
  PartnerAdmin,
  PartnerReferral,
  PartnerCoursePricing,
  PartnerPricingProposal,
  Enrollment,
  Invoice,
  InvoiceCounter,
  Payment,
  PartnerPayable,
  Settlement,
  SettlementItem,
  SupportTicket,
  SupportTicketReply,
  Notification,
  AuditLog,
  PlatformSettings,
];

const dbOptions: DataSourceOptions = process.env.DATABASE_URL
  ? {
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: allEntities,
      migrations: [__dirname + '/migrations/*{.ts,.js}'],
      synchronize: false,
      logging: process.env.NODE_ENV === 'development',
      ssl:
        process.env.NODE_ENV === 'production'
          ? { rejectUnauthorized: false }
          : false,
    }
  : {
      type: 'postgres',
      host:
        process.env.DB_HOST ||
        (process.env.SUPABASE_URL
          ? `db.${process.env.SUPABASE_URL.replace('https://', '').split('.')[0]}.supabase.co`
          : 'localhost'),
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'postgres',
      password:
        process.env.SUPABASE_DB_PASSWORD ||
        process.env.DB_PASSWORD ||
        'postgres',
      database: process.env.DB_NAME || 'postgres',
      entities: allEntities,
      migrations: [__dirname + '/migrations/*{.ts,.js}'],
      synchronize: false,
      logging: process.env.NODE_ENV === 'development',
      ssl:
        process.env.NODE_ENV === 'production'
          ? { rejectUnauthorized: false }
          : false,
    };

export const AppDataSource = new DataSource(dbOptions);
