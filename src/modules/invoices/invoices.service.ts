import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class InvoicesService {
  private storageFilePath = path.join(process.cwd(), 'invoices_data.json');
  private inMemoryInvoices: any[] = [];

  constructor(private readonly supabaseService: SupabaseService) {
    this.loadInvoicesFromDisk();
  }

  private get db() {
    return this.supabaseService.getClient();
  }

  private loadInvoicesFromDisk() {
    try {
      if (fs.existsSync(this.storageFilePath)) {
        const raw = fs.readFileSync(this.storageFilePath, 'utf8');
        this.inMemoryInvoices = JSON.parse(raw);
      } else {
        // Seed sample invoices if empty
        const now = new Date().toISOString();
        this.inMemoryInvoices = [
          {
            id: 'inv-hoc-sample-1',
            invoice_number: 'HOC-2026-000001',
            invoice_type: 'HOC',
            user_id: 'a0000000-0000-0000-0000-000000000001',
            purchase_id: 'purch-sample-1',
            agent_id: null,
            commission_snapshot_id: null,
            customer_name: 'Raj Kumar',
            customer_email: 'raj@example.com',
            customer_phone: '+91 98765 43210',
            agent_name: null,
            agent_referral_code: null,
            course_name: 'Basic Safety Training (BST)',
            course_fee: 12000,
            discount: 0,
            final_amount: 12000,
            payment_gateway: 'razorpay_production_mode',
            transaction_id: 'TXN-HOC-1001',
            payment_method: 'Online UPI/Card',
            payment_date: now,
            status: 'Paid',
            created_at: now,
          },
          {
            id: 'inv-hac-sample-2',
            invoice_number: 'HAC-2026-000001',
            invoice_type: 'HAC',
            user_id: 'a0000000-0000-0000-0000-000000000002',
            purchase_id: 'purch-sample-2',
            agent_id: '58f7dc83-cb27-4547-8264-ed433b557103',
            commission_snapshot_id: 'f02c3029-3897-4606-aeb0-af576e103641',
            customer_name: 'Priya Singh',
            customer_email: 'priya@example.com',
            customer_phone: '+91 99887 76655',
            agent_name: 'Agent User',
            agent_referral_code: 'REFAGENT123',
            course_name: 'Basic Safety Training (BST)',
            course_fee: 12000,
            discount: 0,
            final_amount: 12000,
            payment_gateway: 'razorpay_production_mode',
            transaction_id: 'TXN-HAC-1002',
            payment_method: 'Online UPI/Card',
            payment_date: now,
            status: 'Paid',
            created_at: now,
          },
        ];
        this.saveInvoicesToDisk();
      }
    } catch (e) {
      console.error('Error loading invoices from disk:', e);
    }
  }

  private saveInvoicesToDisk() {
    try {
      fs.writeFileSync(this.storageFilePath, JSON.stringify(this.inMemoryInvoices, null, 2), 'utf8');
    } catch (e) {
      console.error('Error saving invoices to disk:', e);
    }
  }

  // Log invoice activities to audit_logs
  async logAction(
    userId: string,
    userName: string,
    action: string,
    entityId: string,
    details: string,
    ipAddress = '127.0.0.1',
  ) {
    try {
      await this.db.from('audit_logs').insert({
        id: randomUUID(),
        user_id: userId,
        user_name: userName,
        action,
        module: 'Invoices',
        entity_id: entityId,
        details,
        ip_address: ipAddress,
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Audit log write warning:', e);
    }
  }

  // --- 1. Automatic Idempotent Invoice Generation ---
  async generateInvoice(params: {
    userId: string;
    purchaseId: string;
    agentId?: string;
    commissionSnapshotId?: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    agentName?: string;
    agentReferralCode?: string;
    courseName: string;
    courseFee: number;
    discount?: number;
    finalAmount: number;
    paymentGateway?: string;
    transactionId: string;
    paymentMethod?: string;
    paymentDate?: string;
  }) {
    const {
      userId,
      purchaseId,
      agentId,
      commissionSnapshotId,
      customerName,
      customerEmail,
      customerPhone,
      agentName,
      agentReferralCode,
      courseName,
      courseFee,
      discount = 0,
      finalAmount,
      paymentGateway = 'razorpay_production_mode',
      transactionId,
      paymentMethod = 'Online UPI/Card',
      paymentDate = new Date().toISOString(),
    } = params;

    // 1. Idempotency Check
    const existingInMem = this.inMemoryInvoices.find(i => i.transaction_id === transactionId);
    if (existingInMem) {
      console.log(`[Invoice] Duplicate payment callback ignored for transactionId: ${transactionId}`);
      return existingInMem;
    }

    // 2. Determine Invoice Type (HOC vs HAC)
    const isHac = !!(agentId || agentReferralCode || commissionSnapshotId);
    const invoiceType = isHac ? 'HAC' : 'HOC';

    // 3. Generate Sequential Unique Invoice Number
    const currentYear = new Date().getFullYear();
    const prefix = `${invoiceType}-${currentYear}-`;
    const count = this.inMemoryInvoices.filter(i => i.invoice_type === invoiceType).length;
    const seqNum = String(count + 1).padStart(6, '0');
    const invoiceNumber = `${prefix}${seqNum}`;

    const invoiceId = randomUUID();
    const createdAt = new Date().toISOString();

    const invoiceObj = {
      id: invoiceId,
      invoice_number: invoiceNumber,
      invoice_type: invoiceType,
      user_id: userId,
      purchase_id: purchaseId,
      agent_id: agentId || null,
      commission_snapshot_id: commissionSnapshotId || null,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      agent_name: agentName || null,
      agent_referral_code: agentReferralCode || null,
      course_name: courseName,
      course_fee: courseFee,
      discount,
      final_amount: finalAmount,
      payment_gateway: paymentGateway,
      transaction_id: transactionId,
      payment_method: paymentMethod,
      payment_date: paymentDate,
      status: 'Paid',
      created_at: createdAt,
    };

    // Save locally
    this.inMemoryInvoices.unshift(invoiceObj);
    this.saveInvoicesToDisk();

    // Attempt DB insert silently
    try {
      await this.db.from('invoices').insert(invoiceObj);
    } catch (e) {
      console.warn('Supabase invoice insert warning:', e);
    }

    await this.logAction(
      userId,
      customerName,
      'INVOICE_GENERATED',
      invoiceNumber,
      `Generated ${invoiceType} Invoice ${invoiceNumber} for ${courseName} (Amount: ₹${finalAmount.toLocaleString('en-IN')})`
    );

    return invoiceObj;
  }

  // --- 2. List Invoices with Role-Based Scope, Search & Filtering ---
  async getInvoices(user: any, query: any = {}) {
    const { search, type, status, course, startDate, endDate } = query;
    const roleNorm = (user?.role || '').toUpperCase().replace('-', '_');

    let invoiceList: any[] = [];

    try {
      let dbQuery = this.db.from('invoices').select('*').order('created_at', { ascending: false });

      if (roleNorm === 'SEAFARER') {
        dbQuery = dbQuery.eq('user_id', user.id);
      } else if (roleNorm === 'AGENT') {
        dbQuery = dbQuery.eq('agent_id', user.id);
      }

      if (type && type !== 'all') {
        dbQuery = dbQuery.eq('invoice_type', type.toUpperCase());
      }
      if (status && status !== 'all') {
        dbQuery = dbQuery.ilike('status', status);
      }
      if (course && course !== 'all') {
        dbQuery = dbQuery.ilike('course_name', `%${course}%`);
      }
      if (startDate) {
        dbQuery = dbQuery.gte('created_at', new Date(startDate).toISOString());
      }
      if (endDate) {
        dbQuery = dbQuery.lte('created_at', new Date(endDate).toISOString());
      }

      const { data: invoices, error } = await dbQuery;

      if (!error && invoices && invoices.length > 0) {
        invoiceList = invoices;
      } else {
        invoiceList = this.filterInMemoryInvoices(user, query);
      }
    } catch (e) {
      console.warn('[Invoices] DB query fallback to memory:', e);
      invoiceList = this.filterInMemoryInvoices(user, query);
    }

    // In-memory Search
    if (search && search.trim().length > 0) {
      const q = search.trim().toLowerCase();
      invoiceList = invoiceList.filter(
        (inv: any) =>
          inv.invoice_number?.toLowerCase().includes(q) ||
          inv.customer_name?.toLowerCase().includes(q) ||
          inv.transaction_id?.toLowerCase().includes(q) ||
          inv.agent_name?.toLowerCase().includes(q)
      );
    }

    // Fetch referral leads to match registration/lead converted date for AGENT
    let leads: any[] = [];
    if (roleNorm === 'AGENT' && user?.id) {
      try {
        const { data } = await this.db
          .from('referral_leads')
          .select('name, created_at')
          .eq('agent_id', user.id);
        if (data) leads = data;
      } catch (e) {
        console.warn('Failed to fetch leads for invoice converted_at mapping:', e);
      }
    }

    const leadsMap = new Map();
    leads.forEach((l: any) => {
      if (l.name) {
        leadsMap.set(l.name.toLowerCase().trim(), l.created_at);
      }
    });

    return invoiceList.map((inv: any) => {
      const seafarerKey = (inv.customer_name || "").toLowerCase().trim();
      const convertedAt = leadsMap.get(seafarerKey) || inv.created_at;
      return {
        ...inv,
        converted_at: convertedAt
      };
    });
  }

  private filterInMemoryInvoices(user: any, query: any) {
    const { type, status, course, startDate, endDate } = query;
    const roleNorm = (user?.role || '').toUpperCase().replace('-', '_');

    return this.inMemoryInvoices.filter(inv => {
      if (roleNorm === 'SEAFARER' && inv.user_id !== user?.id) return false;
      if (roleNorm === 'AGENT' && inv.agent_id !== user?.id) return false;
      if (type && type !== 'all' && inv.invoice_type?.toUpperCase() !== type.toUpperCase()) return false;
      if (status && status !== 'all' && inv.status?.toLowerCase() !== status.toLowerCase()) return false;
      if (course && course !== 'all' && !inv.course_name?.toLowerCase().includes(course.toLowerCase())) return false;
      if (startDate && new Date(inv.created_at) < new Date(startDate)) return false;
      if (endDate && new Date(inv.created_at) > new Date(endDate)) return false;
      return true;
    });
  }

  // --- 3. View Invoice Details ---
  async getInvoiceById(id: string, user: any) {
    let invoice: any = null;

    try {
      const { data, error } = await this.db
        .from('invoices')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        invoice = data;
      }
    } catch (e) {
      console.warn('[Invoices] DB getById fallback to memory');
    }

    if (!invoice) {
      invoice = this.inMemoryInvoices.find(i => i.id === id || i.invoice_number === id);
    }

    if (!invoice) throw new NotFoundException('Invoice not found');

    const roleNorm = (user?.role || '').toUpperCase().replace('-', '_');
    if (roleNorm === 'SEAFARER' && invoice.user_id !== user.id) {
      throw new ForbiddenException('You are not authorized to view this invoice');
    }
    if (roleNorm === 'AGENT' && invoice.agent_id !== user.id) {
      throw new ForbiddenException('You are not authorized to view this invoice');
    }

    let commissionSnapshot = null;
    if (invoice.commission_snapshot_id) {
      try {
        const { data: comm } = await this.db
          .from('commissions')
          .select('*')
          .eq('id', invoice.commission_snapshot_id)
          .maybeSingle();
        commissionSnapshot = comm;
      } catch (e) {
        console.warn('Commission snapshot lookup warning:', e);
      }
    }

    await this.logAction(
      user.id,
      user.name || 'User',
      'INVOICE_VIEWED',
      invoice.invoice_number,
      `Viewed invoice details for ${invoice.invoice_number}`
    );

    return {
      ...invoice,
      commissionSnapshot,
    };
  }

  // --- 4. Get Printable PDF Data ---
  async getInvoicePdf(id: string, user: any) {
    const invoiceDetails = await this.getInvoiceById(id, user);

    let settings: any = null;
    try {
      const { data } = await this.db.from('settings').select('*').limit(1).maybeSingle();
      settings = data;
    } catch (e) {
      console.warn('Settings lookup warning:', e);
    }

    await this.logAction(
      user.id,
      user.name || 'User',
      'PDF_DOWNLOADED',
      invoiceDetails.invoice_number,
      `Downloaded PDF for invoice ${invoiceDetails.invoice_number}`
    );

    return {
      invoice: invoiceDetails,
      company: {
        name: 'Hari Om Thalassic Maritime Training Institute',
        address: 'Suite 404, Marine Trade Tower, Ballard Estate, Mumbai, Maharashtra 400001',
        email: settings?.system_email || 'support@hariomthalassic.com',
        phone: settings?.contact_phone || '+91 22 12345678',
        dgsAccreditationId: settings?.dgs_accreditation_id || 'DGS-MTI-10294',
        gstin: '27AABCH1234F1Z5',
      },
      terms: [
        'Fees once paid are non-refundable except under DGS guidelines.',
        'Please retain this tax invoice for certificate verification.',
        'This is a computer-generated tax invoice and requires no physical signature.',
      ],
    };
  }

  // --- 5. Export Invoices ---
  async exportInvoices(user: any, query: any = {}) {
    const list = await this.getInvoices(user, query);

    await this.logAction(
      user.id,
      user.name || 'User',
      'INVOICE_EXPORTED',
      'EXPORT',
      `Exported invoice report (${list.length} records)`
    );

    return list.map((inv: any) => ({
      'Invoice Number': inv.invoice_number,
      'Invoice Type': inv.invoice_type,
      'Invoice Status': inv.status,
      'Invoice Date': new Date(inv.created_at).toLocaleDateString('en-IN'),
      'Payment Date': new Date(inv.payment_date).toLocaleDateString('en-IN'),
      'Seafarer Name': inv.customer_name,
      'Seafarer Email': inv.customer_email,
      'Seafarer Phone': inv.customer_phone,
      'Course Name': inv.course_name,
      'Course Fee': `₹${inv.course_fee.toLocaleString('en-IN')}`,
      'Discount': `₹${inv.discount.toLocaleString('en-IN')}`,
      'Final Amount': `₹${inv.final_amount.toLocaleString('en-IN')}`,
      'Payment Gateway': inv.payment_gateway,
      'Transaction ID': inv.transaction_id,
      'Payment Method': inv.payment_method,
      'Referring Agent': inv.agent_name || 'N/A',
      'Agent Referral Code': inv.agent_referral_code || 'N/A',
    }));
  }

  // --- 6. Invoice Immutability Protection ---
  async updateInvoice() {
    throw new BadRequestException('PRD 10.8 Violation: Generated invoices are immutable and cannot be updated.');
  }

  async deleteInvoice() {
    throw new BadRequestException('PRD 10.8 Violation: Historical invoices cannot be deleted.');
  }
}
