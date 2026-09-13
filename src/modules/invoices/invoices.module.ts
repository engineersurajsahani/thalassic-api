import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import {
  Invoice,
  InvoiceCounter,
  Payment,
  AuditLog,
  PlatformSettings,
  User,
  Partner,
  Enrollment,
} from '../../entities';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Invoice,
      InvoiceCounter,
      Payment,
      AuditLog,
      PlatformSettings,
      User,
      Partner,
      Enrollment,
    ]),
    SupabaseModule,
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
