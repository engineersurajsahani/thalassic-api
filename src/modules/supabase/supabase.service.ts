import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private client: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL') || 'https://placeholder.supabase.co';
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') || 'placeholder-key';
    this.client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
      },
    });
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  async onModuleInit() {
    try {
      const supabase = this.client;
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('password123', 10);
      const now = new Date();

      // 1. Seed/Update Master User: master@gmail.com / master@12
      const masterHash = await bcrypt.hash('master@12', 10);
      const { data: existingMaster } = await supabase
        .from('User')
        .select('id')
        .eq('email', 'master@gmail.com')
        .maybeSingle();

      if (!existingMaster) {
        await supabase.from('User').insert([{
          id: require('crypto').randomUUID(),
          email: 'master@gmail.com',
          password: masterHash,
          name: 'Master Admin',
          phone: '+91 91111 22222',
          role: 'MASTER',
          updatedAt: now,
          createdAt: now,
        }]);
        console.log('Seeded Master user: master@gmail.com / master@12');
      } else {
        await supabase.from('User').update({ password: masterHash, role: 'MASTER' }).eq('id', existingMaster.id);
      }

      // 2. Seed/Update Seafarer User: seafarer@test.com / seafarer@123
      const seafarerHash = await bcrypt.hash('seafarer@123', 10);
      const { data: existingSeafarer } = await supabase
        .from('User')
        .select('id')
        .eq('email', 'seafarer@test.com')
        .maybeSingle();

      let seafarerId = existingSeafarer?.id;
      if (!existingSeafarer) {
        seafarerId = require('crypto').randomUUID();
        await supabase.from('User').insert([{
          id: seafarerId,
          email: 'seafarer@test.com',
          password: seafarerHash,
          name: 'Rohan Sharma',
          phone: '+91 98765 11223',
          role: 'SEAFARER',
          updatedAt: now,
          createdAt: now,
        }]);
        console.log('Seeded Seafarer user: seafarer@test.com / seafarer@123');
      } else {
        await supabase.from('User').update({ password: seafarerHash, role: 'SEAFARER' }).eq('id', seafarerId);
      }

      if (seafarerId) {
        await supabase.from('SeafarerProfile').upsert({
          id: seafarerId,
          userId: seafarerId,
          dob: '1995-06-15',
          nationality: 'Indian',
          address: '402 Ocean Towers, Andheri West, Mumbai',
          indosNumber: '22N1234',
          passportNumber: 'P1234567',
          cdcNumber: 'CDC123456',
          fatherName: 'Rajesh Sharma',
        }, { onConflict: 'userId' });
      }

      // 3. Seed/Update Company Admin User: admin2@shippingco.com / Password123!
      const companyAdminHash = await bcrypt.hash('Password123!', 10);
      const { data: existingCompAdmin } = await supabase
        .from('User')
        .select('id')
        .eq('email', 'admin2@shippingco.com')
        .maybeSingle();

      if (!existingCompAdmin) {
        await supabase.from('User').insert([{
          id: require('crypto').randomUUID(),
          email: 'admin2@shippingco.com',
          password: companyAdminHash,
          name: 'Shipping Co Admin',
          phone: '+91 98888 33333',
          role: 'COMPANY_ADMIN',
          updatedAt: now,
          createdAt: now,
        }]);
        console.log('Seeded Company Admin user: admin2@shippingco.com / Password123!');
      } else {
        await supabase.from('User').update({ password: companyAdminHash, role: 'COMPANY_ADMIN' }).eq('id', existingCompAdmin.id);
      }

      // 4. Seed/Activate Partner (Agent): agent@thalassic.in / password123 & partner@test.com / partner@123
      const partnerHash = await bcrypt.hash('partner@123', 10);
      const { data: existingPartner } = await supabase
        .from('User')
        .select('id')
        .eq('email', 'partner@test.com')
        .maybeSingle();

      let partnerId = existingPartner?.id;
      if (!existingPartner) {
        partnerId = require('crypto').randomUUID();
        await supabase.from('User').insert([{
          id: partnerId,
          email: 'partner@test.com',
          password: partnerHash,
          name: 'Hari Om Global Partner',
          phone: '+91 99999 55555',
          role: 'AGENT',
          updatedAt: now,
          createdAt: now,
        }]);
        console.log('Seeded Partner user: partner@test.com / partner@123');
      } else {
        await supabase.from('User').update({ password: partnerHash, role: 'AGENT' }).eq('id', partnerId);
      }

      if (partnerId) {
        await supabase.from('agent_metadata').upsert({
          user_id: partnerId,
          referral_code: 'REFPARTNER123',
          onboarding_status: 'Active',
          general_commission: 0.0,
          updated_at: now,
        }, { onConflict: 'user_id' });
      }

      // 5. Seed/Activate legacy agent user: agent@thalassic.in
      const { data: existingAgent, error: agentCheckError } = await supabase
        .from('User')
        .select('id')
        .eq('email', 'agent@thalassic.in')
        .maybeSingle();

      let agentId = existingAgent?.id;

      if (!existingAgent && !agentCheckError) {
        agentId = require('crypto').randomUUID();
        await supabase
          .from('User')
          .insert([{
            id: agentId,
            email: 'agent@thalassic.in',
            password: hashedPassword,
            name: 'Hari Om Partner Agency',
            phone: '+91 99999 88888',
            role: 'AGENT',
            updatedAt: now,
            createdAt: now,
          }]);
      } else if (existingAgent) {
        await supabase.from('User').update({ role: 'AGENT' }).eq('id', existingAgent.id);
      }

      if (agentId) {
        await supabase
          .from('agent_metadata')
          .upsert({
            user_id: agentId,
            referral_code: 'REFAGENT123',
            onboarding_status: 'Active',
            general_commission: 0.0,
            updated_at: now,
          }, { onConflict: 'user_id' });
      }

      // 6. Seed Agent Admin: admin@thalassic.in
      const { data: existingAdmin, error: adminCheckError } = await supabase
        .from('User')
        .select('id')
        .eq('email', 'admin@thalassic.in')
        .maybeSingle();

      if (!existingAdmin && !adminCheckError) {
        const adminId = require('crypto').randomUUID();
        await supabase
          .from('User')
          .insert([{
            id: adminId,
            email: 'admin@thalassic.in',
            password: hashedPassword,
            name: 'Agent Admin',
            phone: '+91 88888 77777',
            role: 'AGENT_ADMIN',
            updatedAt: now,
            createdAt: now,
          }]);
      }
    } catch (e) {
      console.error('Failed to run DB seed check for accounts:', e);
    }
  }
}
