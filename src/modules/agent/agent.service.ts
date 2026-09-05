import { Injectable, BadRequestException, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';

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
      .eq('userId', agentId)
      .order('uploadDate', { ascending: false });

    if (error) throw new BadRequestException(error.message);

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
        uploadedAt: d.uploadDate || null,
        url: d.url || null,
        documentNumber: meta.documentNumber || d.documentNumber || null,
        placeOfIssue: meta.placeOfIssue || d.placeOfIssue || null,
        dateOfIssue: meta.dateOfIssue || d.dateOfIssue || null,
        remarks: meta.adminRemarks || d.adminRemarks || null,
      };
    });
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
    
    // Fetch referral leads to match registration/lead converted date
    const { data: leads } = await db
      .from('referral_leads')
      .select('name, created_at')
      .eq('agent_id', agentId);

    const { data, error } = await db
      .from('commissions')
      .select('id, seafarer_name, course_name, created_at, course_fee, status, purchase_id, commission_rate, commission_amount')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);

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
        invoiceNumber: `HAC-2026-${p.purchase_id?.substring(0, 6).toUpperCase() || p.id.substring(0, 6).toUpperCase()}`,
        invoiceType: 'HAC',
        seafarerName: p.seafarer_name,
        courseName: p.course_name,
        purchaseAmount: p.course_fee,
        purchaseDate: p.created_at, // Payment Date
        leadRegisteredAt, // Lead Converted/Registered Date
        invoiceStatus: p.status === 'Cancelled' ? 'Cancelled' : 'Paid',
        commissionRate: p.commission_rate,
        commissionAmount: p.commission_amount
      };
    });
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
