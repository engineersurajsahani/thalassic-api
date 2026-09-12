import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PartnerPricingController } from './partner-pricing.controller';
import { PartnerPricingService } from './partner-pricing.service';
import {
  PartnerCoursePricing,
  PartnerPricingProposal,
  Course,
  Partner,
  AuditLog,
  User,
} from '../../entities';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PartnerCoursePricing,
      PartnerPricingProposal,
      Course,
      Partner,
      AuditLog,
      User,
    ]),
    SupabaseModule,
  ],
  controllers: [PartnerPricingController],
  providers: [PartnerPricingService],
  exports: [PartnerPricingService],
})
export class PartnerPricingModule {}
