import { Injectable, BadRequestException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class CompanyService {
  constructor(private supabaseService: SupabaseService) {}

  private get db() {
    return this.supabaseService.getClient();
  }

  private async getCompanyId(adminId: string): Promise<string> {
    const { data, error } = await this.db
      .from('company_admins')
      .select('company_id')
      .eq('user_id', adminId)
      .single();

    if (error || !data) {
      throw new UnauthorizedException('Admin is not associated with any company');
    }
    return data.company_id;
  }

  private async logAudit(adminId: string, companyId: string, action: string, details: string) {
    await this.db.from('audit_logs').insert({
      id: randomUUID(),
      action,
      user_id: adminId,
      company_id: companyId,
      details,
      created_at: new Date().toISOString(),
    });
  }

  // --- DASHBOARD ---
  async getDashboard(adminId: string) {
    const companyId = await this.getCompanyId(adminId);
    
    // Total Seafarers
    const { count: totalSeafarers } = await this.db
      .from('company_crew')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId);

    // Today's Registrations
    const today = new Date();
    today.setUTCHours(0,0,0,0);
    const { count: todaysRegistrations } = await this.db
      .from('company_crew')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('joined_at', today.toISOString());

    // Pending Documents
    // First get crew user_ids
    const { data: crewData } = await this.db.from('company_crew').select('user_id').eq('company_id', companyId);
    const crewUserIds = crewData?.map(c => c.user_id) || [];
    
    let pendingDocuments = 0;
    if (crewUserIds.length > 0) {
      const { count } = await this.db
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .in('user_id', crewUserIds)
        .eq('status', 'Pending');
      pendingDocuments = count || 0;
    }

    // Pending Payments & Invoices
    const { data: payments } = await this.db.from('payments').select('amount, status').eq('company_id', companyId);
    const { data: invoices } = await this.db.from('invoices').select('amount, status').eq('company_id', companyId);
    
    const pendingPaymentsCount = payments?.filter(p => p.status === 'Pending').length || 0;
    const unpaidInvoicesCount = invoices?.filter(i => i.status === 'Unpaid').length || 0;
    const todaysRevenue = payments?.filter(p => p.status === 'Completed').reduce((acc, p) => acc + parseInt(p.amount.replace(/[^0-9]/g, '') || '0', 10), 0) || 0;

    return {
      totalSeafarers: totalSeafarers || 0,
      todaysRegistrations: todaysRegistrations || 0,
      todaysRevenue: `₹${todaysRevenue}`,
      pendingDocuments,
      pendingPayments: pendingPaymentsCount,
      unpaidInvoices: unpaidInvoicesCount,
      activeEnrollments: 0, // Placeholder
      recentActivities: [], // Placeholder
    };
  }

  // --- SEAFARER MANAGEMENT ---
  async getSeafarers(adminId: string, page = 1, limit = 10, search = '') {
    const companyId = await this.getCompanyId(adminId);
    
    let query = this.db
      .from('company_crew')
      .select('user_id, status, joined_at, users(name, email, phone)')
      .eq('company_id', companyId)
      .range((page - 1) * limit, page * limit - 1);
      
    if (search) {
      // Need a more advanced join filter, but basic mapping works for now
      // Postgrest supports inner joins with filters, assuming exact match for simplicity
    }

    const { data, count, error } = await query;
    if (error) throw new BadRequestException(error.message);

    return {
      data: data.map(d => ({
        id: d.user_id,
        status: d.status,
        joined_at: d.joined_at,
        name: (d.users as any)?.name,
        email: (d.users as any)?.email,
        phone: (d.users as any)?.phone,
      })),
      total: count,
      page,
      limit
    };
  }

  async getSeafarerProfile(adminId: string, seafarerId: string) {
    const companyId = await this.getCompanyId(adminId);
    const { data } = await this.db.from('company_crew').select('status').eq('company_id', companyId).eq('user_id', seafarerId).single();
    if (!data) throw new NotFoundException('Seafarer not found in your company');

    const { data: user } = await this.db.from('users').select('*').eq('id', seafarerId).single();
    const { data: profile } = await this.db.from('seafarer_profiles').select('*').eq('user_id', seafarerId).single();
    
    return { ...user, profile };
  }

  async updateSeafarerProfile(adminId: string, seafarerId: string, updateData: any) {
    const companyId = await this.getCompanyId(adminId);
    
    // Check access
    const { data: crew } = await this.db.from('company_crew').select('id').eq('company_id', companyId).eq('user_id', seafarerId).single();
    if (!crew) throw new NotFoundException('Seafarer not found in your company');

    if (updateData.status) {
       await this.db.from('company_crew').update({ status: updateData.status }).eq('user_id', seafarerId).eq('company_id', companyId);
    }
    
    if (updateData.name || updateData.phone) {
       await this.db.from('users').update({ name: updateData.name, phone: updateData.phone }).eq('id', seafarerId);
    }

    await this.logAudit(adminId, companyId, 'UPDATE_SEAFARER', `Updated profile for user ${seafarerId}`);
    return { success: true };
  }

  // --- WALK-IN REGISTRATION ---
  async registerWalkIn(adminId: string, dto: any) {
    const companyId = await this.getCompanyId(adminId);
    
    // 1. Duplicate check
    const { data: existingUser } = await this.db.from('users').select('id').eq('email', dto.email).single();
    if (existingUser) throw new BadRequestException('Email already registered');

    // 2. Auth Sign Up (Using Supabase Auth)
    const { data: authData, error: authError } = await this.db.auth.signUp({
      email: dto.email,
      password: dto.password,
    });
    
    if (authError) throw new BadRequestException(authError.message);
    const userId = randomUUID();

    // 3. Insert into users
    const { error: userError } = await this.db.from('users').insert({
      id: userId,
      auth_user_id: authData?.user?.id || null,
      email: dto.email,
      name: dto.name,
      phone: dto.phone,
      role: 'SEAFARER',
      status: 'Active',
      created_at: new Date().toISOString()
    });

    if (userError) throw new BadRequestException(userError.message);

    // 4. Link to company crew
    await this.db.from('company_crew').insert({
      id: randomUUID(),
      company_id: companyId,
      user_id: userId,
      status: 'Active',
      joined_at: new Date().toISOString()
    });

    // 5. Optional Payment / Course mapping
    if (dto.courseCode) {
      const { data: course } = await this.db.from('courses').select('id').eq('code', dto.courseCode).single();
      if (course) {
        await this.db.from('course_bookings').insert({
          id: randomUUID(),
          user_id: userId,
          course_id: course.id,
          amount: dto.paymentAmount || '0',
          status: 'Processing',
          purchase_date: new Date().toISOString()
        });
      }
    }

    if (dto.paymentAmount) {
      const paymentId = randomUUID();
      await this.db.from('payments').insert({
        id: paymentId,
        company_id: companyId,
        user_id: userId,
        amount: dto.paymentAmount,
        status: 'Completed',
        created_at: new Date().toISOString()
      });
      await this.db.from('invoices').insert({
        id: randomUUID(),
        company_id: companyId,
        amount: dto.paymentAmount,
        status: 'Paid',
        created_at: new Date().toISOString()
      });
    }

    await this.logAudit(adminId, companyId, 'WALK_IN_REGISTRATION', `Registered new seafarer ${dto.email}`);
    
    return {
      message: 'Walk-in registration successful',
      userId,
      credentials: { email: dto.email, password: dto.password }
    };
  }

  // --- DOCUMENT VERIFICATION ---
  async getDocuments(adminId: string, page = 1, limit = 10, statusFilter?: string) {
    const companyId = await this.getCompanyId(adminId);
    
    // Get all crew IDs
    const { data: crew } = await this.db.from('company_crew').select('user_id').eq('company_id', companyId);
    const userIds = crew?.map(c => c.user_id) || [];

    if (userIds.length === 0) return { data: [], total: 0, page, limit };

    let query = this.db
      .from('documents')
      .select('*, users(name, email)')
      .in('user_id', userIds)
      .range((page - 1) * limit, page * limit - 1);

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data, count, error } = await query;
    if (error) throw new BadRequestException(error.message);

    return { data, total: count, page, limit };
  }

  async verifyDocument(adminId: string, docId: string, status: string, remarks?: string) {
    const companyId = await this.getCompanyId(adminId);

    const { error } = await this.db.from('documents')
      .update({ status, remarks })
      .eq('id', docId);

    if (error) throw new BadRequestException(error.message);

    await this.logAudit(adminId, companyId, 'VERIFY_DOCUMENT', `Document ${docId} marked as ${status}`);
    return { success: true, docId, status };
  }

  // --- PAYMENTS & INVOICES ---
  async getPayments(adminId: string, page = 1, limit = 10) {
    const companyId = await this.getCompanyId(adminId);
    const { data, count, error } = await this.db
      .from('payments')
      .select('*, users(name, email)')
      .eq('company_id', companyId)
      .range((page - 1) * limit, page * limit - 1);
    
    if (error) throw new BadRequestException(error.message);
    return { data, total: count, page, limit };
  }

  async getInvoices(adminId: string, page = 1, limit = 10) {
    const companyId = await this.getCompanyId(adminId);
    const { data, count, error } = await this.db
      .from('invoices')
      .select('*')
      .eq('company_id', companyId)
      .range((page - 1) * limit, page * limit - 1);
    
    if (error) throw new BadRequestException(error.message);
    return { data, total: count, page, limit };
  }

  async generateInvoice(adminId: string, amount: string, email?: string) {
    const companyId = await this.getCompanyId(adminId);
    const invoiceId = randomUUID();
    
    const { error } = await this.db.from('invoices').insert({
      id: invoiceId,
      company_id: companyId,
      amount,
      status: 'Unpaid',
      email_sent: !!email,
      created_at: new Date().toISOString()
    });

    if (error) throw new BadRequestException(error.message);
    await this.logAudit(adminId, companyId, 'GENERATE_INVOICE', `Generated invoice for ${amount}`);
    
    return { invoiceId, amount, status: 'Unpaid' };
  }

  // --- REPORTS ---
  async getReport(adminId: string, type: string) {
    const companyId = await this.getCompanyId(adminId);
    
    if (type === 'registrations') {
      const { data } = await this.db.from('company_crew').select('joined_at, status, user_id, users(name, email)').eq('company_id', companyId);
      return data;
    } else if (type === 'revenue') {
      const { data } = await this.db.from('payments').select('amount, created_at, status').eq('company_id', companyId);
      return data;
    }
    throw new BadRequestException('Invalid report type');
  }
}
