import { Injectable, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { InvoicesService } from '../invoices/invoices.service';

// ── Centralized Institute Management Configuration (PRD 1.9, 1.10, 5.2, 5.3) ───
export const CONFIGURED_INSTITUTES = [
  {
    id: 'inst-mumbai',
    name: 'Hari Om Thalassic Maritime Training Academy - Mumbai',
    code: 'HOT-MUM-01',
    idtNumber: 'IDT-10294',
    address:
      'Colaba Maritime Training Complex, Marine Drive, Mumbai, Maharashtra 400005',
    city: 'Mumbai',
    phone: '+91 22 6123 4567',
    email: 'mumbai.campus@hariomthalassic.com',
    schedule: 'Monday - Friday | 09:00 - 17:30 IST',
    batchDates: [
      'Batch 1: 1st - 12th of month',
      'Batch 2: 15th - 27th of month',
    ],
    facilities:
      'Full-Mission Bridge Simulator, Fire Fighting Mock-up, Survival Craft Davit',
  },
  {
    id: 'inst-chennai',
    name: 'Hari Om Maritime Institute - Chennai Regional Center',
    code: 'HOT-CHN-02',
    idtNumber: 'IDT-10355',
    address: 'Harbour View Road, Royapuram, Chennai, Tamil Nadu 600013',
    city: 'Chennai',
    phone: '+91 44 2598 1122',
    email: 'chennai.campus@hariomthalassic.com',
    schedule: 'Monday - Saturday | 08:30 - 16:30 IST',
    batchDates: [
      'Batch A: 5th - 17th of month',
      'Batch B: 20th - 31st of month',
    ],
    facilities:
      'Tanker Cargo Simulator (OCTCO/GTFC), Advanced Medical Care Ward, Wet PST Pool',
  },
  {
    id: 'inst-kolkata',
    name: 'Hari Om Thalassic Nautical Institute - Kolkata',
    code: 'HOT-KOL-03',
    idtNumber: 'IDT-10488',
    address:
      'Garden Reach Road, Kidderpore Port Area, Kolkata, West Bengal 700024',
    city: 'Kolkata',
    phone: '+91 33 2410 8890',
    email: 'kolkata.campus@hariomthalassic.com',
    schedule: 'Monday - Friday | 09:00 - 17:00 IST',
    batchDates: [
      'Batch 1: 3rd - 15th of month',
      'Batch 2: 18th - 30th of month',
    ],
    facilities:
      'Advanced Engine Room Simulator, High Voltage Switchboard Lab, ECDIS Suite',
  },
  {
    id: 'inst-goa',
    name: 'Hari Om Maritime Academy - Goa Center',
    code: 'HOT-GOA-04',
    idtNumber: 'IDT-10512',
    address: 'Vasco da Gama Port Enclave, Mormugao, Goa 403802',
    city: 'Goa',
    phone: '+91 832 251 4400',
    email: 'goa.campus@hariomthalassic.com',
    schedule: 'Monday - Saturday | 09:00 - 16:30 IST',
    batchDates: [
      'Batch Alpha: 2nd - 14th of month',
      'Batch Beta: 16th - 28th of month',
    ],
    facilities:
      'Offshore Survival Platform, Fast Rescue Boat Davits, Helideck Simulator',
  },
  {
    id: 'inst-kochi',
    name: 'Hari Om Maritime Institute - Kochi Campus',
    code: 'HOT-KOC-05',
    idtNumber: 'IDT-10640',
    address: 'Willingdon Island Maritime Hub, Kochi, Kerala 682003',
    city: 'Kochi',
    phone: '+91 484 266 7711',
    email: 'kochi.campus@hariomthalassic.com',
    schedule: 'Monday - Friday | 09:00 - 17:30 IST',
    batchDates: [
      'Batch 1: 1st - 12th of month',
      'Batch 2: 15th - 27th of month',
    ],
    facilities:
      'Ship Maneuvering Simulator, Chemical Tanker Safety Lab, Medical Trauma Bay',
  },
];

export function getInstitutesForCourse(courseCode?: string): any[] {
  const code = (courseCode || '').toUpperCase();
  if (code.includes('BST')) {
    return [
      CONFIGURED_INSTITUTES[0],
      CONFIGURED_INSTITUTES[1],
      CONFIGURED_INSTITUTES[2],
      CONFIGURED_INSTITUTES[3],
      CONFIGURED_INSTITUTES[4],
    ];
  } else if (code.includes('AFF')) {
    return [
      CONFIGURED_INSTITUTES[0],
      CONFIGURED_INSTITUTES[2],
      CONFIGURED_INSTITUTES[3],
    ];
  } else if (code.includes('OCTCO')) {
    return [
      CONFIGURED_INSTITUTES[0],
      CONFIGURED_INSTITUTES[1],
      CONFIGURED_INSTITUTES[4],
    ];
  } else if (code.includes('MEDICARE')) {
    return [
      CONFIGURED_INSTITUTES[0],
      CONFIGURED_INSTITUTES[1],
      CONFIGURED_INSTITUTES[4],
    ];
  } else if (code.includes('PST') || code.includes('RPST')) {
    return [
      CONFIGURED_INSTITUTES[0],
      CONFIGURED_INSTITUTES[1],
      CONFIGURED_INSTITUTES[2],
      CONFIGURED_INSTITUTES[3],
    ];
  } else if (code.includes('STSDSD')) {
    return [
      CONFIGURED_INSTITUTES[0],
      CONFIGURED_INSTITUTES[1],
      CONFIGURED_INSTITUTES[2],
    ];
  } else if (code.includes('GTFC')) {
    return [CONFIGURED_INSTITUTES[0], CONFIGURED_INSTITUTES[1]];
  }
  return [
    CONFIGURED_INSTITUTES[0],
    CONFIGURED_INSTITUTES[1],
    CONFIGURED_INSTITUTES[2],
  ];
}

// Helper to decode latin1-garbled UTF-8 filenames (common with multer)
function cleanDisplayName(rawName?: string, fallback = 'document'): string {
  if (!rawName) return fallback;
  try {
    const fixed = Buffer.from(rawName, 'latin1').toString('utf8');
    if (!fixed.includes('\ufffd')) {
      return fixed.trim();
    }
  } catch {
    // fallback
  }
  return rawName.trim();
}

// Helper to produce a 100% S3 and Supabase Storage key-safe filename (ASCII, no spaces, no control characters)
function sanitizeStorageKey(rawName?: string, fallback = 'document'): string {
  const clean = cleanDisplayName(rawName, fallback);
  const lastDot = clean.lastIndexOf('.');
  const ext =
    lastDot !== -1
      ? clean.substring(lastDot).replace(/[^a-zA-Z0-9.]/g, '')
      : '';
  const base = lastDot !== -1 ? clean.substring(0, lastDot) : clean;

  const safeBase = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics/accents
    .replace(/[^a-zA-Z0-9_-]/g, '_') // replace spaces and any special characters with underscore
    .replace(/_+/g, '_') // collapse multiple underscores
    .replace(/^_|_$/g, '') // trim leading/trailing underscores
    .slice(0, 80);

  return `${safeBase || 'document'}${ext || '.pdf'}`;
}

@Injectable()
export class SeafarerService {
  constructor(
    private supabaseService: SupabaseService,
    private invoicesService: InvoicesService,
  ) {}

  private get db() {
    return this.supabaseService.getClient();
  }

  private isBucketVerified = false;

  private getSafeFileExtension(
    originalName?: string,
    mimeType?: string,
  ): string {
    let ext = '';
    if (originalName && originalName.includes('.')) {
      const parts = originalName.split('.');
      const rawExt = parts[parts.length - 1].toLowerCase().trim();
      const cleanExt = rawExt.replace(/[^a-z0-9]/g, '');
      if (cleanExt && cleanExt.length <= 5) {
        ext = `.${cleanExt}`;
      }
    }
    if (!ext && mimeType) {
      const lower = mimeType.toLowerCase();
      if (lower.includes('pdf')) ext = '.pdf';
      else if (lower.includes('jpeg') || lower.includes('jpg')) ext = '.jpg';
      else if (lower.includes('png')) ext = '.png';
      else ext = '.bin';
    }
    return ext || '.bin';
  }

  private async ensureBucketExists(
    bucketName = 'seafarer-documents',
  ): Promise<void> {
    if (this.isBucketVerified) return;
    try {
      const { data: buckets, error } = await this.db.storage.listBuckets();
      if (!error && buckets) {
        const found = buckets.some((b) => b.name === bucketName);
        if (found) {
          this.isBucketVerified = true;
          return;
        }
      }
      const { error: createErr } = await this.db.storage.createBucket(
        bucketName,
        {
          public: false,
        },
      );
      if (!createErr || createErr.message?.includes('already exists')) {
        this.isBucketVerified = true;
      }
    } catch (e) {
      console.warn(
        '[ensureBucketExists] Bucket verification warning:',
        (e as any)?.message,
      );
    }
  }

  // ─────────────────────────────────────────────
  // DASHBOARD
  // ─────────────────────────────────────────────
  async getDashboard(userId: string) {
    const { data: userRecord } = await this.db
      .from('users')
      .select('id, name, email, status')
      .eq('id', userId)
      .maybeSingle();

    const isUserOnHold =
      (userRecord?.status || '').toLowerCase() === 'on hold' ||
      (userRecord?.status || '').toLowerCase() === 'on_hold';

    const { data: enrollmentsRaw } = await this.db
      .from('enrollments')
      .select('id, status, progress, created_at, course_id, remarks')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    const { data: dashCourses } = await this.db
      .from('courses')
      .select('id, name, code, duration');
    const dashCourseMap = new Map(
      (dashCourses || []).map((c: any) => [c.id, c]),
    );

    const enrollments = (enrollmentsRaw || []).map((e: any) => ({
      ...e,
      course: dashCourseMap.get(e.course_id) || {
        id: e.course_id,
        name: 'Maritime Course',
        code: 'STCW',
        duration: '5 Days',
      },
    }));

    // Accurately separate statuses: Ongoing / Active, On Hold, Completed
    const parseMeta = (e: any) => {
      let meta: any = {};
      try {
        if (
          e.remarks &&
          typeof e.remarks === 'string' &&
          e.remarks.startsWith('{')
        ) {
          meta = JSON.parse(e.remarks);
        } else if (e.remarks && typeof e.remarks === 'object') {
          meta = e.remarks;
        }
      } catch (err) {
        meta = {};
      }
      return meta;
    };

    const isHoldEnrollment = (e: any) => {
      const st = (e.status || '').toLowerCase();
      return (
        st === 'on hold' ||
        st === 'on_hold' ||
        st === 'onhold' ||
        (isUserOnHold && st !== 'completed')
      );
    };

    const isOngoingEnrollment = (e: any) => {
      const st = (e.status || '').toLowerCase();
      return (
        !isHoldEnrollment(e) &&
        (st === 'processing' || st === 'active' || st === 'ongoing')
      );
    };

    const activeEnrollment = enrollments?.find(isOngoingEnrollment);
    const onHoldEnrollment = enrollments?.find(isHoldEnrollment);
    const completedCount =
      enrollments?.filter(
        (e: any) => (e.status || '').toLowerCase() === 'completed',
      ).length ?? 0;
    const ongoingCount = enrollments?.filter(isOngoingEnrollment).length ?? 0;
    const onHoldCount =
      enrollments?.filter(isHoldEnrollment).length ??
      (isUserOnHold && enrollments && enrollments.length > 0
        ? enrollments.length
        : 0);

    const { data: profile } = await this.db
      .from('seafarer_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const { data: docs } = await this.db
      .from('documents')
      .select('type, expiry_date, status')
      .eq('user_id', userId);

    const now = new Date();
    const docStatus = (type: string) => {
      const doc = docs?.find((d: any) => d.type?.toLowerCase() === type);
      if (!doc) return 'missing';
      const exp = (doc as any).expiry_date || (doc as any).expiryDate;
      if (exp && new Date(exp) < now) return 'pending';
      return doc.status?.toLowerCase() === 'verified' ? 'verified' : 'pending';
    };

    const certificates = {
      passport: docStatus('passport'),
      cdc: docStatus('cdc'),
      medical: docStatus('medical'),
      stcw: completedCount > 0 ? 'verified' : 'pending',
    };

    const fields = [
      (profile as any)?.indos_num || (profile as any)?.indosNumber,
      completedCount > 0,
      (docs?.length ?? 0) > 0,
      profile?.dob,
    ];
    const profileCompletion = Math.round(
      (fields.filter(Boolean).length / fields.length) * 100,
    );

    let activeCourseData = null;
    if (activeEnrollment) {
      const meta = parseMeta(activeEnrollment);
      const courseObj =
        (activeEnrollment as any).course ||
        (activeEnrollment as any).courses ||
        (activeEnrollment as any).Course ||
        {};
      const courseCode = courseObj.code || '';
      const associatedInsts = getInstitutesForCourse(courseCode);
      const matchedInst =
        CONFIGURED_INSTITUTES.find(
          (i) => i.id === meta.instituteId || i.name === meta.instituteName,
        ) || associatedInsts[0];

      activeCourseData = {
        name: courseObj.name || 'Maritime Training Course',
        code: courseCode,
        status: 'Ongoing',
        progress: (activeEnrollment as any).progress ?? 35,
        trainingType: 'Physical / Offline Training',
        institute: matchedInst,
        batchSchedule: meta.batchSchedule || matchedInst.schedule,
      };
    }

    let onHoldCourseData = null;
    if (onHoldEnrollment) {
      const meta = parseMeta(onHoldEnrollment);
      const courseObj =
        (onHoldEnrollment as any).course ||
        (onHoldEnrollment as any).courses ||
        (onHoldEnrollment as any).Course ||
        {};
      const courseCode = courseObj.code || '';
      const associatedInsts = getInstitutesForCourse(courseCode);
      const matchedInst =
        CONFIGURED_INSTITUTES.find(
          (i) => i.id === meta.instituteId || i.name === meta.instituteName,
        ) || associatedInsts[0];

      onHoldCourseData = {
        name: courseObj.name || 'Maritime Training Course',
        code: courseCode,
        status: 'On Hold',
        progress: (onHoldEnrollment as any).progress ?? 0,
        trainingType: 'Physical / Offline Training',
        institute: matchedInst,
        batchSchedule: meta.batchSchedule || matchedInst.schedule,
        holdReason:
          'Administrative / Document Verification on hold. Profile & history are preserved.',
      };
    }

    return {
      profileCompletion,
      userStatus: isUserOnHold ? 'On Hold' : userRecord?.status || 'Active',
      courses: {
        active: activeCourseData,
        onHold: onHoldCourseData,
        ongoingCount,
        onHoldCount,
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
        .from('users')
        .select('id, name, email, created_at')
        .eq('role', 'SEAFARER')
        .order('created_at', { ascending: false })
        .limit(3);

      // 2. Fetch recent course enrollments
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('id, status, created_at, user_id, course_id')
        .order('created_at', { ascending: false })
        .limit(3);

      // 3. Fetch recent documents uploaded
      const { data: documents } = await supabase
        .from('documents')
        .select('id, name, type, status, upload_date, user_id')
        .eq('status', 'Pending')
        .order('upload_date', { ascending: false })
        .limit(3);

      const { data: allCourses } = await supabase
        .from('courses')
        .select('id, name');
      const cMap = new Map((allCourses || []).map((c: any) => [c.id, c.name]));

      const notificationsList: any[] = [];

      // Map registrations
      (users || []).forEach((u: any) => {
        notificationsList.push({
          id: `reg-${u.id}`,
          title: `👤 New Seafarer Registration`,
          message: `${u.name || u.email || 'A user'} joined the platform.`,
          isRead: false,
          read: false,
          createdAt: u.created_at,
        });
      });

      // Map enrollments
      (enrollments || []).forEach((e: any) => {
        const cName = cMap.get(e.course_id) || 'Maritime Course';
        notificationsList.push({
          id: `enroll-${e.id}`,
          title: `⚓ New Course Booking`,
          message: `A candidate booked ${cName}.`,
          isRead: false,
          read: false,
          createdAt: e.created_at,
        });
      });

      // Map documents
      (documents || []).forEach((d: any) => {
        notificationsList.push({
          id: `doc-${d.id}`,
          title: `📄 Verification Required`,
          message: `Pending review for ${d.type || 'document'} uploaded by seafarer.`,
          isRead: false,
          read: false,
          createdAt: d.upload_date,
        });
      });

      // Sort by date descending
      return notificationsList
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 5);
    }

    const { data: enrollments } = await this.db
      .from('enrollments')
      .select('id, status, created_at, course_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: allCourses } = await this.db
      .from('courses')
      .select('id, name');
    const cMap = new Map((allCourses || []).map((c: any) => [c.id, c.name]));

    return (enrollments ?? []).map((e: any) => {
      const cName = cMap.get(e.course_id) || 'Maritime Course';
      return {
        id: e.id,
        title:
          e.status === 'Completed'
            ? `✅ Course Completed: ${cName}`
            : e.status === 'On Hold' || e.status === 'on_hold'
              ? `⚠️ Course On Hold: ${cName}`
              : `📋 Enrollment Processing: ${cName}`,
        message:
          e.status === 'Completed'
            ? `Your certificate for ${cName} has been issued.`
            : e.status === 'On Hold' || e.status === 'on_hold'
              ? `Your training for ${cName} is on hold pending verification.`
              : `Your physical training booking for ${cName} is confirmed.`,
        isRead: false,
        read: false,
        createdAt: e.created_at,
      };
    });
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
      .from('courses')
      .select('*')
      .order('name');

    if (error) {
      console.error('getAllCourses error:', error.message);
      return [];
    }

    // Attach associated physical training institutes to each course (PRD 5.2, 5.3)
    return (data ?? []).map((course: any) => {
      const associatedInstitutes = getInstitutesForCourse(course.code);
      return {
        ...course,
        trainingType: 'Physical / Offline Training',
        deliveryMode: 'Classroom & Certified Maritime Simulators',
        institutes: associatedInstitutes,
        availableInstitutesCount: associatedInstitutes.length,
      };
    });
  }

  async getMyEnrollments(userId: string) {
    const { data: userRecord } = await this.db
      .from('users')
      .select('id, email, status')
      .eq('id', userId)
      .maybeSingle();

    const isUserOnHold =
      (userRecord?.status || '').toLowerCase() === 'on hold' ||
      (userRecord?.status || '').toLowerCase() === 'on_hold';

    // Fetch all courses to have a reliable lookup table
    const { data: allCourses } = await this.db.from('courses').select('*');
    const courseMap = new Map((allCourses || []).map((c: any) => [c.id, c]));

    const { data: enrollmentsData, error } = await this.db
      .from('enrollments')
      .select('id, status, progress, created_at, remarks, course_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('getMyEnrollments error:', error.message);
    }

    const existingEnrollments: any[] = enrollmentsData
      ? [...enrollmentsData]
      : [];
    const enrolledCourseIds = new Set(
      existingEnrollments
        .map((e: any) => e.course_id || e.courseId)
        .filter(Boolean),
    );

    // Also check for any purchases in partner_payables or invoices for this seafarer
    try {
      const { data: payables } = await this.db
        .from('partner_payables')
        .select('*')
        .eq('seafarer_user_id', userId);

      if (payables && payables.length > 0) {
        for (const p of payables) {
          if (p.course_id && !enrolledCourseIds.has(p.course_id)) {
            existingEnrollments.push({
              id: p.enrollment_id || p.id,
              user_id: userId,
              course_id: p.course_id,
              status: 'active',
              progress: 25,
              created_at: p.created_at,
              remarks: JSON.stringify({
                source: 'Partner Purchase',
                partnerId: p.partner_id,
              }),
            });
            enrolledCourseIds.add(p.course_id);
          }
        }
      }
    } catch {
      // Non-blocking
    }

    return existingEnrollments.map((e: any) => {
      let meta: any = {};
      try {
        if (
          e.remarks &&
          typeof e.remarks === 'string' &&
          e.remarks.startsWith('{')
        ) {
          meta = JSON.parse(e.remarks);
        } else if (e.remarks && typeof e.remarks === 'object') {
          meta = e.remarks;
        }
      } catch (err) {
        meta = {};
      }

      const rawStatus = (e.status || '').toLowerCase();
      let normStatus: 'active' | 'on_hold' | 'completed' = 'active';
      if (rawStatus === 'completed') {
        normStatus = 'completed';
      } else if (
        rawStatus === 'on hold' ||
        rawStatus === 'on_hold' ||
        rawStatus === 'onhold' ||
        (isUserOnHold && rawStatus !== 'completed')
      ) {
        normStatus = 'on_hold';
      } else {
        normStatus = 'active';
      }

      const cLookup =
        (e.course_id && courseMap.get(e.course_id)) ||
        (e.courseId && courseMap.get(e.courseId));

      const rawCourse = e.courses || e.course || e.Course || cLookup || {};

      const resolvedCourse = {
        id: rawCourse.id || e.course_id || e.courseId,
        name:
          rawCourse.name ||
          cLookup?.name ||
          'Maritime Safety & Technical Course',
        code: rawCourse.code || cLookup?.code || 'STCW',
        category:
          rawCourse.category || cLookup?.category || 'Maritime Training',
        duration: rawCourse.duration || cLookup?.duration || '5 Days',
        fees:
          rawCourse.fees ||
          rawCourse.standard_fee ||
          cLookup?.standard_fee ||
          12000,
        description:
          rawCourse.description ||
          cLookup?.description ||
          'Comprehensive DG Shipping accredited maritime training module.',
      };

      const courseCode = resolvedCourse.code;
      const associatedInstitutes = getInstitutesForCourse(courseCode);
      const selectedInstitute =
        CONFIGURED_INSTITUTES.find(
          (i) => i.id === meta.instituteId || i.name === meta.instituteName,
        ) ||
        (associatedInstitutes && associatedInstitutes.length > 0
          ? associatedInstitutes[0]
          : CONFIGURED_INSTITUTES[0]);

      return {
        id: e.id,
        status: normStatus,
        purchaseDate:
          e.startDate ??
          e.createdAt ??
          e.created_at ??
          new Date().toISOString(),
        course: resolvedCourse,
        courseId: resolvedCourse.id,
        progress:
          e.progress ??
          (normStatus === 'completed'
            ? 100
            : normStatus === 'on_hold'
              ? e.progress || 0
              : 35),
        trainingType: 'Physical / Offline Maritime Training',
        institute: selectedInstitute,
        batchSchedule: meta.batchSchedule || selectedInstitute.schedule,
        enrollmentDetails: {
          batchId: `BATCH-${(e.id || '').substring(0, 6).toUpperCase()}`,
          reportingAddress: selectedInstitute.address,
          coordinatorContact: selectedInstitute.phone,
          coordinatorEmail: selectedInstitute.email,
          facilities: selectedInstitute.facilities,
          onHoldNotice:
            normStatus === 'on_hold'
              ? 'Training placed on hold. All profile history & purchases remain intact.'
              : null,
        },
      };
    });
  }

  async enrollInCourse(
    userId: string,
    courseId: string,
    referralCode?: string,
    instituteId?: string,
    instituteName?: string,
    batchSchedule?: string,
  ) {
    const { data: course } = await this.db
      .from('courses')
      .select('id, fees, name, code')
      .eq('id', courseId)
      .single();

    if (!course) throw new BadRequestException('Course not found');

    const { data: existing } = await this.db
      .from('enrollments')
      .select('id')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .single();

    if (existing)
      throw new BadRequestException('Already enrolled in this course');

    // Determine institute associated with this course
    const associatedInstitutes = getInstitutesForCourse(course.code);
    const chosenInstitute =
      CONFIGURED_INSTITUTES.find(
        (i) => i.id === instituteId || i.name === instituteName,
      ) ||
      (associatedInstitutes && associatedInstitutes.length > 0
        ? associatedInstitutes[0]
        : CONFIGURED_INSTITUTES[0]);

    const metadataObj = {
      instituteId: chosenInstitute.id,
      instituteName: chosenInstitute.name,
      instituteCode: chosenInstitute.code,
      idtNumber: chosenInstitute.idtNumber,
      instituteAddress: chosenInstitute.address,
      batchSchedule: batchSchedule || chosenInstitute.schedule,
      trainingType: 'Physical / Offline Training',
      enrolledAt: new Date().toISOString(),
    };

    const insertPayload: any = {
      id: randomUUID(),
      user_id: userId,
      course_id: courseId,
      status: 'Processing',
      progress: 0,
      created_at: new Date().toISOString(),
      remarks: JSON.stringify(metadataObj),
    };

    let { data, error } = await this.db
      .from('enrollments')
      .insert(insertPayload)
      .select()
      .single();

    if (error && error.message?.includes('remarks')) {
      delete insertPayload.remarks;
      const retry = await this.db
        .from('enrollments')
        .insert(insertPayload)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) throw new BadRequestException(error.message);

    // ── Referral Attribution, Commission Snapshot & Invoice Generation ─────
    console.log(
      `[Backend Enroll] User ${userId} enrolling in ${courseId} with referralCode: "${referralCode}"`,
    );
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
        .from('users')
        .select('name, email, phone')
        .eq('id', userId)
        .single();

      // Case A: Referral Code is entered manually
      if (referralCode && referralCode.trim().length > 0) {
        const cleanRefCode = referralCode.trim().toUpperCase();
        const { data: matchedAgentMeta } = await this.db
          .from('agent_metadata')
          .select('user_id, general_commission, course_commissions')
          .eq('referral_code', cleanRefCode)
          .single();

        if (matchedAgentMeta) {
          targetAgentId = matchedAgentMeta.user_id;
          targetAgentReferralCode = cleanRefCode;
          if (
            matchedAgentMeta.course_commissions &&
            matchedAgentMeta.course_commissions[course.code] !== undefined
          ) {
            targetCommissionRate = parseFloat(
              matchedAgentMeta.course_commissions[course.code],
            );
            commissionSource = `Course Specific Override (${course.code})`;
          } else if (matchedAgentMeta.general_commission !== undefined) {
            targetCommissionRate = parseFloat(
              matchedAgentMeta.general_commission,
            );
            commissionSource = 'General Commission';
          }
        }
      }

      // Case B: No manual code - Check Auto-Attribution via Active Referral Leads
      if (!targetAgentId && seafarerUser) {
        const seafarerEmail = seafarerUser.email.trim().toLowerCase();
        const seafarerPhone = seafarerUser.phone?.trim();

        let leadQuery = this.db
          .from('referral_leads')
          .select('id, agent_id, status, created_at, expiry_at')
          .eq('status', 'New')
          .gt('expiry_at', new Date().toISOString());

        if (seafarerPhone) {
          leadQuery = leadQuery.or(
            `email.ilike.${seafarerEmail},phone.eq.${seafarerPhone}`,
          );
        } else {
          leadQuery = leadQuery.ilike('email', seafarerEmail);
        }

        const { data: matchingLeads } = await leadQuery;

        if (matchingLeads && matchingLeads.length > 0) {
          // Check for multi-agent collision
          const uniqueAgentsMap = new Map<string, any>();
          for (const ml of matchingLeads) {
            if (!uniqueAgentsMap.has(ml.agent_id)) {
              const { data: agMeta } = await this.db
                .from('agent_metadata')
                .select('general_commission, course_commissions')
                .eq('user_id', ml.agent_id)
                .single();

              let rate = agMeta?.general_commission || 5.0;
              let source = 'General Commission';
              if (agMeta?.course_commissions?.[course.code] !== undefined) {
                rate = parseFloat(agMeta.course_commissions[course.code]);
                source = `Course Specific Override (${course.code})`;
              }

              uniqueAgentsMap.set(ml.agent_id, {
                agentId: ml.agent_id,
                leadId: ml.id,
                commissionRate: rate,
                commissionSource: source,
                submittedAt: ml.created_at,
              });
            }
          }

          if (uniqueAgentsMap.size === 1) {
            const singleAgent = Array.from(uniqueAgentsMap.values())[0];
            targetAgentId = singleAgent.agentId;
            matchingLeadId = singleAgent.leadId;
            targetCommissionRate = singleAgent.commissionRate;
            commissionSource = `Lead Auto-Attribution (${singleAgent.commissionSource})`;
          } else if (uniqueAgentsMap.size > 1) {
            // Conflict State: More than one agent submitted this lead
            isConflict = true;
            conflictingAgents = Array.from(uniqueAgentsMap.values());
            console.warn(
              `[Referral Collision] Multiple agents (${conflictingAgents.map((a) => a.agentId).join(', ')}) claim lead for user ${userId}`,
            );
          }
        }
      }

      // ── Commission Calculation & Snapshot Creation (PRD 8.3) ──────────────
      const rawCourseFee = course.fees || '15000';
      const parseFee = (feeStr: any): number => {
        if (typeof feeStr === 'number') return feeStr;
        if (!feeStr) return 0;
        const cleaned = String(feeStr).replace(/[^0-9.]/g, '');
        return parseFloat(cleaned) || 0;
      };
      const courseFee = parseFee(rawCourseFee);
      let createdCommissionId: string | undefined;

      if (isConflict && conflictingAgents.length > 0) {
        // Create flagged commission records for admin review
        for (const conf of conflictingAgents) {
          const commAmt = (conf.commissionRate / 100) * courseFee;
          const commId = randomUUID();
          await this.db.from('commissions').insert({
            id: commId,
            agent_id: conf.agentId,
            purchase_id: data.id,
            seafarer_name: seafarerUser?.name || 'Seafarer',
            course_name: course.name || 'Maritime Course',
            course_fee: courseFee,
            commission_rate: conf.commissionRate,
            commission_amount: commAmt,
            commission_source: 'Lead Conflict (Pending Resolution)',
            commission_version: 'v1.0',
            status: 'Conflict',
            remarks: `Conflict with ${conflictingAgents.length} claiming agents. Awaiting admin resolution.`,
            created_at: new Date().toISOString(),
          });

          await this.db.from('commission_status_history').insert({
            id: randomUUID(),
            commission_id: commId,
            old_status: 'New',
            new_status: 'Conflict',
            reason:
              'Multiple referral leads registered for the same customer prior to checkout.',
            changed_by_user_id: userId,
            changed_by_user_name: seafarerUser?.name || 'Customer Checkout',
            created_at: new Date().toISOString(),
          });
        }
      } else if (targetAgentId) {
        // Unique / resolved attribution -> Create Active Pending Commission
        const commissionAmount = (targetCommissionRate / 100) * courseFee;
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

        const { error: commErr } = await this.db
          .from('commissions')
          .insert(commObj);

        if (
          commErr &&
          (commErr.code === 'PGRST204' || commErr.message?.includes('column'))
        ) {
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
          const { error: retryErr } = await this.db
            .from('commissions')
            .insert(stdCommObj);
          if (retryErr)
            console.error(
              '[Referral] Standard commission insert error:',
              retryErr.message,
            );
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
            reason:
              'Initial commission snapshot generated upon course checkout',
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
            .update({ status: 'Converted' })
            .eq('id', matchingLeadId);
        }
        console.log(
          `[Referral] Attributed commission ${createdCommissionId} to agent ${targetAgentId} for course ${course.name}`,
        );
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
          if (
            courseOverrides[courseId] !== undefined &&
            courseOverrides[courseId] !== null
          ) {
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

          const { error: commErr } = await this.db
            .from('commissions')
            .insert(commObjConflict);
          if (
            commErr &&
            (commErr.code === 'PGRST204' || commErr.message?.includes('column'))
          ) {
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
              reason:
                'Conflicting referral leads detected. Placed under manual review.',
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
          .from('users')
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
      console.error(
        '[Referral] Unexpected error in commission & invoice flow:',
        err?.message,
      );
    }

    return data;
  }

  async updateCourseProgress(
    userId: string,
    courseId: string,
    progress: number,
  ) {
    const dbStatus = progress >= 100 ? 'Completed' : 'Processing';
    const updateData: any = {
      progress,
      status: dbStatus,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.db
      .from('enrollments')
      .update(updateData)
      .eq('user_id', userId)
      .eq('course_id', courseId)
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
      .from('documents')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.warn('[getDocuments] Query warning:', error.message);
      return [];
    }

    let profileData: any = null;
    try {
      const { data: prof } = await this.db
        .from('seafarer_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      profileData = prof;
    } catch (_) {}
    return (data ?? []).map((d: any) => {
      let meta: any = {};
      try {
        const remarksStr = d.remarks || d.metadata;
        if (
          remarksStr &&
          typeof remarksStr === 'string' &&
          remarksStr.startsWith('{')
        ) {
          meta = JSON.parse(remarksStr);
        } else if (remarksStr && typeof remarksStr === 'object') {
          meta = remarksStr;
        }
      } catch (e) {
        meta = {};
      }

      const isPass = d.type?.toLowerCase() === 'passport';
      const isCdc = d.type?.toLowerCase() === 'cdc';

      return {
        id: d.id,
        type: d.type,
        label: d.name ?? d.type,
        status: d.status ?? 'pending',
        expiryDate:
          d.expiry_date ??
          d.expiryDate ??
          meta.expiryDate ??
          (isPass
            ? profileData?.passport_expiry || profileData?.passportExpiry
            : isCdc
              ? profileData?.cdc_expiry || profileData?.cdcExpiry
              : null),
        uploadedAt:
          d.upload_date ?? d.uploadDate ?? d.created_at ?? d.createdAt ?? null,
        url: d.url,
        passportNumber:
          meta.passportNumber ??
          d.passportNumber ??
          (isPass
            ? profileData?.passport_num || profileData?.passportNum
            : null),
        cdcNumber:
          meta.cdcNumber ??
          d.cdcNumber ??
          (isCdc ? profileData?.cdc_num || profileData?.cdcNum : null),
        placeOfIssue:
          meta.placeOfIssue ??
          d.placeOfIssue ??
          (isPass
            ? profileData?.passport_place || profileData?.passportPlace
            : isCdc
              ? profileData?.cdc_place || profileData?.cdcPlace
              : null),
        issueDate:
          meta.issueDate ??
          d.issueDate ??
          (isPass
            ? profileData?.passport_issue || profileData?.passportIssue
            : isCdc
              ? profileData?.cdc_issue || profileData?.cdcIssue
              : null),
        metadata: meta,
        courseName: meta.courseName || null,
        courseType: meta.courseType || null,
        durationFrom: meta.durationFrom || null,
        durationTo: meta.durationTo || null,
      };
    });
  }

  async uploadDocument(
    userId: string,
    file: any,
    type: string,
    expiryDate?: string,
    bodyMetadata?: any,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file provided for document upload.');
    }

    const docType =
      (type || bodyMetadata?.type || 'other')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '') || 'document';
    const BUCKET = 'seafarer-documents';

    // Verify bucket exists once without re-running on every upload
    await this.ensureBucketExists(BUCKET);

    // Business Rule for Passport & CDC: Only ONE active document allowed. Delete pre-existing ones.
    if (docType === 'passport' || docType === 'cdc') {
      const { data: existingDocs } = await this.db
        .from('documents')
        .select('id, url')
        .eq('user_id', userId)
        .ilike('type', docType);

      if (existingDocs && existingDocs.length > 0) {
        for (const exDoc of existingDocs) {
          if (exDoc.url && !exDoc.url.startsWith('/uploads/')) {
            try {
              await this.db.storage.from(BUCKET).remove([exDoc.url]);
            } catch (_) {}
          }
          await this.db.from('documents').delete().eq('id', exDoc.id);
        }
      }
    }

    const docId = randomUUID();
    const displayName = cleanDisplayName(
      file.originalname,
      `${docType}-${docId}`,
    );
    const safeFileName = sanitizeStorageKey(
      file.originalname,
      `${docType}-${docId}`,
    );
    const mimeType = file.mimetype || 'application/octet-stream';

    // Storage path: userId/docId/safeFileName (S3/Supabase key-safe without spaces or control chars)
    const storagePath = `${userId}/${docId}/${safeFileName}`;

    let { error: storageError } = await this.db.storage
      .from(BUCKET)
      .upload(storagePath, file.buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (
      storageError &&
      (storageError.message?.toLowerCase().includes('bucket') ||
        storageError.message?.toLowerCase().includes('not found'))
    ) {
      try {
        await this.db.storage.createBucket(BUCKET, { public: true });
        const retry = await this.db.storage
          .from(BUCKET)
          .upload(storagePath, file.buffer, {
            contentType: mimeType,
            upsert: true,
          });
        storageError = retry.error;
      } catch (e) {
        // ignore
      }
    }

    if (storageError) {
      console.error(
        '[uploadDocument] Supabase Storage upload error:',
        storageError.message,
      );
      if (storageError.message?.toLowerCase().includes('bucket not found')) {
        throw new BadRequestException(
          `Storage bucket '${BUCKET}' does not exist in Supabase Storage. Please create the '${BUCKET}' bucket.`,
        );
      }
      throw new BadRequestException(
        `File storage failed: ${storageError.message}`,
      );
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

    const insertPayload: any = {
      id: docId,
      user_id: userId,
      type: docType,
      name: displayName,
      url: storagePath,
      status: 'Pending',
      expiry_date: expiryDate || bodyMetadata?.expiryDate || null,
      upload_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    // Try including remarks column; if it fails, retry without it
    insertPayload.remarks = JSON.stringify(metadataObj);
    let { data, error } = await this.db
      .from('documents')
      .insert(insertPayload)
      .select()
      .single();

    if (error && error.message?.includes('remarks')) {
      delete insertPayload.remarks;
      const retry = await this.db
        .from('documents')
        .insert(insertPayload)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      // Clean up storage object if database insertion failed
      try {
        await this.db.storage.from(BUCKET).remove([storagePath]);
      } catch (_) {}
      throw new BadRequestException(error.message);
    }

    // Sync profile table for passport or cdc if available
    try {
      if (docType === 'passport' && bodyMetadata?.passportNumber) {
        await this.db.from('seafarer_profiles').upsert(
          {
            user_id: userId,
            passport_num: bodyMetadata.passportNumber,
            passport_place: bodyMetadata.placeOfIssue,
            passport_issue: bodyMetadata.issueDate,
            passport_expiry: expiryDate || bodyMetadata.expiryDate,
          },
          { onConflict: 'user_id' },
        );
      } else if (docType === 'cdc' && bodyMetadata?.cdcNumber) {
        await this.db.from('seafarer_profiles').upsert(
          {
            user_id: userId,
            cdc_num: bodyMetadata.cdcNumber,
            cdc_place: bodyMetadata.placeOfIssue,
            cdc_issue: bodyMetadata.issueDate,
            cdc_expiry: expiryDate || bodyMetadata.expiryDate,
          },
          { onConflict: 'user_id' },
        );
      }
    } catch (_) {}

    return {
      ...data,
      metadata: metadataObj,
      passportNumber: metadataObj.passportNumber,
      cdcNumber: metadataObj.cdcNumber,
      placeOfIssue: metadataObj.placeOfIssue,
      issueDate: metadataObj.issueDate,
      expiryDate: metadataObj.expiryDate,
      message: 'Document uploaded successfully.',
    };
  }

  async updateDocument(
    userId: string,
    docId: string,
    bodyMetadata: any,
    file?: any,
  ) {
    const { data: existingDoc, error: fetchErr } = await this.db
      .from('documents')
      .select('*')
      .eq('id', docId)
      .single();

    if (fetchErr || !existingDoc) {
      throw new BadRequestException('Document not found.');
    }

    if (existingDoc.user_id !== userId && existingDoc.userId !== userId) {
      throw new BadRequestException('Access denied.');
    }

    let storagePath = existingDoc.url;
    let fileName = existingDoc.name;
    const BUCKET = 'seafarer-documents';

    if (file && file.buffer && file.buffer.length > 0) {
      const displayName = cleanDisplayName(
        file.originalname,
        `${existingDoc.type}-${docId}`,
      );
      const safeFileName = sanitizeStorageKey(
        file.originalname,
        `${existingDoc.type}-${docId}`,
      );
      const mimeType = file.mimetype || 'application/octet-stream';
      storagePath = `${userId}/${docId}/${safeFileName}`;
      fileName = displayName;

      // Delete old file if replacing
      if (
        existingDoc.url &&
        existingDoc.url !== storagePath &&
        !existingDoc.url.startsWith('/uploads/')
      ) {
        try {
          await this.db.storage.from(BUCKET).remove([existingDoc.url]);
        } catch (_) {}
      }

      await this.ensureBucketExists(BUCKET);
      let { error: storageError } = await this.db.storage
        .from(BUCKET)
        .upload(storagePath, file.buffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (
        storageError &&
        (storageError.message?.toLowerCase().includes('bucket') ||
          storageError.message?.toLowerCase().includes('not found'))
      ) {
        try {
          await this.db.storage.createBucket(BUCKET, { public: true });
          const retry = await this.db.storage
            .from(BUCKET)
            .upload(storagePath, file.buffer, {
              contentType: mimeType,
              upsert: true,
            });
          storageError = retry.error;
        } catch (e) {
          // ignore
        }
      }

      if (storageError) {
        throw new BadRequestException(
          `File replacement storage failed: ${storageError.message}`,
        );
      }
    }

    let existingMeta: any = {};
    try {
      const remarksStr = existingDoc.remarks || existingDoc.metadata;
      if (
        remarksStr &&
        typeof remarksStr === 'string' &&
        remarksStr.startsWith('{')
      ) {
        existingMeta = JSON.parse(remarksStr);
      }
    } catch (e) {
      existingMeta = {};
    }

    const updatedMeta = {
      ...existingMeta,
      passportNumber:
        bodyMetadata?.passportNumber ?? existingMeta.passportNumber,
      cdcNumber: bodyMetadata?.cdcNumber ?? existingMeta.cdcNumber,
      placeOfIssue: bodyMetadata?.placeOfIssue ?? existingMeta.placeOfIssue,
      issueDate: bodyMetadata?.issueDate ?? existingMeta.issueDate,
      expiryDate: bodyMetadata?.expiryDate ?? existingMeta.expiryDate,
      courseName: bodyMetadata?.courseName ?? existingMeta.courseName,
      courseType: bodyMetadata?.courseType ?? existingMeta.courseType,
      durationFrom: bodyMetadata?.durationFrom ?? existingMeta.durationFrom,
      durationTo: bodyMetadata?.durationTo ?? existingMeta.durationTo,
    };

    const updatePayload: any = {
      name: fileName,
      url: storagePath,
      expiry_date:
        bodyMetadata?.expiryDate ||
        existingDoc.expiry_date ||
        existingDoc.expiryDate,
      remarks: JSON.stringify(updatedMeta),
    };

    let { data, error } = await this.db
      .from('documents')
      .update(updatePayload)
      .eq('id', docId)
      .select()
      .single();

    if (error && error.message?.includes('remarks')) {
      delete updatePayload.remarks;
      const retry = await this.db
        .from('documents')
        .update(updatePayload)
        .eq('id', docId)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) throw new BadRequestException(error.message);
    return {
      ...data,
      metadata: updatedMeta,
      message: 'Document updated successfully.',
    };
  }

  async downloadDocument(userId: string, docId: string, role?: string) {
    // Fetch document record
    const { data: doc, error } = await this.db
      .from('documents')
      .select('id, url, name, user_id, type')
      .eq('id', docId)
      .single();

    if (error || !doc) {
      throw new BadRequestException('Document record not found.');
    }

    // Ownership & authorization check: seafarer can download own doc, MASTER/COMPANY_ADMIN/PARTNER_ADMIN can download any
    if (
      doc.user_id !== userId &&
      role !== 'MASTER' &&
      role !== 'COMPANY_ADMIN' &&
      role !== 'PARTNER_ADMIN' &&
      role !== 'agent-admin' &&
      role !== 'AGENT_ADMIN'
    ) {
      throw new BadRequestException(
        'Access denied. You do not have permission to download this document.',
      );
    }

    const storedUrl: string = doc.url || '';
    const BUCKET = 'seafarer-documents';
    let storagePath = storedUrl;

    const publicPathMarker = `/object/public/${BUCKET}/`;
    const signedPathMarker = `/object/sign/${BUCKET}/`;

    if (storedUrl.includes(publicPathMarker)) {
      storagePath = decodeURIComponent(
        storedUrl.substring(
          storedUrl.indexOf(publicPathMarker) + publicPathMarker.length,
        ),
      );
    } else if (storedUrl.includes(signedPathMarker)) {
      storagePath = decodeURIComponent(
        storedUrl.substring(
          storedUrl.indexOf(signedPathMarker) + signedPathMarker.length,
        ),
      );
    }

    // Check if storagePath is a fake /uploads/ path or empty
    const validPathFound = false;
    if (storagePath && !storagePath.startsWith('/uploads/')) {
      // Test if path exists in storage
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

    // Fallback Search: If path was /uploads/ or direct path failed, search Supabase Storage bucket for matching file
    const { data: bucketFiles } = await this.db.storage
      .from(BUCKET)
      .list('', { limit: 100 });
    if (bucketFiles && bucketFiles.length > 0) {
      // Find file matching doc.user_id, doc.id, or doc.type
      const matchingFile =
        bucketFiles.find(
          (f) =>
            (doc.user_id && f.name.includes(doc.user_id)) ||
            (doc.id && f.name.includes(doc.id)) ||
            (doc.type && f.name.toLowerCase().includes(doc.type.toLowerCase())),
        ) ||
        bucketFiles.find(
          (f) =>
            f.name.endsWith('.pdf') ||
            f.name.endsWith('.png') ||
            f.name.endsWith('.jpg'),
        );

      if (matchingFile) {
        storagePath = matchingFile.name;
        // Auto-fix DB record so future downloads are fast
        await this.db
          .from('documents')
          .update({ url: storagePath })
          .eq('id', doc.id);

        const { data: signedData } = await this.db.storage
          .from(BUCKET)
          .createSignedUrl(storagePath, 60);
        if (signedData?.signedUrl) {
          return {
            signedUrl: signedData.signedUrl,
            fileName: doc.name || matchingFile.name,
          };
        }
      }
    }

    throw new BadRequestException('Document file is unavailable.');
  }

  async deleteDocument(userId: string, docId: string) {
    const { data: doc } = await this.db
      .from('documents')
      .select('id, url, user_id')
      .eq('id', docId)
      .eq('user_id', userId)
      .maybeSingle();

    if (doc?.url && !doc.url.startsWith('/uploads/')) {
      try {
        await this.db.storage.from('seafarer-documents').remove([doc.url]);
      } catch (_) {}
    }

    const { error } = await this.db
      .from('documents')
      .delete()
      .eq('id', docId)
      .eq('user_id', userId);

    if (error) throw new BadRequestException(error.message);
    return { id: docId, deleted: true };
  }

  // ─────────────────────────────────────────────
  // USER PROFILE & SEA SERVICE
  // ─────────────────────────────────────────────
  async uploadProfilePhoto(userId: string, file: any) {
    if (!file || !file.buffer) {
      throw new BadRequestException(
        'No image file provided for profile photo upload.',
      );
    }

    const mimeType = file.mimetype || 'image/jpeg';
    const validMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validMimes.includes(mimeType.toLowerCase())) {
      throw new BadRequestException(
        'Invalid image format. Only JPG, JPEG, PNG, and WEBP are supported.',
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Profile photo size exceeds 5MB.');
    }

    await this.ensureBucketExists('seafarer-documents');

    const ext = this.getSafeFileExtension(file.originalname, mimeType);
    const photoId = randomUUID();
    const storagePath = `avatars/${userId}/${photoId}${ext}`;

    const { error: uploadErr } = await this.db.storage
      .from('seafarer-documents')
      .upload(storagePath, file.buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadErr) {
      console.error('[uploadProfilePhoto] Storage error:', uploadErr);
      throw new BadRequestException(
        'Profile photo upload failed. Please try again.',
      );
    }

    const {
      data: { publicUrl },
    } = this.db.storage.from('seafarer-documents').getPublicUrl(storagePath);

    // Persist immediately to seafarer_profiles record
    const { data: existingProfile } = await this.db
      .from('seafarer_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    const profileId = existingProfile?.id || randomUUID();
    const { error: upsertErr } = await this.db.from('seafarer_profiles').upsert(
      {
        id: profileId,
        user_id: userId,
        profile_picture: publicUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    if (upsertErr) {
      console.error('[uploadProfilePhoto] Profile update error:', upsertErr);
      throw new BadRequestException(
        'Failed to save profile picture to database.',
      );
    }

    return {
      success: true,
      profilePicture: publicUrl,
    };
  }

  async getUserProfile(userId: string) {
    const { data: user } = await this.db
      .from('users')
      .select('id, name, email, phone, role')
      .eq('id', userId)
      .maybeSingle();

    const { data: profile } = await this.db
      .from('seafarer_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const { data: seaServiceRecords } = await this.db
      .from('sea_service_records')
      .select('*')
      .eq('user_id', userId);

    const nameParts = (user?.name || '').trim().split(' ');
    const firstName =
      profile?.first_name || profile?.firstName || nameParts[0] || '';
    const lastName =
      profile?.last_name ||
      profile?.lastName ||
      nameParts.slice(1).join(' ') ||
      '';

    let parsedAddress = profile?.address ?? '';
    let parsedCity = profile?.city ?? '';
    let parsedState = profile?.state ?? '';
    let parsedCountry = profile?.country ?? profile?.nationality ?? 'India';
    let parsedPlaceOfBirth =
      profile?.place_of_birth ??
      profile?.birth_place ??
      profile?.placeOfBirth ??
      profile?.birthPlace ??
      '';
    let parsedAlternatePhone =
      profile?.alternate_phone ??
      profile?.alternatePhone ??
      profile?.alt_phone ??
      profile?.altPhone ??
      '';

    if (
      profile?.address &&
      typeof profile.address === 'string' &&
      profile.address.trim().startsWith('{')
    ) {
      try {
        const parsed = JSON.parse(profile.address);
        parsedAddress = parsed.address ?? parsedAddress;
        parsedCity = parsed.city ?? parsedCity;
        parsedState = parsed.state ?? parsedState;
        parsedCountry = parsed.country ?? parsedCountry;
        parsedPlaceOfBirth = parsed.placeOfBirth ?? parsedPlaceOfBirth;
        parsedAlternatePhone = parsed.alternatePhone ?? parsedAlternatePhone;
      } catch (_) {}
    }

    let onboardingStatus = null;
    const roleUpper = user?.role?.toUpperCase();
    if (roleUpper === 'PARTNER' || roleUpper === 'AGENT') {
      const { data: meta } = await this.db
        .from('agent_metadata')
        .select('onboarding_status')
        .eq('user_id', userId)
        .maybeSingle();
      if (meta) {
        onboardingStatus = meta.onboarding_status;
      }
    }

    const photoUrl =
      profile?.profile_picture ?? profile?.profilePicture ?? null;
    const indosNum = profile?.indos_num ?? profile?.indosNumber ?? '';

    return {
      ...(user ?? {}),
      onboardingStatus,
      firstName,
      lastName,
      email: user?.email,
      phone: user?.phone,
      profilePicture: photoUrl,
      profile: {
        firstName,
        lastName,
        email: user?.email,
        phone: user?.phone,
        alternatePhone: parsedAlternatePhone,
        dob: profile?.dob ?? '',
        placeOfBirth: parsedPlaceOfBirth,
        nationality: parsedCountry,
        indosNumber: indosNum,
        address: parsedAddress,
        city: parsedCity,
        state: parsedState,
        country: parsedCountry,
        profilePicture: photoUrl,
        seaService: (seaServiceRecords ?? []).map((r: any) => ({
          id: r.id,
          rpsl: r.rpsl || r.company || '',
          vessel: r.vessel || r.vessel_name || r.vesselName || '',
          vesselType: r.vessel_type || r.vesselType || '',
          imo: r.imo || r.imo_number || r.imoNumber || '',
          rank: r.rank || '',
          signOn: r.sign_on || r.signOn || '',
          signOff: r.sign_off || r.signOff || '',
        })),
      },
    };
  }

  async updateUserProfile(userId: string, details: any) {
    const {
      firstName,
      lastName,
      name,
      email,
      phone,
      alternatePhone,
      dob,
      placeOfBirth,
      address,
      city,
      state,
      country,
      indosNumber,
      profilePicture,
    } = details;

    const fullName =
      firstName && lastName
        ? `${firstName.trim()} ${lastName.trim()}`
        : name || firstName || '';

    // 1. Mandatory Fields Validation
    if (!fullName || !fullName.trim()) {
      throw new BadRequestException('First Name and Last Name are required.');
    }
    if (!email || !email.trim()) {
      throw new BadRequestException('Email address is required.');
    }
    if (!phone || !phone.trim()) {
      throw new BadRequestException('Mobile phone number is required.');
    }
    if (!dob) {
      throw new BadRequestException('Date of birth is required.');
    }
    if (!placeOfBirth) {
      throw new BadRequestException('Place of birth is required.');
    }
    if (!address) {
      throw new BadRequestException('Address is required.');
    }
    if (!city) {
      throw new BadRequestException('City is required.');
    }
    if (!state) {
      throw new BadRequestException('State is required.');
    }
    if (!country) {
      throw new BadRequestException('Country is required.');
    }
    if (!indosNumber || !indosNumber.trim()) {
      throw new BadRequestException('INDOS Number is required.');
    }

    // 2. Email Format Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      throw new BadRequestException('Invalid email address format.');
    }

    // 3. Email Uniqueness Check
    const { data: existingUserWithEmail } = await this.db
      .from('users')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .neq('id', userId)
      .maybeSingle();

    if (existingUserWithEmail) {
      throw new BadRequestException(
        'Email address is already registered to another user.',
      );
    }

    // 4. INDOS Number Uniqueness Check
    if (indosNumber && indosNumber.trim()) {
      const { data: existingProfileWithIndos } = await this.db
        .from('seafarer_profiles')
        .select('user_id')
        .eq('indos_num', indosNumber.trim())
        .neq('user_id', userId)
        .maybeSingle();

      if (existingProfileWithIndos) {
        throw new BadRequestException(
          'INDOS Number is already registered to another Seafarer.',
        );
      }
    }

    // Handle profile photo persistence:
    let profilePictureUrl = profilePicture;

    // If profilePicture is a base64 string, upload to Supabase Storage
    if (
      typeof profilePicture === 'string' &&
      profilePicture.startsWith('data:image/')
    ) {
      try {
        const matches = profilePicture.match(
          /^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/,
        );
        if (matches) {
          const mime = matches[1];
          const b64Data = matches[2];
          const buffer = Buffer.from(b64Data, 'base64');
          const ext = mime.includes('png')
            ? '.png'
            : mime.includes('webp')
              ? '.webp'
              : '.jpg';
          const photoId = randomUUID();
          const storagePath = `avatars/${userId}/${photoId}${ext}`;

          await this.ensureBucketExists('seafarer-documents');
          const { error: b64UploadErr } = await this.db.storage
            .from('seafarer-documents')
            .upload(storagePath, buffer, {
              contentType: mime,
              upsert: true,
            });

          if (b64UploadErr) {
            console.error(
              '[updateUserProfile] base64 upload error:',
              b64UploadErr,
            );
            throw new BadRequestException(
              'Profile photo upload failed. Please try again.',
            );
          }

          const {
            data: { publicUrl },
          } = this.db.storage
            .from('seafarer-documents')
            .getPublicUrl(storagePath);
          profilePictureUrl = publicUrl;
        }
      } catch (err: any) {
        console.error('[updateUserProfile] photo upload exception:', err);
        throw new BadRequestException(
          err?.message || 'Profile photo upload failed. Please try again.',
        );
      }
    }

    // 5. Update users Table
    await this.db
      .from('users')
      .update({
        name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    // 6. Update/Upsert seafarer_profiles Table
    const { data: existingProfile } = await this.db
      .from('seafarer_profiles')
      .select('id, profile_picture')
      .eq('user_id', userId)
      .maybeSingle();

    const profileId = existingProfile?.id || randomUUID();

    const finalPhotoUrl =
      profilePictureUrl !== undefined
        ? profilePictureUrl === ''
          ? null
          : profilePictureUrl
        : (existingProfile?.profile_picture ?? null);

    const compositeAddress = JSON.stringify({
      address: address?.trim() || '',
      city: city?.trim() || '',
      state: state?.trim() || '',
      country: country?.trim() || 'India',
      placeOfBirth: placeOfBirth?.trim() || '',
      alternatePhone: alternatePhone?.trim() || '',
    });

    const { error: profileUpsertErr } = await this.db
      .from('seafarer_profiles')
      .upsert(
        {
          id: profileId,
          user_id: userId,
          dob: dob || null,
          birth_place: placeOfBirth?.trim() || null,
          indos_num: indosNumber?.trim() || null,
          address: compositeAddress,
          profile_picture: finalPhotoUrl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

    if (profileUpsertErr) {
      console.error(
        '[updateUserProfile] seafarer_profiles upsert error:',
        profileUpsertErr,
      );
      throw new BadRequestException(
        `Failed to save profile details: ${profileUpsertErr.message}`,
      );
    }

    // 7. Audit Log Entry
    try {
      await this.db.from('audit_logs').insert({
        id: randomUUID(),
        user_id: userId,
        user_name: fullName,
        action: 'UPDATE_SEAFARER_PROFILE',
        module: 'Seafarer Portal',
        entity_id: userId,
        details: `Updated seafarer profile: ${fullName} (INDOS: ${indosNumber})`,
        ip_address: '127.0.0.1',
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Audit log write warning:', e);
    }

    return this.getUserProfile(userId);
  }

  async addSeaService(userId: string, record: any) {
    const { data, error } = await this.db
      .from('sea_service_records')
      .insert({
        id: randomUUID(),
        user_id: userId,
        rpsl: record.rpsl || record.company || '',
        vessel: record.vessel || record.vesselName || '',
        vessel_type: record.vesselType || record.vessel_type || null,
        imo: record.imo || record.imoNumber || null,
        rank: record.rank || '',
        sign_on: record.signOn || record.sign_on,
        sign_off: record.signOff || record.sign_off || null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteSeaService(recordId: string) {
    const { error } = await this.db
      .from('sea_service_records')
      .delete()
      .eq('id', recordId);

    if (error) throw new BadRequestException(error.message);
    return { id: recordId, deleted: true };
  }

  // ─────────────────────────────────────────────
  // SUPPORT TICKETS
  // ─────────────────────────────────────────────
  private inMemoryTickets: any[] = [
    {
      id: 'TICKET-1001',
      userId: 'demo-seafarer-001',
      subject: 'Certificate Verification Assistance',
      description:
        'I need assistance verifying my STCW BST certificate renewal status.',
      status: 'In Progress',
      priority: 'Normal',
      createdAt: '2026-08-05T09:00:00.000Z',
      replies: [
        {
          id: 'reply-1',
          sender: 'Support Desk',
          message:
            'Hello, your certificate is currently under review by our DGS verification team.',
          timestamp: '2026-08-05T11:30:00.000Z',
        },
      ],
    },
    {
      id: 'TICKET-1002',
      userId: 'demo-seafarer-001',
      subject: 'Course Schedule Inquiry',
      description:
        'Requesting updated dates for Advanced Fire Fighting classroom sessions.',
      status: 'Resolved',
      priority: 'Low',
      createdAt: '2026-07-20T14:00:00.000Z',
      replies: [
        {
          id: 'reply-2',
          sender: 'Course Coordinator',
          message:
            'Upcoming AFF batches start on the 1st and 15th of next month.',
          timestamp: '2026-07-21T08:45:00.000Z',
        },
      ],
    },
  ];

  async getTickets(userId: string) {
    return this.inMemoryTickets.filter((t) => t.userId === userId);
  }

  async getTicketById(userId: string, ticketId: string) {
    const ticket = this.inMemoryTickets.find((t) => t.id === ticketId);
    return ticket || null;
  }

  async createTicket(userId: string, subject: string, description: string) {
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

  async addReply(userId: string, ticketId: string, message: string) {
    const ticket = this.inMemoryTickets.find((t) => t.id === ticketId);
    if (!ticket) throw new BadRequestException('Ticket not found');
    const reply = {
      id: `reply-${Date.now()}`,
      sender: 'Seafarer User',
      message,
      timestamp: new Date().toISOString(),
    };
    ticket.replies.push(reply);
    return reply;
  }

  // ─────────────────────────────────────────────
  // REFERRAL DASHBOARD (SEAFARER)
  // ─────────────────────────────────────────────
  async getReferrals(userId: string) {
    let indosCode = 'IND99887766';
    try {
      const { data: profile } = await this.db
        .from('seafarer_profiles')
        .select('indos_num')
        .eq('user_id', userId)
        .maybeSingle();
      if (profile?.indos_num) {
        indosCode = profile.indos_num;
      }
    } catch (e) {
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
}
