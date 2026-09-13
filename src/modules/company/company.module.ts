import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
import {
  Company,
  CompanyAdmin,
  CompanySeafarer,
  User,
  Course,
  Institute,
  CourseInstitute,
  Enrollment,
  Invoice,
  Payment,
  AuditLog,
} from '../../entities';
import { SupabaseModule } from '../supabase/supabase.module';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Company,
      CompanyAdmin,
      CompanySeafarer,
      User,
      Course,
      Institute,
      CourseInstitute,
      Enrollment,
      Invoice,
      Payment,
      AuditLog,
    ]),
    SupabaseModule,
    InvoicesModule,
  ],
  controllers: [CompanyController],
  providers: [CompanyService],
  exports: [CompanyService],
})
export class CompanyModule {}
