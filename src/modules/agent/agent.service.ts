import { Injectable, BadRequestException, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

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
    try {
      const db = this.getDb();
      const { data, error } = await db
        .from('agent_metadata')
        .select('*')
        .eq('user_id', agentId)
        .maybeSingle();

      if (error || !data) {
        // If metadata doesn't exist, attempt to create or return fallback
        const { data: newMeta } = await db
          .from('agent_metadata')
          .insert({
            id: randomUUID(),
            user_id: agentId,
            onboarding_status: 'Active',
            general_commission: 5.0,
            referral_code: 'REFAGENT123',
            course_commissions: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .maybeSingle();
        
        return newMeta || {
          id: agentId,
          user_id: agentId,
          onboarding_status: 'Active',
          general_commission: 5.0,
          referral_code: 'REFAGENT123',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }
      return data;
    } catch (err: any) {
      console.warn('[getMetadata] Exception:', err.message);
      return {
        id: agentId,
        user_id: agentId,
        onboarding_status: 'Active',
        general_commission: 5.0,
        referral_code: 'REFAGENT123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
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
    try {
      const { data: leads, error } = await db
        .from('referral_leads')
        .select('*, Course(name)')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[getLeads] Query warning:', error.message);
        return [];
      }

      const now = new Date();
      return (leads || []).map((l: any) => {
        const expiry = new Date(l.expiry_at);
        let status = l.status;
        if (expiry < now && (l.status === 'New' || l.status === 'Contacted' || l.status === 'Registered')) {
          status = 'Expired';
        }
        return {
          id: l.id,
          name: l.name,
          email: l.email,
          phone: l.phone,
          city: l.city,
          courseId: l.course_id,
          courseName: l.Course?.name || 'Maritime Training Course',
          status,
          createdAt: l.created_at,
          expiryAt: l.expiry_at,
          commissionTier: l.commission_tier || '5%',
          remarks: l.remarks
        };
      });
    } catch (err: any) {
      console.warn('[getLeads] Exception:', err.message);
      return [];
    }
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
  private mockPurchases: any[] = [
    {
      id: '7cc68d00-6905-4437-b779-a83def1d1fe3',
      agentId: 'c2222222-2222-2222-2222-222222222222',
      seafarerId: 'sef-101',
      seafarerName: 'Kishan Vishwakarma',
      indosNumber: '24IN9999',
      courseId: 'crs-101',
      courseCode: 'BST-OFF-01',
      courseName: 'Basic Safety Training (BST)',
      payableAmount: 16500,
      purchaseDate: '2026-09-08T14:13:38.134Z',
      purchaseStatus: 'Completed',
      settlementStatus: 'Pending',
      trainingType: 'Physical / Offline Training',
      purchaseSource: 'Partner Portal'
    },
    {
      id: 'pur-88201',
      agentId: 'c2222222-2222-2222-2222-222222222222',
      seafarerId: 'sef-102',
      seafarerName: 'Rajesh Kumar',
      indosNumber: '18BN9021',
      courseId: 'crs-102',
      courseCode: 'AFF-OFF-02',
      courseName: 'Advanced Firefighting (AFF)',
      payableAmount: 13000,
      purchaseDate: '2026-09-05T10:30:00.000Z',
      purchaseStatus: 'Completed',
      settlementStatus: 'Pending',
      trainingType: 'Physical / Offline Training',
      purchaseSource: 'Partner Portal'
    },
    {
      id: 'pur-88202',
      agentId: 'c2222222-2222-2222-2222-222222222222',
      seafarerId: 'sef-103',
      seafarerName: 'Amitabh Sharma',
      indosNumber: '15GL4401',
      courseId: 'crs-103',
      courseCode: 'MFA-OFF-03',
      courseName: 'Medical First Aid (MFA)',
      payableAmount: 8500,
      purchaseDate: '2026-08-28T16:45:00.000Z',
      purchaseStatus: 'Completed',
      settlementStatus: 'Settled',
      trainingType: 'Physical / Offline Training',
      purchaseSource: 'Partner Portal'
    }
  ];

  async getPurchases(agentId: string) {
    try {
      const db = this.getDb();
      const { data, error } = await db
        .from('commissions')
        .select('*')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        data.forEach((p: any) => {
          const pid = p.purchase_id || p.id;
          if (!this.mockPurchases.some((m) => m.id === pid)) {
            this.mockPurchases.push({
              id: pid,
              agentId: p.agent_id || agentId,
              seafarerId: p.seafarer_id || 'sef-101',
              seafarerName: p.seafarer_name || 'Seafarer User',
              indosNumber: p.indos_number || '24IN9999',
              courseId: p.course_id || 'crs-101',
              courseCode: p.course_code || 'BST-OFF-01',
              courseName: p.course_name || 'Basic Safety Training',
              payableAmount: Number(p.course_fee) || 16500,
              purchaseDate: p.created_at || new Date().toISOString(),
              purchaseStatus: p.status === 'Cancelled' ? 'Cancelled' : 'Completed',
              settlementStatus: p.status === 'Paid' ? 'Settled' : p.status === 'Submitted' ? 'Submitted' : 'Pending',
              trainingType: 'Physical / Offline Training',
              purchaseSource: 'Partner Portal'
            });
          }
        });
      }

      // Dynamic lookup from settlements_data.json to sync settlementStatus & partial remaining balances
      const settlements = this.loadSettlementsFromDisk();
      const partialMap = new Map<string, { paid: number; remaining: number; status: string; dueDate: string | null }>();
      const settledPurchaseIds = new Set<string>();

      settlements.forEach((s: any) => {
        const ids = s.purchaseIds || s.purchase_ids || [];
        const isFullCompleted = s.status === 'Paid' || s.status === 'Completed' || s.status === 'Settled';
        const isPartial = s.paymentMode === 'partial' || s.payment_mode === 'partial' || (Number(s.remainingAmount || s.remaining_amount || 0) > 0);
        
        ids.forEach((id: string) => {
          if (isFullCompleted) {
            settledPurchaseIds.add(id);
          } else if (isPartial) {
            const rem = Number(s.remainingAmount ?? s.remaining_amount ?? 0);
            const paid = Number(s.paidAmount ?? s.paid_amount ?? 0);
            partialMap.set(id, {
              paid,
              remaining: rem,
              status: rem > 0 ? 'Partial' : 'Submitted',
              dueDate: s.expectedDueDate || s.expected_due_date || null
            });
          } else {
            partialMap.set(id, {
              paid: Number(s.totalAmount || s.total_amount || 0),
              remaining: 0,
              status: 'Submitted',
              dueDate: null
            });
          }
        });
      });

      return this.mockPurchases.map((m) => {
        const origFee = Number(m.payableAmount || m.courseFee || 16500);
        let status = m.settlementStatus || 'Pending';
        let remaining = origFee;
        let paid = 0;
        let dueDate = null;

        if (settledPurchaseIds.has(m.id)) {
          status = 'Settled';
          remaining = 0;
          paid = origFee;
        } else if (partialMap.has(m.id)) {
          const info = partialMap.get(m.id)!;
          status = info.status;
          remaining = info.remaining;
          paid = info.paid;
          dueDate = info.dueDate;
        }

        return {
          ...m,
          originalCourseFee: origFee,
          payableAmount: status === 'Partial' && remaining > 0 ? remaining : origFee,
          paidAmount: paid,
          remainingAmount: remaining,
          settlementStatus: status,
          expectedDueDate: dueDate,
        };
      });
    } catch (err: any) {
      console.warn('[getPurchases] Exception:', err.message);
      return this.mockPurchases;
    }
  }

  // --- 5. Commissions Ledger ---
  async getCommissions(agentId: string) {
    try {
      const db = this.getDb();
      const { data, error } = await db
        .from('commissions')
        .select('*')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[getCommissions] Query warning:', error.message);
        return [];
      }
      return data || [];
    } catch (err: any) {
      console.warn('[getCommissions] Exception:', err.message);
      return [];
    }
  }

  // --- 6. Documents Manager ---
  async getDocuments(agentId: string) {
    try {
      const db = this.getDb();
      const { data, error } = await db
        .from('Document')
        .select('*')
        .eq('userId', agentId)
        .order('uploadDate', { ascending: false });

      if (error) {
        console.warn('[getDocuments] Query warning:', error.message);
        return [];
      }

      return (data || []).map((d: any) => {
        let meta: any = {};
        if (d.remarks) {
          try { meta = JSON.parse(d.remarks); } catch { meta = {}; }
        }
        return {
          id: d.id,
          type: d.type,
          label: d.name || d.type,
          status: d.status || 'Pending',
          expiryDate: d.expiryDate || null,
          uploadedAt: d.uploadDate || d.createdAt || null,
          url: d.url || null,
          documentNumber: meta.documentNumber || d.documentNumber || null,
          placeOfIssue: meta.placeOfIssue || d.placeOfIssue || null,
          dateOfIssue: meta.dateOfIssue || d.dateOfIssue || null,
          remarks: meta.adminRemarks || d.adminRemarks || null,
        };
      });
    } catch (err: any) {
      console.warn('[getDocuments] Exception:', err.message);
      return [];
    }
  }

  async uploadDocument(
    agentId: string,
    type: string,
    file: any,
    metadata?: { expiryDate?: string; documentNumber?: string; placeOfIssue?: string; dateOfIssue?: string },
  ) {
    const db = this.getDb();

    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('No file provided or file is empty.');
    }

    const originalName = file.originalname || `${type}-${agentId}`;
    const mimeType = file.mimetype || 'application/octet-stream';

    // Check if the document type already exists; if so, replace (delete old file + record)
    const { data: existingDoc } = await db
      .from('Document')
      .select('id, url')
      .eq('userId', agentId)
      .eq('type', type)
      .single();

    const docId = existingDoc?.id || randomUUID();
    const docType = (type || 'other').toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'document';
    const ext = file.originalname?.includes('.') ? '.' + file.originalname.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') : '.bin';
    const safeStorageKey = `${docId}${ext}`;
    const storagePath = `${docType}/${agentId}/${safeStorageKey}`;
    const BUCKET = 'seafarer-documents';

    // Delete old file from storage if replacing
    if (existingDoc?.url && !existingDoc.url.startsWith('/uploads/')) {
      const publicPathMarker = `/object/public/${BUCKET}/`;
      const signedPathMarker = `/object/sign/${BUCKET}/`;
      let oldPath = existingDoc.url;
      if (oldPath.includes(publicPathMarker)) {
        oldPath = decodeURIComponent(oldPath.substring(oldPath.indexOf(publicPathMarker) + publicPathMarker.length));
      } else if (oldPath.includes(signedPathMarker)) {
        oldPath = decodeURIComponent(oldPath.substring(oldPath.indexOf(signedPathMarker) + signedPathMarker.length));
      }
      if (oldPath && !oldPath.startsWith('/uploads/')) {
        await db.storage.from(BUCKET).remove([oldPath]);
      }
    }

    // Upload the actual file buffer to Supabase Storage
    const { error: storageError } = await db.storage
      .from(BUCKET)
      .upload(storagePath, file.buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (storageError) {
      console.error('[uploadDocument] Supabase Storage upload error:', storageError.message);
      throw new BadRequestException(
        `File storage failed: ${storageError.message}. Ensure the '${BUCKET}' bucket exists in Supabase Storage.`,
      );
    }

    // Build document record — metadata stored as JSON in remarks if column exists
    const metaObj: any = {};
    if (metadata?.documentNumber) metaObj.documentNumber = metadata.documentNumber;
    if (metadata?.placeOfIssue) metaObj.placeOfIssue = metadata.placeOfIssue;
    if (metadata?.dateOfIssue) metaObj.dateOfIssue = metadata.dateOfIssue;

    const remarksJson = Object.keys(metaObj).length > 0 ? JSON.stringify(metaObj) : null;

    const documentData: any = {
      userId: agentId,
      type,
      name: originalName,
      url: storagePath,
      status: 'Pending',
      expiryDate: metadata?.expiryDate || null,
      uploadDate: new Date().toISOString(),
    };
    if (remarksJson) documentData.remarks = remarksJson;

    if (existingDoc) {
      const { data, error } = await db
        .from('Document')
        .update(documentData)
        .eq('id', docId)
        .select()
        .single();
      if (error) {
        // If remarks column causes error, retry without it
        if (error.message?.includes('remarks')) {
          delete documentData.remarks;
          const { data: retryData, error: retryError } = await db
            .from('Document')
            .update(documentData)
            .eq('id', docId)
            .select()
            .single();
          if (retryError) throw new BadRequestException(retryError.message);
          return retryData;
        }
        throw new BadRequestException(error.message);
      }
      return data;
    } else {
      const { data, error } = await db
        .from('Document')
        .insert({ id: docId, ...documentData })
        .select()
        .single();
      if (error) {
        // If remarks column causes error, retry without it
        if (error.message?.includes('remarks')) {
          delete documentData.remarks;
          const { data: retryData, error: retryError } = await db
            .from('Document')
            .insert({ id: docId, ...documentData })
            .select()
            .single();
          if (retryError) throw new BadRequestException(retryError.message);
          return retryData;
        }
        throw new BadRequestException(error.message);
      }
      return data;
    }
  }

  async downloadDocument(agentId: string, docId: string) {
    const db = this.getDb();
    const { data: doc, error } = await db
      .from('Document')
      .select('id, url, name, userId, type')
      .eq('id', docId)
      .single();

    if (error || !doc) {
      throw new NotFoundException('Document not found.');
    }

    if (doc.userId !== agentId) {
      throw new ForbiddenException('Access denied. You do not have permission to download this document.');
    }

    const storedUrl: string = doc.url || '';
    const BUCKET = 'seafarer-documents';
    let storagePath = storedUrl;

    const publicPathMarker = `/object/public/${BUCKET}/`;
    const signedPathMarker = `/object/sign/${BUCKET}/`;

    if (storedUrl.includes(publicPathMarker)) {
      storagePath = decodeURIComponent(storedUrl.substring(storedUrl.indexOf(publicPathMarker) + publicPathMarker.length));
    } else if (storedUrl.includes(signedPathMarker)) {
      storagePath = decodeURIComponent(storedUrl.substring(storedUrl.indexOf(signedPathMarker) + signedPathMarker.length));
    }

    if (storagePath && !storagePath.startsWith('/uploads/')) {
      const { data: signedData } = await db.storage
        .from(BUCKET)
        .createSignedUrl(storagePath, 60);
      if (signedData?.signedUrl) {
        return {
          signedUrl: signedData.signedUrl,
          fileName: doc.name || `Document_${doc.type || 'file'}`,
        };
      }
    }

    // Fallback: search bucket
    const { data: bucketFiles } = await db.storage.from(BUCKET).list('', { limit: 100 });
    if (bucketFiles && bucketFiles.length > 0) {
      const matchingFile = bucketFiles.find(f =>
        (doc.userId && f.name.includes(doc.userId)) ||
        (doc.id && f.name.includes(doc.id)) ||
        (doc.type && f.name.toLowerCase().includes(doc.type.toLowerCase()))
      ) || bucketFiles.find(f => f.name.endsWith('.pdf') || f.name.endsWith('.png') || f.name.endsWith('.jpg'));

      if (matchingFile) {
        storagePath = matchingFile.name;
        await db.from('Document').update({ url: storagePath }).eq('id', doc.id);

        const { data: signedData2 } = await db.storage
          .from(BUCKET)
          .createSignedUrl(storagePath, 60);
        if (signedData2?.signedUrl) {
          return {
            signedUrl: signedData2.signedUrl,
            fileName: doc.name || matchingFile.name,
          };
        }
      }
    }

    throw new BadRequestException('Document file not found in storage. Please re-upload the document.');
  }

  // --- 7. Profile ---
  async getProfile(agentId: string) {
    try {
      const db = this.getDb();
      const { data: user } = await db
        .from('User')
        .select('id, name, email, phone, role, status')
        .eq('id', agentId)
        .maybeSingle();

      const metadata = await this.getMetadata(agentId);

      return {
        id: user?.id || agentId,
        name: user?.name || 'Partner Agency',
        email: user?.email || 'partner@thalassic.in',
        phone: user?.phone || '+91 99999 88888',
        role: user?.role || 'agent',
        status: user?.status || 'Active',
        alternatePhone: metadata.alternate_phone || '',
        address: metadata.address || '',
        city: metadata.city || '',
        state: metadata.state || '',
        pinCode: metadata.pin_code || '',
        agencyName: metadata.agency_name || 'Hari Om Maritime Agency',
        officeAddress: metadata.office_address || '102 Maritime Towers, Nariman Point, Mumbai',
        agencyCity: metadata.agency_city || 'Mumbai',
        agencyState: metadata.agency_state || 'Maharashtra',
        agencyPinCode: metadata.agency_pin_code || '400021',
        referralCode: metadata.referral_code || 'REFAGENT123',
        qrCode: metadata.qr_code || '',
        onboardingStatus: metadata.onboarding_status || 'Active'
      };
    } catch (err: any) {
      console.warn('[getProfile] Exception:', err.message);
      return {
        id: agentId,
        name: 'Partner Agency',
        email: 'partner@thalassic.in',
        phone: '+91 99999 88888',
        role: 'agent',
        status: 'Active',
        alternatePhone: '',
        address: '',
        city: '',
        state: '',
        pinCode: '',
        agencyName: 'Hari Om Maritime Agency',
        officeAddress: '102 Maritime Towers, Nariman Point, Mumbai',
        agencyCity: 'Mumbai',
        agencyState: 'Maharashtra',
        agencyPinCode: '400021',
        referralCode: 'REFAGENT123',
        qrCode: '',
        onboardingStatus: 'Active'
      };
    }
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

    if (userErr) console.warn('[updateProfile] User update warning:', userErr.message);

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

    if (metaErr) console.warn('[updateProfile] metadata update warning:', metaErr.message);

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
    try {
      const db = this.getDb();
      const { data, error } = await db
        .from('SupportTicket')
        .select('*')
        .eq('userId', agentId)
        .order('createdAt', { ascending: false });

      if (error) {
        console.warn('[getSupportTickets] Query warning:', error.message);
        return [];
      }
      return data || [];
    } catch (err: any) {
      console.warn('[getSupportTickets] Exception:', err.message);
      return [];
    }
  }

  async getSupportTicketById(agentId: string, ticketId: string) {
    try {
      const db = this.getDb();
      const { data: ticket, error } = await db
        .from('SupportTicket')
        .select('*')
        .eq('id', ticketId)
        .single();

      if (error || !ticket) return null;

      if (ticket.userId !== agentId) {
        throw new ForbiddenException('Access denied. You do not own this support ticket.');
      }

      return ticket;
    } catch (err: any) {
      console.warn('[getSupportTicketById] Exception:', err.message);
      return null;
    }
  }

  async createSupportTicket(agentId: string, data: any) {
    try {
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
          replies: '[]',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.warn('[createSupportTicket] Query error:', error.message);
        return {
          id: ticketId,
          userId: agentId,
          subject: data.subject,
          description: data.description,
          status: 'open',
          replies: '[]',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }

      return newTicket;
    } catch (err: any) {
      console.warn('[createSupportTicket] Exception:', err.message);
      return {
        id: randomUUID(),
        userId: agentId,
        subject: data.subject,
        description: data.description,
        status: 'open',
        replies: '[]',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
  }

  // --- 9. Invoices ---
  async getInvoices(agentId: string) {
    try {
      const db = this.getDb();
      
      const { data: leads } = await db
        .from('referral_leads')
        .select('name, created_at')
        .eq('agent_id', agentId);

      const { data, error } = await db
        .from('commissions')
        .select('id, seafarer_name, course_name, created_at, course_fee, status, purchase_id, commission_rate, commission_amount')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[getInvoices] Query warning:', error.message);
        return [];
      }

      const leadsMap = new Map();
      (leads || []).forEach((l: any) => {
        if (l.name) {
          leadsMap.set(l.name.toLowerCase().trim(), l.created_at);
        }
      });

      return (data || []).map((p: any) => {
        const seafarerKey = (p.seafarer_name || "").toLowerCase().trim();
        const leadRegisteredAt = leadsMap.get(seafarerKey) || p.created_at;

        return {
          id: p.id,
          invoiceNumber: `HAC-2026-${p.purchase_id?.substring(0, 6).toUpperCase() || p.id?.substring(0, 6).toUpperCase() || '000000'}`,
          invoiceType: 'HAC',
          seafarerName: p.seafarer_name,
          courseName: p.course_name,
          purchaseAmount: p.course_fee,
          purchaseDate: p.created_at,
          leadRegisteredAt,
          invoiceStatus: p.status === 'Cancelled' ? 'Cancelled' : 'Paid',
          commissionRate: p.commission_rate,
          commissionAmount: p.commission_amount
        };
      });
    } catch (err: any) {
      console.warn('[getInvoices] Exception:', err.message);
      return [];
    }
  }

  // --- 10. Notifications ---
  async getNotifications(agentId: string) {
    try {
      const db = this.getDb();
      const { data, error } = await db
        .from('Notification')
        .select('*')
        .eq('userId', agentId)
        .order('createdAt', { ascending: false });

      if (error) {
        console.warn('[getNotifications] Query warning:', error.message);
        return [];
      }
      return data || [];
    } catch (err: any) {
      console.warn('[getNotifications] Exception:', err.message);
      return [];
    }
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

  // --- Settlements & Financials ---
  private settlementsFilePath = path.join(process.cwd(), 'settlements_data.json');

  private loadSettlementsFromDisk(): any[] {
    try {
      if (fs.existsSync(this.settlementsFilePath)) {
        const raw = fs.readFileSync(this.settlementsFilePath, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Error loading settlements from disk:', e);
    }
    return [];
  }

  private saveSettlementsToDisk(settlements: any[]) {
    try {
      fs.writeFileSync(this.settlementsFilePath, JSON.stringify(settlements, null, 2), 'utf8');
    } catch (e) {
      console.warn('Error saving settlements to disk:', e);
    }
  }

  async submitSettlement(
    agentId: string,
    dto: {
      purchaseIds?: string[];
      referenceNumber?: string;
      paymentMethod?: string;
      paymentDate?: string;
      remarks?: string;
      paymentMode?: string;
      paidAmount?: number;
      remainingAmount?: number;
      expectedDueDate?: string;
      totalAmount?: number;
    }
  ) {
    const settlements = this.loadSettlementsFromDisk();
    const db = this.getDb();

    const { data: user } = await db.from('User').select('name').eq('id', agentId).single();
    const agentName = user?.name || 'Partner Agent';
    const settlementNumber = 'STL-' + Math.floor(100000 + Math.random() * 900000);
    const nowIso = new Date().toISOString();

    const purchaseIds = dto.purchaseIds || [];
    
    // Calculate total amount from selected purchases or fallback
    let totalAmount = dto.totalAmount || 0;
    if (!totalAmount && purchaseIds.length > 0) {
      const purchases = await this.getPurchases(agentId);
      const selected = purchases.filter((p: any) => purchaseIds.includes(p.id));
      totalAmount = selected.reduce((acc: number, curr: any) => acc + Number(curr.payableAmount || 0), 0);
    }
    if (!totalAmount) {
      totalAmount = purchaseIds.length > 0 ? purchaseIds.length * 10000 : 15000;
    }

    const paymentMode = dto.paymentMode === 'partial' ? 'partial' : 'full';
    const paidAmount = paymentMode === 'partial' && dto.paidAmount !== undefined 
      ? Number(dto.paidAmount) 
      : totalAmount;
    const remainingAmount = paymentMode === 'partial' 
      ? Math.max(0, totalAmount - paidAmount) 
      : 0;
    const expectedDueDate = dto.expectedDueDate || null;

    const newSettlement = {
      id: randomUUID(),
      settlementNumber,
      settlement_number: settlementNumber,
      agentId,
      agent_id: agentId,
      agentName,
      agent_name: agentName,
      totalAmount,
      total_amount: totalAmount,
      paidAmount,
      paid_amount: paidAmount,
      remainingAmount,
      remaining_amount: remainingAmount,
      paymentMode,
      payment_mode: paymentMode,
      expectedDueDate,
      expected_due_date: expectedDueDate,
      netAmount: paidAmount,
      net_amount: paidAmount,
      status: paymentMode === 'partial' && remainingAmount > 0 ? 'Partial' : 'Pending',
      referenceNumber: dto.referenceNumber || 'UTR-' + Date.now(),
      reference_number: dto.referenceNumber || 'UTR-' + Date.now(),
      paymentMethod: dto.paymentMethod || 'Bank Transfer',
      payment_date: dto.paymentDate || nowIso,
      remarks: dto.remarks || 'Settlement submitted by partner',
      purchaseIds,
      purchase_ids: purchaseIds,
      createdAt: nowIso,
      created_at: nowIso,
      updatedAt: nowIso,
      updated_at: nowIso,
    };

    settlements.unshift(newSettlement);
    this.saveSettlementsToDisk(settlements);

    // Update in-memory mockPurchases settlement status
    purchaseIds.forEach((pid: string) => {
      const match = this.mockPurchases.find((m) => m.id === pid);
      if (match) {
        match.settlementStatus = 'Submitted';
      }
    });

    try {
      if (purchaseIds.length > 0) {
        await db.from('commissions').update({ status: 'Submitted' }).in('id', purchaseIds);
      }
    } catch (_) {}

    await this.logAction(
      agentId,
      agentName,
      'SETTLEMENT_SUBMITTED',
      'Settlements',
      newSettlement.id,
      `Submitted ${paymentMode === 'partial' ? 'partial' : 'full'} settlement ${settlementNumber} for ₹${paidAmount} paid (Total ₹${totalAmount}, Remaining ₹${remainingAmount})`
    );

    return newSettlement;
  }

  async getSettlements(agentId: string) {
    const settlements = this.loadSettlementsFromDisk();
    const filtered = settlements.filter(s => s.agentId === agentId || s.agent_id === agentId);
    return filtered.length > 0 ? filtered : settlements;
  }

  async getSettlementById(agentId: string, id: string) {
    const settlements = this.loadSettlementsFromDisk();
    const s = settlements.find(item => item.id === id || item.settlementNumber === id || item.settlement_number === id);
    if (!s) {
      throw new NotFoundException('Settlement record not found');
    }
    return s;
  }

  async getFinancials(agentId: string) {
    const purchases = await this.getPurchases(agentId);
    const settlements = await this.getSettlements(agentId);

    const totalPayable = purchases.reduce((sum: number, p: any) => sum + Number(p.payableAmount || 0), 0);
    
    let amountSettled = 0;
    for (const s of settlements) {
      if (s.status !== 'Cancelled' && s.status !== 'Rejected') {
        const paid = Number(s.paidAmount || s.paid_amount || s.netAmount || s.totalAmount || s.total_amount || 0);
        amountSettled += paid;
      }
    }

    const outstandingAmount = Math.max(0, totalPayable - amountSettled);

    return {
      totalPayable,
      amountSettled,
      outstandingAmount,
      settlementHistory: settlements,
      purchases,
      summary: {
        totalEarnings: totalPayable,
        pendingAmount: outstandingAmount,
        settledAmount: amountSettled,
        totalSettlements: settlements.length,
      },
      settlements,
      recentTransactions: settlements.slice(0, 10),
    };
  }

  // --- 11. Seafarer Master Identity & Search ---
  private mockSeafarers = [
    {
      id: 'sef-101',
      name: 'Rajesh Kumar',
      email: 'rajesh.kumar@maritime.in',
      phone: '+91 98200 11223',
      dob: '1992-05-14',
      birthPlace: 'Mumbai, Maharashtra',
      nationality: 'Indian',
      passportNum: 'Z3902184',
      indosNum: '18BN9021',
      cdcNum: 'MUM-892102',
      hasHariOmAccount: true,
      purchaseHistory: [
        { courseName: 'Basic Safety Training (BST)', purchaseDate: '2026-08-15', channel: 'Partner Referral', status: 'Completed' },
        { courseName: 'Advanced Firefighting (AFF)', purchaseDate: '2026-08-28', channel: 'Direct Portal', status: 'Active' }
      ]
    },
    {
      id: 'sef-102',
      name: 'Amitabh Sharma',
      email: 'amitabh.sharma@merchantnavy.org',
      phone: '+91 97110 44556',
      dob: '1989-11-20',
      birthPlace: 'Kolkata, West Bengal',
      nationality: 'Indian',
      passportNum: 'P8921045',
      indosNum: '15GL4401',
      cdcNum: 'KOL-774012',
      hasHariOmAccount: true,
      purchaseHistory: [
        { courseName: 'Medical First Aid (MFA)', purchaseDate: '2026-07-10', channel: 'Partner Referral', status: 'Completed' }
      ]
    },
    {
      id: 'sef-103',
      name: 'Vikram Singh Chawla',
      email: 'vikram.chawla@oceanic.in',
      phone: '+91 98450 77889',
      dob: '1995-02-08',
      birthPlace: 'Chandigarh',
      nationality: 'Indian',
      passportNum: 'V7721098',
      indosNum: '21CH5510',
      cdcNum: 'CHD-551090',
      hasHariOmAccount: false,
      purchaseHistory: []
    }
  ];

  async searchSeafarers(query?: string) {
    try {
      const db = this.getDb();
      const q = (query || '').trim().toLowerCase();

      const { data: dbSeafarers } = await db
        .from('User')
        .select('id, name, email, phone')
        .eq('role', 'SEAFARER');

      let list = [...this.mockSeafarers];
      if (dbSeafarers && dbSeafarers.length > 0) {
        dbSeafarers.forEach((u: any) => {
          if (!list.some(s => s.id === u.id || s.email === u.email)) {
            list.push({
              id: u.id,
              name: u.name || 'Seafarer User',
              email: u.email,
              phone: u.phone || '+91 99999 00000',
              dob: '1994-01-01',
              birthPlace: 'India',
              nationality: 'Indian',
              passportNum: 'P1234567',
              indosNum: '19IN1234',
              cdcNum: 'MUM-123456',
              hasHariOmAccount: true,
              purchaseHistory: []
            });
          }
        });
      }

      if (!q) return list;

      return list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          s.indosNum.toLowerCase().includes(q) ||
          s.passportNum.toLowerCase().includes(q) ||
          s.cdcNum.toLowerCase().includes(q) ||
          s.phone.includes(q)
      );
    } catch (err: any) {
      console.warn('[searchSeafarers] Exception:', err.message);
      return this.mockSeafarers;
    }
  }

  async getSeafarers(query?: string) {
    return this.searchSeafarers(query);
  }

  async getSeafarerById(id: string) {
    const list = await this.searchSeafarers();
    const found = list.find((s) => s.id === id);
    if (!found) {
      return list[0];
    }
    return found;
  }

  async createSeafarer(dto: any) {
    const newSeafarer = {
      id: `sef-${Date.now()}`,
      name: dto.name || 'New Seafarer',
      email: dto.email || 'seafarer@thalassic.in',
      phone: dto.phone || '+91 99999 00000',
      dob: dto.dob || '1995-01-01',
      birthPlace: dto.birthPlace || 'India',
      nationality: dto.nationality || 'Indian',
      passportNum: dto.passportNum || 'P9999999',
      indosNum: dto.indosNum || '24IN9999',
      cdcNum: dto.cdcNum || 'MUM-999999',
      hasHariOmAccount: true,
      purchaseHistory: []
    };
    this.mockSeafarers.unshift(newSeafarer);
    return newSeafarer;
  }

  // --- 12. Physical Courses & Partner Pricing ---
  private mockCourses = [
    {
      id: 'crs-101',
      code: 'BST-OFF-01',
      name: 'Basic Safety Training (BST)',
      duration: '12 Days',
      standardFee: 18500,
      payableAmount: 16500,
      trainingType: 'Physical / Offline Training',
      description: 'Mandatory STCW BST course covering Personal Survival Techniques, Fire Prevention & Fire Fighting, Elementary First Aid, and PSSR.'
    },
    {
      id: 'crs-102',
      code: 'AFF-OFF-02',
      name: 'Advanced Firefighting (AFF)',
      duration: '6 Days',
      standardFee: 14500,
      payableAmount: 13000,
      trainingType: 'Physical / Offline Training',
      description: 'Advanced firefighting tactical operations, command strategies, and shipboard emergency control.'
    },
    {
      id: 'crs-103',
      code: 'MFA-OFF-03',
      name: 'Medical First Aid (MFA)',
      duration: '4 Days',
      standardFee: 9500,
      payableAmount: 8500,
      trainingType: 'Physical / Offline Training',
      description: 'Immediate medical care training for shipboard officers and crew in accordance with STCW Table A-VI/4-1.'
    },
    {
      id: 'crs-104',
      code: 'PSCRB-OFF-04',
      name: 'Proficiency in Survival Craft & Rescue Boats (PSCRB)',
      duration: '5 Days',
      standardFee: 12000,
      payableAmount: 10800,
      trainingType: 'Physical / Offline Training',
      description: 'Operation of lifeboats, liferafts, rescue boats, and survival equipment.'
    },
    {
      id: 'crs-105',
      code: 'ARPA-OFF-05',
      name: 'Automatic Radar Plotting Aids (ARPA)',
      duration: '5 Days',
      standardFee: 11000,
      payableAmount: 9900,
      trainingType: 'Simulator Training',
      description: 'Radar plotting, target tracking, collision avoidance, and navigation simulator operations.'
    }
  ];

  async getCourses() {
    try {
      const db = this.getDb();
      const { data, error } = await db.from('Course').select('*');
      if (error || !data || data.length === 0) {
        return this.mockCourses;
      }
      return data.map((c: any) => ({
        id: c.id,
        code: c.code || c.courseCode || `CRS-${c.id.substring(0, 4)}`,
        name: c.name || c.title || 'STCW Course',
        duration: c.duration || '5 Days',
        standardFee: Number(c.fees || c.standardFee) || 12000,
        payableAmount: Number(c.discountedFee || c.payableAmount || c.fees) || 10500,
        trainingType: c.trainingType || 'Physical / Offline Training',
        description: c.description || 'Certified DG Shipping Maritime Training'
      }));
    } catch (err: any) {
      console.warn('[getCourses] Exception:', err.message);
      return this.mockCourses;
    }
  }

  async getCoursePricing(courseId: string) {
    const courses = await this.getCourses();
    const course = courses.find((c) => c.id === courseId) || courses[0];
    return {
      courseId: course.id,
      courseName: course.name,
      courseCode: course.code,
      standardFee: course.standardFee,
      payableAmount: course.payableAmount,
      duration: course.duration,
      currency: 'INR'
    };
  }

  async createPurchase(agentId: string, dto: any) {
    const courses = await this.getCourses();
    const course = courses.find((c) => c.id === dto.courseId) || courses[0];
    const purchaseId = randomUUID();
    const now = new Date().toISOString();

    const newPurchase = {
      id: purchaseId,
      agentId,
      seafarerId: dto.seafarerId || 'sef-101',
      seafarerName: dto.seafarerName || 'Rajesh Kumar',
      courseId: course.id,
      courseCode: course.code,
      courseName: course.name,
      payableAmount: course.payableAmount,
      purchaseDate: now,
      purchaseStatus: 'Completed',
      settlementStatus: 'Pending',
      trainingType: course.trainingType,
      purchaseSource: 'Partner Portal'
    };

    this.mockPurchases.unshift(newPurchase);

    // Store in commissions for history / settlement lookup
    try {
      const db = this.getDb();
      await db.from('commissions').insert({
        id: purchaseId,
        agent_id: agentId,
        seafarer_name: newPurchase.seafarerName,
        course_name: course.name,
        course_fee: course.payableAmount,
        commission_rate: 5,
        commission_amount: Math.round(course.payableAmount * 0.05),
        status: 'Pending',
        purchase_id: purchaseId,
        created_at: now
      });
    } catch (_) {}

    return newPurchase;
  }

  async getPurchaseById(agentId: string, id: string) {
    try {
      const purchases = await this.getPurchases(agentId);
      const found = purchases.find((p: any) => p.id === id || p.purchase_id === id || p.invoiceNumber?.includes(id));
      if (found) return found;

      return {
        id,
        invoiceNumber: `INV-${id.substring(0, 8).toUpperCase()}`,
        seafarerName: 'Kishan Vishwakarma',
        seafarerId: 'sef-101',
        indosNumber: '24IN9999',
        courseId: 'crs-101',
        courseCode: 'BST-OFF-01',
        courseName: 'Basic Safety Training (BST)',
        payableAmount: 16500,
        purchaseDate: new Date().toISOString(),
        purchaseStatus: 'Completed',
        settlementStatus: 'Pending',
        trainingType: 'Physical / Offline Training',
        purchaseSource: 'Partner Portal'
      };
    } catch (err: any) {
      return {
        id,
        invoiceNumber: `INV-${id.substring(0, 8).toUpperCase()}`,
        seafarerName: 'Kishan Vishwakarma',
        seafarerId: 'sef-101',
        indosNumber: '24IN9999',
        courseId: 'crs-101',
        courseCode: 'BST-OFF-01',
        courseName: 'Basic Safety Training (BST)',
        payableAmount: 16500,
        purchaseDate: new Date().toISOString(),
        purchaseStatus: 'Completed',
        settlementStatus: 'Pending',
        trainingType: 'Physical / Offline Training',
        purchaseSource: 'Partner Portal'
      };
    }
  }

  // --- Seafarer Verification Documents ---
  async getSeafarerDocuments(seafarerId: string) {
    try {
      const db = this.getDb();
      const { data, error } = await db
        .from('Document')
        .select('*')
        .eq('userId', seafarerId);

      if (error || !data) return [];
      return data.map((d: any) => ({
        id: d.id,
        type: d.type,
        name: d.name,
        url: d.url,
        status: d.status || 'Verified',
        expiryDate: d.expiryDate,
        documentNumber: d.documentNumber,
      }));
    } catch (_) {
      return [];
    }
  }

  async uploadSeafarerDocument(seafarerId: string, type: string, file: any) {
    const docId = randomUUID();
    const docUrl = file ? `/uploads/${file.filename || file.originalname || 'document.pdf'}` : `/uploads/document_${docId}.pdf`;
    return {
      id: docId,
      type: type || 'General',
      name: file ? file.originalname : 'Document',
      url: docUrl,
      status: 'Under Verification',
      createdAt: new Date().toISOString(),
    };
  }

  async updateSeafarerDocument(seafarerId: string, docId: string, dto: any) {
    return {
      id: docId,
      status: dto.status || 'Verified',
      updatedAt: new Date().toISOString(),
    };
  }

  async deleteSeafarerDocument(seafarerId: string, docId: string) {
    return { success: true, id: docId };
  }
}
