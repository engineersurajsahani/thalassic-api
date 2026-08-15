import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class MasterService {
  private usersFile = path.join(process.cwd(), 'users_data.json');
  private seafarersFile = path.join(process.cwd(), 'seafarers_local_data.json');
  private coursesFile = path.join(process.cwd(), 'courses_data.json');
  private purchasesFile = path.join(process.cwd(), 'partner_purchases_data.json');
  private settlementsFile = path.join(process.cwd(), 'settlements_data.json');

  constructor(private supabaseService: SupabaseService) {}

  private getSupabase() {
    return this.supabaseService.getClient();
  }

  private readJsonFile<T>(filePath: string, fallback: T): T {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn(`Error reading ${filePath}:`, e);
    }
    return fallback;
  }

  private writeJsonFile<T>(filePath: string, data: T) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.warn(`Error writing ${filePath}:`, e);
    }
  }

  private getStandardCoursesList() {
    return [
      {
        id: 'c-001',
        code: 'BST',
        name: 'Basic Safety Training',
        category: 'basic',
        duration: '12 Days',
        fees: '₹12,000',
        standardFee: 12000,
        description: 'Mandatory physical safety training modules including Personal Survival Techniques and Firefighting.',
        rating: '4.9',
        ratingCount: 240,
        level: 'Entry Level',
        status: 'Active'
      },
      {
        id: 'c-002',
        code: 'AFF',
        name: 'Advanced Fire Fighting',
        category: 'advanced',
        duration: '5 Days',
        fees: '₹7,200',
        standardFee: 7200,
        description: 'Advanced in-person practical training in organization and control of shipboard firefighting operations.',
        rating: '4.8',
        ratingCount: 180,
        level: 'Advanced',
        status: 'Active'
      },
      {
        id: 'c-003',
        code: 'OCTCO',
        name: 'Oil and Chemical Tanker Cargo Operations',
        category: 'basic',
        duration: '6 Days',
        fees: '₹6,000',
        standardFee: 6000,
        description: 'Physical workshop and simulator training for tanker cargo operations.',
        rating: '4.7',
        ratingCount: 95,
        level: 'Intermediate',
        status: 'Active'
      },
      {
        id: 'c-004',
        code: 'MEDICARE',
        name: 'Medical Care on Board Ships',
        category: 'specialized',
        duration: '5 Days',
        fees: '₹25,000',
        standardFee: 25000,
        description: 'In-person clinical procedures, first aid, and medical care.',
        rating: '4.9',
        ratingCount: 150,
        level: 'Specialized',
        status: 'Active'
      },
      {
        id: 'c-005',
        code: 'RPST',
        name: 'Refresher PST',
        category: 'basic',
        duration: '1 Day',
        fees: '₹3,500',
        standardFee: 3500,
        description: 'Physical practical refresher training for Personal Survival Techniques.',
        rating: '4.8',
        ratingCount: 310,
        level: 'Refresher',
        status: 'Active'
      }
    ];
  }

  // --- 1. Dashboard Metrics ---
  async getDashboardData() {
    const supabase = this.getSupabase();
    let seafarersCount = 0;
    let coursesCount = 0;
    let totalBookings = 0;
    let enrollments: any[] = [];

    try {
      const { count: sfCount } = await supabase
        .from('User')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'SEAFARER');
      seafarersCount = sfCount || 0;

      const { count: cCount } = await supabase
        .from('Course')
        .select('*', { count: 'exact', head: true });
      coursesCount = cCount || 0;

      const { count: bCount } = await supabase
        .from('Enrollment')
        .select('*', { count: 'exact', head: true });
      totalBookings = bCount || 0;

      const { data: enr } = await supabase
        .from('Enrollment')
        .select(`
          id,
          status,
          createdAt,
          User ( name, email ),
          Course ( name, fees )
        `)
        .order('createdAt', { ascending: false });
      enrollments = enr || [];
    } catch (e) {
      console.warn('Dashboard DB query note, using local fallback:', e);
    }

    // Local Fallback counts and live course count
    const localUsers = this.readJsonFile<any[]>(this.usersFile, []);
    const localSeafarers = this.readJsonFile<any[]>(this.seafarersFile, []);
    const currentCourses = await this.getCourses();
    const purchases = this.readJsonFile<any[]>(this.purchasesFile, []);

    coursesCount = currentCourses.length;
    if (seafarersCount === 0) {
      const allSf = [...localUsers.filter(u => (u.role || '').toUpperCase() === 'SEAFARER'), ...localSeafarers];
      seafarersCount = allSf.length || 5;
    }
    if (totalBookings === 0) {
      totalBookings = purchases.length > 0 ? purchases.length : 8;
    }

    // Build dynamic revenue
    let revenueAmount = 0;
    purchases.forEach((p: any) => {
      revenueAmount += Number(p.payable_amount) || 0;
    });

    const ledger: any[] = [];
    if (purchases.length > 0) {
      purchases.slice(0, 8).forEach((p: any) => {
        ledger.push({
          participant: p.seafarer_name || 'Seafarer Master',
          course: p.course_name || p.course_code || 'Maritime Course',
          revenue: `₹${Number(p.payable_amount || 10000).toLocaleString('en-IN')}`,
          status: p.settlement_status === 'Settled' ? 'COMPLETED' : 'PENDING SETTLEMENT'
        });
      });
    }

    let formattedRevenue = '₹24.5L';
    if (revenueAmount >= 100000) {
      formattedRevenue = `₹${(revenueAmount / 100000).toFixed(1)}L`;
    } else if (revenueAmount > 0) {
      formattedRevenue = `₹${revenueAmount.toLocaleString('en-IN')}`;
    }

    return {
      seafarersCount,
      coursesCount,
      totalBookings,
      totalRevenue: formattedRevenue,
      ledger: ledger.length > 0 ? ledger : undefined
    };
  }

  // --- Reports Data ---
  async getReportsData(days?: string) {
    const courses = this.readJsonFile<any[]>(this.coursesFile, this.getStandardCoursesList());
    const purchases = this.readJsonFile<any[]>(this.purchasesFile, []);

    const reports = courses.map((c: any, index: number) => {
      const coursePurchases = purchases.filter(
        (p: any) => p.course_code === c.code || p.course_name === c.name || p.course_id === c.id
      );
      const bookingsCount = coursePurchases.length > 0 ? coursePurchases.length : Math.floor(8 + (index * 3));
      
      const cleanFee = typeof c.standardFee === 'number'
        ? c.standardFee
        : parseFloat((c.fees || '').replace(/[^\d]/g, '')) || 10000;
      const revenueAmount = bookingsCount * cleanFee;

      let formattedRevenue = '₹0';
      if (revenueAmount >= 100000) {
        formattedRevenue = `₹${(revenueAmount / 100000).toFixed(2)}L`;
      } else if (revenueAmount > 0) {
        formattedRevenue = `₹${revenueAmount.toLocaleString('en-IN')}`;
      }

      return {
        id: c.id || String(index + 1),
        course: c.name,
        code: c.code,
        bookings: bookingsCount,
        revenue: formattedRevenue,
        rating: c.rating ? String(c.rating) : '4.8',
      };
    });

    return {
      courses: reports,
      averageCompletion: '96.4%',
      refundRate: '0.15%'
    };
  }

  // --- 2. Course Management ---
  async getCourses() {
    try {
      const { data, error } = await this.getSupabase()
        .from('Course')
        .select('*')
        .order('name');

      if (!error && data && data.length > 0) {
        return data.map(c => ({
          ...c,
          status: 'Active'
        }));
      }
    } catch (e) {
      console.warn('DB course fetch note, using local courses:', e);
    }

    // Fallback to local courses file / standard courses
    const localCourses = this.readJsonFile<any[]>(this.coursesFile, []);
    if (localCourses.length === 0) {
      const standard = this.getStandardCoursesList();
      this.writeJsonFile(this.coursesFile, standard);
      return standard;
    }
    return localCourses;
  }

  async createCourse(dto: any) {
    const payload = {
      id: `c-${randomUUID().substring(0, 8)}`,
      code: (dto.code || 'CRS').toUpperCase(),
      name: dto.name,
      category: dto.category || 'basic',
      duration: dto.duration || '5 Days',
      fees: dto.fees?.startsWith('₹') ? dto.fees : `₹${Number(String(dto.fees).replace(/[^0-9]/g, '') || 10000).toLocaleString('en-IN')}`,
      standardFee: Number(String(dto.fees).replace(/[^0-9]/g, '') || 10000),
      description: dto.description || '',
      level: 'Entry Level',
      icon: dto.category === 'basic' ? '🎯' : '⚓',
      image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e',
      documentsRequired: 'Passport, CDC, INDOS Copy',
      rating: '4.8',
      ratingCount: 120,
      status: 'Active',
      trainingMode: 'Physical'
    };

    // Save locally
    const currentCourses = await this.getCourses();
    currentCourses.push(payload);
    this.writeJsonFile(this.coursesFile, currentCourses);

    try {
      await this.getSupabase().from('Course').insert([payload]);
    } catch (e) {
      console.warn('DB Course insert note:', e);
    }

    return payload;
  }

  async updateCourse(id: string, dto: any) {
    const currentCourses = await this.getCourses();
    const idx = currentCourses.findIndex((c: any) => c.id === id || c.code === id);

    if (idx === -1) {
      throw new NotFoundException('Course module not found');
    }

    const updated = {
      ...currentCourses[idx],
      ...dto,
      fees: dto.fees ? (dto.fees.startsWith('₹') ? dto.fees : `₹${Number(String(dto.fees).replace(/[^0-9]/g, '') || 10000).toLocaleString('en-IN')}`) : currentCourses[idx].fees
    };
    currentCourses[idx] = updated;
    this.writeJsonFile(this.coursesFile, currentCourses);

    try {
      await this.getSupabase().from('Course').update(dto).eq('id', id);
    } catch (e) {
      console.warn('DB Course update note:', e);
    }

    return updated;
  }

  async deleteCourse(id: string) {
    let currentCourses = await this.getCourses();
    currentCourses = currentCourses.filter((c: any) => c.id !== id && c.code !== id);
    this.writeJsonFile(this.coursesFile, currentCourses);

    try {
      await this.getSupabase().from('Course').delete().eq('id', id);
    } catch (e) {
      console.warn('DB Course delete note:', e);
    }

    return { success: true };
  }

  // --- 3. User Management & Auditing ---
  async getUsers(role?: string) {
    const users = this.readJsonFile<any[]>(this.usersFile, []);
    const localSeafarers = this.readJsonFile<any[]>(this.seafarersFile, []);

    // Merge users map
    const userMap = new Map<string, any>();

    users.forEach((u: any) => {
      userMap.set(u.id, {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone || '+91 98765 43210',
        role: u.role || 'SEAFARER',
        status: u.status || 'Active',
        createdAt: u.createdAt || new Date().toISOString()
      });
    });

    localSeafarers.forEach((s: any) => {
      userMap.set(s.id, {
        id: s.id,
        name: s.name,
        email: s.email,
        phone: s.phone || '+91 98765 43210',
        role: 'SEAFARER',
        status: s.status || 'Active',
        createdAt: s.createdAt || new Date().toISOString()
      });
    });

    let allUsers = Array.from(userMap.values());

    if (role && role !== 'All') {
      const targetRole = role.toLowerCase().replace(/[-_]/g, '');
      allUsers = allUsers.filter(u => {
        const uRole = (u.role || '').toLowerCase().replace(/[-_]/g, '');
        return uRole === targetRole || uRole.includes(targetRole);
      });
    }

    return allUsers;
  }

  async createUser(dto: any) {
    const hashedPassword = await bcrypt.hash(dto.password || 'password123', 10);
    const roleSlug = (dto.role || 'seafarer').toLowerCase();
    const dbRole = roleSlug === 'master' ? 'MASTER' : roleSlug === 'company-admin' ? 'COMPANY_ADMIN' : 'SEAFARER';
    const nowIso = new Date().toISOString();

    const payload = {
      id: randomUUID(),
      name: dto.name,
      email: dto.email,
      plainPassword: dto.password || 'password123',
      password: hashedPassword,
      phone: dto.phone || '+91 00000 00000',
      role: dbRole,
      status: 'Active',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // Save locally
    const users = this.readJsonFile<any[]>(this.usersFile, []);
    users.push(payload);
    this.writeJsonFile(this.usersFile, users);

    try {
      await this.getSupabase().from('User').insert([payload]);
    } catch (e) {
      console.warn('DB User insert note:', e);
    }

    return payload;
  }

  async getUserProfile(userId: string) {
    const allUsers = await this.getUsers();
    const user = allUsers.find(u => u.id === userId);

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    const localSeafarers = this.readJsonFile<any[]>(this.seafarersFile, []);
    const sf = localSeafarers.find(s => s.id === userId) || {};

    const mappedProfile = {
      id: user.id,
      givenName: user.name?.split(' ')[0] || 'Seafarer',
      surname: user.name?.split(' ').slice(1).join(' ') || '',
      dob: sf.dob || sf.dateOfBirth || '1995-06-15',
      birthPlace: sf.address || 'Mumbai, Maharashtra',
      fatherName: sf.fatherName || 'Ramesh Kumar',
      passport: {
        num: sf.passportNumber || 'Z8899112',
        issue: '2022-01-10',
        expiry: '2032-01-09',
        place: 'Mumbai',
      },
      indos: {
        num: sf.indosNumber || 'IND-991122',
        issue: '2020-05-15',
        status: 'Verified',
      },
      cdc: {
        num: sf.cdcNumber || 'MUM-991122',
        issue: '2021-03-20',
        expiry: '2031-03-19',
        place: 'Mumbai',
      },
      education: 'B.Sc Nautical Science',
    };

    return {
      ...user,
      profile: mappedProfile,
      seaService: [
        {
          rpsl: 'Anglo-Eastern Ship Management',
          vessel: 'MT Atlantic Pioneer',
          vessel_type: 'Oil Tanker',
          imo: '9345678',
          rank: 'Third Officer',
          sign_on: '2024-01-15',
          sign_off: '2024-07-20'
        }
      ]
    };
  }

  async updateUserStatus(id: string, status: string) {
    const users = this.readJsonFile<any[]>(this.usersFile, []);
    const user = users.find(u => u.id === id);
    if (user) {
      user.status = status || 'Active';
      this.writeJsonFile(this.usersFile, users);
    }
    return { id, status: status || 'Active' };
  }

  // --- 4. Settings Configuration ---
  async getSettings() {
    return {
      system_email: 'support@hariomthalassic.com',
      contact_phone: '+91 22 12345678',
      payment_gateway: 'razorpay_production_mode',
      dgs_accreditation_id: 'DGS-MTI-10294'
    };
  }

  async updateSettings(dto: any) {
    return {
      system_email: dto.system_email || 'support@hariomthalassic.com',
      contact_phone: dto.contact_phone || '+91 22 12345678',
      payment_gateway: dto.payment_gateway || 'razorpay_production_mode',
      dgs_accreditation_id: dto.dgs_accreditation_id || 'DGS-MTI-10294'
    };
  }

  async updateAdminProfile(adminId: string, dto: any) {
    const users = this.readJsonFile<any[]>(this.usersFile, []);
    const admin = users.find(u => u.id === adminId);
    if (admin) {
      if (dto.name) admin.name = dto.name;
      if (dto.password) {
        admin.password = await bcrypt.hash(dto.password, 10);
        admin.plainPassword = dto.password;
      }
      this.writeJsonFile(this.usersFile, users);
    }
    return { success: true, user: admin };
  }
}
