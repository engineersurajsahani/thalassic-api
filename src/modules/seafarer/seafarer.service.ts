import { Injectable, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { InvoicesService } from '../invoices/invoices.service';

@Injectable()
export class SeafarerService {
  constructor(
    private supabaseService: SupabaseService,
    private invoicesService: InvoicesService,
  ) {}

  private get db() {
    return this.supabaseService.getClient();
  }

  // ─────────────────────────────────────────────
  // DASHBOARD
  // ─────────────────────────────────────────────
  async getDashboard(userId: string) {
    const { data: enrollments } = await this.db
      .from('Enrollment')
      .select('id, status, startDate, createdAt, courseId, Course(name, code, duration)')
      .eq('userId', userId)
      .order('createdAt', { ascending: false });

    const activeEnrollment = enrollments?.find((e: any) => e.status === 'Processing');
    const completedCount = enrollments?.filter((e: any) => e.status === 'Completed').length ?? 0;

    const { data: profile } = await this.db
      .from('SeafarerProfile')
      .select('*')
      .eq('userId', userId)
      .single();

    const { data: docs } = await this.db
      .from('Document')
      .select('type, expiryDate, status')
      .eq('userId', userId);

    const now = new Date();
    const docStatus = (type: string) => {
      const doc = docs?.find((d: any) => d.type?.toLowerCase() === type);
      if (!doc) return 'missing';
      if (doc.expiryDate && new Date(doc.expiryDate) < now) return 'pending';
      return doc.status?.toLowerCase() === 'verified' ? 'verified' : 'pending';
    };

    const certificates = {
      passport: docStatus('passport'),
      cdc: docStatus('cdc'),
      medical: docStatus('medical'),
      stcw: completedCount > 0 ? 'verified' : 'pending',
    };

    const fields = [profile?.indosNumber, completedCount > 0, (docs?.length ?? 0) > 0, profile?.dob];
    const profileCompletion = Math.round((fields.filter(Boolean).length / fields.length) * 100);

    return {
      profileCompletion,
      courses: {
        active: activeEnrollment
          ? {
              name: (activeEnrollment as any).Course?.name,
              code: (activeEnrollment as any).Course?.code,
              progress: 40,
            }
          : null,
        completedCount,
      },
      certificates,
      notifications: [],
    };
  }

  // ─────────────────────────────────────────────
  // NOTIFICATIONS
  // ─────────────────────────────────────────────
  async getNotifications(userId: string, role?: string) {
    if (role === 'MASTER') {
      const supabase = this.db;

      // 1. Fetch recent user registrations
      const { data: users } = await supabase
        .from('User')
        .select('id, name, email, createdAt')
        .eq('role', 'SEAFARER')
        .order('createdAt', { ascending: false })
        .limit(3);

      // 2. Fetch recent course enrollments
      const { data: enrollments } = await supabase
        .from('Enrollment')
        .select('id, status, createdAt, User(name), Course(name)')
        .order('createdAt', { ascending: false })
        .limit(3);

      // 3. Fetch recent documents uploaded
      const { data: documents } = await supabase
        .from('Document')
        .select('id, name, type, status, uploadDate, User(name)')
        .eq('status', 'Pending')
        .order('uploadDate', { ascending: false })
        .limit(3);

      const notificationsList: any[] = [];

      // Map registrations
      (users || []).forEach((u: any) => {
        notificationsList.push({
          id: `reg-${u.id}`,
          title: `👤 New Seafarer Registration`,
          message: `${u.name || u.email || 'A user'} joined the platform.`,
          isRead: false,
          read: false,
          createdAt: u.createdAt,
        });
      });

      // Map enrollments
      (enrollments || []).forEach((e: any) => {
        notificationsList.push({
          id: `enroll-${e.id}`,
          title: `⚓ New Course Booking`,
          message: `${e.User?.name || 'A user'} booked ${e.Course?.name || 'a course'}.`,
          isRead: false,
          read: false,
          createdAt: e.createdAt,
        });
      });

      // Map documents
      (documents || []).forEach((d: any) => {
        notificationsList.push({
          id: `doc-${d.id}`,
          title: `📄 Verification Required`,
          message: `Pending review for ${d.type || 'document'} uploaded by ${d.User?.name || 'seafarer'}.`,
          isRead: false,
          read: false,
          createdAt: d.uploadDate,
        });
      });

      // Sort by date descending
      return notificationsList
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);
    }

    const { data: enrollments } = await this.db
      .from('Enrollment')
      .select('id, status, createdAt, Course(name)')
      .eq('userId', userId)
      .order('createdAt', { ascending: false })
      .limit(5);

    return (enrollments ?? []).map((e: any) => ({
      id: e.id,
      title:
        e.status === 'Completed'
          ? `✅ Course Completed: ${e.Course?.name}`
          : `📋 Enrollment Processing: ${e.Course?.name}`,
      message:
        e.status === 'Completed'
          ? `Your certificate for ${e.Course?.name} has been issued.`
          : `Your booking for ${e.Course?.name} is being processed.`,
      isRead: false,
      read: false,
      createdAt: e.createdAt,
    }));
  }

  async markNotificationRead(id: string) {
    return { id, read: true };
  }

  async markAllNotificationsRead() {
    return { success: true };
  }

  // ─────────────────────────────────────────────
  // COURSES
  // ─────────────────────────────────────────────
  async getAllCourses() {
    const { data, error } = await this.db
      .from('Course')
      .select('*')
      .order('name');

    if (error) {
      console.error('getAllCourses error:', error.message);
      return [];
    }
    return data ?? [];
  }

  async getMyEnrollments(userId: string) {
    const { data, error } = await this.db
      .from('Enrollment')
      .select('id, status, progress, startDate, createdAt, Course(id, name, code, category, duration, fees, description)')
      .eq('userId', userId)
      .order('createdAt', { ascending: false });

    if (error) {
      console.error('getMyEnrollments error:', error.message);
      return [];
    }
    return (data ?? []).map((e: any) => ({
      id: e.id,
      status: e.status?.toLowerCase() === 'completed' ? 'completed' : 'active',
      purchaseDate: e.startDate ?? e.createdAt,
      course: e.Course,
      courseId: e.Course?.id ?? e.courseId,
      progress: e.progress ?? (e.status?.toLowerCase() === 'completed' ? 100 : 0),
    }));
  }

  async enrollInCourse(userId: string, courseId: string, referralCode?: string) {
    const { data: course } = await this.db
      .from('Course')
      .select('id, fees, name')
      .eq('id', courseId)
      .single();

    if (!course) throw new BadRequestException('Course not found');

    const { data: existing } = await this.db
      .from('Enrollment')
      .select('id')
      .eq('userId', userId)
      .eq('courseId', courseId)
      .single();

    if (existing) throw new BadRequestException('Already enrolled in this course');

    const { data, error } = await this.db
      .from('Enrollment')
      .insert({
        id: randomUUID(),
        userId,
        courseId,
        status: 'Processing',
        progress: 0,
        startDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    // ── Referral Attribution, Commission Snapshot & Invoice Generation ─────
    console.log(`[Backend Enroll] User ${userId} enrolling in ${courseId} with referralCode: "${referralCode}"`);
    try {
      let targetAgentId = '';
      let targetCommissionRate = 5.0;
      let commissionSource = 'General Commission';
      let matchingLeadId = '';
      let isConflict = false;
      let conflictingAgents: any[] = [];
      let targetAgentReferralCode = '';

      // Fetch seafarer user for display & matching
      const { data: seafarerUser } = await this.db
        .from('User')
        .select('name, email, phone')
        .eq('id', userId)
        .single();

      // Case A: Referral Code is entered manually
      if (referralCode && referralCode.trim().length > 0) {
        const code = referralCode.trim().toUpperCase();
        const { data: agentMeta } = await this.db
          .from('agent_metadata')
          .select('user_id, general_commission, course_commissions, referral_code')
          .eq('referral_code', code)
          .maybeSingle();

        if (!agentMeta) {
          throw new BadRequestException('Invalid Referral Code Error');
        }
        targetAgentId = agentMeta.user_id;
        targetAgentReferralCode = agentMeta.referral_code || code;

        // PRD 9.2 Priority 1: Course-specific Commission Override
        const courseOverrides = agentMeta.course_commissions || {};
        if (courseOverrides[courseId] !== undefined && courseOverrides[courseId] !== null) {
          targetCommissionRate = Number(courseOverrides[courseId]);
          commissionSource = 'Course Override';
        } else {
          targetCommissionRate = Number(agentMeta.general_commission) || 5.0;
          commissionSource = 'General Commission';
        }
      } 
      // Case B: Referral Code left blank -> Auto-match with Referral Leads
      else if (seafarerUser) {
        const nowIso = new Date().toISOString();
        const { data: activeLeads } = await this.db
          .from('referral_leads')
          .select('id, agent_id, status, created_at')
          .in('status', ['New', 'Contacted', 'Registered', 'Pending', 'Under Review'])
          .gt('expiry_at', nowIso)
          .or(`email.eq.${seafarerUser.email},phone.eq.${seafarerUser.phone || ''}`);

        if (activeLeads && activeLeads.length > 0) {
          const uniqueAgentsMap = new Map();
          for (const lead of activeLeads) {
            uniqueAgentsMap.set(lead.agent_id, lead);
          }

          if (uniqueAgentsMap.size === 1) {
            const matchedLead = activeLeads[0];
            targetAgentId = matchedLead.agent_id;
            matchingLeadId = matchedLead.id;

            const { data: agentMeta } = await this.db
              .from('agent_metadata')
              .select('general_commission, course_commissions, referral_code')
              .eq('user_id', targetAgentId)
              .maybeSingle();

            targetAgentReferralCode = agentMeta?.referral_code || 'MATCHED_LEAD';

            const courseOverrides = agentMeta?.course_commissions || {};
            if (courseOverrides[courseId] !== undefined && courseOverrides[courseId] !== null) {
              targetCommissionRate = Number(courseOverrides[courseId]);
              commissionSource = 'Course Override';
            } else {
              targetCommissionRate = Number(agentMeta?.general_commission) || 5.0;
              commissionSource = 'General Commission';
            }
          } else if (uniqueAgentsMap.size > 1) {
            isConflict = true;
            conflictingAgents = Array.from(uniqueAgentsMap.values());
          }
        }
      }

      // Parse string like "₹25,000" or "25000" into numeric value
      const parseFee = (feeStr: any): number => {
        if (typeof feeStr === 'number') return feeStr;
        if (!feeStr) return 0;
        const cleaned = String(feeStr).replace(/[^0-9.]/g, '');
        return parseFloat(cleaned) || 0;
      };
      const courseFee = parseFee(course.fees);
      let createdCommissionId: string | undefined;

      // Create commission snapshot record based on matches
      if (targetAgentId) {
        const commissionAmount = (courseFee * targetCommissionRate) / 100;
        createdCommissionId = randomUUID();

        const commObj = {
          id: createdCommissionId,
          agent_id: targetAgentId,
          purchase_id: data.id,
          seafarer_name: seafarerUser?.name || 'Seafarer',
          course_name: course.name || 'Course',
          course_fee: courseFee,
          commission_rate: targetCommissionRate,
          commission_amount: commissionAmount,
          commission_source: commissionSource,
          commission_version: 'v1.0',
          remarks: `Attributed via ${commissionSource} (${targetCommissionRate}%)`,
          status: 'Pending',
          created_at: new Date().toISOString(),
        };

        const { error: commErr } = await this.db.from('commissions').insert(commObj);

        if (commErr && (commErr.code === 'PGRST204' || commErr.message?.includes('column'))) {
          // Retry with legacy standard columns if new columns don't exist yet in DB schema
          const stdCommObj = {
            id: createdCommissionId,
            agent_id: targetAgentId,
            purchase_id: data.id,
            seafarer_name: seafarerUser?.name || 'Seafarer',
            course_name: course.name || 'Course',
            course_fee: courseFee,
            commission_rate: targetCommissionRate,
            commission_amount: commissionAmount,
            status: 'Pending',
            created_at: new Date().toISOString(),
          };
          const { error: retryErr } = await this.db.from('commissions').insert(stdCommObj);
          if (retryErr) console.error('[Referral] Standard commission insert error:', retryErr.message);
        } else if (commErr) {
          console.error('[Referral] Commission insert error:', commErr.message);
        }

        // Record initial status history transition silently
        try {
          await this.db.from('commission_status_history').insert({
            id: randomUUID(),
            commission_id: createdCommissionId,
            old_status: 'None',
            new_status: 'Pending',
            reason: 'Initial commission snapshot generated upon course checkout',
            changed_by_user_id: userId,
            changed_by_user_name: seafarerUser?.name || 'Seafarer',
            created_at: new Date().toISOString(),
          });
        } catch (e) {
          console.warn('[Referral] History insert warning:', e);
        }

        if (matchingLeadId) {
          await this.db
            .from('referral_leads')
            .update({ status: 'Converted', updated_at: new Date().toISOString() })
            .eq('id', matchingLeadId);
        }
        console.log(`[Referral] Attributed commission ${createdCommissionId} to agent ${targetAgentId} for course ${course.name}`);
      } else if (isConflict) {
        for (const lead of conflictingAgents) {
          const { data: agentMeta } = await this.db
            .from('agent_metadata')
            .select('general_commission, course_commissions')
            .eq('user_id', lead.agent_id)
            .maybeSingle();

          const courseOverrides = agentMeta?.course_commissions || {};
          let rate = agentMeta?.general_commission ?? 5.0;
          let source = 'General Commission';
          if (courseOverrides[courseId] !== undefined && courseOverrides[courseId] !== null) {
            rate = Number(courseOverrides[courseId]);
            source = 'Course Override';
          }

          const commissionAmount = (courseFee * rate) / 100;
          const commId = randomUUID();

          const commObjConflict = {
            id: commId,
            agent_id: lead.agent_id,
            purchase_id: data.id,
            seafarer_name: seafarerUser?.name || 'Seafarer',
            course_name: course.name || 'Course',
            course_fee: courseFee,
            commission_rate: rate,
            commission_amount: commissionAmount,
            commission_source: source,
            commission_version: 'v1.0',
            remarks: 'Frozen under manual conflict review',
            status: 'Under Review',
            created_at: new Date().toISOString(),
          };

          const { error: commErr } = await this.db.from('commissions').insert(commObjConflict);
          if (commErr && (commErr.code === 'PGRST204' || commErr.message?.includes('column'))) {
            await this.db.from('commissions').insert({
              id: commId,
              agent_id: lead.agent_id,
              purchase_id: data.id,
              seafarer_name: seafarerUser?.name || 'Seafarer',
              course_name: course.name || 'Course',
              course_fee: courseFee,
              commission_rate: rate,
              commission_amount: commissionAmount,
              status: 'Under Review',
              created_at: new Date().toISOString(),
            });
          }

          try {
            await this.db.from('commission_status_history').insert({
              id: randomUUID(),
              commission_id: commId,
              old_status: 'None',
              new_status: 'Under Review',
              reason: 'Conflicting referral leads detected. Placed under manual review.',
              changed_by_user_id: userId,
              changed_by_user_name: seafarerUser?.name || 'Seafarer',
              created_at: new Date().toISOString(),
            });
          } catch (e) {
            console.warn('[Referral] History insert warning:', e);
          }
        }
      }

      // ── Automatic Invoice Generation (PRD 10.3) ───────────────────────────
      const transactionId = `TXN-${data.id.substring(0, 8).toUpperCase()}`;
      let agentNameForInvoice: string | undefined;

      if (targetAgentId) {
        const { data: agUser } = await this.db
          .from('User')
          .select('name')
          .eq('id', targetAgentId)
          .maybeSingle();
        agentNameForInvoice = agUser?.name;
      }

      await this.invoicesService.generateInvoice({
        userId,
        purchaseId: data.id,
        agentId: targetAgentId || undefined,
        commissionSnapshotId: createdCommissionId,
        customerName: seafarerUser?.name || 'Seafarer',
        customerEmail: seafarerUser?.email || '',
        customerPhone: seafarerUser?.phone || '',
        agentName: agentNameForInvoice,
        agentReferralCode: targetAgentReferralCode || undefined,
        courseName: course.name || 'Course',
        courseFee: courseFee,
        discount: 0,
        finalAmount: courseFee,
        transactionId,
        paymentGateway: 'razorpay_production_mode',
        paymentMethod: 'Online UPI/Card',
        paymentDate: new Date().toISOString(),
      });
    } catch (err) {
      if (err instanceof BadRequestException) {
        throw err; // Bubble up validation errors
      }
      console.error('[Referral] Unexpected error in commission & invoice flow:', err?.message);
    }

    return data;
  }



  async updateCourseProgress(userId: string, courseId: string, progress: number) {
    const dbStatus = progress >= 100 ? 'Completed' : 'Processing';
    const updateData: any = {
      progress,
      status: dbStatus,
      updatedAt: new Date().toISOString(),
    };
    if (progress >= 100) {
      updateData.completionDate = new Date().toISOString();
    }

    const { data, error } = await this.db
      .from('Enrollment')
      .update(updateData)
      .eq('userId', userId)
      .eq('courseId', courseId)
      .select();

    if (error) {
      throw new BadRequestException(error.message);
    }
    return { courseId, userId, progress, updated: true, data };
  }

  // ─────────────────────────────────────────────
  // DOCUMENTS
  // ─────────────────────────────────────────────
  async getDocuments(userId: string) {
    const { data, error } = await this.db
      .from('Document')
      .select('*')
      .eq('userId', userId);

    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((d: any) => ({
      id: d.id,
      type: d.type,
      label: d.name ?? d.type,
      status: d.status ?? 'pending',
      expiryDate: d.expiryDate ?? null,
      uploadedAt: d.uploadDate ?? d.createdAt ?? null,
    }));
  }

  async uploadDocument(userId: string, type: string, expiryDate?: string, fileName?: string) {
    const { data, error } = await this.db
      .from('Document')
      .insert({
        id: randomUUID(),
        userId,
        type,
        name: fileName || type,
        url: `/uploads/documents/${type}-${userId}.pdf`,
        status: 'Pending',
        expiryDate: expiryDate ?? null,
        uploadDate: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return { ...data, message: 'Document received and pending verification.' };
  }

  async deleteDocument(userId: string, docId: string) {
    const { error } = await this.db
      .from('Document')
      .delete()
      .eq('id', docId)
      .eq('userId', userId);

    if (error) throw new BadRequestException(error.message);
    return { id: docId, deleted: true };
  }

  // ─────────────────────────────────────────────
  // USER PROFILE & SEA SERVICE
  // ─────────────────────────────────────────────
  async getUserProfile(userId: string) {
    const { data: user } = await this.db
      .from('User')
      .select('id, name, email, phone, role')
      .eq('id', userId)
      .single();

    const { data: profile } = await this.db
      .from('SeafarerProfile')
      .select('*')
      .eq('userId', userId)
      .single();

    const { data: seaServiceRecords } = await this.db
      .from('SeaServiceRecord')
      .select('*')
      .eq('profileId', profile?.id ?? userId);

    return {
      ...(user ?? {}),
      profile: {
        dob: profile?.dob,
        birthPlace: profile?.address,
        nationality: profile?.nationality,
        indosNumber: profile?.indosNumber,
        address: profile?.address,
        profilePicture: profile?.profilePicture ?? null,
        seaService: (seaServiceRecords ?? []).map((r: any) => ({
          id: r.id,
          rpsl: r.company,
          vessel: r.vesselName,
          vesselType: r.vesselType,
          imo: r.imoNumber,
          rank: r.rank,
          signOn: r.signOn,
          signOff: r.signOff,
        })),
      },
    };
  }

  async updateUserProfile(userId: string, details: any) {
    const { name, phone } = details;

    if (name || phone) {
      await this.db
        .from('User')
        .update({ name, phone, updatedAt: new Date().toISOString() })
        .eq('id', userId);
    }

    await this.db
      .from('SeafarerProfile')
      .upsert(
        {
          userId,
          dob: details.dob,
          address: details.address ?? details.birthPlace,
          nationality: details.nationality,
          indosNumber: details.indosNumber,
          updatedAt: new Date().toISOString(),
        },
        { onConflict: 'userId' },
      );

    return this.getUserProfile(userId);
  }

  async addSeaService(userId: string, record: any) {
    // Find or create the SeafarerProfile first
    const { data: profile } = await this.db
      .from('SeafarerProfile')
      .select('id')
      .eq('userId', userId)
      .single();

    const profileId = profile?.id ?? userId;

    const { data, error } = await this.db
      .from('SeaServiceRecord')
      .insert({
        id: randomUUID(),
        profileId,
        company: record.rpsl,
        vesselName: record.vessel,
        vesselType: record.vesselType,
        imoNumber: record.imo,
        rank: record.rank,
        signOn: record.signOn,
        signOff: record.signOff,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteSeaService(recordId: string) {
    const { error } = await this.db
      .from('SeaServiceRecord')
      .delete()
      .eq('id', recordId);

    if (error) throw new BadRequestException(error.message);
    return { id: recordId, deleted: true };
  }

  // ─────────────────────────────────────────────
  // SUPPORT TICKETS
  // ─────────────────────────────────────────────
  async getTickets(userId: string) {
    return [];
  }

  async getTicketById(userId: string, ticketId: string) {
    return null;
  }

  async createTicket(userId: string, subject: string, description: string) {
    return {
      id: `ticket-${Date.now()}`,
      userId,
      subject,
      description,
      status: 'open',
      createdAt: new Date().toISOString(),
    };
  }

  async addReply(userId: string, ticketId: string, message: string) {
    return {
      ticketId,
      message,
      from: 'user',
      createdAt: new Date().toISOString(),
    };
  }
}
