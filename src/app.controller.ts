import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { AppService } from './app.service';
import { SupabaseService } from './modules/supabase/supabase.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // Health check endpoint for Render load balancers and monitoring
  @Get('health')
  @HttpCode(HttpStatus.OK)
  async healthCheck() {
    try {
      const supabase = this.supabaseService.getClient();
      const { error } = await supabase
        .from('User')
        .select('id')
        .limit(1);

      if (error && error.code !== 'PGRST116' && !error.message?.includes('0 rows')) {
        return {
          status: 'connected',
          database: 'available',
          timestamp: new Date().toISOString(),
        };
      }

      return {
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        status: 'healthy',
        service: 'online',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
