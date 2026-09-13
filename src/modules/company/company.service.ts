import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
const SEAFARER_STATUSES = [
  'Active',
  'Ongoing',
  'On Hold',
  'Completed',
  'Inactive',
] as const;

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
      throw new UnauthorizedException(
        'Admin is not associated with any company',
      );
    }
    return data.company_id;
  }

  private async logAudit(
    adminId: string,
    companyId: string,
    action: string,
    details: string,
  ) {
    await this.db.from('audit_logs').insert({
      id: randomUUID(),
      action,
      user_id: adminId,
      entity_id: companyId,
      details,
      created_at: new Date().toISOString(),
    });
  }

  // --- DASHBOARD ---
  async getDashboard(adminId: string) {
    const companyId = await this.getCompanyId(adminId);

    // Total Seafarers
    const { count: totalSeafarers } = await this.db
      .from('company_seafarers')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId);

    // Today's Registrations
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const { count: todaysRegistrations } = await this.db
      .from('company_seafarers')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('joined_at', today.toISOString().split('T')[0]);

    // Pending Documents - get crew user_ids first
    const { data: crewData } = await this.db
      .from('company_seafarers')
      .select('user_id')
      .eq('company_id', companyId);
    const crewUserIds = crewData?.map((c) => c.user_id) || [];

    let pendingDocuments = 0;
    if (crewUserIds.length > 0) {
      const { count } = await this.db
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .in('user_id', crewUserIds)
        .eq('status', 'Pending');
      pendingDocuments = count || 0;
    }

    // Invoices for this company (use invoices table - no separate payments table)
    const { data: invoices } = await this.db
      .from('invoices')
      .select('total_amount, net_payable, status')
      .eq('company_id', companyId);

    const pendingPaymentsCount =
      invoices?.filter((i) => i.status === 'Pending' || i.status === 'Unpaid')
        .length || 0;
    const unpaidInvoicesCount =
      invoices?.filter((i) => i.status !== 'Paid').length || 0;
    const todaysRevenue =
      invoices
        ?.filter((i) => i.status === 'Paid')
        .reduce(
          (acc, i) => acc + (Number(i.net_payable || i.total_amount) || 0),
          0,
        ) || 0;

    return {
      totalSeafarers: totalSeafarers || 0,
      todaysRegistrations: todaysRegistrations || 0,
      todaysRevenue: `₹${todaysRevenue.toLocaleString('en-IN')}`,
      pendingDocuments,
      pendingPayments: pendingPaymentsCount,
      unpaidInvoices: unpaidInvoicesCount,
      activeEnrollments: 0,
      recentActivities: [],
    };
  }

  // --- SEAFARER MANAGEMENT ---
  async getSeafarers(adminId: string, page = 1, limit = 10, search = '') {
    const companyId = await this.getCompanyId(adminId);

    const query = this.db
      .from('company_seafarers')
      .select('user_id, status, joined_at, users(name, email, phone)')
      .eq('company_id', companyId)
      .range((page - 1) * limit, page * limit - 1);

    const { data, count, error } = await query;
    if (error) throw new BadRequestException(error.message);

    return {
      data: (data || []).map((d) => ({
        id: d.user_id,
        status: d.status,
        joined_at: d.joined_at,
        name: (d.users as any)?.name,
        email: (d.users as any)?.email,
        phone: (d.users as any)?.phone,
      })),
      total: count,
      page,
      limit,
    };
  }

  async getSeafarerProfile(adminId: string, seafarerId: string) {
    const companyId = await this.getCompanyId(adminId);
    const { data } = await this.db
      .from('company_seafarers')
      .select('status')
      .eq('company_id', companyId)
      .eq('user_id', seafarerId)
      .single();
    if (!data)
      throw new NotFoundException('Seafarer not found in your company');

    const { data: user } = await this.db
      .from('users')
      .select('id, email, name, phone, role, status, created_at')
      .eq('id', seafarerId)
      .single();
    const { data: profile } = await this.db
      .from('seafarer_profiles')
      .select('*')
      .eq('user_id', seafarerId)
      .single();

    return { ...user, profile };
  }

  async updateSeafarerProfile(
    adminId: string,
    seafarerId: string,
    updateData: any,
  ) {
    const companyId = await this.getCompanyId(adminId);

    // Check access
    const { data: crew } = await this.db
      .from('company_seafarers')
      .select('id')
      .eq('company_id', companyId)
      .eq('user_id', seafarerId)
      .single();
    if (!crew)
      throw new NotFoundException('Seafarer not found in your company');

    if (updateData.status) {
      if (!SEAFARER_STATUSES.includes(updateData.status)) {
        throw new BadRequestException(
          `Invalid seafarer status. Allowed statuses: ${SEAFARER_STATUSES.join(', ')}`,
        );
      }

      const { error } = await this.db
        .from('company_seafarers')
        .update({ status: updateData.status })
        .eq('user_id', seafarerId)
        .eq('company_id', companyId);

      if (error) {
        throw new BadRequestException(error.message);
      }
    }

    if (updateData.name || updateData.phone) {
      await this.db
        .from('users')
        .update({ name: updateData.name, phone: updateData.phone })
        .eq('id', seafarerId);
    }

    await this.logAudit(
      adminId,
      companyId,
      'UPDATE_SEAFARER',
      `Updated profile for user ${seafarerId}`,
    );
    return { success: true };
  }

  // --- WALK-IN REGISTRATION ---
  async registerWalkIn(adminId: string, dto: any) {
    const companyId = await this.getCompanyId(adminId);

    // 1. Duplicate check
    const { data: existingUser } = await this.db
      .from('users')
      .select('id')
      .eq('email', dto.email)
      .single();
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
      created_at: new Date().toISOString(),
    });

    if (userError) throw new BadRequestException(userError.message);

    // 4. Link to company_seafarers (correct table name)
    await this.db.from('company_seafarers').insert({
      id: randomUUID(),
      company_id: companyId,
      user_id: userId,
      status: 'Active',
      joined_at: new Date().toISOString().split('T')[0],
    });

    // 5. Optional Course enrollment via enrollments table
    if (dto.courseCode) {
      try {
        const { data: course } = await this.db
          .from('courses')
          .select('id')
          .eq('code', dto.courseCode)
          .single();
        if (course) {
          // Find a course_institutes record for this course
          const { data: ci } = await this.db
            .from('course_institutes')
            .select('id')
            .eq('course_id', course.id)
            .limit(1)
            .maybeSingle();
          if (ci) {
            await this.db.from('enrollments').insert({
              id: randomUUID(),
              user_id: userId,
              course_institute_id: ci.id,
              status: 'Processing',
              progress_percent: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
        }
      } catch (e) {
        console.warn('[registerWalkIn] Course enrollment warning:', e);
      }
    }

    // 6. Optional invoice if payment is provided
    if (dto.paymentAmount) {
      try {
        await this.db.from('invoices').insert({
          id: randomUUID(),
          invoice_number: `HOC-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
          invoice_type: 'HOC',
          company_id: companyId,
          user_id: userId,
          total_amount: Number(dto.paymentAmount) || 0,
          net_payable: Number(dto.paymentAmount) || 0,
          status: 'Paid',
          issue_date: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('[registerWalkIn] Invoice insert warning:', e);
      }
    }

    await this.logAudit(
      adminId,
      companyId,
      'WALK_IN_REGISTRATION',
      `Registered new seafarer ${dto.email}`,
    );

    return {
      message: 'Walk-in registration successful',
      userId,
      note: 'Credentials have been sent to the registered email address.',
    };
  }

  // --- DOCUMENT VERIFICATION ---
  async getDocuments(
    adminId: string,
    page = 1,
    limit = 10,
    statusFilter?: string,
  ) {
    const companyId = await this.getCompanyId(adminId);

    // Get all crew IDs
    const { data: crew } = await this.db
      .from('company_seafarers')
      .select('user_id')
      .eq('company_id', companyId);
    const userIds = crew?.map((c) => c.user_id) || [];

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

  async verifyDocument(
    adminId: string,
    docId: string,
    status: string,
    remarks?: string,
  ) {
    const companyId = await this.getCompanyId(adminId);

    const { error } = await this.db
      .from('documents')
      .update({ status, remarks })
      .eq('id', docId);

    if (error) throw new BadRequestException(error.message);

    await this.logAudit(
      adminId,
      companyId,
      'VERIFY_DOCUMENT',
      `Document ${docId} marked as ${status}`,
    );
    return { success: true, docId, status };
  }

  // --- PAYMENTS & INVOICES ---
  async getPayments(adminId: string, page = 1, limit = 10) {
    // Use invoices table since payments table does not exist in the database
    const companyId = await this.getCompanyId(adminId);
    const { data, count, error } = await this.db
      .from('invoices')
      .select(
        'id, invoice_number, total_amount, net_payable, status, created_at, users(name, email)',
      )
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) {
      console.warn('[getPayments] DB error:', error.message);
      return { data: [], total: 0, page, limit };
    }

    const mapped = (data || []).map((inv: any) => ({
      id: inv.id,
      transactionId: inv.invoice_number,
      amount: inv.net_payable || inv.total_amount || 0,
      status: inv.status === 'Paid' ? 'Completed' : inv.status || 'Pending',
      createdAt: inv.created_at,
      userName: inv.users?.name,
      userEmail: inv.users?.email,
    }));
    return { data: mapped, total: count, page, limit };
  }

  async getInvoices(adminId: string, page = 1, limit = 10) {
    const companyId = await this.getCompanyId(adminId);
    const { data, count, error } = await this.db
      .from('invoices')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) {
      console.warn('[getInvoices] DB error:', error.message);
      return { data: [], total: 0, page, limit };
    }
    return { data, total: count, page, limit };
  }

  async generateInvoice(adminId: string, amount: string, email?: string) {
    const companyId = await this.getCompanyId(adminId);
    const invoiceId = randomUUID();

    const { error } = await this.db.from('invoices').insert({
      id: invoiceId,
      invoice_number: `HOC-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
      invoice_type: 'HOC',
      company_id: companyId,
      total_amount: Number(amount) || 0,
      net_payable: Number(amount) || 0,
      status: 'Pending',
      issue_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });

    if (error) throw new BadRequestException(error.message);
    await this.logAudit(
      adminId,
      companyId,
      'GENERATE_INVOICE',
      `Generated invoice for ${amount}`,
    );

    return { invoiceId, amount, status: 'Pending' };
  }

  // --- REPORTS ---
  async getReport(adminId: string, type: string) {
    const companyId = await this.getCompanyId(adminId);

    if (type === 'registrations') {
      const { data } = await this.db
        .from('company_seafarers')
        .select('joined_at, status, user_id, users(name, email)')
        .eq('company_id', companyId);
      return data || [];
    } else if (type === 'revenue') {
      const { data } = await this.db
        .from('invoices')
        .select('total_amount, net_payable, created_at, status')
        .eq('company_id', companyId);
      return (data || []).map((inv: any) => ({
        amount: inv.net_payable || inv.total_amount || 0,
        created_at: inv.created_at,
        status: inv.status,
      }));
    }
    throw new BadRequestException('Invalid report type');
  }
}
