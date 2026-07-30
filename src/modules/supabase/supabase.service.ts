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
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('password123', 10);
      const now = new Date();

      // Seed/Activate Agent: agent@thalassic.in
      const { data: existingAgent, error: agentCheckError } = await supabase
        .from('User')
        .select('id')
        .eq('email', 'agent@thalassic.in')
        .maybeSingle();

      let agentId = existingAgent?.id;

      if (!existingAgent && !agentCheckError) {
        console.log("Seeding Agent User...");
        agentId = require('crypto').randomUUID();
        const { error } = await supabase
          .from('User')
          .insert([{
            id: agentId,
            email: 'agent@thalassic.in',
            password: hashedPassword,
            name: 'Agent User',
            phone: '+91 99999 88888',
            role: 'agent',
            updatedAt: now
          }]);
        if (error) {
          console.error("Error seeding agent user:", error);
          agentId = null;
        } else {
          console.log("Agent user successfully seeded: agent@thalassic.in / password123");
        }
      }

      if (agentId) {
        const { error: metaErr } = await supabase
          .from('agent_metadata')
          .upsert({
            user_id: agentId,
            referral_code: 'REFAGENT123',
            onboarding_status: 'Active',
            general_commission: 5.0,
            updated_at: now
          }, { onConflict: 'user_id' });

        if (metaErr) {
          console.error("Error upserting agent metadata:", metaErr);
        } else {
          console.log("Agent metadata activated successfully: onboarding_status = Active");
        }
      }

      // Seed Agent Admin: admin@thalassic.in
      const { data: existingAdmin, error: adminCheckError } = await supabase
        .from('User')
        .select('id')
        .eq('email', 'admin@thalassic.in')
        .maybeSingle();

      if (!existingAdmin && !adminCheckError) {
        console.log("Seeding Agent Admin User...");
        const adminId = require('crypto').randomUUID();
        const { error } = await supabase
          .from('User')
          .insert([{
            id: adminId,
            email: 'admin@thalassic.in',
            password: hashedPassword,
            name: 'Agent Admin',
            phone: '+91 88888 77777',
            role: 'agent-admin',
            updatedAt: now
          }]);
        if (error) {
          console.error("Error seeding agent admin user:", error);
        } else {
          console.log("Agent admin user successfully seeded: admin@thalassic.in / password123");
        }
      }
    } catch (e) {
      console.error("Failed to run DB seed check for agents:", e);
    }
  }
}
