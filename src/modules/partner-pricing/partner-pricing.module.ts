import { Module } from '@nestjs/common';
import { PartnerPricingController } from './partner-pricing.controller';
import { PartnerPricingService } from './partner-pricing.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [
    SupabaseModule,
  ],
  controllers: [PartnerPricingController],
  providers: [PartnerPricingService],
  exports: [PartnerPricingService],
})
export class PartnerPricingModule {}
