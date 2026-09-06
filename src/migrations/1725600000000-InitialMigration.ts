import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialMigration1725600000000 implements MigrationInterface {
  name = 'InitialMigration1725600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create Enums
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('MASTER', 'COMPANY_ADMIN', 'SEAFARER', 'AGENT', 'AGENT_ADMIN');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // 2. Create User / users Table (Supports PascalCase and snake_case)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public."User" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" VARCHAR(255) UNIQUE NOT NULL,
        "name" VARCHAR(255) NOT NULL,
        "password" VARCHAR(255) NOT NULL,
        "phone" VARCHAR(50),
        "role" VARCHAR(50) DEFAULT 'SEAFARER' NOT NULL,
        "status" VARCHAR(50) DEFAULT 'Pending Audit' NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `);

    // 3. Create Course Table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public."Course" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" VARCHAR(50) UNIQUE NOT NULL,
        "name" VARCHAR(255) NOT NULL,
        "category" VARCHAR(100) NOT NULL,
        "duration" VARCHAR(50) NOT NULL,
        "fees" VARCHAR(50) NOT NULL,
        "description" TEXT,
        "status" VARCHAR(50) DEFAULT 'Active' NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `);

    // 4. Create SeafarerProfile Table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public."SeafarerProfile" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID UNIQUE REFERENCES public."User"("id") ON DELETE CASCADE NOT NULL,
        "firstName" VARCHAR(100),
        "lastName" VARCHAR(100),
        "dob" DATE,
        "birthPlace" VARCHAR(255),
        "fatherName" VARCHAR(255),
        "passportNum" VARCHAR(100),
        "passportIssue" DATE,
        "passportExpiry" DATE,
        "passportPlace" VARCHAR(100),
        "indosNumber" VARCHAR(100),
        "indosIssue" DATE,
        "indosStatus" VARCHAR(50) DEFAULT 'Pending',
        "cdcNum" VARCHAR(100),
        "cdcIssue" DATE,
        "cdcExpiry" DATE,
        "cdcPlace" VARCHAR(100),
        "education" VARCHAR(255),
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `);

    // 5. Create SeaServiceRecord Table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public."SeaServiceRecord" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID REFERENCES public."User"("id") ON DELETE CASCADE NOT NULL,
        "rpsl" VARCHAR(255) NOT NULL,
        "vessel" VARCHAR(255) NOT NULL,
        "vesselType" VARCHAR(100),
        "imo" VARCHAR(50),
        "rank" VARCHAR(100) NOT NULL,
        "signOn" DATE NOT NULL,
        "signOff" DATE
      );
    `);

    // 6. Create Document Table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public."Document" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID REFERENCES public."User"("id") ON DELETE CASCADE NOT NULL,
        "type" VARCHAR(100),
        "name" VARCHAR(255),
        "url" VARCHAR(255),
        "status" VARCHAR(50) DEFAULT 'Pending',
        "remarks" TEXT,
        "expiryDate" DATE,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `);

    // 7. Create Enrollment Table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public."Enrollment" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID REFERENCES public."User"("id") ON DELETE CASCADE NOT NULL,
        "courseId" UUID REFERENCES public."Course"("id") ON DELETE CASCADE NOT NULL,
        "amount" VARCHAR(50) NOT NULL,
        "status" VARCHAR(50) DEFAULT 'Enrolled' NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `);

    // 8. Create Agent Metadata Table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.agent_metadata (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID UNIQUE REFERENCES public."User"("id") ON DELETE CASCADE NOT NULL,
        "referral_code" VARCHAR(100) UNIQUE,
        "qr_code" TEXT,
        "onboarding_status" VARCHAR(50) DEFAULT 'Invited' NOT NULL,
        "general_commission" NUMERIC(5,2) DEFAULT 5.00 NOT NULL,
        "course_commissions" JSONB DEFAULT '{}'::jsonb NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `);

    // 9. Create Referral Leads Table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.referral_leads (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "agent_id" UUID REFERENCES public."User"("id") ON DELETE CASCADE NOT NULL,
        "name" VARCHAR(255) NOT NULL,
        "email" VARCHAR(255) NOT NULL,
        "phone" VARCHAR(50) NOT NULL,
        "city" VARCHAR(100),
        "course_id" UUID REFERENCES public."Course"("id") ON DELETE SET NULL,
        "status" VARCHAR(50) DEFAULT 'New' NOT NULL,
        "remarks" TEXT,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        "expiry_at" TIMESTAMP WITH TIME ZONE DEFAULT (timezone('utc'::text, now()) + INTERVAL '45 days') NOT NULL
      );
    `);

    // 10. Create Commissions Table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.commissions (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "agent_id" UUID REFERENCES public."User"("id") ON DELETE CASCADE NOT NULL,
        "purchase_id" UUID,
        "seafarer_name" VARCHAR(255) NOT NULL,
        "course_name" VARCHAR(255) NOT NULL,
        "course_fee" NUMERIC(10,2) NOT NULL,
        "commission_rate" NUMERIC(5,2) NOT NULL,
        "commission_amount" NUMERIC(10,2) NOT NULL,
        "commission_source" VARCHAR(100) DEFAULT 'General Commission' NOT NULL,
        "commission_version" VARCHAR(50) DEFAULT 'v1.0' NOT NULL,
        "remarks" TEXT,
        "rejection_reason" TEXT,
        "settlement_id" UUID,
        "status" VARCHAR(50) DEFAULT 'Pending' NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        "settled_at" TIMESTAMP WITH TIME ZONE
      );
    `);

    // 11. Create Commission Status History Table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.commission_status_history (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "commission_id" UUID REFERENCES public.commissions("id") ON DELETE CASCADE NOT NULL,
        "old_status" VARCHAR(50) NOT NULL,
        "new_status" VARCHAR(50) NOT NULL,
        "reason" TEXT,
        "changed_by_user_id" UUID REFERENCES public."User"("id") ON DELETE SET NULL,
        "changed_by_user_name" VARCHAR(255),
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `);

    // 12. Create Invoices Table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.invoices (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "invoice_number" VARCHAR(100) UNIQUE,
        "invoice_type" VARCHAR(10),
        "user_id" UUID REFERENCES public."User"("id") ON DELETE CASCADE,
        "purchase_id" UUID,
        "agent_id" UUID REFERENCES public."User"("id") ON DELETE SET NULL,
        "commission_snapshot_id" UUID,
        "customer_name" VARCHAR(255),
        "customer_email" VARCHAR(255),
        "customer_phone" VARCHAR(50),
        "agent_name" VARCHAR(255),
        "agent_referral_code" VARCHAR(100),
        "course_name" VARCHAR(255),
        "course_fee" NUMERIC(10,2),
        "discount" NUMERIC(10,2) DEFAULT 0.00,
        "final_amount" NUMERIC(10,2),
        "payment_gateway" VARCHAR(100) DEFAULT 'razorpay',
        "transaction_id" VARCHAR(100) UNIQUE,
        "payment_method" VARCHAR(50) DEFAULT 'Online UPI/Card',
        "payment_date" TIMESTAMP WITH TIME ZONE,
        "company_id" UUID,
        "amount" VARCHAR(50),
        "pdf_url" VARCHAR(255),
        "email_sent" BOOLEAN DEFAULT FALSE,
        "status" VARCHAR(50) DEFAULT 'Paid' NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `);

    // 13. Create Companies & Admin/Crew Tables
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.companies (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(255) NOT NULL,
        "rpsl" VARCHAR(255) UNIQUE,
        "address" TEXT,
        "contact_email" VARCHAR(255),
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS public.company_admins (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID REFERENCES public."User"("id") ON DELETE CASCADE NOT NULL,
        "company_id" UUID REFERENCES public.companies("id") ON DELETE CASCADE NOT NULL,
        UNIQUE("user_id", "company_id")
      );

      CREATE TABLE IF NOT EXISTS public.company_crew (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" UUID REFERENCES public.companies("id") ON DELETE CASCADE NOT NULL,
        "user_id" UUID REFERENCES public."User"("id") ON DELETE CASCADE NOT NULL,
        "status" VARCHAR(50) DEFAULT 'Active',
        "joined_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        UNIQUE("company_id", "user_id")
      );
    `);

    // 14. Create Payments & Settlements Tables
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.payments (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" UUID REFERENCES public.companies("id") ON DELETE CASCADE,
        "user_id" UUID REFERENCES public."User"("id") ON DELETE CASCADE,
        "amount" VARCHAR(50) NOT NULL,
        "status" VARCHAR(50) DEFAULT 'Pending',
        "receipt_url" VARCHAR(255),
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS public.settlements (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "settlement_number" VARCHAR(100) UNIQUE NOT NULL,
        "agent_id" UUID REFERENCES public."User"("id") ON DELETE CASCADE NOT NULL,
        "hac_invoice_number" VARCHAR(100),
        "total_amount" NUMERIC(10,2) NOT NULL,
        "status" VARCHAR(50) DEFAULT 'Pending' NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        "paid_at" TIMESTAMP WITH TIME ZONE
      );
    `);

    // 15. Create Audit Logs, Partner Applications, Support Tickets, Notifications, Settings
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.audit_logs (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID REFERENCES public."User"("id") ON DELETE SET NULL,
        "user_name" VARCHAR(255),
        "action" VARCHAR(255) NOT NULL,
        "module" VARCHAR(255) DEFAULT 'General' NOT NULL,
        "entity_id" VARCHAR(255),
        "company_id" UUID,
        "details" TEXT,
        "ip_address" VARCHAR(50),
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS public.partner_applications (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_name" VARCHAR(255) NOT NULL,
        "contact_person" VARCHAR(255) NOT NULL,
        "email" VARCHAR(255) NOT NULL,
        "phone" VARCHAR(50) NOT NULL,
        "company_type" VARCHAR(100),
        "fleet_size" VARCHAR(100),
        "status" VARCHAR(50) DEFAULT 'Pending' NOT NULL,
        "message" TEXT,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS public.support_tickets (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID REFERENCES public."User"("id") ON DELETE CASCADE NOT NULL,
        "subject" VARCHAR(255) NOT NULL,
        "message" TEXT NOT NULL,
        "status" VARCHAR(50) DEFAULT 'Open' NOT NULL,
        "priority" VARCHAR(50) DEFAULT 'Normal' NOT NULL,
        "admin_response" TEXT,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS public.notifications (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID REFERENCES public."User"("id") ON DELETE CASCADE NOT NULL,
        "title" VARCHAR(255) NOT NULL,
        "message" TEXT NOT NULL,
        "status" VARCHAR(50) DEFAULT 'unread' NOT NULL,
        "link" VARCHAR(255),
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS public.settings (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "system_email" VARCHAR(255) DEFAULT 'support@hariomthalassic.com' NOT NULL,
        "contact_phone" VARCHAR(50) DEFAULT '+91 22 12345678' NOT NULL,
        "payment_gateway" VARCHAR(100) DEFAULT 'razorpay_production_mode' NOT NULL,
        "dgs_accreditation_id" VARCHAR(100) DEFAULT 'DGS-MTI-10294' NOT NULL
      );
    `);

    // 16. Insert Default Seed Data (Courses & Settings)
    await queryRunner.query(`
      INSERT INTO public.settings ("system_email", "contact_phone", "payment_gateway", "dgs_accreditation_id")
      VALUES ('support@hariomthalassic.com', '+91 22 12345678', 'razorpay_production_mode', 'DGS-MTI-10294')
      ON CONFLICT DO NOTHING;

      INSERT INTO public."Course" ("code", "name", "category", "duration", "fees", "description", "status")
      VALUES 
      ('BST', 'Basic Safety Training', 'basic', '12 Days', '₹12,000', 'Mandatory safety modules including Personal Survival Techniques and Firefighting.', 'Active'),
      ('AFF', 'Advanced Fire Fighting', 'advanced', '5 Days', '₹7,200', 'Advanced training in organization and control of fire fighting operations.', 'Active'),
      ('OCTCO', 'Oil and Chemical Tanker Cargo Operations', 'basic', '6 Days', '₹6,000', 'Basic training for oil and chemical tanker cargo operations.', 'Active'),
      ('MEDICARE', 'Medical Care on Board Ships', 'advanced', '5 Days', '₹25,000', 'Advanced clinical diagnosis, injection procedures and ship hospital sanitation.', 'Active'),
      ('RPST', 'Refresher PST', 'refresher', '1 Day', '₹3,500', 'Refresher safety training for Personal Survival Techniques.', 'Active')
      ON CONFLICT ("code") DO NOTHING;
    `);

    // 17. High Performance Database Indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_user_email" ON public."User" (LOWER("email"));`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_user_role" ON public."User" ("role");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_enrollment_user_id" ON public."Enrollment" ("userId");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_document_user_id" ON public."Document" ("userId");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_commission_agent_id" ON public.commissions ("agent_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_referral_leads_agent_id" ON public.referral_leads ("agent_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_logs_actor" ON public.audit_logs ("user_id");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS public.settings CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.notifications CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.support_tickets CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.partner_applications CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.audit_logs CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.settlements CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.payments CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.company_crew CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.company_admins CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.companies CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.invoices CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.commission_status_history CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.commissions CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.referral_leads CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.agent_metadata CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public."Enrollment" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public."Document" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public."SeaServiceRecord" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public."SeafarerProfile" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public."Course" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public."User" CASCADE;`);
  }
}
