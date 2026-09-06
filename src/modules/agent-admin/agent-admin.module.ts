import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentAdminController } from './agent-admin.controller';
import { AgentAdminService } from './agent-admin.service';
import { PublicPartnerApplicationsController } from './partner-applications.controller';
import { PartnerApplicationsService } from './partner-applications.service';
import { SupabaseModule } from '../supabase/supabase.module';
import {
  User,
  AgentMetadata,
  ReferralLead,
  Commission,
  PartnerApplication,
  AuditLog,
} from '../../entities';

@Module({
  imports: [
    SupabaseModule,
    TypeOrmModule.forFeature([
      User,
      AgentMetadata,
      ReferralLead,
      Commission,
      PartnerApplication,
      AuditLog,
    ]),
  ],
  controllers: [AgentAdminController, PublicPartnerApplicationsController],
  providers: [AgentAdminService, PartnerApplicationsService],
  exports: [AgentAdminService, PartnerApplicationsService],
})
export class AgentAdminModule {}
