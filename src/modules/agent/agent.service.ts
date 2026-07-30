import { Injectable, BadRequestException, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AgentService {
  constructor(private readonly supabaseService: SupabaseService) {}

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

    // 1. Validate Referral Code Uniqueness
    const refCodeClean = data.referralCode?.trim().toUpperCase();
    if (!refCodeClean) {
      throw new BadRequestException('Referral code is required.');
    }

    const { data: duplicate } = await db
      .from('agent_metadata')
      .select('user_id')
      .eq('referral_code', refCodeClean)
      .single();

    if (duplicate && duplicate.user_id !== agentId) {
      throw new ConflictException('Referral code is already taken. Please choose a unique one.');
    }

    // 2. Fetch current record to enforce immutability at the service layer
    const currentMeta = await this.getMetadata(agentId);
    if (currentMeta.referral_code && currentMeta.referral_code !== refCodeClean) {
      throw new BadRequestException('Referral code is already set and cannot be modified.');
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

    // Check alternate duplicate lead email/phone under active status (45 days)
    const { data: duplicate } = await db
      .from('referral_leads')
      .select('id')
      .eq('agent_id', agentId)
      .or(`email.eq.${data.email},phone.eq.${data.phone}`)
      .gt('expiry_at', new Date().toISOString())
      .in('status', ['New', 'Contacted', 'Registered'])
      .limit(1);

    if (duplicate && duplicate.length > 0) {
      throw new BadRequestException('An active referral lead with this email or mobile number already exists.');
    }

    const leadId = randomUUID();
    const createdAt = new Date().toISOString();
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
        status: 'New',
        remarks: data.remarks || null,
        created_at: createdAt,
        expiry_at: expiryAt
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

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
}
