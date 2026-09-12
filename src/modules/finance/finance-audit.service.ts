import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, User } from '../../entities';
import { AuditLogQueryDto } from './dto/finance.dto';

@Injectable()
export class FinanceAuditService {
  private readonly logger = new Logger(FinanceAuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async logFinancialActivity(params: {
    userId?: string | null;
    userName?: string | null;
    action: string;
    module?: string;
    entityId?: string | null;
    companyId?: string | null;
    partnerId?: string | null;
    details: string;
    previousValue?: any;
    updatedValue?: any;
    ipAddress?: string | null;
  }): Promise<AuditLog> {
    const {
      userId = null,
      userName = 'System',
      action,
      module = 'Finance',
      entityId = null,
      companyId = null,
      partnerId = null,
      details,
      previousValue = null,
      updatedValue = null,
      ipAddress = '127.0.0.1',
    } = params;

    const logEntry = this.auditLogRepo.create({
      actorUserId: userId || null,
      actorName: userName || null,
      action,
      module,
      entityId: entityId || null,
      companyId: companyId || null,
      partnerId: partnerId || null,
      details,
      previousState: previousValue,
      newState: updatedValue,
      ipAddress: ipAddress || null,
    });

    return await this.auditLogRepo.save(logEntry);
  }

  async getAuditLogs(filter: AuditLogQueryDto = {}): Promise<{
    total: number;
    logs: any[];
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

    const qb = this.auditLogRepo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.actor', 'actor')
      .orderBy('log.createdAt', 'DESC');

    if (action && action !== 'all') {
      qb.andWhere('LOWER(log.action) LIKE :action', {
        action: `%${action.toLowerCase()}%`,
      });
    }
    if (mod && mod !== 'all') {
      qb.andWhere('LOWER(log.module) LIKE :mod', {
        mod: `%${mod.toLowerCase()}%`,
      });
    }
    if (entityId) {
      qb.andWhere('log.entityId = :entityId', { entityId });
    }
    if (userId) {
      qb.andWhere('log.actorUserId = :userId', { userId });
    }
    if (startDate) {
      qb.andWhere('log.createdAt >= :startDate', {
        startDate: new Date(startDate),
      });
    }
    if (endDate) {
      qb.andWhere('log.createdAt <= :endDate', { endDate: new Date(endDate) });
    }
    if (search && search.trim()) {
      const s = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(log.action) LIKE :s OR LOWER(log.details) LIKE :s OR LOWER(log.entityId) LIKE :s OR LOWER(log.actorName) LIKE :s OR LOWER(log.module) LIKE :s)',
        { s },
      );
    }

    const [logs, total] = await qb.skip(offset).take(limit).getManyAndCount();

    return {
      total,
      logs: logs.map((l) => ({
        id: l.id,
        user_id: l.actorUserId,
        user_name: l.actorName || l.actor?.name || 'System',
        action: l.action,
        module: l.module,
        entity_id: l.entityId,
        company_id: l.companyId,
        partner_id: l.partnerId,
        details: l.details,
        previous_value: l.previousState,
        updated_value: l.newState,
        ip_address: l.ipAddress,
        created_at: l.createdAt.toISOString(),
      })),
    };
  }

  async getAuditLogById(id: string): Promise<any | null> {
    const log = await this.auditLogRepo.findOne({
      where: { id },
      relations: {
        actor: true,
      },
    });
    if (!log) return null;
    return {
      id: log.id,
      user_id: log.actorUserId,
      user_name: log.actorName || log.actor?.name || 'System',
      action: log.action,
      module: log.module,
      entity_id: log.entityId,
      company_id: log.companyId,
      partner_id: log.partnerId,
      details: log.details,
      previous_value: log.previousState,
      updated_value: log.newState,
      ip_address: log.ipAddress,
      created_at: log.createdAt.toISOString(),
    };
  }

  updateAuditLog() {
    throw new BadRequestException(
      'Audit logs are permanent and immutable. Modifying audit log records is strictly prohibited.',
    );
  }

  deleteAuditLog() {
    throw new BadRequestException(
      'Audit logs are permanent and immutable. Deleting audit log records is strictly prohibited.',
    );
  }
}
