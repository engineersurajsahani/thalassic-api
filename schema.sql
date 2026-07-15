-- 1. Create CUSTOM ENUM Types
CREATE TYPE user_role AS ENUM ('MASTER', 'COMPANY_ADMIN', 'SEAFARER');
CREATE TYPE user_status AS ENUM ('Active', 'Pending Audit', 'Deactivated');
CREATE TYPE course_status AS ENUM ('Active', 'Draft', 'Archived');
CREATE TYPE booking_status AS ENUM ('Completed', 'Processing', 'Cancelled');

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

-- Enable Row Level Security (RLS) on Users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

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

-- 4. Create SEAFARER PROFILES Table (Extends user info)
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

-- 5. Create SEA SERVICE RECORDS Table
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

-- 6. Create COURSE BOOKINGS Table
CREATE TABLE IF NOT EXISTS public.course_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    purchase_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    amount VARCHAR(50) NOT NULL,
    status booking_status DEFAULT 'Completed'::booking_status NOT NULL
);

-- 7. Create PLATFORM SETTINGS Table
CREATE TABLE IF NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_email VARCHAR(255) DEFAULT 'support@hariomthalassic.com' NOT NULL,
    contact_phone VARCHAR(50) DEFAULT '+91 22 12345678' NOT NULL,
    payment_gateway VARCHAR(100) DEFAULT 'razorpay_production_mode' NOT NULL,
    dgs_accreditation_id VARCHAR(100) DEFAULT 'DGS-MTI-10294' NOT NULL
);

-- Insert Initial Mock Settings
INSERT INTO public.settings (system_email, contact_phone, payment_gateway, dgs_accreditation_id)
VALUES ('support@hariomthalassic.com', '+91 22 12345678', 'razorpay_production_mode', 'DGS-MTI-10294')
ON CONFLICT DO NOTHING;

-- 8. Insert Initial Mock Courses
INSERT INTO public.courses (code, name, category, duration, fees, description, status)
VALUES 
('BST', 'Basic Safety Training', 'basic', '12 Days', '₹12,000', 'Mandatory safety modules including Personal Survival Techniques and Firefighting.', 'Active'),
('AFF', 'Advanced Fire Fighting', 'advanced', '5 Days', '₹7,200', 'Advanced training in organization and control of fire fighting operations.', 'Active'),
('OCTCO', 'Oil and Chemical Tanker Cargo Operations', 'basic', '6 Days', '₹6,000', 'Basic training for oil and chemical tanker cargo operations.', 'Active'),
('MEDICARE', 'Medical Care on Board Ships', 'advanced', '5 Days', '₹25,000', 'Advanced clinical diagnosis, injection procedures and ship hospital sanitation.', 'Active'),
('RPST', 'Refresher PST', 'refresher', '1 Day', '₹3,500', 'Refresher safety training for Personal Survival Techniques.', 'Active')
ON CONFLICT (code) DO NOTHING;

-- 9. Insert Sample Seafarer Users
INSERT INTO public.users (id, email, name, phone, role, status)
VALUES 
('a0000000-0000-0000-0000-000000000001', 'raj@example.com', 'Raj Kumar', '+91 98765 43210', 'SEAFARER', 'Pending Audit'),
('a0000000-0000-0000-0000-000000000002', 'priya@example.com', 'Priya Singh', '+91 99887 76655', 'SEAFARER', 'Active'),
('a0000000-0000-0000-0000-000000000003', 'amit@example.com', 'Amit Patel', '+91 98989 89898', 'SEAFARER', 'Pending Audit')
ON CONFLICT (email) DO NOTHING;

-- 10. Insert Seafarer Profiles
INSERT INTO public.seafarer_profiles (user_id, dob, birth_place, father_name, passport_num, passport_issue, passport_expiry, passport_place, indos_num, indos_issue, indos_status, cdc_num, cdc_issue, cdc_expiry, cdc_place, education)
VALUES 
('a0000000-0000-0000-0000-000000000001', '1994-08-12', 'Varanasi, Uttar Pradesh, India', 'Sanjay Kumar', 'Z1234567', '2020-01-10', '2030-01-09', 'Lucknow', '20N1234', '2020-03-15', 'Verified', 'MUM123456', '2020-05-20', '2030-05-19', 'Mumbai', 'Diploma in Nautical Science'),
('a0000000-0000-0000-0000-000000000002', '1996-05-24', 'Patna, Bihar, India', 'Rakesh Singh', 'Y7654321', '2021-04-12', '2031-04-11', 'Patna', '21N5678', '2021-06-20', 'Verified', 'KOL765432', '2021-08-18', '2031-08-17', 'Kolkata', 'B.Sc in Nautical Science'),
('a0000000-0000-0000-0000-000000000003', '1992-11-30', 'Ahmedabad, Gujarat, India', 'Kishor Patel', 'X9876543', '2019-12-05', '2029-12-04', 'Ahmedabad', '19E9876', '2019-11-20', 'Pending', 'MUM987654', '2019-12-15', '2029-12-14', 'Mumbai', 'Marine Engineering Degree')
ON CONFLICT (user_id) DO NOTHING;

-- 11. Insert Sea Service Logs
INSERT INTO public.sea_service_records (user_id, rpsl, vessel, vessel_type, imo, rank, sign_on, sign_off)
VALUES 
('a0000000-0000-0000-0000-000000000001', 'Anvay Maritime', 'Pacific Voyager', 'Container', '9876543', '3rd Officer', '2023-01-10', '2023-08-15'),
('a0000000-0000-0000-0000-000000000002', 'Synergy Marine', 'Atlantic Jewel', 'Oil Tanker', '9654321', 'Cadet', '2022-09-01', '2023-03-01'),
('a0000000-0000-0000-0000-000000000003', 'Fleet Management', 'Ganges Star', 'Bulk Carrier', '9543210', '4th Engineer', '2021-05-10', '2021-12-10')
ON CONFLICT DO NOTHING;

-- 12. Insert Course Booking Payments
INSERT INTO public.course_bookings (user_id, course_id, purchase_date, amount, status)
VALUES 
('a0000000-0000-0000-0000-000000000001', (SELECT id FROM public.courses WHERE code='BST' LIMIT 1), now() - INTERVAL '1 day', '₹12,000', 'Completed'),
('a0000000-0000-0000-0000-000000000002', (SELECT id FROM public.courses WHERE code='AFF' LIMIT 1), now() - INTERVAL '2 days', '₹7,200', 'Completed'),
('a0000000-0000-0000-0000-000000000003', (SELECT id FROM public.courses WHERE code='MEDICARE' LIMIT 1), now() - INTERVAL '3 days', '₹25,000', 'Processing')
ON CONFLICT DO NOTHING;
