import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { SeafarerController } from './seafarer.controller';
import { SeafarerService } from './seafarer.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [SupabaseModule, AuthModule, InvoicesModule, MulterModule.register()],
  controllers: [SeafarerController],
  providers: [SeafarerService],
})
export class SeafarerModule {}
