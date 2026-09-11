import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PartnerApplicationsService } from './partner-applications.service';
import { CreatePartnerApplicationDto } from './dto/create-partner-application.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('partner-applications')
export class PublicPartnerApplicationsController {
  constructor(
    private readonly partnerApplicationsService: PartnerApplicationsService,
  ) {}

  @Post()
  async submitApplication(@Body() dto: CreatePartnerApplicationDto) {
    const result = await this.partnerApplicationsService.createApplication(dto);
    return {
      success: true,
      message:
        'Your Business Partner Application has been submitted successfully.',
      data: result,
    };
  }

  @Get()
  @UseGuards(AuthGuard)
  async getApplications() {
    const result = await this.partnerApplicationsService.getApplications();

    return {
      success: true,
      data: result,
    };
  }
}
