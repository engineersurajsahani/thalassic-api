import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupabaseModule } from '../supabase/supabase.module';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { FinanceReportsService } from './finance-reports.service';
import { FinanceAuditService } from './finance-audit.service';
import { FinanceExportService } from './finance-export.service';
import { MasterFinanceGuard } from './guards/master-finance.guard';
import { Invoice, Payment, Settlement, Commission, AuditLog } from '../../entities';

@Module({
  imports: [
    SupabaseModule,
    TypeOrmModule.forFeature([Invoice, Payment, Settlement, Commission, AuditLog]),
  ],
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
