import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AgentAdminService {
  constructor(private readonly supabaseService: SupabaseService) {}

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

    // 1. Total Registered Agents (Users with role AGENT)
    const { count: totalAgents } = await db
      .from('User')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'AGENT');

    // 2. Active Agents
    const { count: activeAgents } = await db
      .from('User')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'AGENT')
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

    // Fetch all user accounts with role AGENT
    const { data: users, error: userError } = await db
      .from('User')
      .select('id, name, email, phone, role, status, createdAt')
      .eq('role', 'AGENT');

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

    // Check email uniqueness
    const { data: existingUser } = await db
      .from('User')
      .select('id')
      .eq('email', email)
      .single();

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
      role: 'AGENT',
      status: 'Pending Audit',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    if (userError) throw new BadRequestException(userError.message);

    // 2. Create agent metadata (Referral code and QR code are null initially!)
    const { error: metaError } = await db.from('agent_metadata').insert({
      id: randomUUID(),
      user_id: agentId,
      referral_code: null,
      qr_code: null,
      onboarding_status: 'Invited',
      general_commission: generalCommission,
      course_commissions: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (metaError) {
      // rollback User insertion
      await db.from('User').delete().eq('id', agentId);
      throw new BadRequestException(metaError.message);
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

  // --- 5. Commissions ---
  async getCommissions() {
    const db = this.getDb();
    const { data: comms, error } = await db
      .from('commissions')
      .select('*, User:agent_id(name)');

    if (error) throw new BadRequestException(error.message);

    return (comms || []).map((c: any) => ({
      id: c.id,
      invoiceNumber: `INV-${c.id.substring(0,8).toUpperCase()}`,
      seafarerName: c.seafarer_name,
      courseName: c.course_name,
      courseFee: `₹${c.course_fee.toLocaleString('en-IN')}`,
      commissionRate: `${c.commission_rate}%`,
      commissionAmount: `₹${c.commission_amount.toLocaleString('en-IN')}`,
      status: c.status,
      createdAt: c.created_at,
      settledAt: c.settled_at,
      agentName: c.User?.name || 'Unknown Agent',
    }));
  }

  // --- 6. Reports ---
  async getReports() {
    const db = this.getDb();

    // 1. Agent Performance
    const { data: agents } = await db.from('User').select('id, name').eq('role', 'AGENT');
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
      const city = l.city || 'Unknown';
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
}
