import { Module } from '@nestjs/common';
import { CompanyController } from './company.controller';
 import { CompanyService } from './company.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [
    SupabaseModule,
  ],
  controllers: [CompanyController],
  providers: [CompanyService],
  exports: [CompanyService],
})
export class CompanyModule {}
