import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { SeafarerController } from './seafarer.controller';
import { SeafarerService } from './seafarer.service';
import {
  User,
  SeafarerProfile,
  SeaServiceRecord,
  Document,
  Enrollment,
  Course,
  Institute,
  CourseInstitute,
  Partner,
  PartnerCoursePricing,
  PartnerPayable,
  Invoice,
  Payment,
  SupportTicket,
  SupportTicketReply,
  Notification,
  AuditLog,
} from '../../entities';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      SeafarerProfile,
      SeaServiceRecord,
      Document,
      Enrollment,
      Course,
      Institute,
      CourseInstitute,
      Partner,
      PartnerCoursePricing,
      PartnerPayable,
      Invoice,
      Payment,
      SupportTicket,
      SupportTicketReply,
      Notification,
      AuditLog,
    ]),
    SupabaseModule,
    AuthModule,
    InvoicesModule,
    MulterModule.register(),
  ],
  controllers: [SeafarerController],
  providers: [SeafarerService],
  exports: [SeafarerService],
})
export class SeafarerModule {}
