import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { PartnerPricingService } from './partner-pricing.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, ROLES } from '../../common/decorators/roles.decorator';

@Controller('partner/pricing')
@UseGuards(AuthGuard, RolesGuard)
@Roles(ROLES.MASTER, ROLES.AGENT_ADMIN, ROLES.AGENT)
export class PartnerPricingController {
  constructor(private readonly partnerPricingService: PartnerPricingService) {}

  @Get()
  getAllPricings() {
    return this.partnerPricingService.getAllPricings();
  }

  @Get(':id')
  getPricingById(@Param('id') id: string) {
    return this.partnerPricingService.getPricingById(id);
  }

  @Post(':id/propose')
  proposePrice(
    @Param('id') id: string,
    @Body('proposedPayableAmount') proposedPayableAmount: number,
  ) {
    return this.partnerPricingService.proposePrice(id, proposedPayableAmount);
  }

  @Post(':id/approve')
  approvePrice(@Param('id') id: string) {
    return this.partnerPricingService.approvePrice(id);
  }

  @Post(':id/reject')
  rejectPrice(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.partnerPricingService.rejectPrice(id, reason);
  }
}
