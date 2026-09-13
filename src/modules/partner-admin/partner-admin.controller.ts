import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PartnerAdminService } from './partner-admin.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, ROLES } from '../../common/decorators/roles.decorator';

@Controller(['partner-admin', 'agent-admin'])
@UseGuards(AuthGuard, RolesGuard)
@Roles(ROLES.MASTER, ROLES.PARTNER_ADMIN, ROLES.AGENT_ADMIN)
export class PartnerAdminController {
  constructor(private readonly partnerAdminService: PartnerAdminService) {}

  @Get('partners')
  @Roles(ROLES.MASTER)
  getAllPartners() {
    return this.partnerAdminService.getAllPartners();
  }

  @Get('partners/:id')
  @Roles(ROLES.MASTER)
  getPartnerById(@Param('id') id: string) {
    return this.partnerAdminService.getPartnerById(id);
  }

  @Patch('partners/:id/status')
  @Roles(ROLES.MASTER)
  updatePartnerStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Req() req: any,
  ) {
    const userId = req.user?.sub || req.user?.id;
    return this.partnerAdminService.updatePartnerStatus(id, status, userId);
  }

  @Get('settlements')
  @Roles(ROLES.MASTER, ROLES.PARTNER_ADMIN, ROLES.AGENT_ADMIN)
  getAllSettlements() {
    return this.partnerAdminService.getAllSettlements();
  }

  @Post('settlements/:id/approve')
  @Roles(ROLES.MASTER)
  approveSettlement(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.partnerAdminService.approveSettlement(id, userId);
  }

  @Post('settlements/:id/disburse')
  @Roles(ROLES.MASTER)
  disburseSettlement(
    @Param('id') id: string,
    @Body('paymentReference') paymentReference: string,
    @Body('notes') notes: string,
    @Req() req: any,
  ) {
    const userId = req.user?.sub || req.user?.id;
    return this.partnerAdminService.disburseSettlement(
      id,
      paymentReference,
      userId,
      notes,
    );
  }
}
