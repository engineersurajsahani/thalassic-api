import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

const USERS_FILE = path.join(process.cwd(), 'users_data.json');
const PRICING_FILE = path.join(process.cwd(), 'partner_pricing_data.json');
const PURCHASES_FILE = path.join(process.cwd(), 'partner_purchases_data.json');
const SETTLEMENTS_FILE = path.join(process.cwd(), 'settlements_data.json');
const AUDIT_LOGS_FILE = path.join(process.cwd(), 'audit_logs_data.json');

@Injectable()
export class AgentAdminService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private getDb() {
    return this.supabaseService.getClient();
  }

  // --- File Storage Helpers ---
  private readJsonFile(filePath: string, fallback: any[] = []): any[] {
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
    } catch (e) {
      console.warn(`Error reading ${filePath}:`, e);
    }
    return fallback;
  }

  private writeJsonFile(filePath: string, data: any[]) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error(`Error saving ${filePath}:`, e);
    }
  }

  // Helper to log administrative actions
  async logAction(
    userId: string,
    userName: string,
    action: string,
    module: string,
    entityId: string,
    details: string,
    ipAddress = '127.0.0.1',
  ) {
    const logItem = {
      id: randomUUID(),
      user_id: userId,
      user_name: userName,
      action,
      module,
      entity_id: entityId,
      details,
      ip_address: ipAddress,
      created_at: new Date().toISOString(),
    };

    const logs = this.readJsonFile(AUDIT_LOGS_FILE, []);
    logs.unshift(logItem);
    this.writeJsonFile(AUDIT_LOGS_FILE, logs.slice(0, 500));

    try {
      const db = this.getDb();
      await db.from('audit_logs').insert(logItem);
    } catch {
      // ignore offline supabase error
    }
  }

  // --- 1. Dashboard Metrics (Partner Model & Legacy Support) ---
  async getDashboardData() {
    const users = this.readJsonFile(USERS_FILE, []);
    const partners = users.filter((u: any) => {
      const r = (u.role || '').toUpperCase();
      return r === 'AGENT' || r === 'PARTNER';
    });

    const activePartners = partners.filter((p: any) => p.status !== 'Inactive' && p.status !== 'Suspended');
    const purchases = this.readJsonFile(PURCHASES_FILE, []);
    const settlements = this.readJsonFile(SETTLEMENTS_FILE, []);
    const pricingList = this.readJsonFile(PRICING_FILE, []);

    let totalPayable = 0;
    purchases.forEach((p: any) => {
      totalPayable += Number(p.payable_amount || 0);
    });

    let amountSettled = 0;
    let pendingSettlementsCount = 0;
    let pendingSettlementAmount = 0;

    settlements.forEach((s: any) => {
      const amt = Number(s.total_amount || 0);
      if (s.status === 'Completed' || s.status === 'Paid') {
        amountSettled += amt;
      } else if (s.status === 'Submitted' || s.status === 'Under Verification' || s.status === 'Pending') {
        pendingSettlementsCount += 1;
        pendingSettlementAmount += amt;
      }
    });

    const outstandingAmount = Math.max(0, totalPayable - amountSettled);

    // Seafarer masters
    const seafarers = users.filter((u: any) => (u.role || '').toUpperCase() === 'SEAFARER');
    const uniqueSeafarerIds = new Set([
      ...seafarers.map((s: any) => s.id),
      ...purchases.map((p: any) => p.seafarer_id)
    ]);

    const auditLogs = this.readJsonFile(AUDIT_LOGS_FILE, []);

    return {
      kpis: {
        totalAgents: partners.length,
        totalPartners: partners.length,
        activeAgents: activePartners.length,
        activePartners: activePartners.length,
        pendingOnboarding: 0,
        totalPurchases: purchases.length,
        totalPayableAmount: `₹${totalPayable.toLocaleString('en-IN')}`,
        totalPayable: totalPayable,
        amountSettled: amountSettled,
        totalRevenueEarned: `₹${totalPayable.toLocaleString('en-IN')}`,
        outstandingAmount: outstandingAmount,
        commissionPayable: `₹${outstandingAmount.toLocaleString('en-IN')}`,
        commissionPaid: `₹${amountSettled.toLocaleString('en-IN')}`,
        pendingSettlements: pendingSettlementsCount,
        pendingSettlementAmount: pendingSettlementAmount,
        totalReferredSeafarers: uniqueSeafarerIds.size,
        totalLeads: 0,
        activeLeads: 0,
        expiredLeads: 0,
        configuredPricingCount: pricingList.length,
      },
      partnerApplications: [],
      recentPurchases: purchases.slice(0, 8),
      recentSettlements: settlements.slice(0, 8),
      recentActivities: auditLogs.slice(0, 10).map((log: any) => ({
        id: log.id,
        user: log.user_name || 'Admin',
        action: log.action,
        module: log.module,
        details: log.details,
        timestamp: log.created_at,
      })),
    };
  }

  // --- 2. Partner Management ---
  async getAgents() {
    const users = this.readJsonFile(USERS_FILE, []);
    const partners = users.filter((u: any) => {
      const r = (u.role || '').toUpperCase();
      return r === 'AGENT' || r === 'PARTNER';
    });

    const purchases = this.readJsonFile(PURCHASES_FILE, []);
    const settlements = this.readJsonFile(SETTLEMENTS_FILE, []);
    const pricingList = this.readJsonFile(PRICING_FILE, []);

    return partners.map((partner: any) => {
      const partnerPurchases = purchases.filter((p: any) => p.partner_id === partner.id);
      const partnerSettlements = settlements.filter(
        (s: any) => (s.partner_id === partner.id || s.agent_id === partner.id) && (s.status === 'Completed' || s.status === 'Paid')
      );

      const totalPayable = partnerPurchases.reduce((sum: number, p: any) => sum + Number(p.payable_amount || 0), 0);
      const amountSettled = partnerSettlements.reduce((sum: number, s: any) => sum + Number(s.total_amount || 0), 0);
      const outstandingAmount = Math.max(0, totalPayable - amountSettled);

      const configuredCoursesCount = pricingList.filter(
        (pr: any) => pr.partnerId === partner.id || pr.partnerId === '*'
      ).length;

      return {
        id: partner.id,
        name: partner.name,
        email: partner.email,
        phone: partner.phone || '',
        status: partner.status || 'Active',
        onboarding_status: partner.onboardingStatus || 'Active',
        role: partner.role || 'AGENT',
        referral_code: partner.referral_code || 'REFPARTNER',
        general_commission: 0.0,
        course_commissions: {},
        totalPurchases: partnerPurchases.length,
        totalPayable,
        amountSettled,
        outstandingAmount,
        configuredCoursesCount,
        created_at: partner.createdAt || partner.created_at || new Date().toISOString(),
      };
    });
  }

  async createAgent(dto: any, adminId: string, adminName: string) {
    const users = this.readJsonFile(USERS_FILE, []);
    const normalizedEmail = (dto.email || '').trim().toLowerCase();

    if (!normalizedEmail || !dto.name) {
      throw new BadRequestException('Partner name and email are required.');
    }

    const existing = users.find((u: any) => (u.email || '').toLowerCase() === normalizedEmail);
    if (existing) {
      throw new BadRequestException('An account with this email already exists.');
    }

    const newId = randomUUID();
    const rawPassword = dto.password || 'password123';
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const newPartner = {
      id: newId,
      name: dto.name.trim(),
      email: normalizedEmail,
      phone: dto.phone || null,
      role: 'AGENT',
      status: 'Active',
      onboardingStatus: 'Active',
      password: hashedPassword,
      plainPassword: rawPassword,
      referral_code: dto.referralCode || `PARTNER-${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    users.push(newPartner);
    this.writeJsonFile(USERS_FILE, users);

    try {
      const db = this.getDb();
      await db.from('User').insert({
        id: newId,
        name: newPartner.name,
        email: newPartner.email,
        phone: newPartner.phone,
        role: 'AGENT',
        password: hashedPassword,
        createdAt: newPartner.createdAt,
        updatedAt: newPartner.updatedAt,
      });
    } catch {
      // offline fallback
    }

    await this.logAction(adminId, adminName, 'CREATE_PARTNER', 'Partners', newId, `Created Partner Agency: ${dto.name} (${normalizedEmail})`);

    return newPartner;
  }

  async updateAgentStatus(id: string, status: string, adminId: string, adminName: string) {
    const users = this.readJsonFile(USERS_FILE, []);
    const partner = users.find((u: any) => u.id === id);

    if (!partner) {
      throw new NotFoundException('Partner account not found.');
    }

    partner.status = status;
    partner.updatedAt = new Date().toISOString();
    this.writeJsonFile(USERS_FILE, users);

    try {
      const db = this.getDb();
      await db.from('User').update({ status }).eq('id', id);
    } catch {
      // offline
    }

    await this.logAction(adminId, adminName, 'UPDATE_STATUS', 'Partners', id, `Updated status to ${status} for ${partner.name}`);

    return { message: 'Partner status updated successfully', status };
  }

  // --- 3. Chapter 4: Partner-Course Pricing Management ---
  async getPricing() {
    const pricing = this.readJsonFile(PRICING_FILE, []);
    const users = this.readJsonFile(USERS_FILE, []);

    return pricing.map((p: any) => {
      const partner = users.find((u: any) => u.id === p.partnerId);
      return {
        ...p,
        partnerName: p.partnerId === '*' ? 'Global Default (All Partners)' : partner?.name || `Partner (${p.partnerId.slice(0, 8)})`,
      };
    });
  }

  async setPricing(dto: any, adminId: string, adminName: string) {
    if (!dto.courseCode || !dto.hariOmPayableAmount) {
      throw new BadRequestException('Course code and Hari Om payable amount are required.');
    }

    const pricing = this.readJsonFile(PRICING_FILE, []);
    const partnerId = dto.partnerId || '*';
    const courseCode = dto.courseCode.toUpperCase();
    const payableAmount = Number(dto.hariOmPayableAmount);

    const existingIdx = pricing.findIndex(
      (p: any) => (p.partnerId === partnerId || (partnerId === '*' && p.partnerId === '*')) && p.courseCode === courseCode
    );

    let resultRecord: any;

    if (existingIdx >= 0) {
      pricing[existingIdx].hariOmPayableAmount = payableAmount;
      pricing[existingIdx].courseName = dto.courseName || pricing[existingIdx].courseName;
      pricing[existingIdx].standardFee = Number(dto.standardFee || pricing[existingIdx].standardFee);
      pricing[existingIdx].status = dto.status || 'Active';
      resultRecord = pricing[existingIdx];
    } else {
      resultRecord = {
        id: `price-${randomUUID().slice(0, 8)}`,
        partnerId,
        courseId: dto.courseId || '*',
        courseCode,
        courseName: dto.courseName || courseCode,
        standardFee: Number(dto.standardFee || payableAmount),
        hariOmPayableAmount: payableAmount,
        status: dto.status || 'Active',
      };
      pricing.push(resultRecord);
    }

    this.writeJsonFile(PRICING_FILE, pricing);

    await this.logAction(
      adminId,
      adminName,
      'CONFIGURE_PRICING',
      'Partner Pricing',
      resultRecord.id,
      `Configured ${courseCode} payable amount to ₹${payableAmount} for ${partnerId === '*' ? 'All Partners' : `Partner ID ${partnerId}`}`
    );

    return resultRecord;
  }

  async deletePricing(id: string, adminId: string, adminName: string) {
    let pricing = this.readJsonFile(PRICING_FILE, []);
    const item = pricing.find((p: any) => p.id === id);

    if (!item) {
      throw new NotFoundException('Pricing record not found.');
    }

    pricing = pricing.filter((p: any) => p.id !== id);
    this.writeJsonFile(PRICING_FILE, pricing);

    await this.logAction(
      adminId,
      adminName,
      'DELETE_PRICING',
      'Partner Pricing',
      id,
      `Deleted pricing rule for ${item.courseCode}`
    );

    return { message: 'Pricing record deleted successfully' };
  }

  // --- 4. Chapter 3, 5 & 8: Purchases Ledger ---
  async getPurchases(query: any = {}) {
    const purchases = this.readJsonFile(PURCHASES_FILE, []);
    let filtered = [...purchases];

    if (query.partnerId) {
      filtered = filtered.filter((p: any) => p.partner_id === query.partnerId);
    }

    if (query.settlementStatus && query.settlementStatus !== 'ALL') {
      filtered = filtered.filter((p: any) => (p.settlement_status || '').toLowerCase() === query.settlementStatus.toLowerCase());
    }

    if (query.search) {
      const q = query.search.toLowerCase();
      filtered = filtered.filter(
        (p: any) =>
          (p.seafarer_name || '').toLowerCase().includes(q) ||
          (p.indos_number || '').toLowerCase().includes(q) ||
          (p.course_code || '').toLowerCase().includes(q) ||
          (p.purchase_number || '').toLowerCase().includes(q) ||
          (p.partner_name || '').toLowerCase().includes(q)
      );
    }

    return filtered;
  }

  // --- 5. Chapter 5: Settlements Verification ---
  async getSettlements() {
    const settlements = this.readJsonFile(SETTLEMENTS_FILE, []);
    const purchases = this.readJsonFile(PURCHASES_FILE, []);
    const users = this.readJsonFile(USERS_FILE, []);

    return settlements.map((s: any) => {
      const partner = users.find((u: any) => u.id === (s.partner_id || s.agent_id));
      const linkedPurchases = purchases.filter((p: any) => (s.purchase_ids || []).includes(p.id));
      return {
        ...s,
        partnerName: s.partner_name || partner?.name || 'Hari Om Partner',
        partnerEmail: partner?.email || '',
        linkedPurchases,
      };
    });
  }

  async verifySettlement(id: string, dto: any, adminId: string, adminName: string) {
    const settlements = this.readJsonFile(SETTLEMENTS_FILE, []);
    const settlement = settlements.find((s: any) => s.id === id);

    if (!settlement) {
      throw new NotFoundException('Settlement batch not found.');
    }

    settlement.status = 'Completed';
    settlement.paid_at = new Date().toISOString();
    settlement.verified_by = adminName;
    settlement.verified_at = new Date().toISOString();
    this.writeJsonFile(SETTLEMENTS_FILE, settlements);

    // Mark linked purchases as Settled
    const purchases = this.readJsonFile(PURCHASES_FILE, []);
    const purchaseIds: string[] = settlement.purchase_ids || [];

    purchases.forEach((p: any) => {
      if (purchaseIds.includes(p.id)) {
        p.settlement_status = 'Settled';
        p.settlement_id = settlement.id;
      }
    });
    this.writeJsonFile(PURCHASES_FILE, purchases);

    await this.logAction(
      adminId,
      adminName,
      'VERIFY_SETTLEMENT',
      'Finance & Settlements',
      id,
      `Verified and Completed settlement batch ${settlement.settlement_number} (₹${settlement.total_amount}) with UTR: ${settlement.utr_reference}`
    );

    return settlement;
  }

  async rejectSettlement(id: string, dto: any, adminId: string, adminName: string) {
    const settlements = this.readJsonFile(SETTLEMENTS_FILE, []);
    const settlement = settlements.find((s: any) => s.id === id);

    if (!settlement) {
      throw new NotFoundException('Settlement batch not found.');
    }

    const reason = dto.reason || dto.remarks || 'Payment reference verification failed.';

    settlement.status = 'Rejected';
    settlement.rejection_reason = reason;
    settlement.rejected_by = adminName;
    settlement.rejected_at = new Date().toISOString();
    this.writeJsonFile(SETTLEMENTS_FILE, settlements);

    // Revert linked purchases to Pending
    const purchases = this.readJsonFile(PURCHASES_FILE, []);
    const purchaseIds: string[] = settlement.purchase_ids || [];

    purchases.forEach((p: any) => {
      if (purchaseIds.includes(p.id)) {
        p.settlement_status = 'Pending';
        p.settlement_id = null;
      }
    });
    this.writeJsonFile(PURCHASES_FILE, purchases);

    await this.logAction(
      adminId,
      adminName,
      'REJECT_SETTLEMENT',
      'Finance & Settlements',
      id,
      `Rejected settlement batch ${settlement.settlement_number} - Reason: ${reason}`
    );

    return settlement;
  }

  // --- 6. Chapter 2 & 6: Seafarer Master Registry ---
  async getReferredSeafarers() {
    const users = this.readJsonFile(USERS_FILE, []);
    const seafarers = users.filter((u: any) => (u.role || '').toUpperCase() === 'SEAFARER');
    const localSeafarers = this.readJsonFile(path.join(process.cwd(), 'seafarers_local_data.json'), []);
    const purchases = this.readJsonFile(PURCHASES_FILE, []);

    // Merge seafarers from users, local store, and purchases
    const map = new Map<string, any>();

    seafarers.forEach((s: any) => {
      map.set(s.id, {
        id: s.id,
        name: s.name,
        email: s.email,
        phone: s.phone || '',
        indosNumber: s.indosNumber || 'Pending',
        passportNumber: s.passportNumber || '',
        cdcNumber: s.cdcNumber || '',
        purchasesCount: 0,
        createdAt: s.createdAt || new Date().toISOString(),
      });
    });

    localSeafarers.forEach((s: any) => {
      map.set(s.id, {
        id: s.id,
        name: s.name,
        email: s.email,
        phone: s.phone || '',
        indosNumber: s.indosNumber || 'Pending',
        passportNumber: s.passportNumber || '',
        cdcNumber: s.cdcNumber || '',
        purchasesCount: 0,
        createdAt: s.createdAt || new Date().toISOString(),
      });
    });

    purchases.forEach((p: any) => {
      const existing = map.get(p.seafarer_id) || {
        id: p.seafarer_id,
        name: p.seafarer_name,
        email: p.seafarer_email,
        phone: p.seafarer_phone || '',
        indosNumber: p.indos_number || 'Pending',
        passportNumber: p.passport_number || '',
        cdcNumber: p.cdc_number || '',
        purchasesCount: 0,
        createdAt: p.purchase_date || p.created_at || new Date().toISOString(),
      };
      existing.purchasesCount += 1;
      map.set(p.seafarer_id, existing);
    });

    return Array.from(map.values());
  }

  // --- 7. Audit Logs ---
  async getAuditLogs() {
    return this.readJsonFile(AUDIT_LOGS_FILE, []);
  }

  // --- Legacy Compatibility Methods ---
  async updateAgentCommission(id: string, generalCommission: number, courseCommissions: any, adminId: string, adminName: string) {
    return { message: 'Commission update acknowledged' };
  }

  async resetAgentPassword(id: string, dto: any, adminId: string, adminName: string) {
    const users = this.readJsonFile(USERS_FILE, []);
    const partner = users.find((u: any) => u.id === id);
    if (partner) {
      partner.plainPassword = dto.password || 'password123';
      partner.password = await bcrypt.hash(partner.plainPassword, 10);
      this.writeJsonFile(USERS_FILE, users);
    }
    return { message: 'Password reset successfully' };
  }

  async getAgentOnboarding(id: string) {
    return { status: 'Active' };
  }

  async getReferralLeads() {
    return [];
  }

  async getCommissions() {
    return [];
  }

  async getReports() {
    return { totalRevenue: '₹0' };
  }

  async updateAgentDetails(id: string, data: any, adminId: string, adminName: string) {
    const users = this.readJsonFile(USERS_FILE, []);
    const partner = users.find((u: any) => u.id === id);
    if (partner) {
      Object.assign(partner, data);
      this.writeJsonFile(USERS_FILE, users);
    }
    return partner;
  }

  async verifyAgentDocument(id: string, docId: string, status: string, remarks: string, adminId: string, adminName: string) {
    return { message: 'Document verified' };
  }

  async getReferralConflicts() {
    return [];
  }

  async resolveConflict(purchaseId: string, approvedAgentId: string, remarks: string, adminId: string, adminName: string) {
    return { message: 'Conflict resolved' };
  }

  async updateCommissionStatus(id: string, status: string, reason: string, adminId: string, adminName: string) {
    return { message: 'Status updated' };
  }

  async getCommissionStatusHistory(id: string) {
    return [];
  }

  async createSettlementBatch(dto: any, adminId: string, adminName: string) {
    return { message: 'Batch created' };
  }

  async paySettlement(id: string, adminId: string, adminName: string) {
    return this.verifySettlement(id, {}, adminId, adminName);
  }
}
