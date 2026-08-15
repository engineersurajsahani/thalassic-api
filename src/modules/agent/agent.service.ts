import { Injectable, BadRequestException, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AgentService {
  private seafarersFilePath = path.join(process.cwd(), 'seafarers_local_data.json');
  private inMemorySeafarers: any[] = [];

  constructor(private readonly supabaseService: SupabaseService) {
    this.loadSeafarersFromDisk();
  }

  private loadSeafarersFromDisk() {
    try {
      if (fs.existsSync(this.seafarersFilePath)) {
        const raw = fs.readFileSync(this.seafarersFilePath, 'utf8');
        this.inMemorySeafarers = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Error loading seafarers from disk:', e);
    }
  }

  private saveSeafarersToDisk() {
    try {
      fs.writeFileSync(this.seafarersFilePath, JSON.stringify(this.inMemorySeafarers, null, 2), 'utf8');
    } catch (e) {
      console.warn('Error saving seafarers to disk:', e);
    }
  }

  private getDb() {
    return this.supabaseService.getClient();
  }

  // Helper to log agent actions to the audit_logs table
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

  // --- 1. Dashboard ---
  async getDashboard(agentId: string) {
    const db = this.getDb();

    // 1. Total Leads
    const { count: totalLeads } = await db
      .from('referral_leads')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId);

    // 2. Active Leads (status in ['New', 'Contacted', 'Registered'] and expiry_at > NOW())
    const nowIso = new Date().toISOString();
    const { count: activeLeads } = await db
      .from('referral_leads')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .in('status', ['New', 'Contacted', 'Registered'])
      .gt('expiry_at', nowIso);

    // 3. Converted Leads
    const { count: convertedLeads } = await db
      .from('referral_leads')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('status', 'Converted');

    // 4. Commissions Data
    const { data: commissions, error: commErr } = await db
      .from('commissions')
      .select('commission_amount, status')
      .eq('agent_id', agentId);

    if (commErr) throw new BadRequestException(commErr.message);

    let totalEarned = 0;
    let pendingCommission = 0;
    let paidCommission = 0;
    let totalPurchases = commissions?.length || 0;

    (commissions || []).forEach((c: any) => {
      const amt = Number(c.commission_amount) || 0;
      if (c.status !== 'Cancelled') {
        totalEarned += amt;
      }
      if (c.status === 'Pending') {
        pendingCommission += amt;
      } else if (c.status === 'Paid') {
        paidCommission += amt;
      }
    });

    // 5. Recent Activity
    const { data: recentLeads } = await db
      .from('referral_leads')
      .select('name, created_at, status')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(3);

    const { data: recentCommissions } = await db
      .from('commissions')
      .select('seafarer_name, course_name, created_at, status, commission_amount')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(3);

    const activities: any[] = [];
    (recentLeads || []).forEach((l: any) => {
      activities.push({
        id: `lead-${l.created_at}`,
        type: 'lead',
        title: 'New Lead Registered',
        message: `Seafarer ${l.name} registered under your code (Status: ${l.status}).`,
        timestamp: l.created_at,
      });
    });

    (recentCommissions || []).forEach((c: any) => {
      activities.push({
        id: `comm-${c.created_at}`,
        type: 'commission',
        title: 'Commission Updated',
        message: `Earned ₹${c.commission_amount} for ${c.seafarer_name}'s purchase of ${c.course_name} (Status: ${c.status}).`,
        timestamp: c.created_at,
      });
    });

    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const { data: meta } = await db
      .from('agent_metadata')
      .select('referral_code')
      .eq('user_id', agentId)
      .maybeSingle();

    return {
      stats: {
        totalLeads: totalLeads || 0,
        activeLeads: activeLeads || 0,
        convertedLeads: convertedLeads || 0,
        totalPurchases,
        totalEarned,
        pendingCommission,
        paidCommission,
      },
      recentActivities: activities.slice(0, 5),
      referralCode: meta?.referral_code || 'PENDING'
    };
  }

  // --- 2. Onboarding & Metadata ---
  async getMetadata(agentId: string) {
    const db = this.getDb();
    const { data, error } = await db
      .from('agent_metadata')
      .select('*')
      .eq('user_id', agentId)
      .single();

    if (error) {
      // If metadata doesn't exist, create an empty row
      const { data: newMeta, error: createErr } = await db
        .from('agent_metadata')
        .insert({
          id: randomUUID(),
          user_id: agentId,
          onboarding_status: 'Invited',
          general_commission: 5.0,
          course_commissions: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      if (createErr) throw new BadRequestException(createErr.message);
      return newMeta;
    }
    return data;
  }

  async onboard(agentId: string, data: any) {
    const db = this.getDb();

    // 1. Fetch current record to enforce immutability at the service layer
    const currentMeta = await this.getMetadata(agentId);
    let refCodeClean = currentMeta.referral_code;

    if (!refCodeClean) {
      // Auto-generate a unique permanent referral code (e.g. KISH25 or OCEAN25)
      const baseName = (data.name || 'AGENT').trim().toUpperCase().replace(/[^A-Z]/g, '');
      const base = baseName.length >= 3 ? baseName.slice(0, 5) : 'OCEAN';
      
      let isUnique = false;
      let attempts = 0;
      while (!isUnique && attempts < 10) {
        const suffix = Math.floor(10 + Math.random() * 90); // 2-digit suffix
        const candidate = `${base}${suffix}`;
        
        const { data: dup } = await db
          .from('agent_metadata')
          .select('user_id')
          .eq('referral_code', candidate)
          .maybeSingle();

        if (!dup) {
          refCodeClean = candidate;
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        // Fallback to 4-digit random suffix to guarantee absolute uniqueness
        refCodeClean = `${base}${Math.floor(1000 + Math.random() * 9000)}`;
      }
    }

    // 3. Update agent_metadata
    const referralLink = `http://localhost:3000/?ref=${refCodeClean}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(referralLink)}`;

    const { error: metaErr } = await db
      .from('agent_metadata')
      .update({
        referral_code: refCodeClean,
        qr_code: qrCodeUrl,
        onboarding_status: 'Active',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', agentId);

    if (metaErr) throw new BadRequestException(metaErr.message);

    // 4. Update profile details in User
    const { data: userRecord } = await db.from('User').select('name').eq('id', agentId).single();
    const userName = userRecord?.name || 'Agent';

    const { error: userErr } = await db
      .from('User')
      .update({
        name: data.name || userName,
        phone: data.phone || null,
        status: 'Active',
        updatedAt: new Date().toISOString()
      })
      .eq('id', agentId);

    if (userErr) throw new BadRequestException(userErr.message);

    // 5. Write audit log
    await this.logAction(
      agentId,
      data.name || userName,
      'AGENT_ONBOARDED',
      'Onboarding',
      agentId,
      `Completed onboarding setup. Chosen referral code: ${refCodeClean}`
    );

    return { success: true };
  }

  // --- 3. Referral Leads ---
  async getLeads(agentId: string) {
    const db = this.getDb();
    
    // We fetch leads and flag expired ones in-memory (and can update status to Expired if expired)
    const { data: leads, error } = await db
      .from('referral_leads')
      .select('*, Course(name)')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);

    const now = new Date();
    const processedLeads = (leads || []).map((l: any) => {
      const expiry = new Date(l.expiry_at);
      let status = l.status;
      if (expiry < now && (l.status === 'New' || l.status === 'Contacted' || l.status === 'Registered')) {
        status = 'Expired';
      }
      return {
        ...l,
        status,
        courseName: l.Course?.name || 'N/A'
      };
    });

    return processedLeads;
  }

  async getLeadById(agentId: string, leadId: string) {
    const db = this.getDb();
    const { data: lead, error } = await db
      .from('referral_leads')
      .select('*, Course(name)')
      .eq('id', leadId)
      .single();

    if (error || !lead) throw new NotFoundException('Referral lead not found.');

    // Enforce Ownership
    if (lead.agent_id !== agentId) {
      throw new ForbiddenException('Access denied. You do not own this referral lead.');
    }

    const now = new Date();
    const expiry = new Date(lead.expiry_at);
    let status = lead.status;
    if (expiry < now && (lead.status === 'New' || lead.status === 'Contacted' || lead.status === 'Registered')) {
      status = 'Expired';
    }

    return {
      ...lead,
      status,
      courseName: lead.Course?.name || 'N/A'
    };
  }

  async createLead(agentId: string, data: any) {
    const db = this.getDb();
    const nowIso = new Date().toISOString();

    // 1. Check if the current agent already has an active lead for this email/phone
    const { data: ownDuplicate } = await db
      .from('referral_leads')
      .select('id')
      .eq('agent_id', agentId)
      .or(`email.eq.${data.email},phone.eq.${data.phone}`)
      .gt('expiry_at', nowIso)
      .in('status', ['New', 'Contacted', 'Registered', 'Under Review'])
      .limit(1);

    if (ownDuplicate && ownDuplicate.length > 0) {
      throw new BadRequestException('You have already registered an active lead with this email or mobile number.');
    }

    // 2. Check if another agent has registered an active lead for this email/phone
    const { data: otherLeads } = await db
      .from('referral_leads')
      .select('id, agent_id, status')
      .neq('agent_id', agentId)
      .or(`email.eq.${data.email},phone.eq.${data.phone}`)
      .gt('expiry_at', nowIso)
      .in('status', ['New', 'Contacted', 'Registered', 'Under Review']);

    const isConflict = otherLeads && otherLeads.length > 0;
    const leadStatus = isConflict ? 'Under Review' : 'New';

    const leadId = randomUUID();
    const createdAt = nowIso;
    const expiryAt = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString();

    const { data: newLead, error } = await db
      .from('referral_leads')
      .insert({
        id: leadId,
        agent_id: agentId,
        name: data.name,
        email: data.email,
        phone: data.phone,
        city: data.city || null,
        course_id: data.courseId || null,
        status: leadStatus,
        remarks: isConflict ? 'Conflict detected: Registered by multiple agents. Under manual review.' : (data.remarks || null),
        created_at: createdAt,
        expiry_at: expiryAt
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    // 3. If conflict exists, freeze existing leads and notify Admin
    if (isConflict) {
      // Update all other matching leads to 'Under Review'
      await db
        .from('referral_leads')
        .update({
          status: 'Under Review',
          remarks: `Conflict detected: Registered by another agent. Under manual review.`
        })
        .neq('agent_id', agentId)
        .or(`email.eq.${data.email},phone.eq.${data.phone}`)
        .gt('expiry_at', nowIso)
        .in('status', ['New', 'Contacted', 'Registered']);

      // Notify the agent admin
      const { data: admins } = await db.from('User').select('id').eq('role', 'agent_admin');
      for (const admin of (admins || [])) {
        await db.from('Notification').insert({
          id: randomUUID(),
          userId: admin.id,
          title: 'Referral Lead Conflict Detected',
          message: `Multiple agents have registered the same lead: ${data.name || 'Seafarer'} (${data.email}). Please resolve this conflict in the Manual Review panel.`,
          isRead: false,
          createdAt: nowIso
        });
      }

      // Log conflict in audit_logs
      await this.logAction(
        agentId,
        'System',
        'REFERRAL_CONFLICT',
        'Referral Leads',
        leadId,
        `Referral conflict triggered for seafarer ${data.name} (${data.email})`
      );
    }

    const { data: userRec } = await db.from('User').select('name').eq('id', agentId).single();
    await this.logAction(
      agentId,
      userRec?.name || 'Agent',
      'CREATE_LEAD',
      'Referral Leads',
      leadId,
      `Registered a new referral lead: ${data.name} (${data.email})`
    );

    return newLead;
  }

  async updateLead(agentId: string, leadId: string, data: any) {
    const db = this.getDb();
    
    // Ownership check (throws if not owned)
    const currentLead = await this.getLeadById(agentId, leadId);

    // PRD 8.4 Business Rule: Agents may edit only Pending / New Leads. Expired or Converted leads are read-only.
    if (currentLead.status !== 'Pending' && currentLead.status !== 'New') {
      throw new BadRequestException('PRD 8.4 Violation: Agents may edit only Pending leads. Expired or Converted leads are read-only.');
    }

    // Only allow updating specific fields
    const { error } = await db
      .from('referral_leads')
      .update({
        name: data.name ?? currentLead.name,
        email: data.email ?? currentLead.email,
        phone: data.phone ?? currentLead.phone,
        city: data.city ?? currentLead.city,
        course_id: data.courseId ?? currentLead.course_id,
        status: data.status ?? currentLead.status,
        remarks: data.remarks ?? currentLead.remarks
      })
      .eq('id', leadId);

    if (error) throw new BadRequestException(error.message);

    const { data: userRec } = await db.from('User').select('name').eq('id', agentId).single();
    await this.logAction(
      agentId,
      userRec?.name || 'Agent',
      'UPDATE_LEAD',
      'Referral Leads',
      leadId,
      `Updated referral lead details for: ${data.name || currentLead.name}`
    );

    return { success: true };
  }

  // --- 4. Referred Purchases ---
  async getPurchases(agentId: string) {
    const db = this.getDb();
    // In our system, referred purchases match commission entries
    const { data, error } = await db
      .from('commissions')
      .select('id, seafarer_name, course_name, created_at, course_fee, status, purchase_id')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);

    return (data || []).map((p: any) => ({
      invoiceNumber: `INV-${p.purchase_id?.substring(0, 8).toUpperCase() || p.id.substring(0, 8).toUpperCase()}`,
      seafarerName: p.seafarer_name,
      courseName: p.course_name,
      purchaseDate: p.created_at,
      courseFee: p.course_fee,
      status: p.status === 'Cancelled' ? 'Cancelled' : 'Completed'
    }));
  }

  // --- 5. Commissions Ledger ---
  async getCommissions(agentId: string) {
    const db = this.getDb();
    const { data, error } = await db
      .from('commissions')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // --- 6. Documents Manager ---
  async getDocuments(agentId: string) {
    const db = this.getDb();
    const { data, error } = await db
      .from('Document')
      .select('*')
      .eq('userId', agentId);

    if (error) throw new BadRequestException(error.message);

    return (data || []).map((d: any) => ({
      id: d.id,
      type: d.type,
      label: d.name || d.type,
      status: d.status || 'Pending',
      expiryDate: d.expiryDate || null,
      uploadedAt: d.uploadDate || null
    }));
  }

  async uploadDocument(agentId: string, type: string, expiryDate?: string, fileName?: string) {
    const db = this.getDb();

    // Check if the document type already exists; if so, replace it
    const { data: existingDoc } = await db
      .from('Document')
      .select('id')
      .eq('userId', agentId)
      .eq('type', type)
      .single();

    if (existingDoc) {
      const { data, error } = await db
        .from('Document')
        .update({
          name: fileName || type,
          status: 'Pending', // resets verification status to Pending
          expiryDate: expiryDate || null,
          uploadDate: new Date().toISOString()
        })
        .eq('id', existingDoc.id)
        .select()
        .single();
      if (error) throw new BadRequestException(error.message);
      return data;
    } else {
      const { data, error } = await db
        .from('Document')
        .insert({
          id: randomUUID(),
          userId: agentId,
          type,
          name: fileName || type,
          url: `/uploads/documents/${type}-${agentId}.pdf`,
          status: 'Pending',
          expiryDate: expiryDate || null,
          uploadDate: new Date().toISOString()
        })
        .select()
        .single();
      if (error) throw new BadRequestException(error.message);
      return data;
    }
  }

  // --- 7. Profile ---
  async getProfile(agentId: string) {
    const db = this.getDb();

    const { data: user, error: userErr } = await db
      .from('User')
      .select('id, name, email, phone, role, status')
      .eq('id', agentId)
      .single();

    if (userErr || !user) throw new NotFoundException('User profile not found.');

    const metadata = await this.getMetadata(agentId);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      // Metadata (alternate phone, addresses, agency info)
      alternatePhone: metadata.alternate_phone || '',
      address: metadata.address || '',
      city: metadata.city || '',
      state: metadata.state || '',
      pinCode: metadata.pin_code || '',
      agencyName: metadata.agency_name || '',
      officeAddress: metadata.office_address || '',
      agencyCity: metadata.agency_city || '',
      agencyState: metadata.agency_state || '',
      agencyPinCode: metadata.agency_pin_code || '',
      referralCode: metadata.referral_code || '',
      qrCode: metadata.qr_code || '',
      onboardingStatus: metadata.onboarding_status
    };
  }

  async updateProfile(agentId: string, data: any) {
    const db = this.getDb();

    // 1. Immutability block (email, referral_code)
    const currentProfile = await this.getProfile(agentId);
    if (data.email && data.email !== currentProfile.email) {
      throw new BadRequestException('Modifying account email address is not permitted.');
    }
    if (data.referralCode && data.referralCode !== currentProfile.referralCode) {
      throw new BadRequestException('Modifying account referral code is not permitted.');
    }

    // 2. Update User details
    const { error: userErr } = await db
      .from('User')
      .update({
        name: data.name ?? currentProfile.name,
        phone: data.phone ?? currentProfile.phone,
        updatedAt: new Date().toISOString()
      })
      .eq('id', agentId);

    if (userErr) throw new BadRequestException(userErr.message);

    // 3. Update agent_metadata details
    const { error: metaErr } = await db
      .from('agent_metadata')
      .update({
        alternate_phone: data.alternatePhone ?? null,
        address: data.address ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
        pin_code: data.pinCode ?? null,
        agency_name: data.agencyName ?? null,
        office_address: data.officeAddress ?? null,
        agency_city: data.agencyCity ?? null,
        agency_state: data.agencyState ?? null,
        agency_pin_code: data.agencyPinCode ?? null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', agentId);

    if (metaErr) throw new BadRequestException(metaErr.message);

    await this.logAction(
      agentId,
      data.name || currentProfile.name,
      'UPDATE_PROFILE',
      'Profile Settings',
      agentId,
      'Updated account profile settings'
    );

    return { success: true };
  }

  // --- 8. Support Tickets ---
  async getSupportTickets(agentId: string) {
    const db = this.getDb();
    const { data, error } = await db
      .from('SupportTicket')
      .select('*')
      .eq('userId', agentId)
      .order('createdAt', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return data || [];
  }

  async getSupportTicketById(agentId: string, ticketId: string) {
    const db = this.getDb();
    const { data: ticket, error } = await db
      .from('SupportTicket')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (error || !ticket) throw new NotFoundException('Support ticket not found.');

    // Enforce Ownership
    if (ticket.userId !== agentId) {
      throw new ForbiddenException('Access denied. You do not own this support ticket.');
    }

    return ticket;
  }

  async createSupportTicket(agentId: string, data: any) {
    const db = this.getDb();
    const ticketId = randomUUID();

    const { data: newTicket, error } = await db
      .from('SupportTicket')
      .insert({
        id: ticketId,
        userId: agentId,
        subject: data.subject,
        description: data.description,
        status: 'open',
        replies: '[]', // defaulting JSON text representation
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    const { data: userRec } = await db.from('User').select('name').eq('id', agentId).single();
    await this.logAction(
      agentId,
      userRec?.name || 'Agent',
      'CREATE_SUPPORT_TICKET',
      'Support Tickets',
      ticketId,
      `Created support ticket: "${data.subject}"`
    );

    return newTicket;
  }

  // --- 9. Invoices ---
  async getInvoices(agentId: string) {
    const db = this.getDb();
    const { data, error } = await db
      .from('commissions')
      .select('id, seafarer_name, course_name, created_at, course_fee, status, purchase_id, commission_rate, commission_amount')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);

    return (data || []).map((p: any) => ({
      id: p.id,
      invoiceNumber: `HAC-2026-${p.purchase_id?.substring(0, 6).toUpperCase() || p.id.substring(0, 6).toUpperCase()}`,
      invoiceType: 'HAC',
      seafarerName: p.seafarer_name,
      courseName: p.course_name,
      purchaseAmount: p.course_fee,
      purchaseDate: p.created_at,
      invoiceStatus: p.status === 'Cancelled' ? 'Cancelled' : 'Paid',
      commissionRate: p.commission_rate,
      commissionAmount: p.commission_amount
    }));
  }

  // --- 10. Notifications ---
  async getNotifications(agentId: string) {
    const db = this.getDb();
    const { data, error } = await db
      .from('Notification')
      .select('*')
      .eq('userId', agentId)
      .order('createdAt', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return data || [];
  }

  async markNotificationRead(agentId: string, notificationId: string) {
    const db = this.getDb();
    const { error } = await db
      .from('Notification')
      .update({ isRead: true })
      .eq('id', notificationId)
      .eq('userId', agentId);

    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }

  async deleteNotification(agentId: string, notificationId: string) {
    const db = this.getDb();
    const { error } = await db
      .from('Notification')
      .delete()
      .eq('id', notificationId)
      .eq('userId', agentId);

    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }

  // --- 11. Settings (Password Change) ---
  async changePassword(agentId: string, oldPass: string, newPass: string) {
    const db = this.getDb();
    const { data: user, error: userErr } = await db
      .from('User')
      .select('password, name')
      .eq('id', agentId)
      .single();

    if (userErr || !user) throw new NotFoundException('User account not found.');

    const isMatch = await bcrypt.compare(oldPass, user.password);
    if (!isMatch) {
      throw new BadRequestException('Incorrect current password.');
    }

    const hashedNew = await bcrypt.hash(newPass, 10);
    const { error } = await db
      .from('User')
      .update({
        password: hashedNew,
        updatedAt: new Date().toISOString()
      })
      .eq('id', agentId);

    if (error) throw new BadRequestException(error.message);

    await this.logAction(
      agentId,
      user.name || 'Agent',
      'CHANGE_PASSWORD',
      'Settings',
      agentId,
      'Changed account password securely'
    );

    return { success: true };
  }

  // =========================================================================
  // --- PARTNER (AGENT) SIDE IMPLEMENTATION (CHANGE PRD CHAPTERS 1 - 10) ---
  // =========================================================================

  private readonly partnerPurchasesFilePath = path.join(process.cwd(), 'partner_purchases_data.json');
  private readonly partnerPricingFilePath = path.join(process.cwd(), 'partner_pricing_data.json');
  private readonly settlementsFilePath = path.join(process.cwd(), 'settlements_data.json');

  private loadPartnerPurchases(): any[] {
    try {
      if (fs.existsSync(this.partnerPurchasesFilePath)) {
        const raw = fs.readFileSync(this.partnerPurchasesFilePath, 'utf8');
        return JSON.parse(raw) || [];
      }
    } catch (e) {
      console.warn('Error reading partner_purchases_data.json:', e);
    }
    return [];
  }

  private savePartnerPurchases(purchases: any[]) {
    try {
      fs.writeFileSync(this.partnerPurchasesFilePath, JSON.stringify(purchases, null, 2), 'utf8');
    } catch (e) {
      console.warn('Error saving partner_purchases_data.json:', e);
    }
  }

  private loadPartnerPricing(): any[] {
    try {
      if (fs.existsSync(this.partnerPricingFilePath)) {
        const raw = fs.readFileSync(this.partnerPricingFilePath, 'utf8');
        return JSON.parse(raw) || [];
      }
    } catch (e) {
      console.warn('Error reading partner_pricing_data.json:', e);
    }
    return [];
  }

  private loadSettlements(): any[] {
    try {
      if (fs.existsSync(this.settlementsFilePath)) {
        const raw = fs.readFileSync(this.settlementsFilePath, 'utf8');
        return JSON.parse(raw) || [];
      }
    } catch (e) {
      console.warn('Error reading settlements_data.json:', e);
    }
    return [];
  }

  private saveSettlements(settlements: any[]) {
    try {
      fs.writeFileSync(this.settlementsFilePath, JSON.stringify(settlements, null, 2), 'utf8');
    } catch (e) {
      console.warn('Error saving settlements_data.json:', e);
    }
  }

  // Fallback / standard courses if DB query is empty
  private getStandardCoursesList() {
    return [
      {
        id: 'c-001',
        code: 'BST',
        name: 'Basic Safety Training',
        category: 'basic',
        duration: '12 Days',
        fees: '₹12,000',
        standardFee: 12000,
        description: 'Mandatory physical safety training modules including Personal Survival Techniques and Firefighting.',
        status: 'Active',
        trainingMode: 'Physical'
      },
      {
        id: 'c-002',
        code: 'AFF',
        name: 'Advanced Fire Fighting',
        category: 'advanced',
        duration: '5 Days',
        fees: '₹7,200',
        standardFee: 7200,
        description: 'Advanced in-person practical training in organization and control of shipboard firefighting operations.',
        status: 'Active',
        trainingMode: 'Physical'
      },
      {
        id: 'c-003',
        code: 'OCTCO',
        name: 'Oil and Chemical Tanker Cargo Operations',
        category: 'basic',
        duration: '6 Days',
        fees: '₹6,000',
        standardFee: 6000,
        description: 'Physical workshop and simulator training for tanker cargo operations.',
        status: 'Active',
        trainingMode: 'Physical'
      },
      {
        id: 'c-004',
        code: 'MEDICARE',
        name: 'Medical Care on Board Ships',
        category: 'advanced',
        duration: '5 Days',
        fees: '₹25,000',
        standardFee: 25000,
        description: 'In-person clinical procedures, first aid, and medical care.',
        status: 'Active',
        trainingMode: 'Physical'
      },
      {
        id: 'c-005',
        code: 'RPST',
        name: 'Refresher PST',
        category: 'refresher',
        duration: '1 Day',
        fees: '₹3,500',
        standardFee: 3500,
        description: 'Physical practical refresher training for Personal Survival Techniques.',
        status: 'Active',
        trainingMode: 'Physical'
      }
    ];
  }

  // Helper to determine Hari Om payable amount for a partner + course
  private resolvePayableAmount(partnerId: string, course: any): number {
    const pricingList = this.loadPartnerPricing();
    const courseCode = course.code || course.id;
    const courseId = course.id;

    // 1. Check specific partner override FIRST (Highest Precedence)
    const specificPartnerMatch = pricingList.find(
      (p: any) =>
        p.partnerId === partnerId &&
        (p.courseId === courseId || p.courseCode === courseCode)
    );

    if (specificPartnerMatch && typeof specificPartnerMatch.hariOmPayableAmount === 'number') {
      return specificPartnerMatch.hariOmPayableAmount;
    }

    // 2. Check Global Default (*) (Second Precedence)
    const globalMatch = pricingList.find(
      (p: any) =>
        p.partnerId === '*' &&
        (p.courseId === courseId || p.courseCode === courseCode)
    );

    if (globalMatch && typeof globalMatch.hariOmPayableAmount === 'number') {
      return globalMatch.hariOmPayableAmount;
    }

    // 3. Fallback rule: standard fee minus 15% partner rate or raw standard fee
    const rawFee = typeof course.fees === 'number' 
      ? course.fees 
      : parseInt(String(course.fees || '10000').replace(/[^0-9]/g, ''), 10) || 10000;
    
    return Math.round(rawFee * 0.85); // default partner payable rate
  }

  // --- Partner Method 1: Dashboard KPIs ---
  async getPartnerDashboard(partnerId: string) {
    const db = this.getDb();
    const purchases = this.loadPartnerPurchases().filter((p: any) => p.partner_id === partnerId);
    const settlements = this.loadSettlements().filter((s: any) => s.partner_id === partnerId || s.agent_id === partnerId);

    const totalPurchases = purchases.length;
    const pendingPurchases = purchases.filter((p: any) => p.settlement_status === 'Pending').length;
    
    let totalPayable = 0;
    purchases.forEach((p: any) => {
      totalPayable += Number(p.payable_amount) || 0;
    });

    let amountSettled = 0;
    let pendingSettlementAmount = 0;
    let pendingSettlementsCount = 0;

    settlements.forEach((s: any) => {
      const amt = Number(s.total_amount) || 0;
      if (s.status === 'Completed' || s.status === 'Paid') {
        amountSettled += amt;
      } else if (s.status === 'Submitted' || s.status === 'Under Verification' || s.status === 'Pending') {
        pendingSettlementAmount += amt;
        pendingSettlementsCount++;
      }
    });

    const outstandingAmount = Math.max(0, totalPayable - amountSettled);

    // Fetch partner user info
    const { data: user } = await db.from('User').select('id, name, email, phone').eq('id', partnerId).maybeSingle();

    const recentPurchases = [...purchases]
      .sort((a, b) => new Date(b.created_at || b.purchase_date).getTime() - new Date(a.created_at || a.purchase_date).getTime())
      .slice(0, 5);

    const recentSettlements = [...settlements]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);

    return {
      kpis: {
        totalPurchases,
        pendingPurchases,
        totalPayable,
        amountSettled,
        outstandingAmount,
        pendingSettlements: pendingSettlementsCount,
        pendingSettlementAmount
      },
      partner: {
        id: partnerId,
        name: user?.name || 'Authorized Hari Om Partner',
        email: user?.email || '',
        phone: user?.phone || ''
      },
      recentPurchases,
      recentSettlements
    };
  }

  // --- Partner Method 2: Search Seafarer Master ---
  async searchSeafarers(query: string) {
    const q = (query || '').trim().toLowerCase();
    const db = this.getDb();

    // 1. Fetch Users with role SEAFARER
    const { data: users } = await db
      .from('User')
      .select('id, name, email, phone, role, status, createdAt')
      .eq('role', 'SEAFARER');

    // 2. Fetch SeafarerProfiles
    const { data: profiles } = await db
      .from('SeafarerProfile')
      .select('*');

    // 3. Fallback mock seafarers if database has no rows
    const mockSeafarers = [
      {
        id: 'a0000000-0000-0000-0000-000000000001',
        name: 'Raj Kumar',
        email: 'raj@example.com',
        phone: '+91 98765 43210',
        dob: '1994-08-12',
        nationality: 'Indian',
        address: 'Varanasi, Uttar Pradesh, India',
        indosNumber: '20N1234',
        passportNumber: 'Z1234567',
        cdcNumber: 'MUM123456',
        fatherName: 'Sanjay Kumar',
        status: 'Active'
      },
      {
        id: 'a0000000-0000-0000-0000-000000000002',
        name: 'Priya Singh',
        email: 'priya@example.com',
        phone: '+91 99887 76655',
        dob: '1996-05-24',
        nationality: 'Indian',
        address: 'Patna, Bihar, India',
        indosNumber: '21N5678',
        passportNumber: 'Y7654321',
        cdcNumber: 'KOL765432',
        fatherName: 'Rakesh Singh',
        status: 'Active'
      },
      {
        id: 'a0000000-0000-0000-0000-000000000003',
        name: 'Amit Patel',
        email: 'amit@example.com',
        phone: '+91 98989 89898',
        dob: '1992-11-30',
        nationality: 'Indian',
        address: 'Ahmedabad, Gujarat, India',
        indosNumber: '19E9876',
        passportNumber: 'X9876543',
        cdcNumber: 'MUM987654',
        fatherName: 'Kishor Patel',
        status: 'Active'
      }
    ];

    const masterMap = new Map<string, any>();

    // Load mock base
    mockSeafarers.forEach(s => masterMap.set(s.id, s));

    // Overlay inMemory/local records
    this.inMemorySeafarers.forEach(s => masterMap.set(s.id, s));

    // Overlay DB records
    (users || []).forEach((u: any) => {
      const prof = (profiles || []).find((p: any) => p.userId === u.id || p.user_id === u.id);
      masterMap.set(u.id, {
        id: u.id,
        name: u.name || 'Seafarer',
        email: u.email || '',
        phone: u.phone || '',
        dob: prof?.dob || prof?.date_of_birth || '',
        nationality: prof?.nationality || 'Indian',
        address: prof?.address || prof?.birth_place || '',
        indosNumber: prof?.indosNumber || prof?.indos_num || '',
        passportNumber: prof?.passportNumber || prof?.passport_num || '',
        cdcNumber: prof?.cdcNumber || prof?.cdc_num || '',
        fatherName: prof?.fatherName || prof?.father_name || '',
        status: u.status || 'Active',
        createdAt: u.createdAt || u.created_at
      });
    });

    const allSeafarers = Array.from(masterMap.values());

    if (!q) {
      return allSeafarers;
    }

    // Filter by INDoS, Passport, CDC, Email, Phone, or Name
    return allSeafarers.filter(s => {
      const matchIndos = (s.indosNumber || '').toLowerCase().includes(q);
      const matchPassport = (s.passportNumber || '').toLowerCase().includes(q);
      const matchCdc = (s.cdcNumber || '').toLowerCase().includes(q);
      const matchEmail = (s.email || '').toLowerCase().includes(q);
      const matchPhone = (s.phone || '').toLowerCase().includes(q);
      const matchName = (s.name || '').toLowerCase().includes(q);
      return matchIndos || matchPassport || matchCdc || matchEmail || matchPhone || matchName;
    });
  }

  // --- Partner Method 3: Get All Seafarers Master ---
  async getAllSeafarersMaster() {
    return this.searchSeafarers('');
  }

  // --- Partner Method 4: Create Seafarer Master with Duplicate Prevention ---
  async createSeafarerMaster(partnerId: string, dto: any) {
    const db = this.getDb();

    // Required fields check
    if (!dto.name || !dto.email) {
      throw new BadRequestException('Seafarer full name and email address are required.');
    }

    const emailTrimmed = dto.email.trim().toLowerCase();
    const indosTrimmed = (dto.indosNumber || '').trim().toUpperCase();
    const passportTrimmed = (dto.passportNumber || '').trim().toUpperCase();
    const cdcTrimmed = (dto.cdcNumber || '').trim().toUpperCase();
    const phoneTrimmed = (dto.phone || '').trim();

    // 1. Duplicate check across existing Seafarers
    const existingSeafarers = await this.searchSeafarers('');

    if (emailTrimmed) {
      const dupEmail = existingSeafarers.find(s => (s.email || '').toLowerCase() === emailTrimmed);
      if (dupEmail) {
        throw new ConflictException(`Duplicate Detected: A Seafarer Master already exists with email '${emailTrimmed}'. Please reuse existing Seafarer Master.`);
      }
    }

    if (indosTrimmed) {
      const dupIndos = existingSeafarers.find(s => (s.indosNumber || '').toUpperCase() === indosTrimmed);
      if (dupIndos) {
        throw new ConflictException(`Duplicate Detected: A Seafarer Master with INDoS Number '${indosTrimmed}' already exists.`);
      }
    }

    if (passportTrimmed) {
      const dupPassport = existingSeafarers.find(s => (s.passportNumber || '').toUpperCase() === passportTrimmed);
      if (dupPassport) {
        throw new ConflictException(`Duplicate Detected: A Seafarer Master with Passport Number '${passportTrimmed}' already exists.`);
      }
    }

    if (cdcTrimmed) {
      const dupCdc = existingSeafarers.find(s => (s.cdcNumber || '').toUpperCase() === cdcTrimmed);
      if (dupCdc) {
        throw new ConflictException(`Duplicate Detected: A Seafarer Master with CDC Number '${cdcTrimmed}' already exists.`);
      }
    }

    if (phoneTrimmed) {
      const dupPhone = existingSeafarers.find(s => s.phone && s.phone.replace(/[^0-9]/g, '') === phoneTrimmed.replace(/[^0-9]/g, ''));
      if (dupPhone) {
        throw new ConflictException(`Duplicate Detected: A Seafarer Master with Phone Number '${phoneTrimmed}' already exists.`);
      }
    }

    const seafarerId = randomUUID();
    const defaultHashedPassword = await bcrypt.hash('HariOm@Seafarer123', 10);
    const nowIso = new Date().toISOString();

    // 2. Insert into User table
    const { error: userErr } = await db.from('User').insert({
      id: seafarerId,
      name: dto.name.trim(),
      email: emailTrimmed,
      phone: phoneTrimmed || null,
      password: defaultHashedPassword,
      role: 'SEAFARER',
      status: 'Active',
      createdAt: nowIso,
      updatedAt: nowIso
    });

    if (userErr && !userErr.message?.includes('duplicate')) {
      console.warn('User insert note:', userErr.message);
    }

    // 3. Insert into SeafarerProfile table
    const profileId = randomUUID();
    const { error: profErr } = await db.from('SeafarerProfile').insert({
      id: profileId,
      userId: seafarerId,
      dob: dto.dob || null,
      nationality: dto.nationality || 'Indian',
      address: dto.address || dto.city || null,
      indosNumber: indosTrimmed || null,
      passportNumber: passportTrimmed || null,
      cdcNumber: cdcTrimmed || null,
      fatherName: dto.fatherName || null,
      createdAt: nowIso,
      updatedAt: nowIso
    });

    if (profErr) {
      console.warn('SeafarerProfile insert note:', profErr.message);
    }

    const createdMaster = {
      id: seafarerId,
      name: dto.name.trim(),
      email: emailTrimmed,
      phone: phoneTrimmed,
      dob: dto.dob || '',
      nationality: dto.nationality || 'Indian',
      address: dto.address || dto.city || '',
      indosNumber: indosTrimmed,
      passportNumber: passportTrimmed,
      cdcNumber: cdcTrimmed,
      fatherName: dto.fatherName || '',
      status: 'Active',
      createdAt: nowIso
    };

    // Save locally for instant availability
    this.inMemorySeafarers.push(createdMaster);
    this.saveSeafarersToDisk();

    // Log action
    await this.logAction(
      partnerId,
      'Partner',
      'CREATE_SEAFARER_MASTER',
      'Partner Seafarer Master',
      seafarerId,
      `Created Seafarer Master: ${dto.name} (INDoS: ${indosTrimmed || 'N/A'}, Passport: ${passportTrimmed || 'N/A'})`
    );

    return createdMaster;
  }

  // --- Partner Method 5: Get Seafarer Master Profile with Unified Multi-Source Purchase History ---
  async getSeafarerMasterById(seafarerId: string, currentPartnerId: string) {
    const db = this.getDb();
    const seafarers = await this.searchSeafarers('');
    const seafarer = seafarers.find(s => s.id === seafarerId);

    if (!seafarer) {
      throw new NotFoundException('Seafarer Master not found.');
    }

    // 1. Fetch physical enrollments from DB
    const { data: dbEnrollments } = await db
      .from('Enrollment')
      .select('id, status, progress, startDate, createdAt, Course(id, name, code, duration, fees)')
      .eq('userId', seafarerId)
      .order('createdAt', { ascending: false });

    // 2. Fetch Partner Purchases from persistent storage
    const allPartnerPurchases = this.loadPartnerPurchases().filter((p: any) => p.seafarer_id === seafarerId);

    // 3. Build Multi-Source Purchase History (Direct Hari Om vs Current Partner vs Other Partner)
    const purchasesHistory: any[] = [];

    // Map Partner purchases
    allPartnerPurchases.forEach((p: any) => {
      const isCurrentPartner = p.partner_id === currentPartnerId;
      purchasesHistory.push({
        id: p.id,
        purchaseNumber: p.purchase_number || `PUR-${p.id.substring(0, 8).toUpperCase()}`,
        source: isCurrentPartner ? 'Current Partner' : 'Partner Network',
        partnerName: isCurrentPartner ? (p.partner_name || 'Your Partner Agency') : 'Authorized Partner Network',
        isCurrentPartner,
        courseCode: p.course_code,
        courseName: p.course_name,
        trainingMode: 'Physical Training',
        payableAmount: isCurrentPartner ? p.payable_amount : undefined, // privacy protection for other partners
        purchaseDate: p.purchase_date || p.created_at,
        purchaseStatus: p.purchase_status || 'Completed',
        settlementStatus: isCurrentPartner ? (p.settlement_status || 'Pending') : 'Settled'
      });
    });

    // Map Direct DB Enrollments not covered in partner purchases
    (dbEnrollments || []).forEach((e: any) => {
      const alreadyIncluded = allPartnerPurchases.some((p: any) => p.enrollment_id === e.id);
      if (!alreadyIncluded) {
        purchasesHistory.push({
          id: e.id,
          purchaseNumber: `DIR-${e.id.substring(0, 8).toUpperCase()}`,
          source: 'Direct Hari Om',
          partnerName: 'Hari Om Maritime Academy (Direct)',
          isCurrentPartner: false,
          courseCode: e.Course?.code || 'CRS',
          courseName: e.Course?.name || 'Maritime Training Program',
          trainingMode: 'Physical Training',
          purchaseDate: e.startDate || e.createdAt,
          purchaseStatus: 'Completed',
          settlementStatus: 'Direct Cleared'
        });
      }
    });

    // Sort by purchase date descending
    purchasesHistory.sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());

    // 4. Documents list
    const { data: dbDocs } = await db.from('Document').select('*').eq('userId', seafarerId);
    const documents = (dbDocs || []).map((d: any) => ({
      id: d.id,
      type: d.type,
      name: d.name || d.type,
      status: d.status || 'Verified',
      expiryDate: d.expiryDate || d.expiry_date || null
    }));

    return {
      master: seafarer,
      documents,
      purchasesHistory,
      totalPurchasesCount: purchasesHistory.length,
      directPurchasesCount: purchasesHistory.filter(p => p.source === 'Direct Hari Om').length,
      partnerPurchasesCount: purchasesHistory.filter(p => p.source !== 'Direct Hari Om').length
    };
  }

  // --- Partner Method 6: Get Physical Courses with Read-Only Hari Om Payable Amounts ---
  async getPartnerCourses(partnerId: string) {
    const db = this.getDb();
    const { data: dbCourses } = await db.from('Course').select('*').order('name');

    const courseList = (dbCourses && dbCourses.length > 0) ? dbCourses : this.getStandardCoursesList();

    return courseList.map((c: any) => {
      const payableAmount = this.resolvePayableAmount(partnerId, c);
      const standardFee = typeof c.fees === 'number'
        ? c.fees
        : parseInt(String(c.fees || '10000').replace(/[^0-9]/g, ''), 10) || 10000;

      return {
        id: c.id,
        code: c.code || c.id,
        name: c.name,
        category: c.category || 'physical',
        duration: c.duration || 'Physical Batch',
        standardFee,
        hariOmPayableAmount: payableAmount, // READ-ONLY configured payable amount
        description: c.description || 'Physical in-person maritime training program.',
        status: 'Active',
        trainingMode: 'Physical'
      };
    });
  }

  // --- Partner Method 7: Course Partner Pricing (Read-Only) ---
  async getCoursePartnerPricing(partnerId: string, courseId: string) {
    const courses = await this.getPartnerCourses(partnerId);
    const course = courses.find((c: any) => c.id === courseId || c.code === courseId);

    if (!course) {
      throw new NotFoundException('Course not found.');
    }

    return {
      courseId: course.id,
      courseCode: course.code,
      courseName: course.name,
      standardFee: course.standardFee,
      hariOmPayableAmount: course.hariOmPayableAmount,
      trainingMode: 'Physical',
      isReadOnly: true
    };
  }

  // --- Partner Method 8: Create Partner Purchase & Physical Enrollment ---
  async createPartnerPurchase(partnerId: string, dto: any) {
    const db = this.getDb();

    const courseIdentifier = dto.courseId || dto.courseCode;
    if (!dto.seafarerId || !courseIdentifier) {
      throw new BadRequestException('Seafarer Master ID and Course ID or Course Code are required.');
    }

    // 1. Verify Seafarer Master exists
    const seafarers = await this.searchSeafarers('');
    const seafarer = seafarers.find(s => s.id === dto.seafarerId);
    if (!seafarer) {
      throw new NotFoundException('Seafarer Master record not found. Please create Seafarer Master first.');
    }

    // 2. Verify Course exists & Resolve configured Hari Om Payable Amount
    const courses = await this.getPartnerCourses(partnerId);
    const course = courses.find((c: any) => c.id === courseIdentifier || c.code === courseIdentifier);
    if (!course) {
      throw new NotFoundException('Course not found.');
    }

    // 3. Partner details
    const { data: partnerUser } = await db.from('User').select('name, email').eq('id', partnerId).maybeSingle();
    const partnerName = partnerUser?.name || 'Hari Om Partner';

    const purchaseId = randomUUID();
    const year = new Date().getFullYear();
    const purchaseNumber = `PUR-${year}-${randomUUID().substring(0, 6).toUpperCase()}`;
    const enrollmentId = randomUUID();
    const nowIso = new Date().toISOString();

    // 4. Create Physical Enrollment in DB
    const { error: enrErr } = await db.from('Enrollment').insert({
      id: enrollmentId,
      userId: seafarer.id,
      courseId: course.id,
      status: 'Processing',
      progress: 0,
      trainingMode: 'Physical',
      startDate: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso
    });

    if (enrErr) {
      console.warn('Physical Enrollment DB insert note:', enrErr.message);
    }

    // 5. Build and persist Partner Purchase record
    const newPurchase = {
      id: purchaseId,
      purchase_number: purchaseNumber,
      partner_id: partnerId,
      partner_name: partnerName,
      seafarer_id: seafarer.id,
      seafarer_name: seafarer.name,
      seafarer_email: seafarer.email,
      seafarer_phone: seafarer.phone,
      indos_number: seafarer.indosNumber || 'N/A',
      passport_number: seafarer.passportNumber || 'N/A',
      cdc_number: seafarer.cdcNumber || 'N/A',
      course_id: course.id,
      course_code: course.code,
      course_name: course.name,
      payable_amount: course.hariOmPayableAmount, // ONLY configured Hari Om payable amount, zero commission
      purchase_date: nowIso,
      purchase_status: 'Completed',
      settlement_status: 'Pending',
      settlement_id: null,
      enrollment_id: enrollmentId,
      training_mode: 'Physical',
      remarks: dto.remarks || 'Physical course purchase completed via Partner Portal',
      created_at: nowIso
    };

    const purchases = this.loadPartnerPurchases();
    purchases.unshift(newPurchase);
    this.savePartnerPurchases(purchases);

    // 6. Audit log
    await this.logAction(
      partnerId,
      partnerName,
      'CREATE_PARTNER_PURCHASE',
      'Partner Purchases',
      purchaseId,
      `Completed physical course purchase ${purchaseNumber} for ${seafarer.name} (${course.name}) - Payable: ₹${course.hariOmPayableAmount}`
    );

    return newPurchase;
  }

  // --- Partner Method 9: Get Partner Purchases Ledger ---
  async getPartnerPurchases(partnerId: string, filterQuery?: any) {
    const purchases = this.loadPartnerPurchases().filter((p: any) => p.partner_id === partnerId);
    let result = [...purchases];

    if (filterQuery?.settlementStatus) {
      result = result.filter(p => p.settlement_status?.toLowerCase() === filterQuery.settlementStatus.toLowerCase());
    }

    if (filterQuery?.search) {
      const sq = filterQuery.search.toLowerCase();
      result = result.filter(p =>
        (p.seafarer_name || '').toLowerCase().includes(sq) ||
        (p.indos_number || '').toLowerCase().includes(sq) ||
        (p.purchase_number || '').toLowerCase().includes(sq) ||
        (p.course_name || '').toLowerCase().includes(sq)
      );
    }

    result.sort((a, b) => new Date(b.created_at || b.purchase_date).getTime() - new Date(a.created_at || a.purchase_date).getTime());
    return result;
  }

  // --- Partner Method 10: Get Partner Purchase by ID ---
  async getPartnerPurchaseById(partnerId: string, purchaseId: string) {
    const purchases = this.loadPartnerPurchases();
    const purchase = purchases.find((p: any) => p.id === purchaseId || p.purchase_number === purchaseId);

    if (!purchase) {
      throw new NotFoundException('Purchase record not found.');
    }

    // Strict Data Isolation
    if (purchase.partner_id !== partnerId) {
      throw new ForbiddenException('Access denied. You do not own this purchase record.');
    }

    return purchase;
  }

  // --- Partner Method 11: Partner Financials Summary ---
  async getPartnerFinancials(partnerId: string) {
    const purchases = this.loadPartnerPurchases().filter((p: any) => p.partner_id === partnerId);
    const settlements = this.loadSettlements().filter((s: any) => s.partner_id === partnerId || s.agent_id === partnerId);

    let totalPayable = 0;
    let pendingPurchasesCount = 0;
    let settledPurchasesCount = 0;

    purchases.forEach((p: any) => {
      totalPayable += Number(p.payable_amount) || 0;
      if (p.settlement_status === 'Pending') {
        pendingPurchasesCount++;
      } else if (p.settlement_status === 'Settled') {
        settledPurchasesCount++;
      }
    });

    let amountSettled = 0;
    let pendingSettlementAmount = 0;

    settlements.forEach((s: any) => {
      const amt = Number(s.total_amount) || 0;
      if (s.status === 'Completed' || s.status === 'Paid') {
        amountSettled += amt;
      } else if (s.status === 'Submitted' || s.status === 'Under Verification') {
        pendingSettlementAmount += amt;
      }
    });

    const outstandingAmount = Math.max(0, totalPayable - amountSettled);

    return {
      summary: {
        totalPurchases: purchases.length,
        pendingPurchasesCount,
        settledPurchasesCount,
        totalPayable,
        amountSettled,
        outstandingAmount,
        pendingSettlementAmount
      },
      settlementHistory: settlements.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    };
  }

  // --- Partner Method 12: Submit Settlement Batch (Status: Submitted) ---
  async submitPartnerSettlement(partnerId: string, dto: any) {
    const db = this.getDb();

    if (!dto.purchaseIds || !Array.isArray(dto.purchaseIds) || dto.purchaseIds.length === 0) {
      throw new BadRequestException('Please select at least one pending purchase for the settlement batch.');
    }

    if (!dto.utrReference || !dto.utrReference.trim()) {
      throw new BadRequestException('UTR / Bank Transaction reference number is required.');
    }

    const purchases = this.loadPartnerPurchases();
    const selectedPurchases = purchases.filter(
      (p: any) => p.partner_id === partnerId && dto.purchaseIds.includes(p.id)
    );

    if (selectedPurchases.length !== dto.purchaseIds.length) {
      throw new BadRequestException('One or more selected purchases were not found or do not belong to your partner account.');
    }

    // Verify all selected purchases are Pending
    const invalidPurchases = selectedPurchases.filter((p: any) => p.settlement_status !== 'Pending');
    if (invalidPurchases.length > 0) {
      throw new BadRequestException('Only purchases with Pending settlement status can be submitted in a new settlement batch.');
    }

    let calculatedTotal = 0;
    selectedPurchases.forEach((p: any) => {
      calculatedTotal += Number(p.payable_amount) || 0;
    });

    const settlementId = randomUUID();
    const year = new Date().getFullYear();
    const settlementNumber = `SET-${year}-${randomUUID().substring(0, 6).toUpperCase()}`;
    const nowIso = new Date().toISOString();

    const newSettlement = {
      id: settlementId,
      settlement_number: settlementNumber,
      partner_id: partnerId,
      agent_id: partnerId, // backward compatibility
      purchase_ids: dto.purchaseIds,
      total_amount: calculatedTotal,
      utr_reference: dto.utrReference.trim(),
      payment_method: dto.paymentMethod || 'Bank Transfer',
      payment_date: dto.paymentDate || nowIso,
      remarks: dto.remarks || '',
      status: 'Submitted', // Partner CANNOT mark as Completed (Finance/Admin verifies)
      rejection_reason: null,
      created_at: nowIso,
      paid_at: null
    };

    // 1. Update purchase records to 'Submitted'
    purchases.forEach((p: any) => {
      if (dto.purchaseIds.includes(p.id)) {
        p.settlement_status = 'Submitted';
        p.settlement_id = settlementId;
      }
    });
    this.savePartnerPurchases(purchases);

    // 2. Append to settlements storage
    const settlements = this.loadSettlements();
    settlements.unshift(newSettlement);
    this.saveSettlements(settlements);

    // 3. Write audit log
    const { data: user } = await db.from('User').select('name').eq('id', partnerId).maybeSingle();
    await this.logAction(
      partnerId,
      user?.name || 'Partner',
      'SUBMIT_SETTLEMENT',
      'Partner Settlements',
      settlementId,
      `Submitted settlement batch ${settlementNumber} for ${selectedPurchases.length} purchases (Total: ₹${calculatedTotal.toLocaleString('en-IN')}, UTR: ${dto.utrReference})`
    );

    return newSettlement;
  }

  // --- Partner Method 13: Get Partner Settlements ---
  async getPartnerSettlements(partnerId: string) {
    const settlements = this.loadSettlements().filter((s: any) => s.partner_id === partnerId || s.agent_id === partnerId);
    settlements.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return settlements;
  }

  // --- Partner Method 14: Get Partner Settlement by ID ---
  async getPartnerSettlementById(partnerId: string, settlementId: string) {
    const settlements = this.loadSettlements();
    const settlement = settlements.find((s: any) => s.id === settlementId || s.settlement_number === settlementId);

    if (!settlement) {
      throw new NotFoundException('Settlement record not found.');
    }

    // Strict Data Isolation
    if (settlement.partner_id !== partnerId && settlement.agent_id !== partnerId) {
      throw new ForbiddenException('Access denied. You do not own this settlement record.');
    }

    // Attach linked purchases
    const purchases = this.loadPartnerPurchases();
    const linkedPurchases = purchases.filter((p: any) =>
      (settlement.purchase_ids || []).includes(p.id) || p.settlement_id === settlement.id
    );

    return {
      ...settlement,
      linkedPurchases
    };
  }
}

