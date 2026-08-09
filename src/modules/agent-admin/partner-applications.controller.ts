import { Controller, Post, Body } from '@nestjs/common';
import { PartnerApplicationsService } from './partner-applications.service';
import { CreatePartnerApplicationDto } from './dto/create-partner-application.dto';

@Controller('partner-applications')
export class PublicPartnerApplicationsController {
  constructor(private readonly partnerApplicationsService: PartnerApplicationsService) {}

  @Post()
  async submitApplication(@Body() dto: CreatePartnerApplicationDto) {
    const result = await this.partnerApplicationsService.createApplication(dto);
    return {
      success: true,
      message: 'Your Business Partner Application has been submitted successfully.',
      data: result,
    };
  }
}
