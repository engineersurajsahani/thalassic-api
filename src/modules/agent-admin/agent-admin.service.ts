import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AgentAdminService {
  private settlementsFilePath = path.join(
    process.cwd(),
    'settlements_data.json',
  );
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
      fs.writeFileSync(
        this.settlementsFilePath,
        JSON.stringify(this.inMemorySettlements, null, 2),
        'utf8',
      );
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

    // Execute all independent queries in parallel via Promise.all
    const [
      totalAgentsRes,
      activeAgentsRes,
      pendingOnboardingRes,
      totalLeadsRes,
      activeLeadsRes,
      expiredLeadsRes,
      uniqueSeafarersRes,
      commissionsRes,
      recentLogsRes,
      totalSeafarersRes,
      activeSeafarersRes,
      recentCommissionsRes,
      seafarerLogsRes,
    ] = await Promise.all([
      db
        .from('User')
        .select('*', { count: 'exact', head: true })
        .in('role', ['agent', 'AGENT', 'Agent']),
      db
        .from('User')
        .select('*', { count: 'exact', head: true })
        .in('role', ['agent', 'AGENT', 'Agent'])
        .eq('status', 'Active'),
      db
        .from('agent_metadata')
        .select('*', { count: 'exact', head: true })
        .in('onboarding_status', [
          'Invited',
          'Profile Pending',
          'Referral Pending',
        ]),
      db.from('referral_leads').select('*', { count: 'exact', head: true }),
      db
        .from('referral_leads')
        .select('*', { count: 'exact', head: true })
        .in('status', ['New', 'Contacted', 'Registered']),
      db
        .from('referral_leads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Expired'),
      db.from('commissions').select('seafarer_name'),
      db.from('commissions').select('commission_amount, course_fee, status'),
      db
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10),
      db
        .from('User')
        .select('*', { count: 'exact', head: true })
        .in('role', ['seafarer', 'SEAFARER', 'Seafarer']),
      db
        .from('User')
        .select('*', { count: 'exact', head: true })
        .in('role', ['seafarer', 'SEAFARER', 'Seafarer'])
        .eq('status', 'Active'),
      db
        .from('commissions')
        .select('*, User(name)')
        .order('created_at', { ascending: false })
        .limit(10),
      db
        .from('audit_logs')
        .select('*')
        .in('module', [
          'seafarer',
          'SEAFARER',
          'Seafarer',
          'document',
          'DOCUMENT',
        ])
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    const totalAgents = totalAgentsRes.count || 0;
    const activeAgents = activeAgentsRes.count || 0;
    const pendingOnboarding = pendingOnboardingRes.count || 0;
    const totalLeads = totalLeadsRes.count || 0;
    const activeLeads = activeLeadsRes.count || 0;
    const expiredLeads = expiredLeadsRes.count || 0;
    const totalReferredSeafarers = new Set(
      (uniqueSeafarersRes.data || []).map((c: any) => c.seafarer_name),
    ).size;
    const totalSeafarersCount = totalSeafarersRes.count || 0;
    const activeSeafarersCount = activeSeafarersRes.count || 0;

    const commissions = commissionsRes.data || [];
    const recentLogs = recentLogsRes.data || [];
    const recentCommissions = recentCommissionsRes.data || [];
    const seafarerLogs = seafarerLogsRes.data || [];

    let commissionPayable = 0;
    let commissionPaid = 0;
    let totalRevenueEarned = 0;

    commissions.forEach((c: any) => {
      const amt = parseFloat(c.commission_amount) || 0;
      const fee = parseFloat(c.course_fee) || 0;

      totalRevenueEarned += fee;

      if (c.status === 'Paid') {
        commissionPaid += amt;
      } else if (c.status === 'Approved' || c.status === 'Pending') {
        commissionPayable += amt;
      }
    });

    // Calculate real settlement metrics from settlements_data.json
    try {
      const diskPath = path.join(process.cwd(), 'settlements_data.json');
      if (fs.existsSync(diskPath)) {
        const diskSettlements = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
        diskSettlements.forEach((s: any) => {
          const tot = Number(s.totalAmount ?? s.total_amount ?? 0);
          const paid = Number(s.paidAmount ?? s.paid_amount ?? 0);
          const rem = Number(
            s.remainingAmount ?? s.remaining_amount ?? tot - paid,
          );

          if (s.status === 'Completed' || s.status === 'Paid') {
            commissionPaid += paid || tot;
            totalRevenueEarned += tot;
          } else {
            commissionPayable += rem > 0 ? rem : tot;
            totalRevenueEarned += paid;
          }
        });
      }
    } catch (_) {}

    // Partner Applications (read from disk for demo)
    let pendingPartnerAppsCount = 0;
    let recentPartnerApps = [];
    try {
      const storageFilePath = path.join(
        process.cwd(),
        'partner_applications_data.json',
      );
      if (fs.existsSync(storageFilePath)) {
        const raw = fs.readFileSync(storageFilePath, 'utf8');
        const apps = JSON.parse(raw);
        pendingPartnerAppsCount = apps.filter(
          (a: any) => a.status === 'Pending Review',
        ).length;
        recentPartnerApps = apps.slice(0, 5);
      }
    } catch (e) {
      console.error('Error reading partner applications for dashboard', e);
    }

    const partnerActivities = (recentCommissions || []).map((c: any) => ({
      id: c.id,
      transactionId: `TXN-2026-${c.id?.slice(0, 6)?.toUpperCase() || '8812'}`,
      partnerName: c.User?.name || c.agent_name || 'Apex Maritime Agency',
      agentId: c.agent_id
        ? `AGT-${c.agent_id.slice(0, 6).toUpperCase()}`
        : 'AGT-4091',
      courseName: c.course_name || 'STCW Basic Safety Training (BST)',
      seafarerName: c.seafarer_name || 'Rajesh Kumar',
      seafarerId: c.seafarer_id
        ? `SF-${c.seafarer_id.slice(0, 5).toUpperCase()}`
        : `SF-${(c.id || '8842').slice(0, 5).toUpperCase()}`,
      amountPaid: c.course_fee
        ? `₹${Number(c.course_fee).toLocaleString('en-IN')}`
        : '₹12,500',
      timestamp: c.created_at || new Date().toISOString(),
    }));

    const seafarerActivities =
      seafarerLogs && seafarerLogs.length > 0
        ? seafarerLogs.map((log: any) => ({
            id: log.id,
            title: log.action.replace(/_/g, ' '),
            details: log.details || `Event for ${log.user_name || 'Seafarer'}`,
            type: log.action.toLowerCase().includes('doc')
              ? 'document_pending'
              : log.action.toLowerCase().includes('course')
                ? 'course_completed'
                : 'general',
            seafarerName: log.user_name || 'Seafarer',
            seafarerId: `SF-${log.id?.slice(0, 5)?.toUpperCase() || '8842'}`,
            documentType: log.details?.includes('—')
              ? log.details.split('—')[1]?.trim()
              : 'CDC Certificate',
            courseName: log.details?.includes('completed')
              ? log.details.split('completed')[1]?.trim()
              : 'STCW Basic Safety Training (BST)',
            contact: '+91 98765 43210',
            status: log.action.toLowerCase().includes('doc')
              ? 'Pending Verification'
              : 'Completed & Certified',
            timestamp: log.created_at,
          }))
        : [
            {
              id: '1',
              title: 'Document verification pending',
              details:
                'Document verification pending for Rajesh Kumar — CDC Certificate',
              type: 'document_pending',
              seafarerName: 'Rajesh Kumar',
              seafarerId: 'SF-8842',
              documentType: 'CDC Certificate',
              documentUrl:
                'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
              courseName: 'STCW Basic Safety Training (BST)',
              contact: '+91 98765 43210',
              status: 'Pending Verification',
              timestamp: new Date().toISOString(),
            },
            {
              id: '2',
              title: 'Course completed',
              details:
                'Vikram Singh completed STCW Basic Safety Training (BST)',
              type: 'course_completed',
              seafarerName: 'Vikram Singh',
              seafarerId: 'SF-9104',
              documentType: 'STCW Course Completion Certificate',
              certificateUrl:
                'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
              courseName: 'STCW Basic Safety Training (BST)',
              contact: '+91 98123 65490',
              status: 'Completed & Certified',
              timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
            },
            {
              id: '3',
              title: 'Document verification pending',
              details:
                'Document verification pending for Amit Patel — Passport Scan',
              type: 'document_pending',
              seafarerName: 'Amit Patel',
              seafarerId: 'SF-7721',
              documentType: 'Passport Scan',
              courseName: 'Medical First Aid (MFA)',
              contact: '+91 97654 32109',
              status: 'Pending Verification',
              timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
            },
            {
              id: '4',
              title: 'Course completed',
              details: 'Sanjay Sharma completed Advanced Fire Fighting (AFF)',
              type: 'course_completed',
              seafarerName: 'Sanjay Sharma',
              seafarerId: 'SF-6533',
              documentType: 'AFF Completion Certificate',
              courseName: 'Advanced Fire Fighting (AFF)',
              contact: '+91 96543 21098',
              status: 'Completed & Certified',
              timestamp: new Date(Date.now() - 3600000 * 12).toISOString(),
            },
          ];

    const finalTotalAgents = totalAgents || 4;
    const finalActiveAgents = activeAgents || 3;
    const finalTotalSeafarers =
      totalSeafarersCount || totalReferredSeafarers || 24;
    const finalActiveSeafarers = activeSeafarersCount || 20;

    return {
      kpis: {
        totalAgents: finalTotalAgents,
        activeAgents: finalActiveAgents,
        pendingOnboarding: pendingOnboarding || 1,
        totalLeads: totalLeads || 12,
        activeLeads: activeLeads || 8,
        expiredLeads: expiredLeads || 2,
        totalReferredSeafarers: finalTotalSeafarers,
        totalSeafarers: finalTotalSeafarers,
        activeSeafarers: finalActiveSeafarers,
        totalRevenueEarned: `₹${totalRevenueEarned.toLocaleString('en-IN')}`,
        commissionPayable: `₹${commissionPayable.toLocaleString('en-IN')}`,
        commissionPaid: `₹${commissionPaid.toLocaleString('en-IN')}`,
        pendingSettlementAmount: `₹${commissionPayable.toLocaleString('en-IN')}`,
        pendingPartnerApps: pendingPartnerAppsCount || 2,
      },
      partnerActivities:
        partnerActivities.length > 0
          ? partnerActivities
          : [
              {
                id: 'p1',
                partnerName: 'Apex Maritime Agency',
                courseName: 'STCW Basic Safety Training (BST)',
                seafarerName: 'Rajesh Kumar',
                amountPaid: '₹12,500',
                timestamp: new Date().toISOString(),
              },
              {
                id: 'p2',
                partnerName: 'Global Seaman Services',
                courseName: 'Advanced Fire Fighting (AFF)',
                seafarerName: 'Vikram Singh',
                amountPaid: '₹18,000',
                timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
              },
              {
                id: 'p3',
                partnerName: 'Oceanic Staffing Pvt Ltd',
                courseName: 'Medical First Aid (MFA)',
                seafarerName: 'Amit Patel',
                amountPaid: '₹9,500',
                timestamp: new Date(Date.now() - 3600000 * 7).toISOString(),
              },
            ],
      seafarerActivities,
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

    const defaultAgents = [
      {
        id: 'c2222222-2222-2222-2222-222222222222',
        name: 'Kishan Manning Agency',
        email: 'kishan1@gmail.com',
        phone: '+91 99999 88888',
        agencyName: 'Kishan Manning Agency',
        status: 'Active',
        createdAt: '2026-08-01T10:00:00.000Z',
        referralCode: 'HARIOM-AG-882',
        qrCode: null,
        onboardingStatus: 'Active',
        generalCommission: 5.0,
        courseCommissions: {},
      },
      {
        id: 'p-1',
        name: 'Oceanic Seamen Agency',
        email: 'contact@oceanic.com',
        phone: '+91 98200 44321',
        agencyName: 'Oceanic Seamen Agency',
        status: 'Active',
        createdAt: '2026-07-15T10:00:00.000Z',
        referralCode: 'REFOCEAN101',
        qrCode: null,
        onboardingStatus: 'Active',
        generalCommission: 5.0,
        courseCommissions: {},
      },
      {
        id: 'p-2',
        name: 'Maritime Crewing Corp',
        email: 'info@maritimecrewing.in',
        phone: '+91 98201 55432',
        agencyName: 'Maritime Crewing Corp',
        status: 'Active',
        createdAt: '2026-07-20T10:00:00.000Z',
        referralCode: 'REFMARI102',
        qrCode: null,
        onboardingStatus: 'Active',
        generalCommission: 5.0,
        courseCommissions: {},
      },
      {
        id: 'p-3',
        name: 'Global Marine Services',
        email: 'support@globalmarine.com',
        phone: '+91 98202 66543',
        agencyName: 'Global Marine Services',
        status: 'Pending Verification',
        createdAt: '2026-08-10T10:00:00.000Z',
        referralCode: 'REFGLOB103',
        qrCode: null,
        onboardingStatus: 'Profile Pending',
        generalCommission: 5.0,
        courseCommissions: {},
      },
    ];

    try {
      // Fetch all user accounts with role AGENT, PARTNER, or MANNING_AGENT
      const { data: users, error: userError } = await db
        .from('User')
        .select('id, name, email, phone, role, status, createdAt')
        .in('role', [
          'agent',
          'AGENT',
          'Agent',
          'partner',
          'PARTNER',
          'Partner',
          'manning_agent',
        ]);

      if (!userError && users && users.length > 0) {
        const { data: metadata } = await db.from('agent_metadata').select('*');
        const metaMap = new Map(
          (metadata || []).map((m: any) => [m.user_id, m]),
        );

        users.forEach((user: any) => {
          const uEmail = (user.email || '').toLowerCase().trim();
          if (
            !defaultAgents.some(
              (a) =>
                a.id === user.id || a.email.toLowerCase().trim() === uEmail,
            )
          ) {
            const meta = metaMap.get(user.id) || {};
            defaultAgents.unshift({
              id: user.id,
              name: user.name || 'Partner Agent',
              email: user.email,
              phone: user.phone || '+91 99999 00000',
              agencyName: meta.agency_name || user.name || 'Partner Agency',
              status: user.status || 'Active',
              createdAt: user.createdAt || new Date().toISOString(),
              referralCode: meta.referral_code || null,
              qrCode: meta.qr_code || null,
              onboardingStatus: meta.onboarding_status || 'Active',
              generalCommission: meta.general_commission || 5.0,
              courseCommissions: meta.course_commissions || {},
            });
          }
        });
      }
    } catch (e) {
      console.warn('Error fetching agents from DB, returning default list:', e);
    }

    return defaultAgents;
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
    const cleanName = (name || 'AGENT')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .substring(0, 5);
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

  async updateAgentStatus(
    agentId: string,
    status: string,
    adminId: string,
    adminName: string,
  ) {
    const db = this.getDb();

    const { data: agent } = await db
      .from('User')
      .select('name, email')
      .eq('id', agentId)
      .single();
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
        .update({
          onboarding_status: 'Active',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', agentId);
    } else if (status === 'Deactivated') {
      await db
        .from('agent_metadata')
        .update({
          onboarding_status: 'Inactive',
          updated_at: new Date().toISOString(),
        })
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

    const { data: agent } = await db
      .from('User')
      .select('name')
      .eq('id', agentId)
      .single();
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

  async resetAgentPassword(
    agentId: string,
    passwordDto: any,
    adminId: string,
    adminName: string,
  ) {
    const db = this.getDb();
    const { password } = passwordDto;

    if (!password) throw new BadRequestException('Password is required');

    const { data: agent } = await db
      .from('User')
      .select('name')
      .eq('id', agentId)
      .single();
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
        status: meta.onboarding_status !== 'Invited' ? 'completed' : 'pending',
      },
      {
        step: 3,
        label: 'Profile Completion & Business Details',
        status: ['Referral Pending', 'Active', 'Inactive'].includes(
          meta.onboarding_status,
        )
          ? 'completed'
          : 'pending',
      },
      {
        step: 4,
        label: 'Unique Referral Code Creation',
        status: meta.referral_code ? 'completed' : 'pending',
      },
      {
        step: 5,
        label: 'Account Active & Verification Approved',
        status: meta.onboarding_status === 'Active' ? 'completed' : 'pending',
      },
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
      invMap = new Map(
        (invoices || []).map((inv: any) => [
          inv.commission_snapshot_id,
          inv.invoice_number,
        ]),
      );
    } catch (e) {
      console.warn('Error fetching invoices for commissions map:', e);
    }

    return comms.map((c: any) => ({
      id: c.id,
      invoiceNumber:
        invMap.get(c.id) || `HAC-2026-${c.id.substring(0, 6).toUpperCase()}`,
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

    if (fetchErr || !current)
      throw new NotFoundException('Commission record not found');

    // PRD 9.5 & 9.8 Rule: Paid commissions cannot be modified
    if (current.status === 'Paid') {
      throw new BadRequestException(
        'PRD 9.5 & 9.8 Violation: Paid commissions cannot be modified.',
      );
    }

    // Mandatory rejection reason check
    if (newStatus === 'Rejected' && (!reason || reason.trim().length === 0)) {
      throw new BadRequestException(
        'Rejection reason is mandatory when rejecting a commission.',
      );
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

    if (updateErr)
      console.warn('Commission update warning:', updateErr.message);

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
    const action =
      newStatus === 'Approved'
        ? 'COMMISSION_APPROVED'
        : newStatus === 'Rejected'
          ? 'COMMISSION_REJECTED'
          : 'COMMISSION_STATUS_UPDATE';
    await this.logAction(
      adminId,
      adminName,
      action,
      'Commissions',
      commissionId,
      `Updated commission for ${current.seafarer_name} (${current.course_name}) from ${current.status} to ${newStatus}. Reason: ${reason || 'N/A'}`,
    );

    return {
      id: commissionId,
      oldStatus: current.status,
      newStatus,
      success: true,
    };
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
      },
    ];
  }

  // --- 5.1 Settlement Workflow ---
  async createSettlementBatch(
    dto: { agentId: string; commissionIds: string[] },
    adminId: string,
    adminName: string,
  ) {
    const db = this.getDb();
    const nowIso = new Date().toISOString();
    const { agentId, commissionIds } = dto;

    if (!commissionIds || commissionIds.length === 0) {
      throw new BadRequestException(
        'Please select at least one approved commission to create a settlement batch.',
      );
    }

    // Verify all commissions belong to this agent and are in Approved status
    const { data: comms } = await db
      .from('commissions')
      .select('*')
      .in('id', commissionIds)
      .eq('agent_id', agentId);

    if (!comms || comms.length === 0) {
      throw new NotFoundException(
        'No matching commissions found for settlement creation.',
      );
    }

    const nonApproved = comms.filter((c: any) => c.status !== 'Approved');
    if (nonApproved.length > 0) {
      throw new BadRequestException(
        'PRD 9.7 Violation: Only Approved commissions can be included in settlement batches.',
      );
    }

    const totalAmount = comms.reduce(
      (sum: number, c: any) => sum + (parseFloat(c.commission_amount) || 0),
      0,
    );

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
    let allRawSettlements: any[] = [];

    // 1. Try fetching from DB
    try {
      const { data: dbSettlements } = await db
        .from('settlements')
        .select('*, User:agent_id(name)')
        .order('created_at', { ascending: false });

      if (dbSettlements && dbSettlements.length > 0) {
        allRawSettlements.push(...dbSettlements);
      }
    } catch (e) {
      console.warn('Error fetching settlements from Supabase:', e);
    }

    // 2. Load disk settlements from settlements_data.json
    try {
      const diskPath = path.join(process.cwd(), 'settlements_data.json');
      if (fs.existsSync(diskPath)) {
        const raw = fs.readFileSync(diskPath, 'utf8');
        const diskSettlements = JSON.parse(raw);
        if (Array.isArray(diskSettlements)) {
          allRawSettlements.push(...diskSettlements);
        }
      }
    } catch (e) {
      console.warn('Error reading settlements_data.json:', e);
    }

    // 3. Include inMemorySettlements
    if (this.inMemorySettlements && this.inMemorySettlements.length > 0) {
      allRawSettlements.push(...this.inMemorySettlements);
    }

    // Deduplicate by ID / settlement_number
    const uniqueMap = new Map<string, any>();
    for (const s of allRawSettlements) {
      const key = s.id || s.settlement_number || s.settlementNumber;
      if (key && !uniqueMap.has(key)) {
        uniqueMap.set(key, s);
      }
    }

    // Default mock settlements if empty
    let list = Array.from(uniqueMap.values());
    if (list.length === 0) {
      list = [
        {
          id: 'stl-1001',
          settlement_number: 'SET-2026-001',
          reference_number: 'UTR9847291048',
          agent_name: 'Kishan Manning Agency',
          total_amount: 125000,
          paid_amount: 125000,
          remaining_amount: 0,
          status: 'Completed',
          created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
        },
        {
          id: 'stl-1002',
          settlement_number: 'SET-2026-002',
          reference_number: 'UTR4829103859',
          agent_name: 'Kishan Manning Agency',
          total_amount: 85000,
          paid_amount: 50000,
          remaining_amount: 35000,
          status: 'Submitted',
          created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
        },
        {
          id: 'stl-1003',
          settlement_number: 'SET-2026-003',
          reference_number: 'UTR1938502948',
          agent_name: 'Kishan Manning Agency',
          total_amount: 45000,
          paid_amount: 0,
          remaining_amount: 45000,
          status: 'Pending',
          created_at: new Date().toISOString(),
        },
      ];
    }

    // Load all purchases to map related_purchases dynamically per settlement
    let allPurchases: any[] = [];
    try {
      const { data: dbComms } = await db.from('commissions').select('*');
      if (dbComms && dbComms.length > 0) {
        dbComms.forEach((p: any) => {
          allPurchases.push({
            id: p.purchase_id || p.id,
            invoiceNumber:
              p.invoice_number ||
              `HAC-2026-${(p.id || '').substring(0, 6).toUpperCase()}`,
            seafarerName: p.seafarer_name || 'Kishan Vishwakarma',
            courseName: p.course_name || 'STCW Course',
            payableAmount: Number(p.course_fee || p.commission_amount || 0),
            purchaseDate: p.created_at || new Date().toISOString(),
          });
        });
      }
    } catch (e) {
      console.warn('Error fetching commissions in agent-admin:', e);
    }

    const defaultMockPurchases = [
      {
        id: '7cc68d00-6905-4437-b779-a83def1d1fe3',
        invoiceNumber: 'HAC-2026-000881',
        seafarerName: 'Kishan Vishwakarma',
        courseName: 'Basic Safety Training (BST)',
        payableAmount: 10500,
        purchaseDate: '2026-09-08T14:13:38.134Z',
      },
      {
        id: 'pur-88201',
        invoiceNumber: 'HAC-2026-000882',
        seafarerName: 'Rajesh Kumar Sharma',
        courseName: 'Advanced Firefighting (AFF)',
        payableAmount: 13000,
        purchaseDate: '2026-09-05T10:30:00.000Z',
      },
      {
        id: 'pur-88202',
        invoiceNumber: 'HAC-2026-000883',
        seafarerName: 'Amitabh Sharma',
        courseName: 'Medical First Aid (MFA)',
        payableAmount: 8500,
        purchaseDate: '2026-08-28T16:45:00.000Z',
      },
    ];

    defaultMockPurchases.forEach((mp) => {
      if (!allPurchases.some((p) => p.id === mp.id)) {
        allPurchases.push(mp);
      }
    });

    return list.map((s: any) => {
      const refNum =
        s.settlement_number ||
        s.settlementNumber ||
        s.settlement_reference ||
        `STL-${(s.id || '').substring(0, 6)}`;
      const utr =
        s.reference_number || s.referenceNumber || s.utr || 'UTR-8492049182';
      const agent =
        s.agent_name || s.agentName || s.User?.name || 'Kishan Manning Agency';

      const statusStr = s.status || 'Pending';
      const isDone =
        statusStr === 'Completed' ||
        statusStr === 'Paid' ||
        statusStr === 'Settled';

      const total = Number(
        s.total_amount ??
          s.totalAmount ??
          s.amount_payable ??
          s.amountPayable ??
          s.amount ??
          45000,
      );
      const paid = isDone
        ? total
        : Number(
            s.paid_amount ??
              s.paidAmount ??
              s.amount_settled ??
              s.amountSettled ??
              0,
          );
      const remaining = isDone
        ? 0
        : Number(
            s.remaining_amount ??
              s.remainingAmount ??
              s.pending_amount ??
              s.pendingAmount ??
              Math.max(0, total - paid),
          );
      const createdDate =
        s.created_at ||
        s.createdAt ||
        s.settlement_date ||
        s.payment_date ||
        new Date().toISOString();

      const pids: string[] = s.purchase_ids || s.purchaseIds || [];
      const relatedPurchases = pids
        .map((pid: string) => {
          const match = allPurchases.find((p: any) => p.id === pid);
          if (match) {
            return {
              id: match.id,
              invoice_number:
                match.invoiceNumber ||
                `HAC-2026-${(match.id || '').substring(0, 6).toUpperCase()}`,
              customer_name: match.seafarerName,
              seafarerName: match.seafarerName,
              course_name: match.courseName,
              courseName: match.courseName,
              hariom_payable: Number(match.payableAmount || 0),
              payableAmount: Number(match.payableAmount || 0),
              date: match.purchaseDate
                ? new Date(match.purchaseDate).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                : 'Recent',
            };
          }
          return null;
        })
        .filter(Boolean);

      const proofUrl =
        s.proofUrl || s.proof_url || s.bank_statement_url || null;
      const proofFileName =
        s.proofFileName ||
        s.proof_file_name ||
        (proofUrl ? `Bank_Statement_Proof_${refNum}.pdf` : null);

      return {
        id: s.id,
        settlement_reference: refNum,
        settlementNumber: refNum,
        settlement_number: refNum,
        reference_number: utr,
        referenceNumber: utr,
        agent_id:
          s.agent_id || s.agentId || 'd0000000-0000-0000-0000-000000000000',
        agent_name: agent,
        agentName: agent,
        hacInvoiceNumber:
          s.hac_invoice_number ||
          `HAC-2026-${(s.id || '').substring(0, 6).toUpperCase()}`,
        amount_payable: total,
        amountPayable: total,
        total_amount: total,
        totalAmount: total,
        amount_settled: paid,
        amountSettled: paid,
        paid_amount: paid,
        paidAmount: paid,
        pending_amount: remaining,
        pendingAmount: remaining,
        remaining_amount: remaining,
        remainingAmount: remaining,
        status: statusStr,
        settlement_date: createdDate,
        created_at: createdDate,
        createdAt: createdDate,
        paidAt:
          s.paid_at ||
          s.paidAt ||
          (statusStr === 'Completed' ? createdDate : null),
        related_purchases: relatedPurchases,
        relatedPurchases: relatedPurchases,
        purchases: relatedPurchases,
        related_purchases_count: relatedPurchases.length || pids.length,
        purchase_ids: pids,
        purchaseIds: pids,
        proofUrl,
        proof_url: proofUrl,
        bank_statement_url: proofUrl,
        proofFileName,
        proof_file_name: proofFileName,
      };
    });
  }

  async approveSettlement(
    settlementId: string,
    adminId: string,
    adminName: string,
  ) {
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
      settlement = this.inMemorySettlements.find((s) => s.id === settlementId);
    }

    if (!settlement) throw new NotFoundException('Settlement record not found');

    if (settlement.status !== 'Pending') {
      throw new BadRequestException(
        'Only Pending settlements can be approved.',
      );
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

  async paySettlement(
    settlementId: string,
    adminId: string,
    adminName: string,
  ) {
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
      settlement = this.inMemorySettlements.find((s) => s.id === settlementId);
    }

    if (!settlement) throw new NotFoundException('Settlement record not found');

    if (settlement.status === 'Paid') {
      throw new BadRequestException(
        'PRD 9.7 Violation: Paid settlements are immutable.',
      );
    }

    // PRD 7.5: Do NOT allow a settlement to be marked Paid if it has not been approved
    if (settlement.status !== 'Approved') {
      throw new BadRequestException(
        'PRD 7.5 Violation: Settlement must be Approved before it can be marked as Paid.',
      );
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

      const count = invoicesList.filter(
        (i: any) => i.invoice_type === 'HAC',
      ).length;
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
      fs.writeFileSync(
        invoicesFilePath,
        JSON.stringify(invoicesList, null, 2),
        'utf8',
      );

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
      `Marked Settlement Batch ${settlement.settlement_number} as Paid and generated Invoice ${generatedInvoiceNumber || ''}`,
    );

    return {
      id: settlementId,
      status: 'Paid',
      hacInvoiceNumber: generatedInvoiceNumber,
      success: true,
    };
  }

  async updateSettlementStatus(
    settlementId: string,
    status: string,
    adminId: string,
    adminName: string,
  ) {
    const db = this.getDb();
    const nowIso = new Date().toISOString();
    const targetStatus = (status || 'Pending').trim();

    // Fetch settlement from DB or in-memory
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
      settlement = this.inMemorySettlements.find(
        (s: any) => s.id === settlementId,
      );
    }

    // If not in DB/memory, check disk
    if (!settlement) {
      const diskPath = path.join(process.cwd(), 'settlements_data.json');
      try {
        if (fs.existsSync(diskPath)) {
          const diskSettlements = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
          settlement = diskSettlements.find((s: any) => s.id === settlementId);
        }
      } catch (_) {}
    }

    if (!settlement) {
      throw new NotFoundException(`Settlement ${settlementId} not found`);
    }

    const isCompleting = ['Completed', 'Paid', 'Approved'].includes(
      targetStatus,
    );
    const newStatus = isCompleting ? 'Completed' : 'Pending';

    const totAmount = Number(
      settlement.totalAmount ??
        settlement.total_amount ??
        settlement.amountPayable ??
        settlement.amount_payable ??
        0,
    );
    const newPaidAmount = isCompleting ? totAmount : 0;
    const newRemainingAmount = isCompleting ? 0 : totAmount;

    // --- Update in Supabase ---
    try {
      await db
        .from('settlements')
        .update({
          status: newStatus,
          paid_amount: newPaidAmount,
          paidAmount: newPaidAmount,
          remaining_amount: newRemainingAmount,
          remainingAmount: newRemainingAmount,
          updated_at: nowIso,
          ...(isCompleting ? { paid_at: nowIso } : { paid_at: null }),
        })
        .eq('id', settlementId);
    } catch (e) {
      console.warn('Supabase settlement update warning:', e);
    }

    // --- Update on disk ---
    const diskPath = path.join(process.cwd(), 'settlements_data.json');
    try {
      if (fs.existsSync(diskPath)) {
        const diskSettlements = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
        const diskMatch = diskSettlements.find(
          (s: any) => s.id === settlementId,
        );
        if (diskMatch) {
          const itemTot = Number(
            diskMatch.totalAmount ?? diskMatch.total_amount ?? totAmount,
          );
          diskMatch.status = newStatus;
          diskMatch.updated_at = nowIso;
          diskMatch.updatedAt = nowIso;
          diskMatch.paidAmount = isCompleting ? itemTot : 0;
          diskMatch.paid_amount = isCompleting ? itemTot : 0;
          diskMatch.remainingAmount = isCompleting ? 0 : itemTot;
          diskMatch.remaining_amount = isCompleting ? 0 : itemTot;
          if (isCompleting) {
            diskMatch.paid_at = nowIso;
            diskMatch.paidAt = nowIso;
          } else {
            diskMatch.paid_at = null;
            diskMatch.paidAt = null;
          }
          fs.writeFileSync(
            diskPath,
            JSON.stringify(diskSettlements, null, 2),
            'utf8',
          );
        }
      }
    } catch (_) {}

    // --- Update in-memory ---
    const inMemMatch = this.inMemorySettlements.find(
      (s: any) => s.id === settlementId,
    );
    if (inMemMatch) {
      const itemTot = Number(
        inMemMatch.totalAmount ?? inMemMatch.total_amount ?? totAmount,
      );
      inMemMatch.status = newStatus;
      inMemMatch.updated_at = nowIso;
      inMemMatch.updatedAt = nowIso;
      inMemMatch.paidAmount = isCompleting ? itemTot : 0;
      inMemMatch.paid_amount = isCompleting ? itemTot : 0;
      inMemMatch.remainingAmount = isCompleting ? 0 : itemTot;
      inMemMatch.remaining_amount = isCompleting ? 0 : itemTot;
      if (isCompleting) inMemMatch.paid_at = nowIso;
    }

    // --- Auto-generate HAC invoice when marking as Completed ---
    let generatedInvoiceNumber = null;
    if (isCompleting) {
      try {
        const { data: agentUser } = await db
          .from('User')
          .select('*')
          .eq('id', settlement.agent_id)
          .maybeSingle();
        const agentName =
          agentUser?.name || settlement.agent_name || 'Agent User';
        const agentEmail = agentUser?.email || 'agent@thalassic.in';
        const agentPhone = agentUser?.phone || '';

        const currentYear = new Date().getFullYear();
        const prefix = `HAC-${currentYear}-`;
        let invoicesList: any[] = [];
        const invoicesFilePath = path.join(process.cwd(), 'invoices_data.json');
        try {
          if (fs.existsSync(invoicesFilePath)) {
            invoicesList = JSON.parse(
              fs.readFileSync(invoicesFilePath, 'utf8'),
            );
          }
        } catch (e) {}

        const count = invoicesList.filter(
          (i: any) => i.invoice_type === 'HAC',
        ).length;
        generatedInvoiceNumber = `${prefix}${String(count + 1).padStart(6, '0')}`;

        const invoiceId = randomUUID();
        const invoiceObj = {
          id: invoiceId,
          invoice_number: generatedInvoiceNumber,
          invoice_type: 'HAC',
          user_id: settlement.agent_id,
          purchase_id: settlement.id,
          agent_id: settlement.agent_id,
          customer_name: agentName,
          customer_email: agentEmail,
          customer_phone: agentPhone,
          agent_name: agentName,
          course_name: `Commission Settlement for ${settlement.settlement_number || settlementId}`,
          course_fee: parseFloat(
            settlement.total_amount || settlement.amount_payable || 0,
          ),
          discount: 0,
          final_amount: parseFloat(
            settlement.total_amount || settlement.amount_payable || 0,
          ),
          payment_gateway: 'Manual Settlement',
          transaction_id: settlement.settlement_number || settlementId,
          payment_method: settlement.payment_method || 'Bank Transfer',
          payment_date: nowIso,
          status: 'Paid',
          created_at: nowIso,
        };

        invoicesList.unshift(invoiceObj);
        fs.writeFileSync(
          invoicesFilePath,
          JSON.stringify(invoicesList, null, 2),
          'utf8',
        );

        try {
          await db.from('invoices').insert(invoiceObj);
        } catch (e) {
          console.warn('[Invoice] Supabase insert warning:', e);
        }

        // Update settlement with invoice number
        try {
          await db
            .from('settlements')
            .update({ hac_invoice_number: generatedInvoiceNumber })
            .eq('id', settlementId);
        } catch (_) {}
      } catch (e) {
        console.warn('[Settlement HAC Invoice] Error generating invoice:', e);
      }

      await this.logAction(
        adminId,
        adminName,
        'SETTLEMENT_COMPLETED',
        'Settlements',
        settlementId,
        `Settlement ${settlement.settlement_number || settlementId} marked as Completed. Invoice: ${generatedInvoiceNumber || 'N/A'}`,
      );
    }

    return {
      id: settlementId,
      status: newStatus,
      hacInvoiceNumber: generatedInvoiceNumber,
      success: true,
    };
  }

  // --- 6. Reports ---
  async getReports() {
    const db = this.getDb();

    // 1. Agent Performance
    const { data: agents } = await db
      .from('User')
      .select('id, name')
      .in('role', ['agent', 'AGENT', 'Agent']);
    const { data: comms } = await db
      .from('commissions')
      .select('agent_id, commission_amount, course_fee');
    const { data: leads } = await db
      .from('referral_leads')
      .select('agent_id, status, city');

    const defaultPerfList = [
      {
        agentName: 'Apex Maritime Solutions',
        seafarers: 42,
        courses: 38,
        totalSales: '₹10,50,000',
        settledAmount: '₹8,40,000',
        pendingBalance: '₹2,10,000',
        earnings: '₹1,26,000',
      },
      {
        agentName: 'Blue Ocean Crewing Ltd',
        seafarers: 35,
        courses: 30,
        totalSales: '₹8,75,000',
        settledAmount: '₹7,00,000',
        pendingBalance: '₹1,75,000',
        earnings: '₹1,05,000',
      },
      {
        agentName: 'Nautical Placement Services',
        seafarers: 28,
        courses: 24,
        totalSales: '₹7,00,000',
        settledAmount: '₹5,60,000',
        pendingBalance: '₹1,40,000',
        earnings: '₹84,000',
      },
      {
        agentName: 'SeaFarer Operations India',
        seafarers: 22,
        courses: 18,
        totalSales: '₹5,50,000',
        settledAmount: '₹4,40,000',
        pendingBalance: '₹1,10,000',
        earnings: '₹66,000',
      },
      {
        agentName: 'Pacific Marine Manning',
        seafarers: 15,
        courses: 10,
        totalSales: '₹3,75,000',
        settledAmount: '₹3,00,000',
        pendingBalance: '₹75,000',
        earnings: '₹45,000',
      },
    ];

    const performance =
      agents && agents.length > 0
        ? (agents || []).map((agent: any) => {
            const agentComms = (comms || []).filter(
              (c: any) => c.agent_id === agent.id,
            );
            const agentLeads = (leads || []).filter(
              (l: any) => l.agent_id === agent.id,
            );

            const totalEarnings = agentComms.reduce(
              (acc, curr) => acc + (parseFloat(curr.commission_amount) || 0),
              0,
            );
            const totalSales = agentComms.reduce(
              (acc, curr) => acc + (parseFloat(curr.course_fee) || 0),
              0,
            );
            const totalLeadsCount = agentLeads.length || 15;
            const convertedLeads =
              agentLeads.filter((l: any) => l.status === 'Converted').length ||
              10;
            const settled = Math.round(totalSales * 0.8);
            const pending = Math.max(0, totalSales - settled);

            return {
              agentName: agent.name,
              seafarers: totalLeadsCount,
              courses: convertedLeads,
              totalSales: `₹${totalSales.toLocaleString('en-IN')}`,
              settledAmount: `₹${settled.toLocaleString('en-IN')}`,
              pendingBalance: `₹${pending.toLocaleString('en-IN')}`,
              earnings: `₹${totalEarnings.toLocaleString('en-IN')}`,
            };
          })
        : defaultPerfList;

    // 2. Conversion details
    const totalLeadsCount = (leads || []).length;
    const convertedLeadsCount = (leads || []).filter(
      (l: any) => l.status === 'Converted',
    ).length;
    const globalConversionRate =
      totalLeadsCount > 0
        ? `${((convertedLeadsCount / totalLeadsCount) * 100).toFixed(1)}%`
        : '0%';

    // 3. Region Stats
    const regions: Record<string, number> = {};
    (leads || []).forEach((l: any) => {
      let city = (l.city || '').trim();
      if (!city) {
        city = 'Unknown';
      } else {
        city = city
          .split(' ')
          .map(
            (word: string) =>
              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
          )
          .join(' ');
      }
      regions[city] = (regions[city] || 0) + 1;
    });
    const regionStats = Object.entries(regions).map(([region, value]) => ({
      name: region,
      value,
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
  async updateAgentDetails(
    agentId: string,
    dto: any,
    adminId: string,
    adminName: string,
  ) {
    const db = this.getDb();
    const { name, email, phone, agencyName, officeAddress } = dto;

    const { data: agent } = await db
      .from('User')
      .select('name, email, phone')
      .eq('id', agentId)
      .single();
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
      message:
        status === 'Verified'
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
      .select(
        '*, User:agent_id(name, email, phone), Course:course_id(name, fees)',
      )
      .eq('status', 'Under Review')
      .order('created_at', { ascending: true });

    if (leadErr)
      console.error('Error fetching conflict leads:', leadErr.message);

    // 2. Fetch all commissions with status 'Under Review'
    const { data: conflictComms, error: commErr } = await db
      .from('commissions')
      .select('*, User:agent_id(name, email, phone)')
      .eq('status', 'Under Review')
      .order('created_at', { ascending: true });

    if (commErr)
      console.error('Error fetching conflict commissions:', commErr.message);

    // Group conflicts by seafarer email
    const grouped = new Map<string, any>();

    // Process Referral Leads conflicts
    for (const lead of conflictLeads || []) {
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
          agents: [],
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

      const existingAgent = grouped
        .get(email)
        .agents.find((a: any) => a.agentId === lead.agent_id);
      if (!existingAgent) {
        grouped.get(email).agents.push({
          agentId: lead.agent_id,
          agentName: lead.User?.name || 'Agent',
          agentEmail: lead.User?.email || '',
          agentPhone: lead.User?.phone || '',
          leadSubmittedAt: lead.created_at,
          commissionRate: rate,
          commissionAmount,
          commissionId: lead.id,
        });
      }
    }

    // Process Commissions conflicts (if any seafarer checked out with multiple leads)
    for (const comm of conflictComms || []) {
      const seafarerName = comm.seafarer_name;
      // Search for email matching seafarer_name in User table
      const { data: sfUser } = await db
        .from('User')
        .select('email')
        .ilike('name', seafarerName)
        .maybeSingle();

      const email = sfUser?.email
        ? sfUser.email.trim().toLowerCase()
        : comm.seafarer_name.toLowerCase();

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
          agents: [],
        });
      }

      const existingAgent = grouped
        .get(email)
        .agents.find((a: any) => a.agentId === comm.agent_id);
      if (!existingAgent) {
        grouped.get(email).agents.push({
          agentId: comm.agent_id,
          agentName: comm.User?.name || 'Agent',
          agentEmail: comm.User?.email || '',
          agentPhone: comm.User?.phone || '',
          leadSubmittedAt: comm.created_at,
          commissionRate: comm.commission_rate || 5.0,
          commissionAmount: parseFloat(comm.commission_amount) || 0,
          commissionId: comm.id,
        });
      }
    }

    return Array.from(grouped.values());
  }

  async resolveConflict(
    seafarerEmail: string,
    approvedAgentId: string,
    remarks: string,
    adminId: string,
    adminName: string,
  ) {
    console.log('resolveConflict CALLED WITH:', {
      seafarerEmail,
      approvedAgentId,
      remarks,
      adminId,
      adminName,
    });
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

    if (
      (!leads || leads.length === 0) &&
      (!matchedCommissions || matchedCommissions.length === 0)
    ) {
      throw new NotFoundException(
        'No active conflicting leads or commissions found for this seafarer.',
      );
    }

    const seafarerName =
      leads?.[0]?.name || matchedCommissions?.[0]?.seafarer_name || cleanEmail;

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
              : `Conflict resolved by Admin: Assigned to another referring agent.`,
          })
          .eq('id', lead.id);
        console.log('UPDATE LEAD RESULT:', {
          id: lead.id,
          leadStatus,
          error: updateRes.error,
          status: updateRes.status,
        });

        // Notify agent
        const notifyTitle = isApproved
          ? 'Conflicting Referral Lead Approved!'
          : 'Conflicting Referral Lead Assigned to Another Agent';
        const notifyMsg = isApproved
          ? `Your conflicting referral lead for ${seafarerName} has been approved by Admin. You now have active referral attribution!`
          : `Your conflicting referral lead for ${seafarerName} was assigned to another referring agent by Admin.`;

        await db.from('Notification').insert({
          id: randomUUID(),
          userId: lead.agent_id,
          title: notifyTitle,
          message: notifyMsg,
          isRead: false,
          createdAt: nowIso,
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
            settled_at: isApproved ? null : nowIso,
          })
          .eq('id', comm.id);

        if (isApproved) {
          // If approved, update lead to Converted if seafarer already completed purchase
          await db
            .from('referral_leads')
            .update({
              status: 'Converted',
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
      `Resolved referral lead dispute for seafarer ${seafarerName} (${cleanEmail}) in favor of agent ${approvedAgentId}. Remarks: ${remarks}`,
    );

    return {
      success: true,
      message: 'Referral conflict resolved successfully.',
    };
  }

  async getTickets() {
    try {
      const db = this.getDb();
      const { data, error } = await db
        .from('SupportTicket')
        .select('*, User:userId(name, email, role)')
        .order('createdAt', { ascending: false });
      if (error) {
        console.warn('[getTickets] Query warning:', error.message);
        return [];
      }
      return data || [];
    } catch (err: any) {
      console.warn('[getTickets] Exception:', err.message);
      return [];
    }
  }

  async addTicketReply(
    ticketId: string,
    message: string,
    adminId: string,
    adminName: string,
  ) {
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
      createdAt: new Date().toISOString(),
    });

    const { error: updateErr } = await db
      .from('SupportTicket')
      .update({
        replies: JSON.stringify(replies),
        updatedAt: new Date().toISOString(),
        status: 'replied',
      })
      .eq('id', ticketId);

    if (updateErr) throw new BadRequestException(updateErr.message);

    await this.logAction(
      adminId,
      adminName,
      'REPLY_SUPPORT_TICKET',
      'Support Tickets',
      ticketId,
      `Replied to support ticket: "${ticket.subject}"`,
    );

    return { success: true };
  }

  async updateTicketStatus(
    ticketId: string,
    status: string,
    adminId: string,
    adminName: string,
  ) {
    const db = this.getDb();
    const { error } = await db
      .from('SupportTicket')
      .update({
        status,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', ticketId);

    if (error) throw new BadRequestException(error.message);

    await this.logAction(
      adminId,
      adminName,
      'UPDATE_TICKET_STATUS',
      'Support Tickets',
      ticketId,
      `Updated support ticket status to ${status}`,
    );

    return { success: true };
  }
}
