import { Module } from '@nestjs/common';
import { MasterController } from './master.controller';
import { MasterService } from './master.service';
import { InvoicesModule } from '../invoices/invoices.module';
import { AgentAdminModule } from '../agent-admin/agent-admin.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [
    SupabaseModule,
    InvoicesModule,
    AgentAdminModule,
  ],
  controllers: [MasterController],
  providers: [MasterService],
  exports: [MasterService],
})
export class MasterModule {}
