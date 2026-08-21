import { Module } from '@nestjs/common';
import { MasterController } from './master.controller';
import { MasterService } from './master.service';
import { InvoicesModule } from '../invoices/invoices.module';
import { AgentAdminModule } from '../agent-admin/agent-admin.module';

@Module({
  imports: [InvoicesModule, AgentAdminModule],
  controllers: [MasterController],
  providers: [MasterService],
})
export class MasterModule {}
