const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const SUPABASE_URL = 'https://expzlbadryzwvsxfmads.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4cHpsYmFkcnl6d3ZzeGZtYWRzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzUwODUwNSwiZXhwIjoyMDk5MDg0NTA1fQ.BsavZd3CxJ3C_AfUOO4aYjvhIeOtmrCsROB7Kgs9JsE';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const email = 'admin2@shippingco.com';
  const password = 'Password123!';
  const hashedPassword = await bcrypt.hash(password, 10);

  console.log('Inserting user...');
  const { data, error } = await supabase.from('users').insert({
    id: 'c0000000-0000-0000-0000-000000000001',
    email: email,
    password: hashedPassword,
    name: 'Admin 2',
    role: 'COMPANY_ADMIN',
    status: 'Active'
  }).select();

  if (error) {
    console.error('Error inserting user:', error);
  } else {
    console.log('User created:', data);
  }
}

main();
