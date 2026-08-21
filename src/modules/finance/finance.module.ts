import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { FinanceReportsService } from './finance-reports.service';
import { FinanceAuditService } from './finance-audit.service';
import { FinanceExportService } from './finance-export.service';
import { MasterFinanceGuard } from './guards/master-finance.guard';

@Module({
  imports: [SupabaseModule],
  controllers: [FinanceController],
  providers: [
    FinanceService,
    FinanceReportsService,
    FinanceAuditService,
    FinanceExportService,
    MasterFinanceGuard,
  ],
  exports: [
    FinanceService,
    FinanceReportsService,
    FinanceAuditService,
    FinanceExportService,
  ],
})
export class FinanceModule {}
