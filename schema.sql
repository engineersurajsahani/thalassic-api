-- ==============================================================================
-- HARI OM THALASSIC - COMPLETE POSTGRESQL 15 / SUPABASE PRODUCTION DATABASE SCHEMA
-- REBUILD VERSION 2.0 (STRICT SNAKE_CASE, ZERO COMMISSION/MARGIN, PURE HARI OM PAYABLE)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. SAFE PUBLIC SCHEMA RESET (CLEANUP OBSOLETE VIEWS, TABLES & FUNCTIONS)
-- DOES NOT TOUCH auth.users, storage.*, or Supabase system schemas
-- ------------------------------------------------------------------------------
-- Drop obsolete PascalCase compatibility views & tables
DROP VIEW IF EXISTS public."User" CASCADE;
DROP VIEW IF EXISTS public."Course" CASCADE;
DROP VIEW IF EXISTS public."Enrollment" CASCADE;
DROP VIEW IF EXISTS public."Document" CASCADE;
DROP VIEW IF EXISTS public."SeafarerProfile" CASCADE;
DROP VIEW IF EXISTS public."SeaServiceRecord" CASCADE;

DROP TABLE IF EXISTS public."User" CASCADE;
DROP TABLE IF EXISTS public."Course" CASCADE;
DROP TABLE IF EXISTS public."Enrollment" CASCADE;
DROP TABLE IF EXISTS public."Document" CASCADE;
DROP TABLE IF EXISTS public."SeafarerProfile" CASCADE;
DROP TABLE IF EXISTS public."SeaServiceRecord" CASCADE;

-- Drop obsolete legacy application tables
DROP TABLE IF EXISTS public.agent_metadata CASCADE;
DROP TABLE IF EXISTS public.commissions CASCADE;
DROP TABLE IF EXISTS public.commission_status_history CASCADE;
DROP TABLE IF EXISTS public.company_crew CASCADE;
DROP TABLE IF EXISTS public.course_bookings CASCADE;
DROP TABLE IF EXISTS public.partner_applications CASCADE;
DROP TABLE IF EXISTS public.referral_leads CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;

-- Drop new relational tables in reverse dependency order
DROP TABLE IF EXISTS public.settlement_items CASCADE;
DROP TABLE IF EXISTS public.settlements CASCADE;
DROP TABLE IF EXISTS public.partner_payables CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.invoice_counters CASCADE;
DROP TABLE IF EXISTS public.partner_pricing_proposals CASCADE;
DROP TABLE IF EXISTS public.partner_course_pricings CASCADE;
DROP TABLE IF EXISTS public.partner_referrals CASCADE;
DROP TABLE IF EXISTS public.partner_admins CASCADE;
DROP TABLE IF EXISTS public.partners CASCADE;
DROP TABLE IF EXISTS public.enrollments CASCADE;
DROP TABLE IF EXISTS public.course_institutes CASCADE;
DROP TABLE IF EXISTS public.courses CASCADE;
DROP TABLE IF EXISTS public.institutes CASCADE;
DROP TABLE IF EXISTS public.company_seafarers CASCADE;
DROP TABLE IF EXISTS public.company_admins CASCADE;
DROP TABLE IF EXISTS public.companies CASCADE;
DROP TABLE IF EXISTS public.sea_service_records CASCADE;
DROP TABLE IF EXISTS public.documents CASCADE;
DROP TABLE IF EXISTS public.seafarer_profiles CASCADE;
DROP TABLE IF EXISTS public.support_ticket_replies CASCADE;
DROP TABLE IF EXISTS public.support_tickets CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.platform_settings CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Drop obsolete functions in public schema
DROP FUNCTION IF EXISTS public.generate_invoice_number(invoice_type) CASCADE;
DROP FUNCTION IF EXISTS public.generate_invoice_number(text) CASCADE;

-- ------------------------------------------------------------------------------
-- 1. ENUM TYPES
-- ------------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
        'MASTER',
        'PARTNER_ADMIN',
        'COMPANY_ADMIN',
        'SEAFARER'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE user_status AS ENUM (
        'Active',
        'Pending Audit',
        'On Hold',
        'Deactivated'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE course_status AS ENUM (
        'Active',
        'Draft',
        'Archived'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE enrollment_status AS ENUM (
        'Processing',
        'Active',
        'On Hold',
        'Completed',
        'Cancelled'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE referral_status AS ENUM (
        'New',
        'Contacted',
        'Registered',
        'Converted',
        'Expired',
        'Under Review'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE pricing_proposal_status AS ENUM (
        'PENDING_MASTER_APPROVAL',
        'APPROVED',
        'REJECTED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE payable_status AS ENUM (
        'Pending',
        'Approved',
        'Settled',
        'Cancelled'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE settlement_status AS ENUM (
        'Pending',
        'Approved',
        'Paid',
        'Cancelled'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE invoice_type AS ENUM (
        'HOC',
        'HAC',
        'COMPANY'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE invoice_status AS ENUM (
        'Issued',
        'Paid',
        'Partially Paid',
        'Cancelled',
        'Refunded'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM (
        'Pending',
        'Successful',
        'Failed',
        'Refunded'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM (
        'Razorpay',
        'Bank Transfer',
        'Corporate Credit',
        'Cash/Demand Draft'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE ticket_status AS ENUM (
        'Open',
        'In Progress',
        'Resolved',
        'Closed'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE ticket_priority AS ENUM (
        'Low',
        'Normal',
        'High',
        'Urgent'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------------------------
-- 2. CORE USERS & EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE, -- Foreign key reference to Supabase Auth
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    role user_role DEFAULT 'SEAFARER'::user_role NOT NULL,
    status user_status DEFAULT 'Pending Audit'::user_status NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_user_id);

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
    education VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_seafarer_indos ON public.seafarer_profiles(indos_num);
CREATE INDEX IF NOT EXISTS idx_seafarer_cdc ON public.seafarer_profiles(cdc_num);

CREATE TABLE IF NOT EXISTS public.sea_service_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    rpsl_company VARCHAR(255) NOT NULL,
    vessel_name VARCHAR(255) NOT NULL,
    vessel_type VARCHAR(100) NOT NULL,
    imo_number VARCHAR(50),
    rank VARCHAR(100) NOT NULL,
    sign_on_date DATE NOT NULL,
    sign_off_date DATE,
    duration_days INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sea_service_user ON public.sea_service_records(user_id);

CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    type VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending' NOT NULL,
    document_number VARCHAR(100),
    expiry_date DATE,
    remarks TEXT,
    verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_user ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON public.documents(type);

-- ------------------------------------------------------------------------------
-- 3. INSTITUTES & COURSES (MANY-TO-MANY)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.institutes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    accreditation_id VARCHAR(100) NOT NULL,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    duration VARCHAR(50) NOT NULL,
    standard_fee NUMERIC(10, 2) NOT NULL,
    description TEXT,
    status course_status DEFAULT 'Active'::course_status NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.course_institutes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    institute_id UUID REFERENCES public.institutes(id) ON DELETE CASCADE NOT NULL,
    batch_frequency VARCHAR(100) DEFAULT 'Weekly',
    capacity INTEGER DEFAULT 24 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(course_id, institute_id)
);

CREATE INDEX IF NOT EXISTS idx_course_institutes_c ON public.course_institutes(course_id);
CREATE INDEX IF NOT EXISTS idx_course_institutes_i ON public.course_institutes(institute_id);

-- ------------------------------------------------------------------------------
-- 4. CORPORATE SHIPPING COMPANIES (RPSL)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    registration_number VARCHAR(100),
    rpsl_number VARCHAR(100) UNIQUE NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    website VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Active' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.company_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    designation VARCHAR(100) DEFAULT 'Crew Manager',
    is_primary BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(company_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.company_seafarers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    employee_id VARCHAR(100),
    designation_rank VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'Employed' NOT NULL,
    joined_at DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(company_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_company_seafarers_c ON public.company_seafarers(company_id);
CREATE INDEX IF NOT EXISTS idx_company_seafarers_u ON public.company_seafarers(user_id);

-- ------------------------------------------------------------------------------
-- 5. PARTNER DOMAIN (CLEAN REBUILD - NO AGENT TERMINOLOGY)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_name VARCHAR(255) NOT NULL,
    rpsl_license_number VARCHAR(100),
    contact_person VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255) UNIQUE NOT NULL,
    contact_phone VARCHAR(50) NOT NULL,
    alternate_phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    postal_code VARCHAR(20),
    referral_code VARCHAR(50) UNIQUE NOT NULL,
    qr_code_url TEXT,
    onboarding_status VARCHAR(50) DEFAULT 'Active' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_partners_ref_code ON public.partners(referral_code);

CREATE TABLE IF NOT EXISTS public.partner_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    designation VARCHAR(100) DEFAULT 'Partner Admin',
    is_primary BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(partner_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.partner_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    course_interested VARCHAR(255),
    status referral_status DEFAULT 'New'::referral_status NOT NULL,
    notes TEXT,
    referred_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    referred_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    converted_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (timezone('utc'::text, now()) + INTERVAL '45 days') NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_partner_referrals_p ON public.partner_referrals(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_referrals_email ON public.partner_referrals(email);

-- ------------------------------------------------------------------------------
-- 6. PARTNER COURSE PRICING & HARI OM PAYABLE APPROVAL WORKFLOW
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_course_pricings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    active_payable_amount NUMERIC(10, 2) NOT NULL, -- Approved baseline payable amount to Hari Om
    effective_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(partner_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_pricings_lookup ON public.partner_course_pricings(partner_id, course_id);

CREATE TABLE IF NOT EXISTS public.partner_pricing_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    proposed_payable_amount NUMERIC(10, 2) NOT NULL, -- Proposed Hari Om Payable
    previous_payable_amount NUMERIC(10, 2),
    justification_reason TEXT,
    status pricing_proposal_status DEFAULT 'PENDING_MASTER_APPROVAL'::pricing_proposal_status NOT NULL,
    requested_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reviewed_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    review_notes TEXT,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pricing_proposals_status ON public.partner_pricing_proposals(status);
CREATE INDEX IF NOT EXISTS idx_pricing_proposals_partner ON public.partner_pricing_proposals(partner_id);

-- ------------------------------------------------------------------------------
-- 7. ENROLLMENTS & COURSE BOOKINGS (SINGLE SOURCE OF TRUTH)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    course_institute_id UUID REFERENCES public.course_institutes(id) ON DELETE RESTRICT NOT NULL,
    partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
    partner_referral_id UUID REFERENCES public.partner_referrals(id) ON DELETE SET NULL,
    batch_start_date DATE,
    batch_end_date DATE,
    status enrollment_status DEFAULT 'Processing'::enrollment_status NOT NULL,
    progress_percent INTEGER DEFAULT 0 NOT NULL,
    completion_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_enrollments_user ON public.enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_partner ON public.enrollments(partner_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_inst ON public.enrollments(course_institute_id);

-- ------------------------------------------------------------------------------
-- 8. INVOICES, PAYMENTS & PARTNER PAYABLES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_counters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year_month VARCHAR(4) UNIQUE NOT NULL, -- e.g. '2601'
    hoc_counter INTEGER DEFAULT 0 NOT NULL,
    hac_counter INTEGER DEFAULT 0 NOT NULL,
    company_counter INTEGER DEFAULT 0 NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL, -- e.g. HOC260100001, HAC260100001, COM260100001
    invoice_type invoice_type NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    enrollment_id UUID REFERENCES public.enrollments(id) ON DELETE SET NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    tax_amount NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    discount_amount NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    net_payable NUMERIC(10, 2) NOT NULL,
    status invoice_status DEFAULT 'Issued'::invoice_status NOT NULL,
    issue_date DATE DEFAULT CURRENT_DATE NOT NULL,
    due_date DATE DEFAULT (CURRENT_DATE + 7) NOT NULL,
    paid_date DATE,
    pdf_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invoices_num ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_partner ON public.invoices(partner_id);

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_number VARCHAR(50) UNIQUE NOT NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    enrollment_id UUID REFERENCES public.enrollments(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) NOT NULL,
    payment_method payment_method DEFAULT 'Razorpay'::payment_method NOT NULL,
    gateway_transaction_id VARCHAR(255),
    gateway_order_id VARCHAR(255),
    status payment_status DEFAULT 'Pending'::payment_status NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    failure_reason TEXT,
    receipt_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments(user_id);

CREATE TABLE IF NOT EXISTS public.partner_payables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE NOT NULL,
    enrollment_id UUID UNIQUE REFERENCES public.enrollments(id) ON DELETE CASCADE NOT NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    seafarer_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    approved_payable_amount NUMERIC(10, 2) NOT NULL, -- Snapshotted approved Hari Om Payable amount (amount Partner owes Hari Om)
    pricing_proposal_id UUID REFERENCES public.partner_pricing_proposals(id) ON DELETE SET NULL,
    status payable_status DEFAULT 'Pending'::payable_status NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_partner_payables_enrollment UNIQUE (enrollment_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_payables_partner ON public.partner_payables(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_payables_status ON public.partner_payables(status);
CREATE INDEX IF NOT EXISTS idx_partner_payables_enrollment ON public.partner_payables(enrollment_id);

-- ------------------------------------------------------------------------------
-- 9. SETTLEMENTS (PARTNER REMITTANCES / PAYMENTS TO HARI OM FOR OWED PAYABLES)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_number VARCHAR(50) UNIQUE NOT NULL, -- e.g. STL-2601-0001
    partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    total_items INTEGER DEFAULT 1 NOT NULL,
    status settlement_status DEFAULT 'Pending'::settlement_status NOT NULL,
    payment_reference VARCHAR(100),
    processed_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    processed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_settlements_partner ON public.settlements(partner_id);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON public.settlements(status);

CREATE TABLE IF NOT EXISTS public.settlement_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id UUID REFERENCES public.settlements(id) ON DELETE CASCADE NOT NULL,
    payable_id UUID REFERENCES public.partner_payables(id) ON DELETE RESTRICT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(settlement_id, payable_id)
);

CREATE INDEX IF NOT EXISTS idx_settlement_items_lookup ON public.settlement_items(settlement_id, payable_id);

-- ------------------------------------------------------------------------------
-- 10. SUPPORT HELPDESK & THREADED REPLIES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number VARCHAR(50) UNIQUE NOT NULL, -- e.g. TCK-2601-0001
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    subject VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'General Inquiry' NOT NULL,
    priority ticket_priority DEFAULT 'Normal'::ticket_priority NOT NULL,
    status ticket_status DEFAULT 'Open'::ticket_status NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);

CREATE TABLE IF NOT EXISTS public.support_ticket_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE CASCADE NOT NULL,
    sender_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    message TEXT NOT NULL,
    attachment_url TEXT,
    is_staff_reply BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_replies_ticket ON public.support_ticket_replies(ticket_id);

-- ------------------------------------------------------------------------------
-- 11. NOTIFICATIONS, IMMUTABLE AUDIT LOGS & PLATFORM SETTINGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    action_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    actor_name VARCHAR(255),
    action VARCHAR(255) NOT NULL,
    module VARCHAR(255) NOT NULL,
    entity_table VARCHAR(100),
    entity_id VARCHAR(255),
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
    details TEXT NOT NULL,
    previous_state JSONB,
    new_state JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON public.audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at);

CREATE TABLE IF NOT EXISTS public.platform_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_email VARCHAR(255),
    contact_phone VARCHAR(50),
    payment_gateway VARCHAR(100) DEFAULT 'razorpay' NOT NULL,
    dgs_accreditation_id VARCHAR(100),
    gstin VARCHAR(50),
    terms_and_conditions TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 12. ATOMIC INVOICE NUMBER GENERATION FUNCTION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_invoice_number(inv_type invoice_type)
RETURNS VARCHAR AS $$
DECLARE
    cur_ym VARCHAR(4);
    next_num INTEGER;
    prefix VARCHAR(3);
    final_inv_no VARCHAR(50);
BEGIN
    cur_ym := to_char(now(), 'YYMM');
    prefix := inv_type::text;
    
    INSERT INTO public.invoice_counters (year_month, hoc_counter, hac_counter, company_counter)
    VALUES (cur_ym, 0, 0, 0)
    ON CONFLICT (year_month) DO NOTHING;

    IF inv_type = 'HOC' THEN
        UPDATE public.invoice_counters
        SET hoc_counter = hoc_counter + 1
        WHERE year_month = cur_ym
        RETURNING hoc_counter INTO next_num;
    ELSIF inv_type = 'HAC' THEN
        UPDATE public.invoice_counters
        SET hac_counter = hac_counter + 1
        WHERE year_month = cur_ym
        RETURNING hac_counter INTO next_num;
    ELSE
        UPDATE public.invoice_counters
        SET company_counter = company_counter + 1
        WHERE year_month = cur_ym
        RETURNING company_counter INTO next_num;
    END IF;

    final_inv_no := prefix || cur_ym || lpad(next_num::text, 5, '0');
    RETURN final_inv_no;
END;
$$ LANGUAGE plpgsql;
