import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private client: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl =
      this.configService.get<string>('SUPABASE_URL') ||
      'https://expzlbadryzwvsxfmads.supabase.co';
    const supabaseKey =
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
      'placeholder-service-key';

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
      // Ensure 'seafarer-documents' bucket exists in Supabase Storage
      const { data: buckets, error } = await this.client.storage.listBuckets();
      if (!error && buckets) {
        const hasBucket = buckets.some(
          (b: any) => b.name === 'seafarer-documents',
        );
        if (!hasBucket) {
          await this.client.storage.createBucket('seafarer-documents', {
            public: true,
          });
          this.logger.log("Bucket 'seafarer-documents' verified/created.");
        }
      }
    } catch (e) {
      this.logger.debug('Storage bucket check completed.');
    }
  }
}
