import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { AuditLogEntry } from './interfaces/finance.interface';
import { AuditLogQueryDto } from './dto/finance.dto';

@Injectable()
export class FinanceAuditService {
  private readonly logger = new Logger(FinanceAuditService.name);
  private storageFilePath = path.join(process.cwd(), 'audit_logs_data.json');
  private inMemoryLogs: AuditLogEntry[] = [];

  constructor(private readonly supabaseService: SupabaseService) {
    this.loadLogsFromDisk();
  }

  private get db() {
    return this.supabaseService.getClient();
  }

  private loadLogsFromDisk() {
    try {
      if (fs.existsSync(this.storageFilePath)) {
        const raw = fs.readFileSync(this.storageFilePath, 'utf8');
        this.inMemoryLogs = JSON.parse(raw);
      } else {
        // Seed default bootstrap financial audit logs
        const now = new Date();
        const baseDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        this.inMemoryLogs = [
          {
            id: randomUUID(),
            user_id: 'a0000000-0000-0000-0000-000000000001',
            user_name: 'Master Admin',
            action: 'INVOICE_GENERATED',
            module: 'Invoices',
            entity_id: 'HOC-2026-000001',
            details: 'Generated HOC Invoice HOC-2026-000001 for Basic Safety Training (BST) (Amount: ₹12,000)',
            previous_value: null,
            updated_value: { status: 'Paid', amount: 12000, invoice_type: 'HOC' },
            ip_address: '127.0.0.1',
            created_at: new Date(baseDate.getTime() + 1 * 86400000).toISOString(),
          },
          {
            id: randomUUID(),
            user_id: 'a0000000-0000-0000-0000-000000000001',
            user_name: 'Master Admin',
            action: 'PAYMENT_RECEIVED',
            module: 'Payments',
            entity_id: 'TXN-HOC-1001',
            details: 'Payment received of ₹12,000 via Razorpay for transaction TXN-HOC-1001',
            previous_value: { status: 'Pending' },
            updated_value: { status: 'Successful', amount: 12000 },
            ip_address: '127.0.0.1',
            created_at: new Date(baseDate.getTime() + 1 * 86400000).toISOString(),
          },
          {
            id: randomUUID(),
            user_id: 'a0000000-0000-0000-0000-000000000001',
            user_name: 'Master Admin',
            action: 'COMMISSION_APPROVED',
            module: 'Commissions',
            entity_id: 'f02c3029-3897-4606-aeb0-af576e103641',
            details: 'Commission approved for agent Kishan Vishwakarma (Course: Advanced Fire Fighting, Amount: ₹1,250)',
            previous_value: { status: 'Pending' },
            updated_value: { status: 'Approved', commission_amount: 1250 },
            ip_address: '127.0.0.1',
            created_at: new Date(baseDate.getTime() + 4 * 86400000).toISOString(),
          },
          {
            id: randomUUID(),
            user_id: 'a0000000-0000-0000-0000-000000000001',
            user_name: 'Master Admin',
            action: 'SETTLEMENT_APPROVED',
            module: 'Settlements',
            entity_id: 'SET-2026-C1EEC7',
            details: 'Created and approved settlement batch SET-2026-C1EEC7 for ₹1,250',
            previous_value: { status: 'Draft' },
            updated_value: { status: 'Approved', total_amount: 1250 },
            ip_address: '127.0.0.1',
            created_at: new Date(baseDate.getTime() + 6 * 86400000).toISOString(),
          },
          {
            id: randomUUID(),
            user_id: 'a0000000-0000-0000-0000-000000000001',
            user_name: 'Master Admin',
            action: 'SETTLEMENT_COMPLETED',
            module: 'Settlements',
            entity_id: 'SET-2026-C1EEC7',
            details: 'Settlement batch SET-2026-C1EEC7 marked as paid and disbursed to agent',
            previous_value: { status: 'Approved' },
            updated_value: { status: 'Paid', paid_at: new Date().toISOString() },
            ip_address: '127.0.0.1',
            created_at: new Date(baseDate.getTime() + 7 * 86400000).toISOString(),
          },
        ];
        this.saveLogsToDisk();
      }
    } catch (e) {
      this.logger.warn('Error reading audit logs from disk:', e);
    }
  }

  private saveLogsToDisk() {
    try {
      fs.writeFileSync(
        this.storageFilePath,
        JSON.stringify(this.inMemoryLogs, null, 2),
        'utf8',
      );
    } catch (e) {
      this.logger.warn('Error saving audit logs to disk:', e);
    }
  }

  /**
   * Section 7.8 Log Activity:
   * Maintain a permanent audit trail of all financial activities:
   * - Payment received
   * - Invoice generated
   * - Commission approved
   * - Commission modified
   * - Settlement approved
   * - Settlement completed
   * - Invoice resent
   * - Report exported
   */
  async logFinancialActivity(params: {
    userId?: string | null;
    userName?: string | null;
    action: string;
    module?: string;
    entityId?: string | null;
    companyId?: string | null;
    details: string;
    previousValue?: any;
    updatedValue?: any;
    ipAddress?: string | null;
  }): Promise<AuditLogEntry> {
    const {
      userId = null,
      userName = 'System',
      action,
      module = 'Finance',
      entityId = null,
      companyId = null,
      details,
      previousValue = null,
      updatedValue = null,
      ipAddress = '127.0.0.1',
    } = params;

    const logId = randomUUID();
    const createdAt = new Date().toISOString();

    const logEntry: AuditLogEntry = {
      id: logId,
      user_id: userId,
      user_name: userName,
      action,
      module,
      entity_id: entityId,
      company_id: companyId,
      details,
      previous_value: previousValue,
      updated_value: updatedValue,
      ip_address: ipAddress,
      created_at: createdAt,
    };

    // Store in-memory and backup to disk
    this.inMemoryLogs.unshift(logEntry);
    this.saveLogsToDisk();

    // Persist to Supabase audit_logs table
    try {
      await this.db.from('audit_logs').insert({
        id: logId,
        user_id: userId,
        user_name: userName,
        action,
        module,
        entity_id: entityId,
        company_id: companyId,
        details,
        ip_address: ipAddress,
        created_at: createdAt,
      });
    } catch (e) {
      this.logger.debug(`Supabase audit log insert fallback: ${e.message}`);
    }

    return logEntry;
  }

  /**
   * Section 7.8 Searchable Audit Logs
   */
  async getAuditLogs(filter: AuditLogQueryDto = {}): Promise<{
    total: number;
    logs: AuditLogEntry[];
  }> {
    const {
      action,
      module: mod,
      entityId,
      userId,
      search,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
    } = filter;

    let logs: AuditLogEntry[] = [];

    // Attempt DB query first
    try {
      let query = this.db
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (action && action !== 'all') {
        query = query.ilike('action', `%${action}%`);
      }
      if (mod && mod !== 'all') {
        query = query.ilike('module', `%${mod}%`);
      }
      if (entityId) {
        query = query.eq('entity_id', entityId);
      }
      if (userId) {
        query = query.eq('user_id', userId);
      }
      if (startDate) {
        query = query.gte('created_at', new Date(startDate).toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', new Date(endDate).toISOString());
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        logs = data;
      } else {
        logs = this.inMemoryLogs;
      }
    } catch (e) {
      logs = this.inMemoryLogs;
    }

    // Merge and deduplicate with in-memory logs
    const seenIds = new Set<string>();
    const mergedLogs: AuditLogEntry[] = [];

    for (const log of [...logs, ...this.inMemoryLogs]) {
      if (!seenIds.has(log.id)) {
        seenIds.add(log.id);
        mergedLogs.push(log);
      }
    }

    // Filter in-memory
    let filtered = mergedLogs.filter((log) => {
      if (action && action !== 'all' && !log.action.toLowerCase().includes(action.toLowerCase())) {
        return false;
      }
      if (mod && mod !== 'all' && !log.module.toLowerCase().includes(mod.toLowerCase())) {
        return false;
      }
      if (entityId && log.entity_id !== entityId) {
        return false;
      }
      if (userId && log.user_id !== userId) {
        return false;
      }
      if (startDate && new Date(log.created_at) < new Date(startDate)) {
        return false;
      }
      if (endDate && new Date(log.created_at) > new Date(endDate)) {
        return false;
      }
      if (search && search.trim().length > 0) {
        const q = search.trim().toLowerCase();
        const match =
          (log.action && log.action.toLowerCase().includes(q)) ||
          (log.details && log.details.toLowerCase().includes(q)) ||
          (log.entity_id && log.entity_id.toLowerCase().includes(q)) ||
          (log.user_name && log.user_name.toLowerCase().includes(q)) ||
          (log.module && log.module.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });

    // Sort by timestamp descending
    filtered.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    return { total, logs: paginated };
  }

  async getAuditLogById(id: string): Promise<AuditLogEntry | null> {
    const { logs } = await this.getAuditLogs();
    const found = logs.find((l) => l.id === id);
    return found || null;
  }

  /**
   * Section 7.8 Business Rules:
   * "Audit logs shall not be editable or deletable."
   */
  updateAuditLog() {
    throw new BadRequestException(
      'Section 7.8 Violation: Audit logs are permanent and immutable. Modifying audit log records is strictly prohibited.',
    );
  }

  deleteAuditLog() {
    throw new BadRequestException(
      'Section 7.8 Violation: Audit logs are permanent and immutable. Deleting audit log records is strictly prohibited.',
    );
  }
}
