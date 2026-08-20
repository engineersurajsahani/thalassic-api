"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeafarerService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const supabase_service_1 = require("../supabase/supabase.service");
const invoices_service_1 = require("../invoices/invoices.service");
let SeafarerService = class SeafarerService {
    supabaseService;
    invoicesService;
    constructor(supabaseService, invoicesService) {
        this.supabaseService = supabaseService;
        this.invoicesService = invoicesService;
    }
    get db() {
        return this.supabaseService.getClient();
    }
    async getDashboard(userId) {
        const { data: enrollments } = await this.db
            .from('Enrollment')
            .select('id, status, startDate, createdAt, courseId, Course(name, code, duration)')
            .eq('userId', userId)
            .order('createdAt', { ascending: false });
        const activeEnrollment = enrollments?.find((e) => e.status === 'Processing');
        const completedCount = enrollments?.filter((e) => e.status === 'Completed').length ?? 0;
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
        const docStatus = (type) => {
            const doc = docs?.find((d) => d.type?.toLowerCase() === type);
            if (!doc)
                return 'missing';
            if (doc.expiryDate && new Date(doc.expiryDate) < now)
                return 'pending';
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
                        name: activeEnrollment.Course?.name,
                        code: activeEnrollment.Course?.code,
                        progress: 40,
                    }
                    : null,
                completedCount,
            },
            certificates,
            notifications: [],
        };
    }
    async getNotifications(userId, role) {
        if (role === 'MASTER') {
            const supabase = this.db;
            const { data: users } = await supabase
                .from('User')
                .select('id, name, email, createdAt')
                .eq('role', 'SEAFARER')
                .order('createdAt', { ascending: false })
                .limit(3);
            const { data: enrollments } = await supabase
                .from('Enrollment')
                .select('id, status, createdAt, User(name), Course(name)')
                .order('createdAt', { ascending: false })
                .limit(3);
            const { data: documents } = await supabase
                .from('Document')
                .select('id, name, type, status, uploadDate, User(name)')
                .eq('status', 'Pending')
                .order('uploadDate', { ascending: false })
                .limit(3);
            const notificationsList = [];
            (users || []).forEach((u) => {
                notificationsList.push({
                    id: `reg-${u.id}`,
                    title: `👤 New Seafarer Registration`,
                    message: `${u.name || u.email || 'A user'} joined the platform.`,
                    isRead: false,
                    read: false,
                    createdAt: u.createdAt,
                });
            });
            (enrollments || []).forEach((e) => {
                notificationsList.push({
                    id: `enroll-${e.id}`,
                    title: `⚓ New Course Booking`,
                    message: `${e.User?.name || 'A user'} booked ${e.Course?.name || 'a course'}.`,
                    isRead: false,
                    read: false,
                    createdAt: e.createdAt,
                });
            });
            (documents || []).forEach((d) => {
                notificationsList.push({
                    id: `doc-${d.id}`,
                    title: `📄 Verification Required`,
                    message: `Pending review for ${d.type || 'document'} uploaded by ${d.User?.name || 'seafarer'}.`,
                    isRead: false,
                    read: false,
                    createdAt: d.uploadDate,
                });
            });
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
        return (enrollments ?? []).map((e) => ({
            id: e.id,
            title: e.status === 'Completed'
                ? `✅ Course Completed: ${e.Course?.name}`
                : `📋 Enrollment Processing: ${e.Course?.name}`,
            message: e.status === 'Completed'
                ? `Your certificate for ${e.Course?.name} has been issued.`
                : `Your booking for ${e.Course?.name} is being processed.`,
            isRead: false,
            read: false,
            createdAt: e.createdAt,
        }));
    }
    async markNotificationRead(id) {
        return { id, read: true };
    }
    async markAllNotificationsRead() {
        return { success: true };
    }
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
    async getMyEnrollments(userId) {
        const { data, error } = await this.db
            .from('Enrollment')
            .select('id, status, progress, startDate, createdAt, Course(id, name, code, category, duration, fees, description)')
            .eq('userId', userId)
            .order('createdAt', { ascending: false });
        if (error) {
            console.error('getMyEnrollments error:', error.message);
            return [];
        }
        return (data ?? []).map((e) => ({
            id: e.id,
            status: e.status?.toLowerCase() === 'completed' ? 'completed' : 'active',
            purchaseDate: e.startDate ?? e.createdAt,
            course: e.Course,
            courseId: e.Course?.id ?? e.courseId,
            progress: e.progress ?? (e.status?.toLowerCase() === 'completed' ? 100 : 0),
        }));
    }
    async enrollInCourse(userId, courseId, referralCode) {
        const { data: course } = await this.db
            .from('Course')
            .select('id, fees, name')
            .eq('id', courseId)
            .single();
        if (!course)
            throw new common_1.BadRequestException('Course not found');
        const { data: existing } = await this.db
            .from('Enrollment')
            .select('id')
            .eq('userId', userId)
            .eq('courseId', courseId)
            .single();
        if (existing)
            throw new common_1.BadRequestException('Already enrolled in this course');
        const { data, error } = await this.db
            .from('Enrollment')
            .insert({
            id: (0, crypto_1.randomUUID)(),
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
        if (error)
            throw new common_1.BadRequestException(error.message);
        console.log(`[Backend Enroll] User ${userId} enrolling in ${courseId} with referralCode: "${referralCode}"`);
        try {
            let targetAgentId = '';
            let targetCommissionRate = 5.0;
            let commissionSource = 'General Commission';
            let matchingLeadId = '';
            let isConflict = false;
            let conflictingAgents = [];
            let targetAgentReferralCode = '';
            const { data: seafarerUser } = await this.db
                .from('User')
                .select('name, email, phone')
                .eq('id', userId)
                .single();
            if (referralCode && referralCode.trim().length > 0) {
                const code = referralCode.trim().toUpperCase();
                const { data: agentMeta } = await this.db
                    .from('agent_metadata')
                    .select('user_id, general_commission, course_commissions, referral_code')
                    .eq('referral_code', code)
                    .maybeSingle();
                if (!agentMeta) {
                    throw new common_1.BadRequestException('Invalid Referral Code Error');
                }
                targetAgentId = agentMeta.user_id;
                targetAgentReferralCode = agentMeta.referral_code || code;
                const courseOverrides = agentMeta.course_commissions || {};
                if (courseOverrides[courseId] !== undefined && courseOverrides[courseId] !== null) {
                    targetCommissionRate = Number(courseOverrides[courseId]);
                    commissionSource = 'Course Override';
                }
                else {
                    targetCommissionRate = Number(agentMeta.general_commission) || 5.0;
                    commissionSource = 'General Commission';
                }
            }
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
                        }
                        else {
                            targetCommissionRate = Number(agentMeta?.general_commission) || 5.0;
                            commissionSource = 'General Commission';
                        }
                    }
                    else if (uniqueAgentsMap.size > 1) {
                        isConflict = true;
                        conflictingAgents = Array.from(uniqueAgentsMap.values());
                    }
                }
            }
            const parseFee = (feeStr) => {
                if (typeof feeStr === 'number')
                    return feeStr;
                if (!feeStr)
                    return 0;
                const cleaned = String(feeStr).replace(/[^0-9.]/g, '');
                return parseFloat(cleaned) || 0;
            };
            const courseFee = parseFee(course.fees);
            let createdCommissionId;
            if (targetAgentId) {
                const commissionAmount = (courseFee * targetCommissionRate) / 100;
                createdCommissionId = (0, crypto_1.randomUUID)();
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
                    if (retryErr)
                        console.error('[Referral] Standard commission insert error:', retryErr.message);
                }
                else if (commErr) {
                    console.error('[Referral] Commission insert error:', commErr.message);
                }
                try {
                    await this.db.from('commission_status_history').insert({
                        id: (0, crypto_1.randomUUID)(),
                        commission_id: createdCommissionId,
                        old_status: 'None',
                        new_status: 'Pending',
                        reason: 'Initial commission snapshot generated upon course checkout',
                        changed_by_user_id: userId,
                        changed_by_user_name: seafarerUser?.name || 'Seafarer',
                        created_at: new Date().toISOString(),
                    });
                }
                catch (e) {
                    console.warn('[Referral] History insert warning:', e);
                }
                if (matchingLeadId) {
                    await this.db
                        .from('referral_leads')
                        .update({ status: 'Converted' })
                        .eq('id', matchingLeadId);
                }
                console.log(`[Referral] Attributed commission ${createdCommissionId} to agent ${targetAgentId} for course ${course.name}`);
            }
            else if (isConflict) {
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
                    const commId = (0, crypto_1.randomUUID)();
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
                            id: (0, crypto_1.randomUUID)(),
                            commission_id: commId,
                            old_status: 'None',
                            new_status: 'Under Review',
                            reason: 'Conflicting referral leads detected. Placed under manual review.',
                            changed_by_user_id: userId,
                            changed_by_user_name: seafarerUser?.name || 'Seafarer',
                            created_at: new Date().toISOString(),
                        });
                    }
                    catch (e) {
                        console.warn('[Referral] History insert warning:', e);
                    }
                }
            }
            const transactionId = `TXN-${data.id.substring(0, 8).toUpperCase()}`;
            let agentNameForInvoice;
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
        }
        catch (err) {
            if (err instanceof common_1.BadRequestException) {
                throw err;
            }
            console.error('[Referral] Unexpected error in commission & invoice flow:', err?.message);
        }
        return data;
    }
    async updateCourseProgress(userId, courseId, progress) {
        const dbStatus = progress >= 100 ? 'Completed' : 'Processing';
        const updateData = {
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
            throw new common_1.BadRequestException(error.message);
        }
        return { courseId, userId, progress, updated: true, data };
    }
    async getDocuments(userId) {
        const { data, error } = await this.db
            .from('Document')
            .select('*')
            .eq('userId', userId);
        if (error)
            throw new common_1.BadRequestException(error.message);
        return (data ?? []).map((d) => {
            let meta = {};
            try {
                if (d.remarks && d.remarks.startsWith('{')) {
                    meta = JSON.parse(d.remarks);
                }
                else if (d.metadata && typeof d.metadata === 'string') {
                    meta = JSON.parse(d.metadata);
                }
                else if (d.metadata && typeof d.metadata === 'object') {
                    meta = d.metadata;
                }
            }
            catch (e) {
                meta = {};
            }
            return {
                id: d.id,
                type: d.type,
                label: d.name ?? d.type,
                status: d.status ?? 'pending',
                expiryDate: d.expiryDate ?? meta.expiryDate ?? null,
                uploadedAt: d.uploadDate ?? d.createdAt ?? null,
                url: d.url,
                passportNumber: meta.passportNumber ?? d.passportNumber ?? null,
                cdcNumber: meta.cdcNumber ?? d.cdcNumber ?? null,
                placeOfIssue: meta.placeOfIssue ?? d.placeOfIssue ?? null,
                issueDate: meta.issueDate ?? d.issueDate ?? null,
                courseName: meta.courseName ?? d.courseName ?? null,
                courseType: meta.courseType ?? d.courseType ?? null,
                durationFrom: meta.durationFrom ?? d.durationFrom ?? null,
                durationTo: meta.durationTo ?? d.durationTo ?? null,
                metadata: meta,
            };
        });
    }
    async uploadDocument(userId, type, expiryDate, file, bodyMetadata) {
        if (!file || !file.buffer || file.buffer.length === 0) {
            throw new common_1.BadRequestException('No file provided or file is empty.');
        }
        const docType = (type || bodyMetadata?.type || 'other').toLowerCase();
        if (docType === 'passport' || docType === 'cdc') {
            const { data: existingDocs } = await this.db
                .from('Document')
                .select('id')
                .eq('userId', userId)
                .ilike('type', docType);
            if (existingDocs && existingDocs.length > 0) {
                for (const exDoc of existingDocs) {
                    await this.db.from('Document').delete().eq('id', exDoc.id);
                }
            }
        }
        const docId = (0, crypto_1.randomUUID)();
        const originalName = file.originalname || `${docType}-${docId}`;
        const mimeType = file.mimetype || 'application/octet-stream';
        const storagePath = `${userId}/${docId}/${originalName}`;
        const BUCKET = 'seafarer-documents';
        const { error: storageError } = await this.db.storage
            .from(BUCKET)
            .upload(storagePath, file.buffer, {
            contentType: mimeType,
            upsert: true,
        });
        if (storageError) {
            console.error('[uploadDocument] Supabase Storage upload error:', storageError.message);
            throw new common_1.BadRequestException(`File storage failed: ${storageError.message}. Ensure '${BUCKET}' bucket exists in Supabase Storage.`);
        }
        const metadataObj = {
            passportNumber: bodyMetadata?.passportNumber,
            cdcNumber: bodyMetadata?.cdcNumber,
            placeOfIssue: bodyMetadata?.placeOfIssue,
            issueDate: bodyMetadata?.issueDate,
            expiryDate: expiryDate || bodyMetadata?.expiryDate,
            courseName: bodyMetadata?.courseName,
            courseType: bodyMetadata?.courseType,
            durationFrom: bodyMetadata?.durationFrom,
            durationTo: bodyMetadata?.durationTo,
        };
        const { data, error } = await this.db
            .from('Document')
            .insert({
            id: docId,
            userId,
            type: docType,
            name: originalName,
            url: storagePath,
            status: 'Pending',
            expiryDate: expiryDate || bodyMetadata?.expiryDate || null,
            remarks: JSON.stringify(metadataObj),
            uploadDate: new Date().toISOString(),
        })
            .select()
            .single();
        if (error)
            throw new common_1.BadRequestException(error.message);
        return { ...data, metadata: metadataObj, message: 'Document uploaded successfully.' };
    }
    async updateDocument(userId, docId, bodyMetadata, file) {
        const { data: existingDoc, error: fetchErr } = await this.db
            .from('Document')
            .select('*')
            .eq('id', docId)
            .single();
        if (fetchErr || !existingDoc) {
            throw new common_1.BadRequestException('Document not found.');
        }
        if (existingDoc.userId !== userId) {
            throw new common_1.BadRequestException('Access denied.');
        }
        let storagePath = existingDoc.url;
        let fileName = existingDoc.name;
        if (file && file.buffer && file.buffer.length > 0) {
            const originalName = file.originalname || `${existingDoc.type}-${docId}`;
            const mimeType = file.mimetype || 'application/octet-stream';
            storagePath = `${userId}/${docId}/${originalName}`;
            fileName = originalName;
            const BUCKET = 'seafarer-documents';
            const { error: storageError } = await this.db.storage
                .from(BUCKET)
                .upload(storagePath, file.buffer, {
                contentType: mimeType,
                upsert: true,
            });
            if (storageError) {
                throw new common_1.BadRequestException(`File replacement storage failed: ${storageError.message}`);
            }
        }
        let existingMeta = {};
        try {
            if (existingDoc.remarks && existingDoc.remarks.startsWith('{')) {
                existingMeta = JSON.parse(existingDoc.remarks);
            }
        }
        catch (e) {
            existingMeta = {};
        }
        const updatedMeta = {
            ...existingMeta,
            passportNumber: bodyMetadata?.passportNumber ?? existingMeta.passportNumber,
            cdcNumber: bodyMetadata?.cdcNumber ?? existingMeta.cdcNumber,
            placeOfIssue: bodyMetadata?.placeOfIssue ?? existingMeta.placeOfIssue,
            issueDate: bodyMetadata?.issueDate ?? existingMeta.issueDate,
            expiryDate: bodyMetadata?.expiryDate ?? existingMeta.expiryDate,
            courseName: bodyMetadata?.courseName ?? existingMeta.courseName,
            courseType: bodyMetadata?.courseType ?? existingMeta.courseType,
            durationFrom: bodyMetadata?.durationFrom ?? existingMeta.durationFrom,
            durationTo: bodyMetadata?.durationTo ?? existingMeta.durationTo,
        };
        const { data, error } = await this.db
            .from('Document')
            .update({
            name: fileName,
            url: storagePath,
            expiryDate: bodyMetadata?.expiryDate || existingDoc.expiryDate,
            remarks: JSON.stringify(updatedMeta),
        })
            .eq('id', docId)
            .select()
            .single();
        if (error)
            throw new common_1.BadRequestException(error.message);
        return { ...data, metadata: updatedMeta, message: 'Document updated successfully.' };
    }
    async downloadDocument(userId, docId, role) {
        const { data: doc, error } = await this.db
            .from('Document')
            .select('id, url, name, userId, type')
            .eq('id', docId)
            .single();
        if (error || !doc) {
            throw new common_1.BadRequestException('Document record not found.');
        }
        if (doc.userId !== userId && role !== 'MASTER' && role !== 'COMPANY_ADMIN' && role !== 'agent-admin') {
            throw new common_1.BadRequestException('Access denied. You do not have permission to download this document.');
        }
        const storedUrl = doc.url || '';
        const BUCKET = 'seafarer-documents';
        let storagePath = storedUrl;
        const publicPathMarker = `/object/public/${BUCKET}/`;
        const signedPathMarker = `/object/sign/${BUCKET}/`;
        if (storedUrl.includes(publicPathMarker)) {
            storagePath = decodeURIComponent(storedUrl.substring(storedUrl.indexOf(publicPathMarker) + publicPathMarker.length));
        }
        else if (storedUrl.includes(signedPathMarker)) {
            storagePath = decodeURIComponent(storedUrl.substring(storedUrl.indexOf(signedPathMarker) + signedPathMarker.length));
        }
        let validPathFound = false;
        if (storagePath && !storagePath.startsWith('/uploads/')) {
            const { data: signedData } = await this.db.storage
                .from(BUCKET)
                .createSignedUrl(storagePath, 60);
            if (signedData?.signedUrl) {
                return {
                    signedUrl: signedData.signedUrl,
                    fileName: doc.name || `Document_${doc.type || 'file'}`,
                };
            }
        }
        const { data: bucketFiles } = await this.db.storage.from(BUCKET).list('', { limit: 100 });
        if (bucketFiles && bucketFiles.length > 0) {
            const matchingFile = bucketFiles.find(f => (doc.userId && f.name.includes(doc.userId)) ||
                (doc.id && f.name.includes(doc.id)) ||
                (doc.type && f.name.toLowerCase().includes(doc.type.toLowerCase()))) || bucketFiles.find(f => f.name.endsWith('.pdf') || f.name.endsWith('.png') || f.name.endsWith('.jpg'));
            if (matchingFile) {
                storagePath = matchingFile.name;
                await this.db.from('Document').update({ url: storagePath }).eq('id', doc.id);
                const { data: signedData } = await this.db.storage.from(BUCKET).createSignedUrl(storagePath, 60);
                if (signedData?.signedUrl) {
                    return {
                        signedUrl: signedData.signedUrl,
                        fileName: doc.name || matchingFile.name,
                    };
                }
            }
        }
        throw new common_1.BadRequestException('Document file is unavailable.');
    }
    async deleteDocument(userId, docId) {
        const { error } = await this.db
            .from('Document')
            .delete()
            .eq('id', docId)
            .eq('userId', userId);
        if (error)
            throw new common_1.BadRequestException(error.message);
        return { id: docId, deleted: true };
    }
    async getUserProfile(userId) {
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
        const nameParts = (user?.name || '').trim().split(' ');
        const firstName = profile?.firstName || nameParts[0] || '';
        const lastName = profile?.lastName || nameParts.slice(1).join(' ') || '';
        return {
            ...(user ?? {}),
            firstName,
            lastName,
            email: user?.email,
            phone: user?.phone,
            profile: {
                firstName,
                lastName,
                email: user?.email,
                phone: user?.phone,
                alternatePhone: profile?.alternatePhone ?? profile?.altPhone ?? '',
                dob: profile?.dob ?? '',
                placeOfBirth: profile?.placeOfBirth ?? profile?.birthPlace ?? '',
                nationality: profile?.nationality ?? '',
                indosNumber: profile?.indosNumber ?? '',
                address: profile?.address ?? '',
                city: profile?.city ?? '',
                state: profile?.state ?? '',
                country: profile?.country ?? '',
                profilePicture: profile?.profilePicture ?? null,
                seaService: (seaServiceRecords ?? []).map((r) => ({
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
    async updateUserProfile(userId, details) {
        const { firstName, lastName, name, email, phone, alternatePhone, dob, placeOfBirth, address, city, state, country, indosNumber, profilePicture, } = details;
        const fullName = (firstName && lastName) ? `${firstName.trim()} ${lastName.trim()}` : (name || firstName || '');
        if (!fullName || !fullName.trim()) {
            throw new common_1.BadRequestException('First Name and Last Name are required.');
        }
        if (!email || !email.trim()) {
            throw new common_1.BadRequestException('Email address is required.');
        }
        if (!phone || !phone.trim()) {
            throw new common_1.BadRequestException('Mobile phone number is required.');
        }
        if (!dob) {
            throw new common_1.BadRequestException('Date of birth is required.');
        }
        if (!placeOfBirth) {
            throw new common_1.BadRequestException('Place of birth is required.');
        }
        if (!address) {
            throw new common_1.BadRequestException('Address is required.');
        }
        if (!city) {
            throw new common_1.BadRequestException('City is required.');
        }
        if (!state) {
            throw new common_1.BadRequestException('State is required.');
        }
        if (!country) {
            throw new common_1.BadRequestException('Country is required.');
        }
        if (!indosNumber || !indosNumber.trim()) {
            throw new common_1.BadRequestException('INDOS Number is required.');
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            throw new common_1.BadRequestException('Invalid email address format.');
        }
        const { data: existingUserWithEmail } = await this.db
            .from('User')
            .select('id')
            .eq('email', email.trim().toLowerCase())
            .neq('id', userId)
            .maybeSingle();
        if (existingUserWithEmail) {
            throw new common_1.BadRequestException('Email address is already registered to another user.');
        }
        if (indosNumber && indosNumber.trim()) {
            const { data: existingProfileWithIndos } = await this.db
                .from('SeafarerProfile')
                .select('userId')
                .eq('indosNumber', indosNumber.trim())
                .neq('userId', userId)
                .maybeSingle();
            if (existingProfileWithIndos) {
                throw new common_1.BadRequestException('INDOS Number is already registered to another Seafarer.');
            }
        }
        await this.db
            .from('User')
            .update({
            name: fullName.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            updatedAt: new Date().toISOString(),
        })
            .eq('id', userId);
        await this.db
            .from('SeafarerProfile')
            .upsert({
            userId,
            firstName: firstName?.trim(),
            lastName: lastName?.trim(),
            alternatePhone: alternatePhone?.trim() ?? null,
            dob,
            placeOfBirth: placeOfBirth?.trim(),
            birthPlace: placeOfBirth?.trim(),
            address: address?.trim(),
            city: city?.trim(),
            state: state?.trim(),
            country: country?.trim(),
            nationality: country?.trim() || 'Indian',
            indosNumber: indosNumber?.trim(),
            profilePicture: profilePicture ?? null,
            updatedAt: new Date().toISOString(),
        }, { onConflict: 'userId' });
        try {
            await this.db.from('audit_logs').insert({
                id: (0, crypto_1.randomUUID)(),
                user_id: userId,
                user_name: fullName,
                action: 'UPDATE_SEAFARER_PROFILE',
                module: 'Seafarer Portal',
                entity_id: userId,
                details: `Updated seafarer profile: ${fullName} (INDOS: ${indosNumber})`,
                ip_address: '127.0.0.1',
                created_at: new Date().toISOString(),
            });
        }
        catch (e) {
            console.warn('Audit log write warning:', e);
        }
        return this.getUserProfile(userId);
    }
    async addSeaService(userId, record) {
        const { data: profile } = await this.db
            .from('SeafarerProfile')
            .select('id')
            .eq('userId', userId)
            .single();
        let profileId = profile?.id;
        if (!profileId) {
            profileId = (0, crypto_1.randomUUID)();
            const { data: newProfile, error: profileErr } = await this.db
                .from('SeafarerProfile')
                .insert({
                id: profileId,
                userId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            })
                .select('id')
                .single();
            if (profileErr)
                throw new common_1.BadRequestException('Failed to initialize profile: ' + profileErr.message);
        }
        const { data, error } = await this.db
            .from('SeaServiceRecord')
            .insert({
            id: (0, crypto_1.randomUUID)(),
            profileId,
            company: record.rpsl,
            vesselName: record.vessel,
            imoNumber: record.imo,
            rank: record.rank,
            signOn: record.signOn,
            signOff: record.signOff,
            createdAt: new Date().toISOString(),
        })
            .select()
            .single();
        if (error)
            throw new common_1.BadRequestException(error.message);
        return data;
    }
    async deleteSeaService(recordId) {
        const { error } = await this.db
            .from('SeaServiceRecord')
            .delete()
            .eq('id', recordId);
        if (error)
            throw new common_1.BadRequestException(error.message);
        return { id: recordId, deleted: true };
    }
    inMemoryTickets = [
        {
            id: 'TICKET-1001',
            userId: 'demo-seafarer-001',
            subject: 'Certificate Verification Assistance',
            description: 'I need assistance verifying my STCW BST certificate renewal status.',
            status: 'In Progress',
            priority: 'Normal',
            createdAt: '2026-08-05T09:00:00.000Z',
            replies: [
                {
                    id: 'reply-1',
                    sender: 'Support Desk',
                    message: 'Hello, your certificate is currently under review by our DGS verification team.',
                    timestamp: '2026-08-05T11:30:00.000Z',
                },
            ],
        },
        {
            id: 'TICKET-1002',
            userId: 'demo-seafarer-001',
            subject: 'Course Schedule Inquiry',
            description: 'Requesting updated dates for Advanced Fire Fighting classroom sessions.',
            status: 'Resolved',
            priority: 'Low',
            createdAt: '2026-07-20T14:00:00.000Z',
            replies: [
                {
                    id: 'reply-2',
                    sender: 'Course Coordinator',
                    message: 'Upcoming AFF batches start on the 1st and 15th of next month.',
                    timestamp: '2026-07-21T08:45:00.000Z',
                },
            ],
        },
    ];
    async getTickets(userId) {
        return this.inMemoryTickets.filter(t => t.userId === userId);
    }
    async getTicketById(userId, ticketId) {
        const ticket = this.inMemoryTickets.find(t => t.id === ticketId);
        return ticket || null;
    }
    async createTicket(userId, subject, description) {
        const newTicket = {
            id: `TICKET-${Math.floor(1000 + Math.random() * 9000)}`,
            userId,
            subject,
            description,
            status: 'Open',
            priority: 'Normal',
            createdAt: new Date().toISOString(),
            replies: [],
        };
        this.inMemoryTickets.unshift(newTicket);
        return newTicket;
    }
    async addReply(userId, ticketId, message) {
        const ticket = this.inMemoryTickets.find(t => t.id === ticketId);
        if (!ticket)
            throw new common_1.BadRequestException('Ticket not found');
        const reply = {
            id: `reply-${Date.now()}`,
            sender: 'Seafarer User',
            message,
            timestamp: new Date().toISOString(),
        };
        ticket.replies.push(reply);
        return reply;
    }
    async getReferrals(userId) {
        let indosCode = 'IND99887766';
        try {
            const { data: profile } = await this.db
                .from('SeafarerProfile')
                .select('indosNumber')
                .eq('userId', userId)
                .maybeSingle();
            if (profile?.indosNumber) {
                indosCode = profile.indosNumber;
            }
        }
        catch (e) {
            console.warn('Referral INDoS lookup fallback');
        }
        const history = [
            {
                id: 'ref-1',
                name: 'Rohan Sharma',
                email: 'rohan.s@example.com',
                registrationDate: '2026-07-10T11:20:00.000Z',
                status: 'Registered',
                creditsEarned: 500,
            },
            {
                id: 'ref-2',
                name: 'Vikram Merchant',
                email: 'vikram.m@example.com',
                registrationDate: '2026-07-25T16:45:00.000Z',
                status: 'Registered',
                creditsEarned: 500,
            },
        ];
        return {
            referralCode: indosCode,
            totalReferrals: history.length,
            successfulRegistrations: history.length,
            earnedCredits: history.reduce((acc, curr) => acc + curr.creditsEarned, 0),
            history,
        };
    }
};
exports.SeafarerService = SeafarerService;
exports.SeafarerService = SeafarerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService,
        invoices_service_1.InvoicesService])
], SeafarerService);
//# sourceMappingURL=seafarer.service.js.map