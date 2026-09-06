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

  // ISSUE-011, ISSUE-054: Health check endpoint for load balancers and monitoring
  @Get('health')
  @HttpCode(HttpStatus.OK)
  async healthCheck() {
    try {
      const supabase = this.supabaseService.getClient();
      // Simple query to verify database connectivity
      const { error } = await supabase
        .from('User')
        .select('id')
        .limit(1)
        .single();

      if (error) {
        return {
          status: 'unhealthy',
          database: 'connection error',
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
        status: 'unhealthy',
        database: 'connection error',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
