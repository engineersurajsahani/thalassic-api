import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MasterController } from './master.controller';
import { MasterService } from './master.service';
import { InvoicesModule } from '../invoices/invoices.module';
import { PartnerAdminModule } from '../partner-admin/partner-admin.module';
import {
  User,
  Course,
  Institute,
  CourseInstitute,
  Enrollment,
  Partner,
  PartnerCoursePricing,
  PartnerPricingProposal,
  PartnerPayable,
  Settlement,
  Document,
  AuditLog,
  PlatformSettings,
  SupportTicket,
  Notification,
} from '../../entities';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Course,
      Institute,
      CourseInstitute,
      Enrollment,
      Partner,
      PartnerCoursePricing,
      PartnerPricingProposal,
      PartnerPayable,
      Settlement,
      Document,
      AuditLog,
      PlatformSettings,
      SupportTicket,
      Notification,
    ]),
    SupabaseModule,
    InvoicesModule,
    PartnerAdminModule,
  ],
  controllers: [MasterController],
  providers: [MasterService],
  exports: [MasterService],
})
export class MasterModule {}
