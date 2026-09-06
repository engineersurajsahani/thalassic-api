import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MasterController } from './master.controller';
import { MasterService } from './master.service';
import { InvoicesModule } from '../invoices/invoices.module';
import { AgentAdminModule } from '../agent-admin/agent-admin.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { User, Course, AuditLog, PlatformSettings, PartnerApplication } from '../../entities';

@Module({
  imports: [
    SupabaseModule,
    InvoicesModule,
    AgentAdminModule,
    TypeOrmModule.forFeature([User, Course, AuditLog, PlatformSettings, PartnerApplication]),
  ],
  controllers: [MasterController],
  providers: [MasterService],
  exports: [MasterService],
})
export class MasterModule {}
