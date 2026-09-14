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
      return;
    }

    try {
      const supabase = this.client;

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
      } catch {
        // Handled
      }

      const now = new Date();

      // Seed/Activate Agent: agent@thalassic.in (DEV ONLY)
      const { data: existingAgent, error: agentCheckError } = await supabase
        .from('users')
        .select('id')
        .eq('email', 'agent@thalassic.in')
        .maybeSingle();

      let agentId = existingAgent?.id;

      if (!existingAgent && !agentCheckError) {
        agentId = crypto.randomUUID();
        const { error } = await supabase.from('users').insert([
          {
            id: agentId,
            email: 'agent@thalassic.in',
            name: 'Partner User',
            phone: '+91 99999 88888',
            role: ROLES.PARTNER,
          },
        ]);
        if (error) {
          console.warn('[DEV] Partner user seed check:', error.message);
          agentId = null;
        }
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

      // Seed Partner Admin: admin@thalassic.in (DEV ONLY)
      const { data: existingAdmin, error: adminCheckError } = await supabase
        .from('users')
        .select('id')
        .eq('email', 'admin@thalassic.in')
        .maybeSingle();

      if (!existingAdmin && !adminCheckError) {
        const adminId = crypto.randomUUID();
        await supabase.from('users').insert([
          {
            id: adminId,
            email: 'admin@thalassic.in',
            name: 'Partner Admin',
            phone: '+91 88888 77777',
            role: ROLES.PARTNER_ADMIN,
          },
        ]);
      }
    } catch {
      // Non-blocking
    }
  }
}
