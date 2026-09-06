import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeafarerController } from './seafarer.controller';
import { SeafarerService } from './seafarer.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';
import { InvoicesModule } from '../invoices/invoices.module';
import {
  User,
  SeafarerProfile,
  Document,
  Enrollment,
  Course,
  SeaServiceRecord,
  SupportTicket,
  Notification,
} from '../../entities';

@Module({
  imports: [
    SupabaseModule,
    AuthModule,
    InvoicesModule,
    MulterModule.register(),
    TypeOrmModule.forFeature([
      User,
      SeafarerProfile,
      Document,
      Enrollment,
      Course,
      SeaServiceRecord,
      SupportTicket,
      Notification,
    ]),
  ],
  controllers: [SeafarerController],
  providers: [SeafarerService],
  exports: [SeafarerService],
})
export class SeafarerModule {}
