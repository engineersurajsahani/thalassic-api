import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseModule } from './modules/supabase/supabase.module';
import { MasterModule } from './modules/master/master.module';
import { AuthModule } from './modules/auth/auth.module';
import { SeafarerModule } from './modules/seafarer/seafarer.module';
import { AgentAdminModule } from './modules/agent-admin/agent-admin.module';
import { AgentModule } from './modules/agent/agent.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
    AuthModule,
    MasterModule,
    SeafarerModule,
    AgentAdminModule,
    AgentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
