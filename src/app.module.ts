import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseModule } from './supabase/supabase.module';
import { MasterModule } from './master/master.module';
import { AuthModule } from './auth/auth.module';
import { SeafarerModule } from './seafarer/seafarer.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
    AuthModule,
    MasterModule,
    SeafarerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
