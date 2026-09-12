import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PartnerController } from './partner.controller';
import { PartnerService } from './partner.service';
import {
  Partner,
  PartnerAdmin,
  PartnerReferral,
  PartnerCoursePricing,
  PartnerPricingProposal,
  PartnerPayable,
  Settlement,
  SettlementItem,
  User,
  Course,
  Document,
  SupportTicket,
  SupportTicketReply,
  Notification,
  AuditLog,
  Invoice,
} from '../../entities';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Partner,
      PartnerAdmin,
      PartnerReferral,
      PartnerCoursePricing,
      PartnerPricingProposal,
      PartnerPayable,
      Settlement,
      SettlementItem,
      User,
      Course,
      Document,
      SupportTicket,
      SupportTicketReply,
      Notification,
      AuditLog,
      Invoice,
    ]),
    SupabaseModule,
  ],
  controllers: [PartnerController],
  providers: [PartnerService],
  exports: [PartnerService],
})
export class PartnerModule {}
