import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PartnerAdminController } from './partner-admin.controller';
import { PartnerAdminService } from './partner-admin.service';
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
  AuditLog,
  Course,
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
      AuditLog,
      Course,
    ]),
    SupabaseModule,
  ],
  controllers: [PartnerAdminController],
  providers: [PartnerAdminService],
  exports: [PartnerAdminService],
})
export class PartnerAdminModule {}
