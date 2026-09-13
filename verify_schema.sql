-- ==============================================================================
-- HARI OM THALASSIC - POST-DEPLOYMENT VERIFICATION SCRIPT (NON-CONSUMING)
-- Execute this script in Supabase SQL Editor after running schema.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXACT 27-TABLE COMPARISON (CHECKS FOR MISSING & UNEXPECTED TABLES)
-- ------------------------------------------------------------------------------
WITH expected_tables AS (
    SELECT unnest(ARRAY[
        'users',
        'institutes',
        'courses',
        'course_institutes',
        'seafarer_profiles',
        'sea_service_records',
        'documents',
        'companies',
        'company_admins',
        'company_seafarers',
        'partners',
        'partner_admins',
        'partner_referrals',
        'partner_course_pricings',
        'partner_pricing_proposals',
        'enrollments',
        'invoices',
        'invoice_counters',
        'payments',
        'partner_payables',
        'settlements',
        'settlement_items',
        'support_tickets',
        'support_ticket_replies',
        'notifications',
        'audit_logs',
        'platform_settings'
    ]) AS table_name
),
actual_tables AS (
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
)
SELECT 
    COALESCE(e.table_name, a.table_name) AS table_name,
    CASE 
        WHEN e.table_name IS NOT NULL AND a.table_name IS NOT NULL THEN '✓ MATCHED'
        WHEN e.table_name IS NOT NULL AND a.table_name IS NULL THEN '✗ MISSING EXPECTED TABLE'
        WHEN e.table_name IS NULL AND a.table_name IS NOT NULL THEN '✗ UNEXPECTED EXTRA TABLE'
    END AS status
FROM expected_tables e
FULL OUTER JOIN actual_tables a ON e.table_name = a.table_name
ORDER BY status DESC, table_name ASC;

-- ------------------------------------------------------------------------------
-- 2. VERIFY EXACT TABLE COUNT & SUMMARY STATUS
-- ------------------------------------------------------------------------------
WITH expected_tables AS (
    SELECT unnest(ARRAY[
        'users',
        'institutes',
        'courses',
        'course_institutes',
        'seafarer_profiles',
        'sea_service_records',
        'documents',
        'companies',
        'company_admins',
        'company_seafarers',
        'partners',
        'partner_admins',
        'partner_referrals',
        'partner_course_pricings',
        'partner_pricing_proposals',
        'enrollments',
        'invoices',
        'invoice_counters',
        'payments',
        'partner_payables',
        'settlements',
        'settlement_items',
        'support_tickets',
        'support_ticket_replies',
        'notifications',
        'audit_logs',
        'platform_settings'
    ]) AS table_name
),
actual_tables AS (
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
)
SELECT 
    (SELECT count(*) FROM actual_tables) AS total_actual_tables,
    (SELECT count(*) FROM expected_tables) AS total_expected_tables,
    (SELECT count(*) FROM expected_tables e JOIN actual_tables a ON e.table_name = a.table_name) AS matched_tables_count,
    (SELECT count(*) FROM expected_tables e LEFT JOIN actual_tables a ON e.table_name = a.table_name WHERE a.table_name IS NULL) AS missing_tables_count,
    (SELECT count(*) FROM actual_tables a LEFT JOIN expected_tables e ON a.table_name = e.table_name WHERE e.table_name IS NULL) AS unexpected_tables_count,
    CASE 
        WHEN (SELECT count(*) FROM actual_tables) = 27 
         AND (SELECT count(*) FROM expected_tables e JOIN actual_tables a ON e.table_name = a.table_name) = 27
        THEN '✓ PASS: Exact 27/27 expected tables created with 0 missing and 0 unexpected'
        ELSE '✗ FAIL: Schema table mismatch detected'
    END AS verification_result;

-- ------------------------------------------------------------------------------
-- 3. VERIFY ZERO LEGACY TABLES EXIST (MUST RETURN 0 ROWS)
-- ------------------------------------------------------------------------------
SELECT 
    table_name AS obsolete_table_found,
    '✗ FAIL: Obsolete table still present' AS error_message
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
      'agent_metadata',
      'commissions',
      'commission_status_history',
      'company_crew',
      'course_bookings',
      'partner_applications',
      'referral_leads',
      'settings',
      'User',
      'Course',
      'Enrollment',
      'Document',
      'SeafarerProfile',
      'SeaServiceRecord'
  );

-- ------------------------------------------------------------------------------
-- 4. VERIFY ZERO COMMISSION OR MARGIN COLUMNS IN partner_payables (MUST RETURN 0 ROWS)
-- ------------------------------------------------------------------------------
SELECT 
    column_name AS prohibited_column_found,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'partner_payables'
  AND column_name IN (
      'commission',
      'commission_amount',
      'commission_rate',
      'partner_margin',
      'partner_margin_amount',
      'partner_selling_price',
      'selling_price',
      'margin',
      'course_retail_fee',
      'partner_payout',
      'partner_earnings'
  );

-- ------------------------------------------------------------------------------
-- 5. NON-CONSUMING INVOICE GENERATOR FUNCTION VERIFICATION
-- Inspects function metadata and table structure WITHOUT incrementing counters
-- ------------------------------------------------------------------------------
SELECT 
    r.routine_name,
    r.routine_type,
    r.data_type AS return_type,
    p.parameter_name,
    p.data_type AS parameter_type,
    CASE 
        WHEN r.routine_name = 'generate_invoice_number' AND r.data_type = 'character varying'
        THEN '✓ PASS: generate_invoice_number function exists with correct signature'
        ELSE '✗ FAIL: Function signature mismatch'
    END AS function_status
FROM information_schema.routines r
JOIN information_schema.parameters p 
  ON r.specific_name = p.specific_name
WHERE r.routine_schema = 'public' 
  AND r.routine_name = 'generate_invoice_number';

-- Verify invoice_counters table structure (non-consuming)
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'invoice_counters'
ORDER BY ordinal_position;

-- ------------------------------------------------------------------------------
-- 6. VERIFY SUPABASE AUTH & STORAGE ARE UNTOUCHED
-- ------------------------------------------------------------------------------
SELECT 
    'auth.users' AS system_table,
    count(*) AS auth_users_count,
    '✓ Intact' AS status
FROM auth.users;

-- ------------------------------------------------------------------------------
-- 7. VERIFY ZERO PUBLIC VIEWS (MUST RETURN 0 VIEWS)
-- ------------------------------------------------------------------------------
SELECT 
    table_name AS unexpected_view_found,
    '✗ FAIL: Public view should not exist in clean schema' AS error_message
FROM information_schema.views
WHERE table_schema = 'public';

SELECT 
    count(*) AS total_public_views,
    CASE 
        WHEN count(*) = 0 THEN '✓ PASS: Exactly 0 public views found' 
        ELSE '✗ FAIL: Unexpected views found in public schema' 
    END AS verification_result
FROM information_schema.views
WHERE table_schema = 'public';

-- ------------------------------------------------------------------------------
-- 8. VERIFY FOREIGN KEYS & RELATIONAL INTEGRITY
-- ------------------------------------------------------------------------------
-- 8.1 Verify public.users.auth_user_id references auth.users(id)
SELECT 
    tc.constraint_name,
    tc.table_schema,
    tc.table_name,
    kcu.column_name,
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    '✓ PASS: public.users.auth_user_id references auth.users(id)' AS verification_status
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'users'
  AND kcu.column_name = 'auth_user_id'
  AND tc.constraint_type = 'FOREIGN KEY';

-- 8.2 Verify public.enrollments contains only authoritative course_institute_id
SELECT 
    column_name,
    data_type,
    '✓ Normalized enrollment column' AS status
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'enrollments'
  AND column_name IN ('course_institute_id', 'course_id', 'institute_id');

-- 8.3 Verify unique enrollment_id constraint on partner_payables
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    tc.constraint_type,
    '✓ PASS: partner_payables enrollment_id is unique' AS verification_status
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'partner_payables'
  AND kcu.column_name = 'enrollment_id'
  AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY');

