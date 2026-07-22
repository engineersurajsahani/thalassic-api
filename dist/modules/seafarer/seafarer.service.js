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
let SeafarerService = class SeafarerService {
    supabaseService;
    constructor(supabaseService) {
        this.supabaseService = supabaseService;
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
        if (referralCode && referralCode.trim().length > 0) {
            try {
                const code = referralCode.trim().toUpperCase();
                const { data: agentMeta } = await this.db
                    .from('agent_metadata')
                    .select('user_id, general_commission')
                    .eq('referral_code', code)
                    .single();
                if (agentMeta) {
                    const parseFee = (feeStr) => {
                        if (typeof feeStr === 'number')
                            return feeStr;
                        if (!feeStr)
                            return 0;
                        const cleaned = String(feeStr).replace(/[^0-9.]/g, '');
                        return parseFloat(cleaned) || 0;
                    };
                    const commissionRate = agentMeta.general_commission ?? 5;
                    const courseFee = parseFee(course.fees);
                    const commissionAmount = (courseFee * commissionRate) / 100;
                    const { data: seafarerUser } = await this.db
                        .from('User')
                        .select('name, email, phone')
                        .eq('id', userId)
                        .single();
                    const { error: commErr } = await this.db.from('commissions').insert({
                        id: (0, crypto_1.randomUUID)(),
                        agent_id: agentMeta.user_id,
                        purchase_id: data.id,
                        seafarer_name: seafarerUser?.name || 'Seafarer',
                        course_name: course.name || 'Course',
                        course_fee: courseFee,
                        commission_rate: commissionRate,
                        commission_amount: commissionAmount,
                        status: 'Pending',
                        created_at: new Date().toISOString(),
                    });
                    if (commErr) {
                        console.error('[Referral] Failed to insert commission:', commErr.message);
                    }
                    else {
                        console.log(`[Referral] SUCCESS! Created commission ₹${commissionAmount} for agent ${agentMeta.user_id}`);
                    }
                    if (seafarerUser) {
                        await this.db
                            .from('referral_leads')
                            .update({ status: 'Converted', updated_at: new Date().toISOString() })
                            .eq('agent_id', agentMeta.user_id)
                            .in('status', ['New', 'Contacted', 'Registered'])
                            .or(`email.eq.${seafarerUser.email},phone.eq.${seafarerUser.phone || ''}`);
                    }
                }
            }
            catch (commissionErr) {
                console.error('[Referral] Unexpected error in commission flow:', commissionErr?.message);
            }
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
        return (data ?? []).map((d) => ({
            id: d.id,
            type: d.type,
            label: d.name ?? d.type,
            status: d.status ?? 'pending',
            expiryDate: d.expiryDate ?? null,
            uploadedAt: d.uploadDate ?? d.createdAt ?? null,
        }));
    }
    async uploadDocument(userId, type, expiryDate, fileName) {
        const { data, error } = await this.db
            .from('Document')
            .insert({
            id: (0, crypto_1.randomUUID)(),
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
        if (error)
            throw new common_1.BadRequestException(error.message);
        return { ...data, message: 'Document received and pending verification.' };
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
        return {
            ...(user ?? {}),
            profile: {
                dob: profile?.dob,
                birthPlace: profile?.address,
                nationality: profile?.nationality,
                indosNumber: profile?.indosNumber,
                address: profile?.address,
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
        const { name, phone } = details;
        if (name || phone) {
            await this.db
                .from('User')
                .update({ name, phone, updatedAt: new Date().toISOString() })
                .eq('id', userId);
        }
        await this.db
            .from('SeafarerProfile')
            .upsert({
            userId,
            dob: details.dob,
            address: details.address ?? details.birthPlace,
            nationality: details.nationality,
            indosNumber: details.indosNumber,
            updatedAt: new Date().toISOString(),
        }, { onConflict: 'userId' });
        return this.getUserProfile(userId);
    }
    async addSeaService(userId, record) {
        const { data: profile } = await this.db
            .from('SeafarerProfile')
            .select('id')
            .eq('userId', userId)
            .single();
        const profileId = profile?.id ?? userId;
        const { data, error } = await this.db
            .from('SeaServiceRecord')
            .insert({
            id: (0, crypto_1.randomUUID)(),
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
    async getTickets(userId) {
        return [];
    }
    async getTicketById(userId, ticketId) {
        return null;
    }
    async createTicket(userId, subject, description) {
        return {
            id: `ticket-${Date.now()}`,
            userId,
            subject,
            description,
            status: 'open',
            createdAt: new Date().toISOString(),
        };
    }
    async addReply(userId, ticketId, message) {
        return {
            ticketId,
            message,
            from: 'user',
            createdAt: new Date().toISOString(),
        };
    }
};
exports.SeafarerService = SeafarerService;
exports.SeafarerService = SeafarerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], SeafarerService);
//# sourceMappingURL=seafarer.service.js.map