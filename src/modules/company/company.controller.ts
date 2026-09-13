import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CompanyService } from './company.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, ROLES } from '../../common/decorators/roles.decorator';

@Controller('company')
@UseGuards(AuthGuard, RolesGuard)
@Roles(ROLES.COMPANY_ADMIN, ROLES.MASTER)
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get('dashboard')
  getDashboard(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.companyService.getDashboard(userId);
  }

  @Get('profile')
  getProfile(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.companyService.getProfile(userId);
  }

  @Put('profile')
  updateProfile(@Req() req: any, @Body() data: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.companyService.updateProfile(userId, data);
  }

  @Get('crew')
  getCrew(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.companyService.getCrew(userId);
  }

  @Post('crew')
  addCrewMember(@Req() req: any, @Body() data: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.companyService.addCrewMember(userId, data);
  }

  @Post('sponsor')
  sponsorCourse(@Req() req: any, @Body() data: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.companyService.sponsorCourse(userId, data);
  }
}
