import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { SupabaseModule } from '../supabase/supabase.module';
import {
  User,
  AgentMetadata,
  ReferralLead,
  Commission,
  CommissionStatusHistory,
  SupportTicket,
  Notification,
} from '../../entities';

@Module({
  imports: [
    SupabaseModule,
    TypeOrmModule.forFeature([
      User,
      AgentMetadata,
      ReferralLead,
      Commission,
      CommissionStatusHistory,
      SupportTicket,
      Notification,
    ]),
  ],
  controllers: [AgentController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
