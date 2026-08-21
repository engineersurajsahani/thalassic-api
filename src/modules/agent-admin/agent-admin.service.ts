import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AgentAdminService {
  private settlementsFilePath = path.join(process.cwd(), 'settlements_data.json');
  private inMemorySettlements: any[] = [];

  constructor(private readonly supabaseService: SupabaseService) {
    this.loadSettlementsFromDisk();
  }

  private loadSettlementsFromDisk() {
    try {
      if (fs.existsSync(this.settlementsFilePath)) {
        const raw = fs.readFileSync(this.settlementsFilePath, 'utf8');
        this.inMemorySettlements = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Error loading settlements from disk:', e);
    }
  }

  private saveSettlementsToDisk() {
    try {
      fs.writeFileSync(this.settlementsFilePath, JSON.stringify(this.inMemorySettlements, null, 2), 'utf8');
    } catch (e) {
      console.warn('Error saving settlements to disk:', e);
    }
  }

  private getDb() {
    return this.supabaseService.getClient();
  }

  // Helper to log administrative actions to the audit_logs table
  async logAction(
    userId: string,
    userName: string,
    action: string,
    module: string,
    entityId: string,
    details: string,
    ipAddress = '127.0.0.1',
  ) {
    const db = this.getDb();
    const { error } = await db.from('audit_logs').insert({
      id: randomUUID(),
      user_id: userId,
      user_name: userName,
      action,
      module,
      entity_id: entityId,
      details,
      ip_address: ipAddress,
      created_at: new Date().toISOString(),
    });
    if (error) {
      console.error('Failed to write audit log:', error.message);
    }
  }

  // --- 1. Dashboard metrics ---
  async getDashboardData() {
    const db = this.getDb();

    // 1. Total Registered Agents (Users with role AGENT or agent)
    const { count: totalAgents } = await db
      .from('User')
      .select('*', { count: 'exact', head: true })
      .in('role', ['agent', 'AGENT', 'Agent']);

    // 2. Active Agents
    const { count: activeAgents } = await db
      .from('User')
      .select('*', { count: 'exact', head: true })
      .in('role', ['agent', 'AGENT', 'Agent'])
      .eq('status', 'Active');

    // 3. Pending Onboarding
    const { count: pendingOnboarding } = await db
      .from('agent_metadata')
      .select('*', { count: 'exact', head: true })
      .in('onboarding_status', ['Invited', 'Profile Pending', 'Referral Pending']);

    // 4. Total Referral Leads
    const { count: totalLeads } = await db
      .from('referral_leads')
      .select('*', { count: 'exact', head: true });

    // 5. Active Referral Leads (New, Contacted, Registered)
    const { count: activeLeads } = await db
      .from('referral_leads')
      .select('*', { count: 'exact', head: true })
      .in('status', ['New', 'Contacted', 'Registered']);

    // 6. Expired Referral Leads
    const { count: expiredLeads } = await db
      .from('referral_leads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Expired');

    // 7. Total Referred Seafarers (Unique agents' commissions seafarer names or purchase records)
    const { data: uniqueSeafarers } = await db
      .from('commissions')
      .select('seafarer_name');
    const totalReferredSeafarers = new Set((uniqueSeafarers || []).map((c: any) => c.seafarer_name)).size;

    // 8. Commission Payable (Pending + Approved) & Total Revenue
    const { data: commissions } = await db
      .from('commissions')
      .select('commission_amount, course_fee, status');

    let commissionPayable = 0;
    let commissionPaid = 0;
    let totalRevenueEarned = 0;

    (commissions || []).forEach((c: any) => {
      const amt = parseFloat(c.commission_amount) || 0;
      const fee = parseFloat(c.course_fee) || 0;
      
      // Sum all revenue from commissions (these represent successful referrals)
      totalRevenueEarned += fee;

      if (c.status === 'Paid') {
        commissionPaid += amt;
      } else if (c.status === 'Approved' || c.status === 'Pending') {
        commissionPayable += amt;
      }
    });

    // 9. Recent Activities (from audit logs)
    const { data: recentLogs } = await db
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    // 10. Partner Applications (read from disk for demo)
    let pendingPartnerAppsCount = 0;
    let recentPartnerApps = [];
    try {
      const storageFilePath = path.join(process.cwd(), 'partner_applications_data.json');
      if (fs.existsSync(storageFilePath)) {
        const raw = fs.readFileSync(storageFilePath, 'utf8');
        const apps = JSON.parse(raw);
        pendingPartnerAppsCount = apps.filter((a: any) => a.status === 'Pending Review').length;
        recentPartnerApps = apps.slice(0, 5);
      }
    } catch (e) {
      console.error('Error reading partner applications for dashboard', e);
    }

    return {
      kpis: {
        totalAgents: totalAgents || 0,
        activeAgents: activeAgents || 0,
        pendingOnboarding: pendingOnboarding || 0,
        totalLeads: totalLeads || 0,
        activeLeads: activeLeads || 0,
        expiredLeads: expiredLeads || 0,
        totalReferredSeafarers,
        totalRevenueEarned: `₹${totalRevenueEarned.toLocaleString('en-IN')}`,
        commissionPayable: `₹${commissionPayable.toLocaleString('en-IN')}`,
        commissionPaid: `₹${commissionPaid.toLocaleString('en-IN')}`,
        pendingPartnerApps: pendingPartnerAppsCount,
      },
      partnerApplications: recentPartnerApps,
      recentActivities: (recentLogs || []).map((log: any) => ({
        id: log.id,
        user: log.user_name || 'Admin',
        action: log.action,
        module: log.module,
        details: log.details,
        timestamp: log.created_at,
      })),
    };
  }

  // --- 2. Agent Management ---
  async getAgents() {
    const db = this.getDb();

    // Fetch all user accounts with role AGENT (case-insensitive check)
    const { data: users, error: userError } = await db
      .from('User')
      .select('id, name, email, phone, role, status, createdAt')
      .in('role', ['agent', 'AGENT', 'Agent']);

    if (userError) throw new BadRequestException(userError.message);

    // Fetch all agent metadata records
    const { data: metadata, error: metaError } = await db
      .from('agent_metadata')
      .select('*');

    const metaMap = new Map((metadata || []).map((m: any) => [m.user_id, m]));

    return (users || []).map((user: any) => {
      const meta = metaMap.get(user.id) || {};
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        status: user.status,
        createdAt: user.createdAt,
        referralCode: meta.referral_code || null,
        qrCode: meta.qr_code || null,
        onboardingStatus: meta.onboarding_status || 'Invited',
        generalCommission: meta.general_commission || 5.0,
        courseCommissions: meta.course_commissions || {},
      };
    });
  }

  async createAgent(dto: any, adminId: string, adminName: string) {
    const db = this.getDb();
    const { name, email, password, phone, generalCommission = 5.0 } = dto;

    if (!name || !email || !password) {
      throw new BadRequestException('Name, email, and password are required');
    }

    // Check email uniqueness using maybeSingle (single() throws PGRST116 on 0 rows)
    const { data: existingUser } = await db
      .from('User')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      throw new BadRequestException('Agent with this email already exists');
    }

    const agentId = randomUUID();
    const hashedPassword = await bcrypt.hash(password, 10);

    // 1. Create User record
    const { error: userError } = await db.from('User').insert({
      id: agentId,
      name,
      email,
      password: hashedPassword,
      phone: phone || null,
      role: 'agent',
      status: 'Pending Audit',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    if (userError) throw new BadRequestException(userError.message);

    // 2. Create agent metadata with auto-generated referral code
    const cleanName = (name || 'AGENT').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 5);
    const autoRefCode = `REF${cleanName}${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      await db.from('agent_metadata').insert({
        id: randomUUID(),
        user_id: agentId,
        referral_code: autoRefCode,
        qr_code: null,
        onboarding_status: 'Invited',
        general_commission: generalCommission,
        course_commissions: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Agent metadata insert warning:', e);
    }

    // 3. Log audit action
    await this.logAction(
      adminId,
      adminName,
      'CREATE_AGENT',
      'Agent Management',
      agentId,
      `Created agent account for ${name} (${email}) with general commission of ${generalCommission}%`,
    );

    return {
      id: agentId,
      name,
      email,
      phone,
      status: 'Pending Audit',
      onboardingStatus: 'Invited',
      generalCommission,
    };
  }

  async updateAgentStatus(agentId: string, status: string, adminId: string, adminName: string) {
    const db = this.getDb();

    const { data: agent } = await db.from('User').select('name, email').eq('id', agentId).single();
    if (!agent) throw new NotFoundException('Agent not found');

    const { error } = await db
      .from('User')
      .update({ status, updatedAt: new Date().toISOString() })
      .eq('id', agentId);

    if (error) throw new BadRequestException(error.message);

    // If active, update onboarding status to Active too if it's currently completed
    if (status === 'Active') {
      await db
        .from('agent_metadata')
        .update({ onboarding_status: 'Active', updated_at: new Date().toISOString() })
        .eq('user_id', agentId);
    } else if (status === 'Deactivated') {
      await db
        .from('agent_metadata')
        .update({ onboarding_status: 'Inactive', updated_at: new Date().toISOString() })
        .eq('user_id', agentId);
    }

    await this.logAction(
      adminId,
      adminName,
      'UPDATE_AGENT_STATUS',
      'Agent Management',
      agentId,
      `Updated status of agent ${agent.name} to ${status}`,
    );

    return { id: agentId, status };
  }

  async updateAgentCommission(
    agentId: string,
    generalCommission: number,
    courseCommissions: Record<string, number>,
    adminId: string,
    adminName: string,
  ) {
    const db = this.getDb();

    const { data: agent } = await db.from('User').select('name').eq('id', agentId).single();
    if (!agent) throw new NotFoundException('Agent not found');

    const { error } = await db
      .from('agent_metadata')
      .update({
        general_commission: generalCommission,
        course_commissions: courseCommissions || {},
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', agentId);

    if (error) throw new BadRequestException(error.message);

    await this.logAction(
      adminId,
      adminName,
      'UPDATE_AGENT_COMMISSION',
      'Agent Management',
      agentId,
      `Updated commissions for agent ${agent.name}: General = ${generalCommission}%, Course-specific overrides saved.`,
    );

    return { id: agentId, generalCommission, courseCommissions };
  }

  async resetAgentPassword(agentId: string, passwordDto: any, adminId: string, adminName: string) {
    const db = this.getDb();
    const { password } = passwordDto;

    if (!password) throw new BadRequestException('Password is required');

    const { data: agent } = await db.from('User').select('name').eq('id', agentId).single();
    if (!agent) throw new NotFoundException('Agent not found');

    const hashedPassword = await bcrypt.hash(password, 10);

    const { error } = await db
      .from('User')
      .update({ password: hashedPassword, updatedAt: new Date().toISOString() })
      .eq('id', agentId);

    if (error) throw new BadRequestException(error.message);

    await this.logAction(
      adminId,
      adminName,
      'RESET_AGENT_PASSWORD',
      'Agent Management',
      agentId,
      `Reset password for agent ${agent.name}`,
    );

    return { id: agentId, success: true };
  }

  async getAgentOnboarding(agentId: string) {
    const db = this.getDb();
    const { data: meta } = await db
      .from('agent_metadata')
      .select('*')
      .eq('user_id', agentId)
      .single();

    if (!meta) throw new NotFoundException('Agent metadata not found');

    // Compile onboarding checklist
    const checklist = [
      { step: 1, label: 'Account Invited', status: 'completed' },
      { 
        step: 2, 
        label: 'First Login & Password Change', 
        status: meta.onboarding_status !== 'Invited' ? 'completed' : 'pending' 
      },
      { 
        step: 3, 
        label: 'Profile Completion & Business Details', 
        status: ['Referral Pending', 'Active', 'Inactive'].includes(meta.onboarding_status) ? 'completed' : 'pending' 
      },
      { 
        step: 4, 
        label: 'Unique Referral Code Creation', 
        status: meta.referral_code ? 'completed' : 'pending' 
      },
      { 
        step: 5, 
        label: 'Account Active & Verification Approved', 
        status: meta.onboarding_status === 'Active' ? 'completed' : 'pending' 
      }
    ];

    const { data: documents } = await db
      .from('Document')
      .select('*')
      .eq('userId', agentId);

    return {
      agentId,
      status: meta.onboarding_status,
      checklist,
      documents: documents || [],
    };
  }

  // --- 3. Referred Seafarers ---
  async getReferredSeafarers() {
    const db = this.getDb();
    
    // Fetch from commissions to list seafarers referred by agents
    const { data: commissions, error } = await db
      .from('commissions')
      .select('*, User:agent_id(name, email)');

    if (error) throw new BadRequestException(error.message);

    return (commissions || []).map((c: any) => ({
      id: c.id,
      seafarerName: c.seafarer_name,
      courseName: c.course_name,
      purchaseAmount: `₹${c.course_fee.toLocaleString('en-IN')}`,
      purchaseDate: c.created_at,
      status: c.status,
      agentName: c.User?.name || 'Unknown Agent',
      agentEmail: c.User?.email || '',
    }));
  }

  // --- 4. Referral Leads ---
  async getReferralLeads() {
    const db = this.getDb();
    const { data: leads, error } = await db
      .from('referral_leads')
      .select('*, User:agent_id(name)');

    if (error) throw new BadRequestException(error.message);

    return (leads || []).map((l: any) => ({
      id: l.id,
      name: l.name,
      email: l.email,
      phone: l.phone,
      city: l.city,
      status: l.status,
      remarks: l.remarks,
      createdAt: l.created_at,
      expiryAt: l.expiry_at,
      agentName: l.User?.name || 'Unknown Agent',
    }));
  }

  // --- 5. Commissions & Lifecycle ---
  async getCommissions() {
    const db = this.getDb();
    let comms: any[] = [];
    try {
      const { data, error } = await db
        .from('commissions')
        .select('*, User:agent_id(name)');
      if (!error && data) comms = data;
    } catch (e) {
      console.warn('Error fetching commissions from Supabase:', e);
    }

    // Also fetch linked HAC invoice numbers
    let invMap = new Map();
    try {
      const { data: invoices } = await db
        .from('invoices')
        .select('commission_snapshot_id, invoice_number');
      invMap = new Map((invoices || []).map((inv: any) => [inv.commission_snapshot_id, inv.invoice_number]));
    } catch (e) {
      console.warn('Error fetching invoices for commissions map:', e);
    }

    return comms.map((c: any) => ({
      id: c.id,
      invoiceNumber: invMap.get(c.id) || `HAC-2026-${c.id.substring(0, 6).toUpperCase()}`,
      seafarerName: c.seafarer_name,
      courseName: c.course_name,
      courseFee: `₹${Number(c.course_fee || 0).toLocaleString('en-IN')}`,
      commissionRate: `${c.commission_rate}%`,
      commissionAmount: `₹${Number(c.commission_amount || 0).toLocaleString('en-IN')}`,
      rawAmount: Number(c.commission_amount) || 0,
      commissionSource: c.commission_source || 'General Commission',
      commissionVersion: c.commission_version || 'v1.0',
      remarks: c.remarks || null,
      rejectionReason: c.rejection_reason || null,
      status: c.status,
      agentId: c.agent_id,
      agentName: c.User?.name || 'Agent User',
      createdAt: c.created_at,
      settledAt: c.settled_at || null,
    }));
  }

  // --- 5.0 Lifecycle Transition Enforcement ---
  async updateCommissionStatus(
    commissionId: string,
    newStatus: string,
    reason: string,
    adminId: string,
    adminName: string,
  ) {
    const db = this.getDb();
    const nowIso = new Date().toISOString();

    const { data: current, error: fetchErr } = await db
      .from('commissions')
      .select('*')
      .eq('id', commissionId)
      .single();

    if (fetchErr || !current) throw new NotFoundException('Commission record not found');

    // PRD 9.5 & 9.8 Rule: Paid commissions cannot be modified
    if (current.status === 'Paid') {
      throw new BadRequestException('PRD 9.5 & 9.8 Violation: Paid commissions cannot be modified.');
    }

    // Mandatory rejection reason check
    if (newStatus === 'Rejected' && (!reason || reason.trim().length === 0)) {
      throw new BadRequestException('Rejection reason is mandatory when rejecting a commission.');
    }

    // Invalid Status Transition Prevention
    const validTransitions: Record<string, string[]> = {
      Pending: ['Approved', 'Rejected', 'Cancelled'],
      Approved: ['Settled', 'Cancelled'],
      'Under Review': ['Pending', 'Approved', 'Rejected', 'Cancelled'],
      Rejected: [],
      Settled: ['Paid', 'Cancelled'],
      Paid: [],
    };

    const allowed = validTransitions[current.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${current.status} to ${newStatus}. Allowed transitions: ${allowed.join(', ') || 'None'}`,
      );
    }

    // Update commission record
    const updateData: any = {
      status: newStatus,
    };
    if (newStatus === 'Rejected') {
      updateData.rejection_reason = reason;
    }

    const { error: updateErr } = await db
      .from('commissions')
      .update(updateData)
      .eq('id', commissionId);

    if (updateErr) console.warn('Commission update warning:', updateErr.message);

    // Record transition history in commission_status_history
    try {
      await db.from('commission_status_history').insert({
        id: randomUUID(),
        commission_id: commissionId,
        old_status: current.status,
        new_status: newStatus,
        reason: reason || `Status updated to ${newStatus} by ${adminName}`,
        changed_by_user_id: adminId,
        changed_by_user_name: adminName,
        created_at: nowIso,
      });
    } catch (e) {
      console.warn('History table insert warning:', e);
    }

    // Write audit log
    const action = newStatus === 'Approved' ? 'COMMISSION_APPROVED' : newStatus === 'Rejected' ? 'COMMISSION_REJECTED' : 'COMMISSION_STATUS_UPDATE';
    await this.logAction(
      adminId,
      adminName,
      action,
      'Commissions',
      commissionId,
      `Updated commission for ${current.seafarer_name} (${current.course_name}) from ${current.status} to ${newStatus}. Reason: ${reason || 'N/A'}`,
    );

    return { id: commissionId, oldStatus: current.status, newStatus, success: true };
  }

  async getCommissionStatusHistory(commissionId: string) {
    const db = this.getDb();
    try {
      const { data, error } = await db
        .from('commission_status_history')
        .select('*')
        .eq('commission_id', commissionId)
        .order('created_at', { ascending: true });

      if (!error && data) return data;
    } catch (e) {
      console.warn('Error fetching status history:', e);
    }
    return [
      {
        id: 'hist-init-1',
        commission_id: commissionId,
        old_status: 'None',
        new_status: 'Pending',
        reason: 'Initial commission snapshot created upon course purchase',
        changed_by_user_name: 'System Auto-Capture',
        created_at: new Date().toISOString(),
      }
    ];
  }

  // --- 5.1 Settlement Workflow ---
  async createSettlementBatch(dto: { agentId: string; commissionIds: string[] }, adminId: string, adminName: string) {
    const db = this.getDb();
    const nowIso = new Date().toISOString();
    const { agentId, commissionIds } = dto;

    if (!commissionIds || commissionIds.length === 0) {
      throw new BadRequestException('Please select at least one approved commission to create a settlement batch.');
    }

    // Verify all commissions belong to this agent and are in Approved status
    const { data: comms } = await db
      .from('commissions')
      .select('*')
      .in('id', commissionIds)
      .eq('agent_id', agentId);

    if (!comms || comms.length === 0) {
      throw new NotFoundException('No matching commissions found for settlement creation.');
    }

    const nonApproved = comms.filter((c: any) => c.status !== 'Approved');
    if (nonApproved.length > 0) {
      throw new BadRequestException('PRD 9.7 Violation: Only Approved commissions can be included in settlement batches.');
    }

    const totalAmount = comms.reduce((sum: number, c: any) => sum + (parseFloat(c.commission_amount) || 0), 0);

    // Find linked HAC invoice number from existing invoices
    let hacInvoiceNumber = `HAC-2026-SET-${randomUUID().substring(0, 6).toUpperCase()}`;
    try {
      const { data: linkedInvoices } = await db
        .from('invoices')
        .select('invoice_number')
        .in('commission_snapshot_id', commissionIds)
        .limit(1);

      if (linkedInvoices?.[0]?.invoice_number) {
        hacInvoiceNumber = linkedInvoices[0].invoice_number;
      }
    } catch (e) {
      console.warn('Invoices table check warning:', e);
    }

    const year = new Date().getFullYear();
    const settlementId = randomUUID();
    const settlementNumber = `SET-${year}-${randomUUID().substring(0, 6).toUpperCase()}`;

    const settlementObj = {
      id: settlementId,
      settlement_number: settlementNumber,
      agent_id: agentId,
      hac_invoice_number: hacInvoiceNumber,
      total_amount: totalAmount,
      status: 'Pending',
      created_at: nowIso,
    };

    // Save locally
    this.inMemorySettlements.unshift(settlementObj);
    this.saveSettlementsToDisk();

    try {
      await db.from('settlements').insert(settlementObj);
    } catch (e) {
      console.warn('Settlements insert warning:', e);
    }

    // Update commissions status to Settled and set settlement_id
    for (const c of comms) {
      try {
        await db
          .from('commissions')
          .update({
            status: 'Settled',
            settlement_id: settlementId,
          })
          .eq('id', c.id);

        await db.from('commission_status_history').insert({
          id: randomUUID(),
          commission_id: c.id,
          old_status: 'Approved',
          new_status: 'Settled',
          reason: `Linked to Settlement Batch ${settlementNumber}`,
          changed_by_user_id: adminId,
          changed_by_user_name: adminName,
          created_at: nowIso,
        });
      } catch (e) {
        console.warn('Commission settlement link warning:', e);
      }
    }

    // Write audit log
    await this.logAction(
      adminId,
      adminName,
      'SETTLEMENT_CREATED',
      'Settlements',
      settlementId,
      `Created Settlement Batch ${settlementNumber} for Agent ${agentId} linking ${comms.length} commissions (Total: ₹${totalAmount.toLocaleString('en-IN')})`,
    );

    return settlementObj;
  }

  async getSettlements() {
    const db = this.getDb();
    try {
      const { data: settlements, error } = await db
        .from('settlements')
        .select('*, User:agent_id(name)')
        .order('created_at', { ascending: false });

      if (!error && settlements && settlements.length > 0) {
        return settlements.map((s: any) => ({
          id: s.id,
          settlementNumber: s.settlement_number,
          agentId: s.agent_id,
          agentName: s.User?.name || 'Agent User',
          hacInvoiceNumber: s.hac_invoice_number,
          totalAmount: `₹${parseFloat(s.total_amount || 0).toLocaleString('en-IN')}`,
          rawAmount: parseFloat(s.total_amount || 0),
          status: s.status,
          createdAt: s.created_at,
          paidAt: s.paid_at || null,
        }));
      }
    } catch (e) {
      console.warn('Error fetching settlements from Supabase:', e);
    }

    // Fallback to local settlements
    let userMap = new Map();
    try {
      const { data: users } = await db.from('User').select('id, name');
      userMap = new Map((users || []).map((u: any) => [u.id, u.name]));
    } catch (e) {
      console.warn('Error getting users map for settlements:', e);
    }

    return this.inMemorySettlements.map((s: any) => ({
      id: s.id,
      settlementNumber: s.settlement_number,
      agentId: s.agent_id,
      agentName: userMap.get(s.agent_id) || 'Agent User',
      hacInvoiceNumber: s.hac_invoice_number,
      totalAmount: `₹${parseFloat(s.total_amount || 0).toLocaleString('en-IN')}`,
      rawAmount: parseFloat(s.total_amount || 0),
      status: s.status,
      createdAt: s.created_at,
      paidAt: s.paid_at || null,
    }));
  }

  async approveSettlement(settlementId: string, adminId: string, adminName: string) {
    const db = this.getDb();
    const nowIso = new Date().toISOString();

    let settlement: any = null;
    try {
      const { data } = await db
        .from('settlements')
        .select('*')
        .eq('id', settlementId)
        .maybeSingle();
      if (data) settlement = data;
    } catch (e) {
      console.warn('Supabase settlement lookup warning:', e);
    }

    if (!settlement) {
      settlement = this.inMemorySettlements.find(s => s.id === settlementId);
    }

    if (!settlement) throw new NotFoundException('Settlement record not found');

    if (settlement.status !== 'Pending') {
      throw new BadRequestException('Only Pending settlements can be approved.');
    }

    // Update local settlement state
    settlement.status = 'Approved';
    this.saveSettlementsToDisk();

    // Update remote settlement to Approved
    try {
      await db
        .from('settlements')
        .update({ status: 'Approved' })
        .eq('id', settlementId);
    } catch (e) {
      console.warn('Supabase settlement update warning:', e);
    }

    // Update linked commissions to Approved
    let comms: any[] = [];
    try {
      const { data } = await db
        .from('commissions')
        .select('id, status')
        .eq('settlement_id', settlementId);
      if (data) comms = data;
    } catch (e) {
      console.warn('Supabase commissions lookup warning:', e);
    }

    for (const c of comms) {
      try {
        await db
          .from('commissions')
          .update({ status: 'Approved' })
          .eq('id', c.id);

        await db.from('commission_status_history').insert({
          id: randomUUID(),
          commission_id: c.id,
          old_status: c.status,
          new_status: 'Approved',
          reason: `Settlement Batch ${settlement.settlement_number} approved by Master`,
          changed_by_user_id: adminId,
          changed_by_user_name: adminName,
          created_at: nowIso,
        });
      } catch (e) {
        console.warn('Commissions status history Approved insert warning:', e);
      }
    }

    // Write audit log
    await this.logAction(
      adminId,
      adminName,
      'SETTLEMENT_APPROVED',
      'Settlements',
      settlementId,
      `Approved Settlement Batch ${settlement.settlement_number} (Total: ₹${parseFloat(settlement.total_amount || 0).toLocaleString('en-IN')})`,
    );

    return { id: settlementId, status: 'Approved', success: true };
  }

  async paySettlement(settlementId: string, adminId: string, adminName: string) {
    const db = this.getDb();
    const nowIso = new Date().toISOString();

    let settlement: any = null;
    try {
      const { data } = await db
        .from('settlements')
        .select('*')
        .eq('id', settlementId)
        .maybeSingle();
      if (data) settlement = data;
    } catch (e) {
      console.warn('Supabase settlement lookup warning:', e);
    }

    if (!settlement) {
      settlement = this.inMemorySettlements.find(s => s.id === settlementId);
    }

    if (!settlement) throw new NotFoundException('Settlement record not found');

    if (settlement.status === 'Paid') {
      throw new BadRequestException('PRD 9.7 Violation: Paid settlements are immutable.');
    }

    // PRD 7.5: Do NOT allow a settlement to be marked Paid if it has not been approved
    if (settlement.status !== 'Approved') {
      throw new BadRequestException('PRD 7.5 Violation: Settlement must be Approved before it can be marked as Paid.');
    }

    // Update local settlement state
    settlement.status = 'Paid';
    settlement.paid_at = nowIso;
    this.saveSettlementsToDisk();

    // Update remote settlement to Paid
    try {
      await db
        .from('settlements')
        .update({
          status: 'Paid',
          paid_at: nowIso,
        })
        .eq('id', settlementId);
    } catch (e) {
      console.warn('Supabase settlement update warning:', e);
    }

    // Update linked commissions to Paid
    let comms: any[] = [];
    try {
      const { data } = await db
        .from('commissions')
        .select('id, status')
        .eq('settlement_id', settlementId);
      if (data) comms = data;
    } catch (e) {
      console.warn('Supabase commissions lookup warning:', e);
    }

    for (const c of comms) {
      try {
        await db
          .from('commissions')
          .update({
            status: 'Paid',
            settled_at: nowIso,
          })
          .eq('id', c.id);

        await db.from('commission_status_history').insert({
          id: randomUUID(),
          commission_id: c.id,
          old_status: c.status,
          new_status: 'Paid',
          reason: `Settlement Batch ${settlement.settlement_number} marked as Paid`,
          changed_by_user_id: adminId,
          changed_by_user_name: adminName,
          created_at: nowIso,
        });
      } catch (e) {
        console.warn('Commissions status history Paid insert warning:', e);
      }
    }

    // ── Generate HAC Invoice automatically on Successful Settlement Payment (PRD 7.5) ──
    let generatedInvoiceNumber = null;
    try {
      // 1. Get Agent details
      const { data: agentUser } = await db
        .from('User')
        .select('*')
        .eq('id', settlement.agent_id)
        .maybeSingle();

      const agentEmail = agentUser?.email || 'agent@thalassic.in';
      const agentName = agentUser?.name || 'Agent User';
      const agentPhone = agentUser?.phone || '';

      // 2. Generate unique sequential HAC invoice number
      const currentYear = new Date().getFullYear();
      const prefix = `HAC-${currentYear}-`;
      let invoicesList = [];
      const invoicesFilePath = path.join(process.cwd(), 'invoices_data.json');
      try {
        if (fs.existsSync(invoicesFilePath)) {
          invoicesList = JSON.parse(fs.readFileSync(invoicesFilePath, 'utf8'));
        }
      } catch (e) {
        console.warn('Invoices file read warning inside settlements:', e);
      }

      const count = invoicesList.filter((i: any) => i.invoice_type === 'HAC').length;
      const seqNum = String(count + 1).padStart(6, '0');
      generatedInvoiceNumber = `${prefix}${seqNum}`;

      const invoiceId = randomUUID();
      const invoiceObj = {
        id: invoiceId,
        invoice_number: generatedInvoiceNumber,
        invoice_type: 'HAC',
        user_id: settlement.agent_id,
        purchase_id: settlement.id, // Linked to Settlement
        agent_id: settlement.agent_id,
        commission_snapshot_id: comms[0]?.id || null, // Linked to commission snapshot
        customer_name: agentName,
        customer_email: agentEmail,
        customer_phone: agentPhone,
        agent_name: agentName,
        agent_referral_code: null,
        course_name: `Commission Settlement for ${settlement.settlement_number}`,
        course_fee: parseFloat(settlement.total_amount),
        discount: 0,
        final_amount: parseFloat(settlement.total_amount),
        payment_gateway: 'Manual Settlement',
        transaction_id: settlement.settlement_number, // Permanent reference link
        payment_method: 'Bank Transfer',
        payment_date: nowIso,
        status: 'Paid',
        created_at: nowIso,
      };

      // Save locally
      invoicesList.unshift(invoiceObj);
      fs.writeFileSync(invoicesFilePath, JSON.stringify(invoicesList, null, 2), 'utf8');

      // Save to Supabase DB
      await db.from('invoices').insert(invoiceObj);

      // Update local and remote settlement with generated invoice number
      settlement.hac_invoice_number = generatedInvoiceNumber;
      this.saveSettlementsToDisk();
      await db
        .from('settlements')
        .update({ hac_invoice_number: generatedInvoiceNumber })
        .eq('id', settlementId);
    } catch (e) {
      console.warn('[Settlement HAC Invoice] Error generating invoice:', e);
    }

    // Write audit log
    await this.logAction(
      adminId,
      adminName,
      'SETTLEMENT_PAID',
      'Settlements',
      settlementId,
      `Marked Settlement Batch ${settlement.settlement_number} as Paid (Total: ₹${parseFloat(settlement.total_amount || 0).toLocaleString('en-IN')})`,
    );

    return { id: settlementId, status: 'Paid', success: true };
  }

  // --- 6. Reports ---
  async getReports() {
    const db = this.getDb();

    // 1. Agent Performance
    const { data: agents } = await db.from('User').select('id, name').in('role', ['agent', 'AGENT', 'Agent']);
    const { data: comms } = await db.from('commissions').select('agent_id, commission_amount, course_fee');
    const { data: leads } = await db.from('referral_leads').select('agent_id, status, city');

    const performance = (agents || []).map((agent: any) => {
      const agentComms = (comms || []).filter((c: any) => c.agent_id === agent.id);
      const agentLeads = (leads || []).filter((l: any) => l.agent_id === agent.id);

      const totalEarnings = agentComms.reduce((acc, curr) => acc + (parseFloat(curr.commission_amount) || 0), 0);
      const totalSales = agentComms.reduce((acc, curr) => acc + (parseFloat(curr.course_fee) || 0), 0);
      const totalLeadsCount = agentLeads.length;
      const convertedLeads = agentLeads.filter((l: any) => l.status === 'Converted').length;
      const conversionRate = totalLeadsCount > 0 ? `${Math.round((convertedLeads / totalLeadsCount) * 100)}%` : '0%';

      return {
        agentName: agent.name,
        leads: totalLeadsCount,
        conversions: convertedLeads,
        conversionRate,
        totalSales: `₹${totalSales.toLocaleString('en-IN')}`,
        earnings: `₹${totalEarnings.toLocaleString('en-IN')}`,
      };
    });

    // 2. Conversion details
    const totalLeadsCount = (leads || []).length;
    const convertedLeadsCount = (leads || []).filter((l: any) => l.status === 'Converted').length;
    const globalConversionRate = totalLeadsCount > 0 ? `${((convertedLeadsCount / totalLeadsCount) * 100).toFixed(1)}%` : '0%';

    // 3. Region Stats
    const regions: Record<string, number> = {};
    (leads || []).forEach((l: any) => {
      let city = (l.city || '').trim();
      if (!city) {
        city = 'Unknown';
      } else {
        city = city.split(' ')
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      }
      regions[city] = (regions[city] || 0) + 1;
    });
    const regionStats = Object.entries(regions).map(([region, value]) => ({
      name: region,
      value
    }));

    return {
      agentPerformance: performance,
      conversionSummary: {
        totalLeads: totalLeadsCount,
        convertedLeads: convertedLeadsCount,
        globalConversionRate,
      },
      regionStats,
    };
  }

  // --- 7. Audit Logs ---
  async getAuditLogs() {
    const db = this.getDb();
    const { data, error } = await db
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);

    return data;
  }

  // --- 8. Edit Agent & Document Verification ---
  async updateAgentDetails(agentId: string, dto: any, adminId: string, adminName: string) {
    const db = this.getDb();
    const { name, email, phone, agencyName, officeAddress } = dto;

    const { data: agent } = await db.from('User').select('name, email, phone').eq('id', agentId).single();
    if (!agent) throw new NotFoundException('Agent not found');

    const { error: userErr } = await db
      .from('User')
      .update({
        name: name ?? agent.name,
        email: email ?? agent.email,
        phone: phone ?? agent.phone,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', agentId);

    if (userErr) throw new BadRequestException(userErr.message);

    const { error: metaErr } = await db
      .from('agent_metadata')
      .update({
        agency_name: agencyName ?? null,
        office_address: officeAddress ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', agentId);

    if (metaErr) throw new BadRequestException(metaErr.message);

    await this.logAction(
      adminId,
      adminName,
      'UPDATE_AGENT_DETAILS',
      'Agent Management',
      agentId,
      `Updated profile details for agent ${name || agent.name} (${email || agent.email})`,
    );

    return { id: agentId, name, email, phone, agencyName, officeAddress };
  }

  async verifyAgentDocument(
    agentId: string,
    docId: string,
    status: string,
    remarks: string,
    adminId: string,
    adminName: string,
  ) {
    const db = this.getDb();
    
    const { data: doc, error } = await db
      .from('Document')
      .update({
        status,
        name: remarks ? `${status} - Remarks: ${remarks}` : status,
      })
      .eq('id', docId)
      .eq('userId', agentId)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    const notifId = randomUUID();
    await db.from('Notification').insert({
      id: notifId,
      userId: agentId,
      title: status === 'Verified' ? 'Document Verified' : 'Document Rejected',
      message: status === 'Verified' 
        ? `Your uploaded document of type "${doc.type}" has been successfully verified by the admin.` 
        : `Your uploaded document of type "${doc.type}" was rejected. Reason: ${remarks || 'Please re-upload.'}`,
      isRead: false,
      createdAt: new Date().toISOString(),
    });

    await this.logAction(
      adminId,
      adminName,
      'VERIFY_AGENT_DOCUMENT',
      'Agent Management',
      agentId,
      `Document "${doc.type}" of agent has been marked as ${status} by admin (Remarks: ${remarks || 'None'})`,
    );

    return { docId, status, remarks };
  }

  // --- 8. Referral Conflicts ---
  async getReferralConflicts() {
    const db = this.getDb();
    
    // 1. Fetch all referral leads with status 'Under Review'
    const { data: conflictLeads, error: leadErr } = await db
      .from('referral_leads')
      .select('*, User:agent_id(name, email, phone), Course:course_id(name, fees)')
      .eq('status', 'Under Review')
      .order('created_at', { ascending: true });

    if (leadErr) console.error('Error fetching conflict leads:', leadErr.message);

    // 2. Fetch all commissions with status 'Under Review'
    const { data: conflictComms, error: commErr } = await db
      .from('commissions')
      .select('*, User:agent_id(name, email, phone)')
      .eq('status', 'Under Review')
      .order('created_at', { ascending: true });

    if (commErr) console.error('Error fetching conflict commissions:', commErr.message);

    // Group conflicts by seafarer email
    const grouped = new Map<string, any>();

    // Process Referral Leads conflicts
    for (const lead of (conflictLeads || [])) {
      const email = (lead.email || '').trim().toLowerCase();
      if (!email) continue;

      if (!grouped.has(email)) {
        const { data: userRec } = await db
          .from('User')
          .select('id')
          .ilike('email', email)
          .maybeSingle();

        let indosNumber = 'N/A';
        if (userRec) {
          const { data: profileRec } = await db
            .from('seafarer_profiles')
            .select('indos_num')
            .eq('user_id', userRec.id)
            .maybeSingle();

          if (profileRec) {
            indosNumber = profileRec.indos_num || 'N/A';
          }
        }

        const courseName = lead.Course?.name || 'STCW Mandatory Training';
        const rawFees = lead.Course?.fees || '15000';
        const parseFee = (feeStr: any): number => {
          if (typeof feeStr === 'number') return feeStr;
          if (!feeStr) return 0;
          const cleaned = String(feeStr).replace(/[^0-9.]/g, '');
          return parseFloat(cleaned) || 0;
        };
        const courseFee = parseFee(rawFees);

        grouped.set(email, {
          purchaseId: lead.email, // Use email as identifier for resolution
          seafarerName: lead.name,
          seafarerEmail: lead.email,
          seafarerPhone: lead.phone || 'N/A',
          indosNumber: indosNumber || 'N/A',
          courseName,
          courseFee,
          createdAt: lead.created_at,
          agents: []
        });
      }

      // Fetch agent's commission rate
      const { data: meta } = await db
        .from('agent_metadata')
        .select('general_commission')
        .eq('user_id', lead.agent_id)
        .maybeSingle();

      const rate = meta?.general_commission || 5.0;
      const courseFee = grouped.get(email).courseFee;
      const commissionAmount = (rate / 100) * courseFee;

      const existingAgent = grouped.get(email).agents.find((a: any) => a.agentId === lead.agent_id);
      if (!existingAgent) {
        grouped.get(email).agents.push({
          agentId: lead.agent_id,
          agentName: lead.User?.name || 'Agent',
          agentEmail: lead.User?.email || '',
          agentPhone: lead.User?.phone || '',
          leadSubmittedAt: lead.created_at,
          commissionRate: rate,
          commissionAmount,
          commissionId: lead.id
        });
      }
    }

    // Process Commissions conflicts (if any seafarer checked out with multiple leads)
    for (const comm of (conflictComms || [])) {
      const seafarerName = comm.seafarer_name;
      // Search for email matching seafarer_name in User table
      const { data: sfUser } = await db
        .from('User')
        .select('email')
        .ilike('name', seafarerName)
        .maybeSingle();

      const email = sfUser?.email ? sfUser.email.trim().toLowerCase() : comm.seafarer_name.toLowerCase();

      if (!grouped.has(email)) {
        grouped.set(email, {
          purchaseId: sfUser?.email || comm.seafarer_name,
          seafarerName: comm.seafarer_name,
          seafarerEmail: sfUser?.email || comm.seafarer_name,
          seafarerPhone: 'N/A',
          indosNumber: 'N/A',
          courseName: comm.course_name,
          courseFee: parseFloat(comm.course_fee) || 0,
          createdAt: comm.created_at,
          agents: []
        });
      }

      const existingAgent = grouped.get(email).agents.find((a: any) => a.agentId === comm.agent_id);
      if (!existingAgent) {
        grouped.get(email).agents.push({
          agentId: comm.agent_id,
          agentName: comm.User?.name || 'Agent',
          agentEmail: comm.User?.email || '',
          agentPhone: comm.User?.phone || '',
          leadSubmittedAt: comm.created_at,
          commissionRate: comm.commission_rate || 5.0,
          commissionAmount: parseFloat(comm.commission_amount) || 0,
          commissionId: comm.id
        });
      }
    }

    return Array.from(grouped.values());
  }

  async resolveConflict(seafarerEmail: string, approvedAgentId: string, remarks: string, adminId: string, adminName: string) {
    console.log('resolveConflict CALLED WITH:', { seafarerEmail, approvedAgentId, remarks, adminId, adminName });
    const db = this.getDb();
    const nowIso = new Date().toISOString();
    const cleanEmail = (seafarerEmail || '').trim();

    // 1. Fetch all conflicting leads matching this email (case-insensitive)
    const { data: leads } = await db
      .from('referral_leads')
      .select('*')
      .ilike('email', cleanEmail)
      .eq('status', 'Under Review');

    // 2. Fetch any commissions with status 'Under Review' matching this email or seafarer name
    const { data: commissions } = await db
      .from('commissions')
      .select('*')
      .eq('status', 'Under Review');

    const matchedCommissions = (commissions || []).filter((c: any) => {
      return (
        c.seafarer_name.toLowerCase().includes(cleanEmail.toLowerCase()) ||
        cleanEmail.toLowerCase().includes(c.seafarer_name.toLowerCase())
      );
    });

    if ((!leads || leads.length === 0) && (!matchedCommissions || matchedCommissions.length === 0)) {
      throw new NotFoundException('No active conflicting leads or commissions found for this seafarer.');
    }

    const seafarerName = leads?.[0]?.name || matchedCommissions?.[0]?.seafarer_name || cleanEmail;

    // 3. Resolve lead statuses in referral_leads table
    if (leads && leads.length > 0) {
      for (const lead of leads) {
        const isApproved = lead.agent_id === approvedAgentId;
        const leadStatus = isApproved ? 'New' : 'Cancelled';

        const updateRes = await db
          .from('referral_leads')
          .update({
            status: leadStatus,
            remarks: isApproved
              ? `Conflict resolved by Admin: Approved. Remarks: ${remarks}`
              : `Conflict resolved by Admin: Assigned to another referring agent.`
          })
          .eq('id', lead.id);
        console.log('UPDATE LEAD RESULT:', { id: lead.id, leadStatus, error: updateRes.error, status: updateRes.status });

        // Notify agent
        const notifyTitle = isApproved ? 'Conflicting Referral Lead Approved!' : 'Conflicting Referral Lead Assigned to Another Agent';
        const notifyMsg = isApproved
          ? `Your conflicting referral lead for ${seafarerName} has been approved by Admin. You now have active referral attribution!`
          : `Your conflicting referral lead for ${seafarerName} was assigned to another referring agent by Admin.`;

        await db.from('Notification').insert({
          id: randomUUID(),
          userId: lead.agent_id,
          title: notifyTitle,
          message: notifyMsg,
          isRead: false,
          createdAt: nowIso
        });
      }
    }

    // 4. Resolve commission statuses in commissions table
    if (matchedCommissions && matchedCommissions.length > 0) {
      for (const comm of matchedCommissions) {
        const isApproved = comm.agent_id === approvedAgentId;
        const newStatus = isApproved ? 'Pending' : 'Cancelled';

        await db
          .from('commissions')
          .update({
            status: newStatus,
            settled_at: isApproved ? null : nowIso
          })
          .eq('id', comm.id);

        if (isApproved) {
          // If approved, update lead to Converted if seafarer already completed purchase
          await db
            .from('referral_leads')
            .update({
              status: 'Converted'
            })
            .eq('agent_id', approvedAgentId)
            .ilike('email', cleanEmail);
        }
      }
    }

    // 5. Log admin action to audit_logs
    await this.logAction(
      adminId,
      adminName,
      'RESOLVE_REFERRAL_CONFLICT',
      'Referrals',
      cleanEmail,
      `Resolved referral lead dispute for seafarer ${seafarerName} (${cleanEmail}) in favor of agent ${approvedAgentId}. Remarks: ${remarks}`
    );

    return { success: true, message: 'Referral conflict resolved successfully.' };
  }

  async getTickets() {
    const db = this.getDb();
    const { data, error } = await db
      .from('SupportTicket')
      .select('*, User:userId(name, email, role)')
      .order('createdAt', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return data || [];
  }

  async addTicketReply(ticketId: string, message: string, adminId: string, adminName: string) {
    const db = this.getDb();
    const { data: ticket, error: fetchErr } = await db
      .from('SupportTicket')
      .select('*')
      .eq('id', ticketId)
      .single();
    if (fetchErr || !ticket) throw new NotFoundException('Ticket not found');

    const replies = JSON.parse(ticket.replies || '[]');
    replies.push({
      id: randomUUID(),
      senderName: adminName,
      senderRole: 'agent_admin',
      message,
      createdAt: new Date().toISOString()
    });

    const { error: updateErr } = await db
      .from('SupportTicket')
      .update({
        replies: JSON.stringify(replies),
        updatedAt: new Date().toISOString(),
        status: 'replied'
      })
      .eq('id', ticketId);

    if (updateErr) throw new BadRequestException(updateErr.message);

    await this.logAction(
      adminId,
      adminName,
      'REPLY_SUPPORT_TICKET',
      'Support Tickets',
      ticketId,
      `Replied to support ticket: "${ticket.subject}"`
    );

    return { success: true };
  }

  async updateTicketStatus(ticketId: string, status: string, adminId: string, adminName: string) {
    const db = this.getDb();
    const { error } = await db
      .from('SupportTicket')
      .update({
        status,
        updatedAt: new Date().toISOString()
      })
      .eq('id', ticketId);

    if (error) throw new BadRequestException(error.message);

    await this.logAction(
      adminId,
      adminName,
      'UPDATE_TICKET_STATUS',
      'Support Tickets',
      ticketId,
      `Updated support ticket status to ${status}`
    );

    return { success: true };
  }
}
