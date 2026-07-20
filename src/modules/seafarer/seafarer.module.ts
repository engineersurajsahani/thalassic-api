import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { SeafarerController } from './seafarer.controller';
import { SeafarerService } from './seafarer.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [SupabaseModule, AuthModule, MulterModule.register()],
  controllers: [SeafarerController],
  providers: [SeafarerService],
})
export class SeafarerModule {}
