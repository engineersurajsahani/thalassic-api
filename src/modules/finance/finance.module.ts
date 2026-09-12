import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { FinanceReportsService } from './finance-reports.service';
import { FinanceAuditService } from './finance-audit.service';
import { FinanceExportService } from './finance-export.service';
import {
  Invoice,
  Payment,
  PartnerPayable,
  Settlement,
  SettlementItem,
  AuditLog,
  Partner,
  Course,
  Enrollment,
  User,
} from '../../entities';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Invoice,
      Payment,
      PartnerPayable,
      Settlement,
      SettlementItem,
      AuditLog,
      Partner,
      Course,
      Enrollment,
      User,
    ]),
    SupabaseModule,
  ],
  controllers: [FinanceController],
  providers: [
    FinanceService,
    FinanceReportsService,
    FinanceAuditService,
    FinanceExportService,
  ],
  exports: [FinanceService, FinanceReportsService, FinanceAuditService],
})
export class FinanceModule {}
