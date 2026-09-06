import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { Company, CompanyAdmin, CompanyCrew, User, Document } from '../../entities';

@Module({
  imports: [
    SupabaseModule,
    TypeOrmModule.forFeature([Company, CompanyAdmin, CompanyCrew, User, Document]),
  ],
  controllers: [CompanyController],
  providers: [CompanyService],
  exports: [CompanyService],
})
export class CompanyModule {}
