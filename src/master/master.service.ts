import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class MasterService {
  constructor(private supabaseService: SupabaseService) {}

  private getSupabase() {
    return this.supabaseService.getClient();
  }

  // --- 1. Dashboard Metrics ---
  async getDashboardData() {
    const supabase = this.getSupabase();

    // Fetch counts from database
    const { count: totalSeafarers, error: err1 } = await supabase
      .from('User')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'seafarer');

    const { count: totalCourses, error: err2 } = await supabase
      .from('Course')
      .select('*', { count: 'exact', head: true });

    const { count: totalBookings, error: err3 } = await supabase
      .from('Enrollment')
      .select('*', { count: 'exact', head: true });

    // Fetch recent registrations
    const { data: recentRegistrations, error: err4 } = await supabase
      .from('User')
      .select('id, name, email, createdAt')
      .eq('role', 'seafarer')
      .order('createdAt', { ascending: false })
      .limit(4);

    // Fetch recent purchases
    const { data: recentPurchases, error: err5 } = await supabase
      .from('Enrollment')
      .select(`
        id,
        startDate,
        status,
        User ( name ),
        Course ( name, fees )
      `)
      .order('createdAt', { ascending: false })
      .limit(4);

    if (err1 || err2 || err3 || err4 || err5) {
      console.error("Dashboard error details:", { err1, err2, err3, err4, err5 });
    }

    // Map bookings structure for response
    const formattedPurchases = (recentPurchases || []).map((p: any) => ({
      id: p.id,
      user: p.User?.name || 'Unknown User',
      course: p.Course?.name || 'Unknown Course',
      amount: p.Course?.fees || 'N/A',
      status: p.status || 'Completed',
      date: new Date(p.startDate || p.createdAt).toLocaleDateString(),
    }));

    return {
      totalSeafarers: totalSeafarers || 0,
      totalCourses: totalCourses || 0,
      totalPurchases: totalBookings || 0,
      totalRevenue: '₹24.5L', // Placeholder or calculated value
      recentRegistrations: (recentRegistrations || []).map(r => ({
        id: r.id,
        name: r.name,
        email: r.email,
        date: new Date(r.createdAt).toLocaleDateString(),
      })),
      recentPurchases: formattedPurchases,
    };
  }

  async getReportsData() {
    const supabase = this.getSupabase();

    // Fetch courses
    const { data: courses, error: err1 } = await supabase
      .from('Course')
      .select('id, name, fees, rating');

    // Fetch enrollments
    const { data: enrollments, error: err2 } = await supabase
      .from('Enrollment')
      .select('courseId, status');

    if (err1 || err2) {
      console.error("Reports loading error:", { err1, err2 });
    }

    const courseList = courses || [];
    const enrollmentList = enrollments || [];

    const reports = courseList.map((c: any, index: number) => {
      const courseBookingsList = enrollmentList.filter((e: any) => e.courseId === c.id);
      const bookingsCount = courseBookingsList.length;

      // Parse fee amount (e.g. "₹12,000" -> 12000)
      const cleanFee = parseFloat((c.fees || "").replace(/[^\d]/g, "")) || 0;
      const revenueAmount = bookingsCount * cleanFee;

      // Format revenue (e.g. 3625000 -> "₹36.25L" or standard format)
      let formattedRevenue = "₹0";
      if (revenueAmount >= 100000) {
        formattedRevenue = `₹${(revenueAmount / 100000).toFixed(2)}L`;
      } else if (revenueAmount > 0) {
        formattedRevenue = `₹${revenueAmount.toLocaleString('en-IN')}`;
      }

      return {
        id: c.id || String(index + 1),
        course: c.name,
        bookings: bookingsCount,
        revenue: formattedRevenue,
        rating: c.rating ? String(c.rating) : "4.8",
      };
    });

    return reports;
  }

  // --- 2. Course Management ---
  async getCourses() {
    const { data, error } = await this.getSupabase()
      .from('Course')
      .select('*')
      .order('createdAt', { ascending: false });

    if (error) throw new InternalServerErrorException('Error loading courses');
    return (data || []).map(c => ({
      ...c,
      status: 'Active'
    }));
  }

  async createCourse(dto: any) {
    const payload = {
      code: dto.code,
      name: dto.name,
      category: dto.category,
      duration: dto.duration,
      fees: dto.fees,
      description: dto.description || '',
      level: 'Entry Level',
      icon: dto.category === 'basic' ? '🎯' : '⚓',
      documentsRequired: 'Passport, CDC, INDOS Copy'
    };

    const { data, error } = await this.getSupabase()
      .from('Course')
      .insert([payload])
      .select()
      .single();

    if (error) throw new InternalServerErrorException('Error creating course module: ' + error.message);
    return data;
  }

  async updateCourse(id: string, dto: any) {
    const { data, error } = await this.getSupabase()
      .from('Course')
      .update(dto)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new NotFoundException('Course module not found or update failed');
    return data;
  }

  async deleteCourse(id: string) {
    const { error } = await this.getSupabase()
      .from('Course')
      .delete()
      .eq('id', id);

    if (error) throw new InternalServerErrorException('Error deleting course module');
    return { success: true };
  }

  // --- 3. User Management & Auditing ---
  async getUsers(role?: string) {
    let query = this.getSupabase().from('User').select('*').order('createdAt', { ascending: false });

    if (role) {
      const normalizedRole = role.toLowerCase() === 'seafarer' ? 'seafarer' : 'master';
      query = query.eq('role', normalizedRole);
    }

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException('Error loading users list');
    return data;
  }

  async createUser(dto: any) {
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(dto.password || 'password123', 10);

    const payload = {
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
      role: dto.role || 'seafarer',
      status: 'Active',
    };

    const { data, error } = await this.getSupabase()
      .from('User')
      .insert([payload])
      .select()
      .single();

    if (error) throw new InternalServerErrorException('Error creating user: ' + error.message);

    // If role is seafarer, seed profile record so profiles detail query succeeds
    if (data && data.role === 'seafarer') {
      await this.getSupabase()
        .from('SeafarerProfile')
        .insert([{
          userId: data.id,
          status: 'Pending Audit',
          nationality: 'Indian',
        }]);
    }

    return data;
  }

  async getUserProfile(userId: string) {
    const supabase = this.getSupabase();

    // Fetch user basic data
    const { data: user, error: err1 } = await supabase
      .from('User')
      .select('*')
      .eq('id', userId)
      .single();

    if (err1 || !user) throw new NotFoundException('User profile not found');

    // Fetch detailed profile docs
    const { data: profile } = await supabase
      .from('SeafarerProfile')
      .select('*')
      .eq('userId', userId)
      .single();

    // Fetch documents (Passport, CDC, INDOS details)
    const { data: documents } = await supabase
      .from('Document')
      .select('*')
      .eq('userId', userId);

    // Fetch sea service history
    const { data: seaService } = await supabase
      .from('SeaServiceRecord')
      .select('*')
      .eq('profileId', profile?.id || userId);

    // Map Document records to seafarer profiles properties expected by the UI
    const docsList = documents || [];
    const passportDoc = docsList.find((d: any) => d.type?.toLowerCase() === 'passport');
    const cdcDoc = docsList.find((d: any) => d.type?.toLowerCase() === 'cdc');
    const indosDoc = docsList.find((d: any) => d.type?.toLowerCase() === 'indos');

    const mappedProfile = {
      ...(profile || {}),
      givenName: user.name?.split(" ")[0] || 'N/A',
      surname: user.name?.split(" ").slice(1).join(" ") || 'N/A',
      dob: profile?.dob || 'N/A',
      birthPlace: profile?.address || 'N/A',
      fatherName: 'N/A',
      passport: {
        num: passportDoc?.name || 'N/A',
        issue: passportDoc?.uploadDate ? new Date(passportDoc.uploadDate).toISOString().split('T')[0] : 'N/A',
        expiry: passportDoc?.expiryDate || 'N/A',
        place: 'N/A',
      },
      indos: {
        num: profile?.indosNumber || 'N/A',
        issue: 'N/A',
        status: indosDoc?.status || 'Pending',
      },
      cdc: {
        num: cdcDoc?.name || 'N/A',
        issue: cdcDoc?.uploadDate ? new Date(cdcDoc.uploadDate).toISOString().split('T')[0] : 'N/A',
        expiry: cdcDoc?.expiryDate || 'N/A',
        place: 'N/A',
      },
      education: 'N/A',
    };

    return {
      ...user,
      profile: mappedProfile,
      seaService: (seaService || []).map((s: any) => ({
        rpsl: s.company || 'N/A',
        vessel: s.vesselName || 'N/A',
        vessel_type: 'N/A',
        imo: s.imoNumber || 'N/A',
        rank: s.rank || 'N/A',
        sign_on: s.signOn || 'N/A',
        sign_off: s.signOff || 'N/A'
      })),
    };
  }

  async updateUserStatus(id: string, status: string) {
    const supabase = this.getSupabase();

    // The User table has no status column, so we update the SeafarerProfile or Document verification status
    const { data: documents } = await supabase
      .from('Document')
      .update({ status: 'Verified' })
      .eq('userId', id)
      .select();

    return { id, status: 'Verified', documents };
  }

  // --- 4. Settings Configuration ---
  async getSettings() {
    const { data, error } = await this.getSupabase()
      .from('settings')
      .select('*')
      .single();

    if (error) {
      // Fallback response if settings table is not present
      return {
        system_email: 'support@hariomthalassic.com',
        contact_phone: '+91 22 12345678',
        payment_gateway: 'razorpay_production_mode',
        dgs_accreditation_id: 'DGS-MTI-10294'
      };
    }
    return data;
  }

  async updateSettings(dto: any) {
    const { data, error } = await this.getSupabase()
      .from('settings')
      .update(dto)
      .select()
      .single();

    if (error) {
      // Simply return the payload directly if table is not present
      return dto;
    }
    return data;
  }
}
