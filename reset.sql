-- ==============================================================================
-- HARI OM THALASSIC - SAFE DATABASE RESET SCRIPT (PUBLIC SCHEMA ONLY)
-- DOES NOT TOUCH auth.users, storage.*, or Supabase internal schemas
-- ==============================================================================

-- 1. Drop obsolete compatibility views & PascalCase tables
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

-- 2. Drop obsolete legacy tables (commissions, old agent metadata, duplicate models)
DROP TABLE IF EXISTS public.agent_metadata CASCADE;
DROP TABLE IF EXISTS public.commissions CASCADE;
DROP TABLE IF EXISTS public.commission_status_history CASCADE;
DROP TABLE IF EXISTS public.company_crew CASCADE;
DROP TABLE IF EXISTS public.course_bookings CASCADE;
DROP TABLE IF EXISTS public.partner_applications CASCADE;
DROP TABLE IF EXISTS public.referral_leads CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;

-- 3. Drop relational application tables in reverse dependency order
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

-- 4. Drop application functions in public schema
DROP FUNCTION IF EXISTS public.generate_invoice_number(invoice_type) CASCADE;
DROP FUNCTION IF EXISTS public.generate_invoice_number(text) CASCADE;

-- 5. Drop application enums in public schema
DROP TYPE IF EXISTS public.user_role CASCADE;
DROP TYPE IF EXISTS public.user_status CASCADE;
DROP TYPE IF EXISTS public.course_status CASCADE;
DROP TYPE IF EXISTS public.enrollment_status CASCADE;
DROP TYPE IF EXISTS public.referral_status CASCADE;
DROP TYPE IF EXISTS public.pricing_proposal_status CASCADE;
DROP TYPE IF EXISTS public.payable_status CASCADE;
DROP TYPE IF EXISTS public.settlement_status CASCADE;
DROP TYPE IF EXISTS public.invoice_type CASCADE;
DROP TYPE IF EXISTS public.invoice_status CASCADE;
DROP TYPE IF EXISTS public.payment_status CASCADE;
DROP TYPE IF EXISTS public.payment_method CASCADE;
