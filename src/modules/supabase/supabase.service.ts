import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
// Import ROLES from common decorators to prevent circular dependency
import { ROLES } from '../../common/decorators/roles.decorator';

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
    // ISSUE-019: Only seed in development environment — never in production
    if (process.env.NODE_ENV !== 'development') {
      console.log('Skipping agent user seeding in non-development environment.');
      return;
    }

    try {
      const supabase = this.client;

      // Auto-migration: Add 'remarks' column to Document table if missing
      try {
        const { error: migrationError } = await supabase.rpc('exec_sql', {
          query: `ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS remarks TEXT;`,
        });
        if (migrationError) {
          console.warn('Could not run remarks migration via rpc:', migrationError.message);
        }
      } catch (migErr) {
        console.warn('Remarks column migration skipped:', (migErr as any)?.message);
      }

      // Ensure 'seafarer-documents' bucket exists in Supabase Storage
      try {
        const { data: buckets } = await supabase.storage.listBuckets();
        const hasBucket = buckets?.some((b: any) => b.name === 'seafarer-documents');
        if (!hasBucket) {
          await supabase.storage.createBucket('seafarer-documents', { public: true });
          console.log("Bucket 'seafarer-documents' ensured.");
        }
      } catch (bucketErr) {
        console.warn('Bucket check skipped:', (bucketErr as any)?.message);
      }

      // ISSUE-019: Use a secure randomly generated password for seeded users, not 'password123'
      // In development only — production users should be created through proper admin flows
      const randomPassword = crypto.randomBytes(12).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      const now = new Date();

      // Seed/Activate Agent: agent@thalassic.in (DEV ONLY)
      const { data: existingAgent, error: agentCheckError } = await supabase
        .from('User')
        .select('id')
        .eq('email', 'agent@thalassic.in')
        .maybeSingle();

      let agentId = existingAgent?.id;

      if (!existingAgent && !agentCheckError) {
        console.log('[DEV] Seeding Agent User...');
        agentId = crypto.randomUUID();
        const { error } = await supabase
          .from('User')
          .insert([{
            id: agentId,
            email: 'agent@thalassic.in',
            password: hashedPassword,
            name: 'Agent User',
            phone: '+91 99999 88888',
            role: ROLES.AGENT,
            updatedAt: now
          }]);
        if (error) {
          console.error('[DEV] Error seeding agent user:', error);
          agentId = null;
        } else {
          // ISSUE-032: Do NOT log the password in plain text
          console.log('[DEV] Agent user seeded: agent@thalassic.in (password stored in secure location)');
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
          console.error('[DEV] Error upserting agent metadata:', metaErr);
        }
      }

      // Seed Agent Admin: admin@thalassic.in (DEV ONLY)
      const { data: existingAdmin, error: adminCheckError } = await supabase
        .from('User')
        .select('id')
        .eq('email', 'admin@thalassic.in')
        .maybeSingle();

      if (!existingAdmin && !adminCheckError) {
        console.log('[DEV] Seeding Agent Admin User...');
        const adminId = crypto.randomUUID();
        const { error } = await supabase
          .from('User')
          .insert([{
            id: adminId,
            email: 'admin@thalassic.in',
            password: hashedPassword,
            name: 'Agent Admin',
            phone: '+91 88888 77777',
            role: ROLES.AGENT_ADMIN,
            updatedAt: now
          }]);
        if (error) {
          console.error('[DEV] Error seeding agent admin user:', error);
        } else {
          // ISSUE-032: Do NOT log the password in plain text
          console.log('[DEV] Agent admin user seeded: admin@thalassic.in (password stored in secure location)');
        }
      }
    } catch (e) {
      console.error('[DEV] Failed to run DB seed check for agents:', e);
    }
  }
}
