import { Module } from '@nestjs/common';
import { AgentController, PartnerController } from './agent.controller';
import { AgentService } from './agent.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [AgentController, PartnerController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}

