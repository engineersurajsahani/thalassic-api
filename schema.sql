-- ==============================================================================
-- HARI OM THALASSIC - COMPLETE SUPABASE CLOUD DATABASE SCHEMA
-- Execute this script in your Supabase Dashboard: SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. Create CUSTOM ENUM Types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('MASTER', 'COMPANY_ADMIN', 'SEAFARER', 'AGENT', 'AGENT_ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('Active', 'Pending Audit', 'Deactivated');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE course_status AS ENUM ('Active', 'Draft', 'Archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE booking_status AS ENUM ('Completed', 'Processing', 'Cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create USERS Table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE, -- Links to auth.users in Supabase Auth
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    role user_role DEFAULT 'SEAFARER'::user_role NOT NULL,
    status user_status DEFAULT 'Pending Audit'::user_status NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create COURSES Table
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL, -- e.g. 'basic', 'advanced', 'refresher'
    duration VARCHAR(50) NOT NULL,
    fees VARCHAR(50) NOT NULL,
    description TEXT,
    status course_status DEFAULT 'Active'::course_status NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create ENROLLMENTS Table
CREATE TABLE IF NOT EXISTS public.enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    status VARCHAR(50) DEFAULT 'Enrolled' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create SEAFARER PROFILES Table (Extends user info)
CREATE TABLE IF NOT EXISTS public.seafarer_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    dob DATE,
    birth_place VARCHAR(255),
    father_name VARCHAR(255),
    passport_num VARCHAR(100),
    passport_issue DATE,
    passport_expiry DATE,
    passport_place VARCHAR(100),
    indos_num VARCHAR(100),
    indos_issue DATE,
    indos_status VARCHAR(50) DEFAULT 'Pending',
    cdc_num VARCHAR(100),
    cdc_issue DATE,
    cdc_expiry DATE,
    cdc_place VARCHAR(100),
    education VARCHAR(255)
);

-- 6. Create SEA SERVICE RECORDS Table
CREATE TABLE IF NOT EXISTS public.sea_service_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    rpsl VARCHAR(255) NOT NULL,
    vessel VARCHAR(255) NOT NULL,
    vessel_type VARCHAR(100),
    imo VARCHAR(50),
    rank VARCHAR(100) NOT NULL,
    sign_on DATE NOT NULL,
    sign_off DATE
);

-- 7. Create COURSE BOOKINGS Table
CREATE TABLE IF NOT EXISTS public.course_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    purchase_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    amount VARCHAR(50) NOT NULL,
    status booking_status DEFAULT 'Completed'::booking_status NOT NULL
);

-- 8. Create PLATFORM SETTINGS Table
CREATE TABLE IF NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_email VARCHAR(255) DEFAULT 'support@hariomthalassic.com' NOT NULL,
    contact_phone VARCHAR(50) DEFAULT '+91 22 12345678' NOT NULL,
    payment_gateway VARCHAR(100) DEFAULT 'razorpay_production_mode' NOT NULL,
    dgs_accreditation_id VARCHAR(100) DEFAULT 'DGS-MTI-10294' NOT NULL
);

-- 9. Create COMPANIES Table
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    rpsl VARCHAR(255) UNIQUE,
    address TEXT,
    contact_email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. Create COMPANY ADMINS Table (linking admin to company)
CREATE TABLE IF NOT EXISTS public.company_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    UNIQUE(user_id, company_id)
);

-- 11. Create COMPANY CREW Table (linking seafarers to company)
CREATE TABLE IF NOT EXISTS public.company_crew (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    status VARCHAR(50) DEFAULT 'Active',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(company_id, user_id)
);

-- 12. Create AGENT METADATA Table
CREATE TABLE IF NOT EXISTS public.agent_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    referral_code VARCHAR(100) UNIQUE, -- Will be set by the agent during onboarding
    qr_code TEXT,                      -- Generated after referral code creation
    onboarding_status VARCHAR(50) DEFAULT 'Invited' NOT NULL,
    general_commission NUMERIC(5,2) DEFAULT 5.00 NOT NULL,
    course_commissions JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 13. Create DOCUMENTS Table
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    type VARCHAR(100),
    name VARCHAR(255),
    url VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Pending',
    remarks TEXT,
    expiry_date DATE,
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 14. Create REFERRAL LEADS Table
CREATE TABLE IF NOT EXISTS public.referral_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    city VARCHAR(100),
    course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'New' NOT NULL,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expiry_at TIMESTAMP WITH TIME ZONE DEFAULT (timezone('utc'::text, now()) + INTERVAL '45 days') NOT NULL
);

-- 15. Create COMMISSIONS Table
CREATE TABLE IF NOT EXISTS public.commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    purchase_id UUID REFERENCES public.enrollments(id) ON DELETE CASCADE NOT NULL,
    seafarer_name VARCHAR(255) NOT NULL,
    course_name VARCHAR(255) NOT NULL,
    course_fee NUMERIC(10,2) NOT NULL,
    commission_rate NUMERIC(5,2) NOT NULL,
    commission_amount NUMERIC(10,2) NOT NULL,
    commission_source VARCHAR(100) DEFAULT 'General Commission' NOT NULL,
    commission_version VARCHAR(50) DEFAULT 'v1.0' NOT NULL,
    remarks TEXT,
    rejection_reason TEXT,
    settlement_id UUID,
    status VARCHAR(50) DEFAULT 'Pending' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    settled_at TIMESTAMP WITH TIME ZONE
);

-- 16. Create COMMISSION STATUS HISTORY Table
CREATE TABLE IF NOT EXISTS public.commission_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commission_id UUID REFERENCES public.commissions(id) ON DELETE CASCADE NOT NULL,
    old_status VARCHAR(50) NOT NULL,
    new_status VARCHAR(50) NOT NULL,
    reason TEXT,
    changed_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    changed_by_user_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 17. Create SETTLEMENTS Table
CREATE TABLE IF NOT EXISTS public.settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_number VARCHAR(100) UNIQUE NOT NULL, -- e.g. SET-2026-000001
    agent_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    hac_invoice_number VARCHAR(100),
    total_amount NUMERIC(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending' NOT NULL, -- 'Pending', 'Approved', 'Paid'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE
);

-- 18. Create INVOICES Table
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(100) UNIQUE,                          -- Nullable for Company Invoices
    invoice_type VARCHAR(10),                                   -- 'HOC' or 'HAC' (Nullable for Company Invoices)
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE, -- Nullable for Company Invoices
    purchase_id UUID REFERENCES public.enrollments(id) ON DELETE CASCADE, -- Nullable for Company Invoices
    agent_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    commission_snapshot_id UUID REFERENCES public.commissions(id) ON DELETE SET NULL,
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    agent_name VARCHAR(255),
    agent_referral_code VARCHAR(100),
    course_name VARCHAR(255),
    course_fee NUMERIC(10,2),
    discount NUMERIC(10,2) DEFAULT 0.00,
    final_amount NUMERIC(10,2),
    payment_gateway VARCHAR(100) DEFAULT 'razorpay',
    transaction_id VARCHAR(100) UNIQUE,
    payment_method VARCHAR(50) DEFAULT 'Online UPI/Card',
    payment_date TIMESTAMP WITH TIME ZONE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE, -- Company specific
    amount VARCHAR(50),                                                -- Company specific amount string
    pdf_url VARCHAR(255),                                              -- Company specific pdf
    email_sent BOOLEAN DEFAULT FALSE,                                  -- Company specific email status
    status VARCHAR(50) DEFAULT 'Paid' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 19. Create PAYMENTS Table
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    amount VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending',
    receipt_url VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 20. Create AUDIT LOGS Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    user_name VARCHAR(255),
    action VARCHAR(255) NOT NULL,
    module VARCHAR(255) DEFAULT 'General' NOT NULL,
    entity_id VARCHAR(255),
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    details TEXT,
    ip_address VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 21. Create PARTNER APPLICATIONS Table
CREATE TABLE IF NOT EXISTS public.partner_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    company_type VARCHAR(100),
    fleet_size VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Pending' NOT NULL,
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 22. Create SUPPORT TICKETS Table
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'Open' NOT NULL,
    priority VARCHAR(50) DEFAULT 'Normal' NOT NULL,
    admin_response TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 23. Create NOTIFICATIONS Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'unread' NOT NULL,
    link VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 24. PERFORMANCE INDEXES (ISSUE-006)
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_enrollments_user ON public.enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON public.enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_commissions_agent ON public.commissions(agent_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON public.commissions(status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON public.audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_referral_leads_agent ON public.referral_leads(agent_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);

-- 25. SEED INITIAL MOCK DATA
-- Insert Initial Settings
INSERT INTO public.settings (system_email, contact_phone, payment_gateway, dgs_accreditation_id)
VALUES ('support@hariomthalassic.com', '+91 22 12345678', 'razorpay_production_mode', 'DGS-MTI-10294')
ON CONFLICT DO NOTHING;

-- Insert Initial Courses
INSERT INTO public.courses (code, name, category, duration, fees, description, status)
VALUES 
('BST', 'Basic Safety Training', 'basic', '12 Days', '₹12,000', 'Mandatory safety modules including Personal Survival Techniques and Firefighting.', 'Active'),
('AFF', 'Advanced Fire Fighting', 'advanced', '5 Days', '₹7,200', 'Advanced training in organization and control of fire fighting operations.', 'Active'),
('OCTCO', 'Oil and Chemical Tanker Cargo Operations', 'basic', '6 Days', '₹6,000', 'Basic training for oil and chemical tanker cargo operations.', 'Active'),
('MEDICARE', 'Medical Care on Board Ships', 'advanced', '5 Days', '₹25,000', 'Advanced clinical diagnosis, injection procedures and ship hospital sanitation.', 'Active'),
('RPST', 'Refresher PST', 'refresher', '1 Day', '₹3,500', 'Refresher safety training for Personal Survival Techniques.', 'Active')
ON CONFLICT (code) DO NOTHING;

-- Insert Sample Seafarer Users
INSERT INTO public.users (id, email, name, phone, role, status)
VALUES 
('a0000000-0000-0000-0000-000000000001', 'raj@example.com', 'Raj Kumar', '+91 98765 43210', 'SEAFARER', 'Pending Audit'),
('a0000000-0000-0000-0000-000000000002', 'priya@example.com', 'Priya Singh', '+91 99887 76655', 'SEAFARER', 'Active'),
('a0000000-0000-0000-0000-000000000003', 'amit@example.com', 'Amit Patel', '+91 98989 89898', 'SEAFARER', 'Pending Audit')
ON CONFLICT (email) DO NOTHING;

-- Insert Seafarer Profiles
INSERT INTO public.seafarer_profiles (user_id, dob, birth_place, father_name, passport_num, passport_issue, passport_expiry, passport_place, indos_num, indos_issue, indos_status, cdc_num, cdc_issue, cdc_expiry, cdc_place, education)
VALUES 
('a0000000-0000-0000-0000-000000000001', '1994-08-12', 'Varanasi, Uttar Pradesh, India', 'Sanjay Kumar', 'Z1234567', '2020-01-10', '2030-01-09', 'Lucknow', '20N1234', '2020-03-15', 'Verified', 'MUM123456', '2020-05-20', '2030-05-19', 'Mumbai', 'Diploma in Nautical Science'),
('a0000000-0000-0000-0000-000000000002', '1996-05-24', 'Patna, Bihar, India', 'Rakesh Singh', 'Y7654321', '2021-04-12', '2031-04-11', 'Patna', '21N5678', '2021-06-20', 'Verified', 'KOL765432', '2021-08-18', '2031-08-17', 'Kolkata', 'B.Sc in Nautical Science'),
('a0000000-0000-0000-0000-000000000003', '1992-11-30', 'Ahmedabad, Gujarat, India', 'Kishor Patel', 'X9876543', '2019-12-05', '2029-12-04', 'Ahmedabad', '19E9876', '2019-11-20', 'Pending', 'MUM987654', '2019-12-15', '2029-12-14', 'Mumbai', 'Marine Engineering Degree')
ON CONFLICT (user_id) DO NOTHING;

-- Insert Sea Service Logs
INSERT INTO public.sea_service_records (user_id, rpsl, vessel, vessel_type, imo, rank, sign_on, sign_off)
VALUES 
('a0000000-0000-0000-0000-000000000001', 'Anvay Maritime', 'Pacific Voyager', 'Container', '9876543', '3rd Officer', '2023-01-10', '2023-08-15'),
('a0000000-0000-0000-0000-000000000002', 'Synergy Marine', 'Atlantic Jewel', 'Oil Tanker', '9654321', 'Cadet', '2022-09-01', '2023-03-01'),
('a0000000-0000-0000-0000-000000000003', 'Fleet Management', 'Ganges Star', 'Bulk Carrier', '9543210', '4th Engineer', '2021-05-10', '2021-12-10')
ON CONFLICT DO NOTHING;
