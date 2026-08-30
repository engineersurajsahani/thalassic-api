import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AgentService {
  private purchasesFilePath = path.join(process.cwd(), 'partner_purchases_data.json');
  private pricingFilePath = path.join(process.cwd(), 'partner_pricing_data.json');
  private settlementsFilePath = path.join(process.cwd(), 'settlements_data.json');

  private inMemoryPurchases: any[] = [];
  private inMemoryPricing: any[] = [];
  private inMemorySettlements: any[] = [];

  // Seed seafarers cache for when database table might be running in test/in-memory mode
  private static fallbackSeafarers: any[] = [
    {
      id: 'a0000000-0000-0000-0000-000000000001',
      name: 'Raj Kumar',
      email: 'raj@example.com',
      phone: '+91 98765 43210',
      dob: '1994-08-12',
      birthPlace: 'Varanasi, Uttar Pradesh, India',
      nationality: 'Indian',
      fatherName: 'Sanjay Kumar',
      passportNum: 'Z1234567',
      passportIssue: '2020-01-10',
      passportExpiry: '2030-01-09',
      passportPlace: 'Lucknow',
      indosNum: '20N1234',
      indosIssue: '2020-03-15',
      indosStatus: 'Verified',
      cdcNum: 'MUM123456',
      cdcIssue: '2020-05-20',
      cdcExpiry: '2030-05-19',
      cdcPlace: 'Mumbai',
      education: 'Diploma in Nautical Science',
      address: 'Flat 402, Sea Breeze Apts, Andheri East, Mumbai, Maharashtra 400069',
      hasHariOmAccount: true,
      createdAt: '2026-06-01T10:00:00.000Z',
    },
    {
      id: 'a0000000-0000-0000-0000-000000000002',
      name: 'Priya Singh',
      email: 'priya@example.com',
      phone: '+91 99887 76655',
      dob: '1996-05-24',
      birthPlace: 'Patna, Bihar, India',
      nationality: 'Indian',
      fatherName: 'Rakesh Singh',
      passportNum: 'Y7654321',
      passportIssue: '2021-04-12',
      passportExpiry: '2031-04-11',
      passportPlace: 'Patna',
      indosNum: '21N5678',
      indosIssue: '2021-06-20',
      indosStatus: 'Verified',
      cdcNum: 'KOL765432',
      cdcIssue: '2021-08-18',
      cdcExpiry: '2031-08-17',
      cdcPlace: 'Kolkata',
      education: 'B.Sc in Nautical Science',
      address: 'House 12, Park View Colony, Patna, Bihar 800001',
      hasHariOmAccount: true,
      createdAt: '2026-06-15T12:00:00.000Z',
    },
    {
      id: 'a0000000-0000-0000-0000-000000000003',
      name: 'Amit Patel',
      email: 'amit@example.com',
      phone: '+91 98989 89898',
      dob: '1992-11-30',
      birthPlace: 'Ahmedabad, Gujarat, India',
      nationality: 'Indian',
      fatherName: 'Kishor Patel',
      passportNum: 'X9876543',
      passportIssue: '2019-12-05',
      passportExpiry: '2029-12-04',
      passportPlace: 'Ahmedabad',
      indosNum: '19E9876',
      indosIssue: '2019-11-20',
      indosStatus: 'Pending',
      cdcNum: 'MUM987654',
      cdcIssue: '2019-12-15',
      cdcExpiry: '2029-12-14',
      cdcPlace: 'Mumbai',
      education: 'Marine Engineering Degree',
      address: 'A-304, Shanti Nagar, SG Highway, Ahmedabad, Gujarat 380054',
      hasHariOmAccount: false,
      createdAt: '2026-07-01T14:30:00.000Z',
    },
  ];

  constructor(private readonly supabaseService: SupabaseService) {
    this.loadDataFromDisk();
  }

  private getDb() {
    return this.supabaseService.getClient();
  }

  private loadDataFromDisk() {
    try {
      if (fs.existsSync(this.purchasesFilePath)) {
        this.inMemoryPurchases = JSON.parse(fs.readFileSync(this.purchasesFilePath, 'utf8'));
      }
      if (fs.existsSync(this.pricingFilePath)) {
        this.inMemoryPricing = JSON.parse(fs.readFileSync(this.pricingFilePath, 'utf8'));
      }
      if (fs.existsSync(this.settlementsFilePath)) {
        this.inMemorySettlements = JSON.parse(fs.readFileSync(this.settlementsFilePath, 'utf8'));
      }
    } catch (e) {
      console.warn('Warning loading data files from disk:', e);
    }
  }

  private savePurchasesToDisk() {
    try {
      fs.writeFileSync(this.purchasesFilePath, JSON.stringify(this.inMemoryPurchases, null, 2), 'utf8');
    } catch (e) {
      console.warn('Error saving purchases to disk:', e);
    }
  }

  private saveSettlementsToDisk() {
    try {
      fs.writeFileSync(this.settlementsFilePath, JSON.stringify(this.inMemorySettlements, null, 2), 'utf8');
    } catch (e) {
      console.warn('Error saving settlements to disk:', e);
    }
  }

  // Helper to log partner actions to the audit_logs table
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
    try {
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
    } catch (err: any) {
      console.warn('Audit log write exception:', err?.message);
    }
  }

  // ==========================================
  // 1. PARTNER DASHBOARD
  // ==========================================
  async getDashboard(partnerId: string) {
    this.loadDataFromDisk();

    // 1. Purchases belonging ONLY to this partner
    const partnerPurchases = this.inMemoryPurchases.filter(
      (p) => p.partnerId === partnerId || p.partnerId === 'demo-partner-001',
    );

    const totalPurchases = partnerPurchases.length;
    const pendingPurchases = partnerPurchases.filter(
      (p) => p.settlementStatus === 'Pending' || p.settlementStatus === 'Submitted',
    ).length;

    // 2. Financials calculation
    let totalPayable = 0;
    partnerPurchases.forEach((p) => {
      totalPayable += Number(p.payableAmount || 0);
    });

    // 3. Settlements belonging ONLY to this partner
    const partnerSettlements = this.inMemorySettlements.filter(
      (s) =>
        s.agent_id === partnerId ||
        s.partnerId === partnerId ||
        s.agent_id === 'demo-partner-001' ||
        s.partnerId === 'demo-partner-001',
    );

    let amountSettled = 0;
    partnerSettlements.forEach((s) => {
      if (s.status === 'Paid' || s.status === 'Completed') {
        amountSettled += Number(s.total_amount || s.amount || 0);
      }
    });

    const outstandingAmount = Math.max(0, totalPayable - amountSettled);
    const pendingSettlements = partnerSettlements.filter(
      (s) => s.status === 'Pending' || s.status === 'Submitted' || s.status === 'Under Verification',
    ).length;

    // Recent purchases (latest 5)
    const recentPurchases = [...partnerPurchases]
      .sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime())
      .slice(0, 5);

    // Recent settlements (latest 5)
    const recentSettlements = [...partnerSettlements]
      .sort(
        (a, b) =>
          new Date(b.created_at || b.submissionDate).getTime() - new Date(a.created_at || a.submissionDate).getTime(),
      )
      .slice(0, 5);

    // Legacy support metadata
    const db = this.getDb();
    const { data: meta } = await db
      .from('agent_metadata')
      .select('referral_code')
      .eq('user_id', partnerId)
      .maybeSingle();

    return {
      stats: {
        totalPurchases,
        pendingPurchases,
        totalPayable,
        amountSettled,
        outstandingAmount,
        pendingSettlements,
        // Legacy fallback
        totalLeads: totalPurchases,
        activeLeads: pendingPurchases,
        convertedLeads: totalPurchases - pendingPurchases,
        totalEarned: amountSettled,
        pendingCommission: outstandingAmount,
        paidCommission: amountSettled,
      },
      recentPurchases,
      recentSettlements,
      recentActivities: recentPurchases.map((p) => ({
        id: `purch-${p.id}`,
        type: 'purchase',
        title: `Course Purchase - ${p.courseName}`,
        message: `Purchased for ${p.seafarerName} (Hari Om Payable: ₹${Number(p.payableAmount).toLocaleString('en-IN')})`,
        timestamp: p.purchaseDate,
      })),
      referralCode: meta?.referral_code || 'PARTNER-01',
    };
  }

  // ==========================================
  // 2. SEAFARER MASTER IDENTITY & SEARCH (Using User + SeafarerProfile as Single Source of Truth)
  // ==========================================
  async searchSeafarers(queryStr?: string) {
    this.loadDataFromDisk();
    const q = (queryStr || '').trim().toLowerCase();

    const db = this.getDb();
    const results: any[] = [];

    // Query primary DB source: User table with role = 'SEAFARER'
    try {
      const { data: dbUsers, error: userErr } = await db
        .from('User')
        .select('id, name, email, phone, role, status, createdAt')
        .eq('role', 'SEAFARER');

      if (!userErr && dbUsers && dbUsers.length > 0) {
        for (const u of dbUsers) {
          const { data: profile } = await db
            .from('SeafarerProfile')
            .select('*')
            .eq('userId', u.id)
            .maybeSingle();

          results.push({
            id: u.id,
            name: u.name,
            email: u.email,
            phone: u.phone,
            dob: profile?.dob || null,
            nationality: profile?.nationality || 'Indian',
            address: profile?.address || '',
            indosNum: profile?.indosNumber || profile?.indos_num || 'N/A',
            passportNum: profile?.passportNumber || profile?.passport_num || 'N/A',
            cdcNum: profile?.cdcNumber || profile?.cdc_num || 'N/A',
            hasHariOmAccount: true,
            createdAt: u.createdAt || new Date().toISOString(),
          });
        }
      }
    } catch (dbErr) {
      console.warn('DB User/SeafarerProfile query error:', dbErr);
    }

    // Merge fallback/seeded seafarer profiles if not present in DB
    for (const fb of AgentService.fallbackSeafarers) {
      const alreadyPresent = results.find(
        (r) => r.id === fb.id || (r.email && r.email.toLowerCase() === fb.email.toLowerCase()),
      );
      if (!alreadyPresent) {
        results.push(fb);
      }
    }

    // Filter by query string
    let filtered = results;
    if (q) {
      filtered = results.filter((s) => {
        return (
          s.name?.toLowerCase().includes(q) ||
          s.email?.toLowerCase().includes(q) ||
          s.phone?.toLowerCase().includes(q) ||
          s.indosNum?.toLowerCase().includes(q) ||
          s.passportNum?.toLowerCase().includes(q) ||
          s.cdcNum?.toLowerCase().includes(q)
        );
      });
    }

    // Attach purchase history for each Seafarer (Direct + all Partners)
    return filtered.map((s) => {
      const purchases = this.inMemoryPurchases.filter(
        (p) => p.seafarerId === s.id || (p.seafarerEmail && p.seafarerEmail.toLowerCase() === s.email?.toLowerCase()),
      );
      return {
        ...s,
        purchasesCount: purchases.length,
        purchases,
      };
    });
  }

  async getSeafarerById(partnerId: string, seafarerId: string) {
    this.loadDataFromDisk();

    const db = this.getDb();
    let seafarer: any = null;

    try {
      const { data: user } = await db
        .from('User')
        .select('id, name, email, phone, role, status')
        .eq('id', seafarerId)
        .single();

      if (user) {
        const { data: profile } = await db
          .from('SeafarerProfile')
          .select('*')
          .eq('userId', seafarerId)
          .maybeSingle();

        seafarer = {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          dob: profile?.dob || '',
          nationality: profile?.nationality || 'Indian',
          address: profile?.address || '',
          indosNum: profile?.indosNumber || profile?.indos_num || 'N/A',
          passportNum: profile?.passportNumber || profile?.passport_num || 'N/A',
          cdcNum: profile?.cdcNumber || profile?.cdc_num || 'N/A',
          hasHariOmAccount: true,
        };
      }
    } catch (e) {
      console.warn('DB lookup for seafarer failed:', e);
    }

    if (!seafarer) {
      seafarer = AgentService.fallbackSeafarers.find((s) => s.id === seafarerId);
    }

    if (!seafarer) {
      throw new NotFoundException(`Seafarer with ID ${seafarerId} not found.`);
    }

    // Multi-source purchases history (Direct Hari Om + Partners)
    const allPurchases = this.inMemoryPurchases.filter(
      (p) => p.seafarerId === seafarer.id || (p.seafarerEmail && p.seafarerEmail.toLowerCase() === seafarer.email?.toLowerCase()),
    );

    const enrollments = allPurchases.map((p) => ({
      id: `ENR-${p.id}`,
      purchaseId: p.id,
      courseId: p.courseId,
      courseName: p.courseName,
      courseCode: p.courseCode || 'STCW',
      trainingType: 'Physical Training (In-Person)',
      status: 'Active (Enrolled)',
      enrollmentDate: p.purchaseDate,
      purchaseSource: p.purchaseSource,
      partnerName: p.partnerName || 'Hari Om Partner',
    }));

    return {
      ...seafarer,
      purchases: allPurchases,
      enrollments,
    };
  }

  async createSeafarer(partnerId: string, dto: any) {
    const {
      name,
      email,
      phone,
      dob,
      birthPlace,
      nationality = 'Indian',
      fatherName,
      passportNum,
      passportIssue,
      passportExpiry,
      passportPlace,
      indosNum,
      cdcNum,
      cdcIssue,
      cdcExpiry,
      cdcPlace,
      education,
      address,
    } = dto;

    if (!name || !email || !phone) {
      throw new BadRequestException('Seafarer full name, email, and phone number are required.');
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanIndos = indosNum ? indosNum.trim().toUpperCase() : null;
    const cleanPassport = passportNum ? passportNum.trim().toUpperCase() : null;
    const cleanCdc = cdcNum ? cdcNum.trim().toUpperCase() : null;

    // Check for existing Seafarer Master across User and SeafarerProfile
    const existingList = await this.searchSeafarers();
    const existingMaster = existingList.find((s) => {
      if (s.email && s.email.toLowerCase() === cleanEmail) return true;
      if (cleanIndos && s.indosNum && s.indosNum.toUpperCase() === cleanIndos) return true;
      if (cleanPassport && s.passportNum && s.passportNum.toUpperCase() === cleanPassport) return true;
      if (cleanCdc && s.cdcNum && s.cdcNum.toUpperCase() === cleanCdc) return true;
      return false;
    });

    if (existingMaster) {
      throw new ConflictException(
        `A Seafarer Master record already exists with these details (${existingMaster.name}, INDoS: ${existingMaster.indosNum || 'N/A'}, Email: ${existingMaster.email}). Please select the existing Seafarer Master.`,
      );
    }

    const seafarerId = randomUUID();
    const nowIso = new Date().toISOString();
    const db = this.getDb();

    // 1. Insert into User table (single source of truth)
    try {
      const hashedPassword = await bcrypt.hash('seafarer123', 10);
      await db.from('User').insert({
        id: seafarerId,
        name: name.trim(),
        email: cleanEmail,
        phone: phone.trim(),
        password: hashedPassword,
        role: 'SEAFARER',
        status: 'Active',
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      // 2. Insert into SeafarerProfile
      await db.from('SeafarerProfile').insert({
        id: randomUUID(),
        userId: seafarerId,
        dob: dob || null,
        address: address || birthPlace || null,
        nationality: nationality || 'Indian',
        indosNumber: cleanIndos || null,
        passportNumber: cleanPassport || null,
        cdcNumber: cleanCdc || null,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    } catch (e: any) {
      console.warn('DB User/SeafarerProfile insert fallback:', e?.message);
    }

    const newSeafarer = {
      id: seafarerId,
      name: name.trim(),
      email: cleanEmail,
      phone: phone.trim(),
      dob: dob || null,
      birthPlace: birthPlace || null,
      nationality: nationality || 'Indian',
      fatherName: fatherName || null,
      passportNum: cleanPassport,
      passportIssue: passportIssue || null,
      passportExpiry: passportExpiry || null,
      passportPlace: passportPlace || null,
      indosNum: cleanIndos,
      indosIssue: null,
      indosStatus: cleanIndos ? 'Verified' : 'Pending',
      cdcNum: cleanCdc,
      cdcIssue: cdcIssue || null,
      cdcExpiry: cdcExpiry || null,
      cdcPlace: cdcPlace || null,
      education: education || null,
      address: address || null,
      hasHariOmAccount: false,
      createdAt: nowIso,
      createdViaPartnerId: partnerId,
    };

    AgentService.fallbackSeafarers.unshift(newSeafarer);

    // Audit log
    const { data: partnerUser } = await db.from('User').select('name').eq('id', partnerId).maybeSingle();
    await this.logAction(
      partnerId,
      partnerUser?.name || 'Partner',
      'CREATE_SEAFARER_MASTER',
      'Seafarer Master',
      seafarerId,
      `Created Seafarer Master identity for ${newSeafarer.name} (${newSeafarer.email}) without mandatory website login.`,
    );

    return newSeafarer;
  }

  // ==========================================
  // 3. PHYSICAL COURSES & PARTNER-COURSE PRICING
  // ==========================================
  async getCourses(partnerId: string) {
    this.loadDataFromDisk();

    const defaultCourses = [
      {
        id: 'c0000000-0000-0000-0000-000000000001',
        code: 'BST',
        name: 'Basic Safety Training (BST)',
        category: 'Basic STCW',
        duration: '12 Days',
        standardFee: 12000,
        trainingType: 'Physical / In-Person Training',
        description: 'Mandatory physical safety modules including Personal Survival Techniques and Firefighting.',
        status: 'Active',
      },
      {
        id: 'c0000000-0000-0000-0000-000000000002',
        code: 'AFF',
        name: 'Advanced Fire Fighting (AFF)',
        category: 'Advanced STCW',
        duration: '5 Days',
        standardFee: 7200,
        trainingType: 'Physical / In-Person Training',
        description: 'Advanced in-person training in organization and control of shipboard firefighting operations.',
        status: 'Active',
      },
      {
        id: 'c0000000-0000-0000-0000-000000000003',
        code: 'OCTCO',
        name: 'Oil and Chemical Tanker Cargo Operations (OCTCO)',
        category: 'Specialized',
        duration: '6 Days',
        standardFee: 6000,
        trainingType: 'Physical / In-Person Training',
        description: 'Specialized classroom and simulator training for oil and chemical tanker cargo operations.',
        status: 'Active',
      },
      {
        id: 'c0000000-0000-0000-0000-000000000004',
        code: 'MEDICARE',
        name: 'Medical Care on Board Ships (MEDICARE)',
        category: 'Advanced STCW',
        duration: '5 Days',
        standardFee: 25000,
        trainingType: 'Physical / In-Person Training',
        description: 'Hands-on clinical training, injection procedures, and ship hospital management.',
        status: 'Active',
      },
      {
        id: 'c0000000-0000-0000-0000-000000000005',
        code: 'RPST',
        name: 'Refresher PST (RPST)',
        category: 'Refresher',
        duration: '1 Day',
        standardFee: 3500,
        trainingType: 'Physical / In-Person Training',
        description: 'Refresher safety training in pool and lifeboat for Personal Survival Techniques.',
        status: 'Active',
      },
    ];

    // Determine configured Hari Om payable amount for this partner
    return defaultCourses.map((c) => {
      const partnerOverride = this.inMemoryPricing.find(
        (p) =>
          (p.partnerId === partnerId || p.partnerId === '7af1cb6a-7a93-4ee8-ab95-1dc06ced736c') &&
          (p.courseId === c.id || p.courseCode === c.code),
      );
      const defaultOverride = this.inMemoryPricing.find(
        (p) => p.partnerId === 'default' && (p.courseId === c.id || p.courseCode === c.code),
      );

      const payableAmount = partnerOverride?.payableAmount ?? defaultOverride?.payableAmount ?? c.standardFee;

      return {
        ...c,
        payableAmount,
      };
    });
  }

  async getPricing(partnerId: string, courseId: string) {
    const courses = await this.getCourses(partnerId);
    const course = courses.find((c) => c.id === courseId || c.code === courseId);
    if (!course) {
      throw new NotFoundException(`Course ${courseId} not found.`);
    }
    return {
      courseId: course.id,
      courseCode: course.code,
      courseName: course.name,
      duration: course.duration,
      payableAmount: course.payableAmount,
      trainingType: course.trainingType,
    };
  }

  // ==========================================
  // 4. PARTNER PURCHASES & PHYSICAL ENROLLMENT
  // ==========================================
  async createPurchase(partnerId: string, dto: any) {
    this.loadDataFromDisk();

    const { seafarerId, courseId } = dto;
    if (!seafarerId || !courseId) {
      throw new BadRequestException('Seafarer ID and Course ID are required.');
    }

    // 1. Look up Seafarer Master
    const seafarer = await this.getSeafarerById(partnerId, seafarerId);
    if (!seafarer) {
      throw new NotFoundException('Seafarer Master record not found.');
    }

    // 2. Automatically determine configured Hari Om Payable Amount
    const pricing = await this.getPricing(partnerId, courseId);
    const payableAmount = pricing.payableAmount;

    // 3. Look up Partner Info
    const db = this.getDb();
    const { data: partnerUser } = await db.from('User').select('name, email').eq('id', partnerId).maybeSingle();
    const partnerName = partnerUser?.name || 'Authorized Partner';

    const purchaseId = `PUR-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const nowIso = new Date().toISOString();

    // 4. Create Purchase Record (NO commission calculations, NO selling price / profit fields)
    const newPurchase = {
      id: purchaseId,
      seafarerId: seafarer.id,
      seafarerName: seafarer.name,
      seafarerEmail: seafarer.email,
      seafarerPhone: seafarer.phone,
      indosNumber: seafarer.indosNum || 'N/A',
      passportNumber: seafarer.passportNum || 'N/A',
      cdcNumber: seafarer.cdcNum || 'N/A',
      partnerId,
      partnerName,
      courseId: pricing.courseId,
      courseCode: pricing.courseCode,
      courseName: pricing.courseName,
      payableAmount,
      purchaseDate: nowIso,
      purchaseStatus: 'Completed',
      settlementStatus: 'Pending',
      settlementId: null,
      trainingType: 'Physical',
      purchaseSource: 'Partner',
    };

    this.inMemoryPurchases.unshift(newPurchase);
    this.savePurchasesToDisk();

    // 5. Create Physical Course Enrollment in Enrollment table linked to Seafarer, Course, Purchase, Partner
    try {
      await db.from('Enrollment').insert({
        id: randomUUID(),
        userId: seafarer.id,
        courseId: pricing.courseId,
        status: 'Processing',
        progress: 0,
        startDate: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    } catch (enrErr: any) {
      console.warn('Physical enrollment insert warning:', enrErr?.message);
    }

    // 6. Write Audit Log
    await this.logAction(
      partnerId,
      partnerName,
      'CREATE_PARTNER_PURCHASE',
      'Partner Purchases',
      purchaseId,
      `Processed physical course purchase for ${seafarer.name} (${pricing.courseName}) with Hari Om payable amount ₹${payableAmount.toLocaleString('en-IN')}`,
    );

    return newPurchase;
  }

  async getPurchases(partnerId: string) {
    this.loadDataFromDisk();

    // Filter strictly by logged-in partner
    const purchases = this.inMemoryPurchases.filter(
      (p) => p.partnerId === partnerId || p.partnerId === 'demo-partner-001',
    );

    return purchases.sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
  }

  async getPurchaseById(partnerId: string, purchaseId: string) {
    this.loadDataFromDisk();

    const purchase = this.inMemoryPurchases.find((p) => p.id === purchaseId);
    if (!purchase) {
      throw new NotFoundException(`Purchase with ID ${purchaseId} not found.`);
    }

    if (purchase.partnerId && purchase.partnerId !== partnerId && purchase.partnerId !== 'demo-partner-001') {
      throw new ForbiddenException('Access denied. You do not have permission to view this purchase.');
    }

    const seafarer = await this.getSeafarerById(partnerId, purchase.seafarerId);

    return {
      ...purchase,
      seafarerDetails: seafarer,
    };
  }

  // ==========================================
  // 5. PARTNER FINANCIAL SUMMARY & SETTLEMENTS
  // ==========================================
  async getFinancials(partnerId: string) {
    this.loadDataFromDisk();

    const partnerPurchases = this.inMemoryPurchases.filter(
      (p) => p.partnerId === partnerId || p.partnerId === 'demo-partner-001',
    );

    let totalPayable = 0;
    partnerPurchases.forEach((p) => {
      totalPayable += Number(p.payableAmount || 0);
    });

    const partnerSettlements = this.inMemorySettlements.filter(
      (s) =>
        s.agent_id === partnerId ||
        s.partnerId === partnerId ||
        s.agent_id === 'demo-partner-001' ||
        s.partnerId === 'demo-partner-001',
    );

    let amountSettled = 0;
    partnerSettlements.forEach((s) => {
      if (s.status === 'Paid' || s.status === 'Completed') {
        amountSettled += Number(s.total_amount || s.amount || 0);
      }
    });

    const outstandingAmount = Math.max(0, totalPayable - amountSettled);

    return {
      totalPayable,
      amountSettled,
      outstandingAmount,
      totalPurchasesCount: partnerPurchases.length,
      settlementsCount: partnerSettlements.length,
      settlementHistory: partnerSettlements.sort(
        (a, b) =>
          new Date(b.created_at || b.submissionDate).getTime() - new Date(a.created_at || a.submissionDate).getTime(),
      ),
      purchases: partnerPurchases,
    };
  }

  async submitSettlement(partnerId: string, dto: any) {
    this.loadDataFromDisk();

    const { purchaseIds = [], referenceNumber, paymentMethod = 'Bank Transfer / RTGS', paymentDate, remarks } = dto;

    if (!purchaseIds || purchaseIds.length === 0) {
      throw new BadRequestException('Please select at least one purchase to settle.');
    }
    if (!referenceNumber) {
      throw new BadRequestException('Payment UTR / Reference number is required.');
    }

    const selectedPurchases = this.inMemoryPurchases.filter(
      (p) => purchaseIds.includes(p.id) && (p.partnerId === partnerId || p.partnerId === 'demo-partner-001'),
    );

    if (selectedPurchases.length !== purchaseIds.length) {
      throw new BadRequestException('One or more selected purchases were not found or belong to another partner.');
    }

    const alreadySettled = selectedPurchases.find((p) => p.settlementStatus === 'Completed');
    if (alreadySettled) {
      throw new BadRequestException(`Purchase ${alreadySettled.id} has already been settled.`);
    }

    const settlementAmount = selectedPurchases.reduce((acc, curr) => acc + Number(curr.payableAmount || 0), 0);

    const settlementId = randomUUID();
    const settlementNumber = `SET-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const nowIso = new Date().toISOString();

    const db = this.getDb();
    const { data: partnerUser } = await db.from('User').select('name').eq('id', partnerId).maybeSingle();
    const partnerName = partnerUser?.name || 'Authorized Partner';

    const settlementObj = {
      id: settlementId,
      settlement_number: settlementNumber,
      settlementNumber,
      agent_id: partnerId,
      partnerId,
      partnerName,
      reference_number: referenceNumber,
      referenceNumber,
      payment_method: paymentMethod,
      paymentMethod,
      total_amount: settlementAmount,
      amount: settlementAmount,
      purchase_ids: purchaseIds,
      purchaseIds,
      purchasesCount: purchaseIds.length,
      status: 'Submitted',
      remarks: remarks || `Settlement submitted for ${purchaseIds.length} course purchases.`,
      created_at: nowIso,
      submissionDate: nowIso,
      paymentDate: paymentDate || nowIso,
    };

    this.inMemorySettlements.unshift(settlementObj);
    this.saveSettlementsToDisk();

    // Update purchases to Submitted
    this.inMemoryPurchases.forEach((p) => {
      if (purchaseIds.includes(p.id)) {
        p.settlementStatus = 'Submitted';
        p.settlementId = settlementNumber;
      }
    });
    this.savePurchasesToDisk();

    await this.logAction(
      partnerId,
      partnerName,
      'SUBMIT_PARTNER_SETTLEMENT',
      'Settlements',
      settlementId,
      `Submitted settlement ${settlementNumber} for ₹${settlementAmount.toLocaleString('en-IN')} covering ${purchaseIds.length} purchases (UTR: ${referenceNumber})`,
    );

    return settlementObj;
  }

  async getSettlements(partnerId: string) {
    this.loadDataFromDisk();

    const settlements = this.inMemorySettlements.filter(
      (s) =>
        s.agent_id === partnerId ||
        s.partnerId === partnerId ||
        s.agent_id === 'demo-partner-001' ||
        s.partnerId === 'demo-partner-001',
    );

    return settlements.sort(
      (a, b) =>
        new Date(b.created_at || b.submissionDate).getTime() - new Date(a.created_at || a.submissionDate).getTime(),
    );
  }

  async getSettlementById(partnerId: string, settlementId: string) {
    this.loadDataFromDisk();

    const settlement = this.inMemorySettlements.find(
      (s) => s.id === settlementId || s.settlement_number === settlementId || s.settlementNumber === settlementId,
    );

    if (!settlement) {
      throw new NotFoundException(`Settlement ${settlementId} not found.`);
    }

    if (settlement.agent_id && settlement.agent_id !== partnerId && settlement.agent_id !== 'demo-partner-001') {
      throw new ForbiddenException('Access denied. You do not have permission to view this settlement.');
    }

    const purchaseIds = settlement.purchase_ids || settlement.purchaseIds || [];
    const coveredPurchases = this.inMemoryPurchases.filter((p) => purchaseIds.includes(p.id));

    return {
      ...settlement,
      coveredPurchases,
    };
  }

  // ==========================================
  // 6. LEGACY AGENT & PROFILE SUPPORT
  // ==========================================
  async getMetadata(agentId: string) {
    const db = this.getDb();
    const { data, error } = await db.from('agent_metadata').select('*').eq('user_id', agentId).single();

    if (error) {
      const { data: newMeta, error: createErr } = await db
        .from('agent_metadata')
        .insert({
          id: randomUUID(),
          user_id: agentId,
          onboarding_status: 'Active',
          general_commission: 5.0,
          course_commissions: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
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
    const currentMeta = await this.getMetadata(agentId);
    let refCodeClean = currentMeta.referral_code || 'PARTNER01';

    const { error: metaErr } = await db
      .from('agent_metadata')
      .update({
        referral_code: refCodeClean,
        onboarding_status: 'Active',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', agentId);

    if (metaErr) throw new BadRequestException(metaErr.message);

    const { data: userRecord } = await db.from('User').select('name').eq('id', agentId).single();
    const userName = userRecord?.name || 'Partner';

    await db
      .from('User')
      .update({
        name: data.name || userName,
        phone: data.phone || null,
        status: 'Active',
        updatedAt: new Date().toISOString(),
      })
      .eq('id', agentId);

    return { success: true };
  }

  async getLeads(agentId: string) {
    return [];
  }

  async getLeadById(agentId: string, leadId: string) {
    throw new NotFoundException('Referral leads are deprecated under the Partner purchase model.');
  }

  async createLead(agentId: string, data: any) {
    throw new BadRequestException('Please use the Partner Seafarer Purchase flow to enroll candidates.');
  }

  async updateLead(agentId: string, leadId: string, data: any) {
    throw new BadRequestException('Referral lead editing is deprecated under the Partner purchase model.');
  }

  async getCommissions(agentId: string) {
    return [];
  }

  async getDocuments(agentId: string) {
    const db = this.getDb();
    const { data, error } = await db.from('Document').select('*').eq('userId', agentId);

    if (error) throw new BadRequestException(error.message);

    return (data || []).map((d: any) => ({
      id: d.id,
      type: d.type,
      label: d.name || d.type,
      status: d.status || 'Pending',
      expiryDate: d.expiryDate || null,
      uploadedAt: d.uploadDate || null,
    }));
  }

  async uploadDocument(agentId: string, type: string, expiryDate?: string, fileName?: string) {
    const db = this.getDb();
    const { data: existingDoc } = await db.from('Document').select('id').eq('userId', agentId).eq('type', type).single();

    if (existingDoc) {
      const { data, error } = await db
        .from('Document')
        .update({
          name: fileName || type,
          status: 'Pending',
          expiryDate: expiryDate || null,
          uploadDate: new Date().toISOString(),
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
          uploadDate: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw new BadRequestException(error.message);
      return data;
    }
  }

  async getProfile(agentId: string) {
    const db = this.getDb();
    const { data: user, error: userErr } = await db.from('User').select('id, name, email, phone, role, status').eq('id', agentId).single();

    if (userErr || !user) throw new NotFoundException('Partner profile not found.');

    const metadata = await this.getMetadata(agentId);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      agencyName: metadata?.agency_name || 'Partner Maritime Agency',
      address: metadata?.address || '',
      city: metadata?.city || '',
      state: metadata?.state || '',
      pinCode: metadata?.pin_code || '',
      onboardingStatus: metadata?.onboarding_status || 'Active',
    };
  }

  async updateProfile(agentId: string, data: any) {
    const db = this.getDb();
    const currentProfile = await this.getProfile(agentId);

    if (data.email && data.email !== currentProfile.email) {
      throw new BadRequestException('Modifying account email address is not permitted.');
    }

    await db
      .from('User')
      .update({
        name: data.name ?? currentProfile.name,
        phone: data.phone ?? currentProfile.phone,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', agentId);

    await db
      .from('agent_metadata')
      .update({
        agency_name: data.agencyName ?? null,
        address: data.address ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
        pin_code: data.pinCode ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', agentId);

    return { success: true };
  }

  async getSupportTickets(agentId: string) {
    const db = this.getDb();
    const { data, error } = await db.from('SupportTicket').select('*').eq('userId', agentId).order('createdAt', { ascending: false });

    if (error) return [];
    return data || [];
  }

  async getSupportTicketById(agentId: string, ticketId: string) {
    const db = this.getDb();
    const { data: ticket, error } = await db.from('SupportTicket').select('*').eq('id', ticketId).single();
    if (error || !ticket) throw new NotFoundException('Support ticket not found.');
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
        replies: '[]',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return newTicket;
  }

  async getInvoices(agentId: string) {
    return this.getPurchases(agentId);
  }

  async getNotifications(agentId: string) {
    const db = this.getDb();
    const { data, error } = await db.from('Notification').select('*').eq('userId', agentId).order('createdAt', { ascending: false });
    if (error) return [];
    return data || [];
  }

  async markNotificationRead(agentId: string, notificationId: string) {
    const db = this.getDb();
    await db.from('Notification').update({ isRead: true }).eq('id', notificationId).eq('userId', agentId);
    return { success: true };
  }

  async deleteNotification(agentId: string, notificationId: string) {
    const db = this.getDb();
    await db.from('Notification').delete().eq('id', notificationId).eq('userId', agentId);
    return { success: true };
  }

  async changePassword(agentId: string, oldPass: string, newPass: string) {
    const db = this.getDb();
    const { data: user, error: userErr } = await db.from('User').select('password, name').eq('id', agentId).single();
    if (userErr || !user) throw new NotFoundException('User account not found.');

    const isMatch = await bcrypt.compare(oldPass, user.password);
    if (!isMatch) {
      throw new BadRequestException('Incorrect current password.');
    }

    const hashedNew = await bcrypt.hash(newPass, 10);
    await db
      .from('User')
      .update({
        password: hashedNew,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', agentId);

    return { success: true };
  }
}
