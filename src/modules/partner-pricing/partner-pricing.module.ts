import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PartnerPricingController } from './partner-pricing.controller';
import { PartnerPricingService } from './partner-pricing.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { Course, AgentMetadata } from '../../entities';

@Module({
  imports: [
    SupabaseModule,
    TypeOrmModule.forFeature([Course, AgentMetadata]),
  ],
  controllers: [PartnerPricingController],
  providers: [PartnerPricingService],
  exports: [PartnerPricingService],
})
export class PartnerPricingModule {}
