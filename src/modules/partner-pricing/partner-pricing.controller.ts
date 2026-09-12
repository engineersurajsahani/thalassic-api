import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PartnerPricingService } from './partner-pricing.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, ROLES } from '../../common/decorators/roles.decorator';

@Controller('partner/pricing')
@UseGuards(AuthGuard, RolesGuard)
@Roles(ROLES.MASTER, ROLES.PARTNER_ADMIN, ROLES.AGENT_ADMIN, ROLES.AGENT)
export class PartnerPricingController {
  constructor(private readonly partnerPricingService: PartnerPricingService) {}

  @Get()
  getAllPricings(@Query('partnerId') partnerId?: string) {
    return this.partnerPricingService.getAllPricings(partnerId);
  }

  @Get('proposals/pending')
  @Roles(ROLES.MASTER)
  getPendingProposals(@Query('partnerId') partnerId?: string) {
    return this.partnerPricingService.getPendingProposals(partnerId);
  }

  @Get(':id')
  getPricingById(
    @Param('id') id: string,
    @Query('partnerId') partnerId?: string,
  ) {
    return this.partnerPricingService.getPricingById(id, partnerId);
  }

  @Post(':id/propose')
  @Roles(ROLES.PARTNER_ADMIN, ROLES.AGENT_ADMIN, ROLES.AGENT, ROLES.MASTER)
  proposePrice(
    @Param('id') id: string,
    @Body('proposedPayableAmount') proposedPayableAmount: number,
    @Body('partnerId') partnerId?: string,
    @Body('reason') reason?: string,
    @Req() req?: any,
  ) {
    const userId = req?.user?.sub || req?.user?.id;
    return this.partnerPricingService.proposePrice(
      id,
      proposedPayableAmount,
      partnerId,
      reason,
      userId,
    );
  }

  @Post(':id/approve')
  @Roles(ROLES.MASTER)
  approvePrice(
    @Param('id') id: string,
    @Body('partnerId') partnerId?: string,
    @Req() req?: any,
  ) {
    const userId = req?.user?.sub || req?.user?.id;
    return this.partnerPricingService.approvePrice(id, partnerId, userId);
  }

  @Post(':id/reject')
  @Roles(ROLES.MASTER)
  rejectPrice(
    @Param('id') id: string,
    @Body('reason') reason?: string,
    @Body('partnerId') partnerId?: string,
    @Req() req?: any,
  ) {
    const userId = req?.user?.sub || req?.user?.id;
    return this.partnerPricingService.rejectPrice(
      id,
      reason,
      partnerId,
      userId,
    );
  }

  @Post('proposals/:proposalId/approve')
  @Roles(ROLES.MASTER)
  approveProposal(
    @Param('proposalId') proposalId: string,
    @Body('notes') notes?: string,
    @Req() req?: any,
  ) {
    const userId = req?.user?.sub || req?.user?.id;
    return this.partnerPricingService.approveProposal(
      proposalId,
      userId,
      notes,
    );
  }

  @Post('proposals/:proposalId/reject')
  @Roles(ROLES.MASTER)
  rejectProposal(
    @Param('proposalId') proposalId: string,
    @Body('reason') reason: string,
    @Req() req?: any,
  ) {
    const userId = req?.user?.sub || req?.user?.id;
    return this.partnerPricingService.rejectProposal(
      proposalId,
      userId,
      reason,
    );
  }
}
