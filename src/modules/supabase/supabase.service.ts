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
    const supabaseUrl =
      this.configService.get<string>('SUPABASE_URL') ||
      'https://placeholder.supabase.co';
    const supabaseKey =
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
      'placeholder-key';
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
      console.log(
        'Skipping agent user seeding in non-development environment.',
      );
      return;
    }

    try {
      const supabase = this.client;

      // Auto-migration: Add 'remarks' column to Document table if missing
      try {
        await supabase.rpc('exec_sql', {
          query: `ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS remarks TEXT;`,
        });
      } catch (migErr) {
        // migration skipped silently if offline or rpc unavailable
      }

      // Ensure 'seafarer-documents' bucket exists in Supabase Storage
      try {
        const { data: buckets } = await supabase.storage.listBuckets();
        const hasBucket = buckets?.some(
          (b: any) => b.name === 'seafarer-documents',
        );
        if (!hasBucket) {
          await supabase.storage.createBucket('seafarer-documents', {
            public: true,
          });
        }
      } catch (bucketErr) {
        // bucket check skipped silently if offline
      }

      const randomPassword = crypto.randomBytes(12).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      const now = new Date();

      // Seed/Activate Agent: agent@thalassic.in
      try {
        const { data: existingAgent, error: agentCheckError } = await supabase
          .from('User')
          .select('id')
          .eq('email', 'agent@thalassic.in')
          .maybeSingle();

        let agentId = existingAgent?.id;

        if (!existingAgent && !agentCheckError) {
          agentId = crypto.randomUUID();
          await supabase.from('User').insert([
            {
              id: agentId,
              email: 'agent@thalassic.in',
              password: hashedPassword,
              name: 'Agent User',
              phone: '+91 99999 88888',
              role: ROLES.AGENT,
              updatedAt: now,
            },
          ]);
        }

        if (agentId) {
          await supabase.from('agent_metadata').upsert(
            {
              user_id: agentId,
              referral_code: 'REFAGENT123',
              onboarding_status: 'Active',
              general_commission: 5.0,
              updated_at: now,
            },
            { onConflict: 'user_id' },
          );
        }
      } catch (agentErr) {}

      // Seed Agent Admin: admin@thalassic.in
      try {
        const { data: existingAdmin, error: adminCheckError } = await supabase
          .from('User')
          .select('id')
          .eq('email', 'admin@thalassic.in')
          .maybeSingle();

        if (!existingAdmin && !adminCheckError) {
          const adminId = crypto.randomUUID();
          await supabase.from('User').insert([
            {
              id: adminId,
              email: 'admin@thalassic.in',
              password: hashedPassword,
              name: 'Agent Admin',
              phone: '+91 88888 77777',
              role: ROLES.AGENT_ADMIN,
              updatedAt: now,
            },
          ]);
        }
      } catch (adminErr) {}
    } catch (e) {
      console.warn('Skipping DB seed check:', (e as any)?.message);
    }
  }
}
