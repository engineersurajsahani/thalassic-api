import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { Invoice, Payment, Settlement, User, Course } from '../../entities';

@Module({
  imports: [
    SupabaseModule,
    TypeOrmModule.forFeature([Invoice, Payment, Settlement, User, Course]),
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
