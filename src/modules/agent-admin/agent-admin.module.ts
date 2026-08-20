import { Module } from '@nestjs/common';
import { AgentAdminController } from './agent-admin.controller';
import { AgentAdminService } from './agent-admin.service';
import { PublicPartnerApplicationsController } from './partner-applications.controller';
import { PartnerApplicationsService } from './partner-applications.service';

@Module({
  controllers: [AgentAdminController, PublicPartnerApplicationsController],
  providers: [AgentAdminService, PartnerApplicationsService],
  exports: [AgentAdminService, PartnerApplicationsService],
})
export class AgentAdminModule {}
