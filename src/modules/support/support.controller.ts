import { Body, Controller, Get, Param, Post, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { SupportService } from './support.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('support')
export class SupportController {
  constructor(private supportService: SupportService) {}

  @Get()
  async getTickets(@CurrentUser() user: any) {
    return this.supportService.getMyTickets(user.sub);
  }

  @Get(':id')
  async getTicketById(@CurrentUser() user: any, @Param('id') ticketId: string) {
    return this.supportService.getTicketById(user.sub, ticketId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createTicket(
    @CurrentUser() user: any,
    @Body('subject') subject: string,
    @Body('description') description: string,
  ) {
    if (!subject || !description) {
      throw new BadRequestException('Subject and description are required');
    }
    return this.supportService.createTicket(user.sub, subject, description);
  }

  @Post(':id/reply')
  @HttpCode(HttpStatus.OK)
  async addReply(
    @CurrentUser() user: any,
    @Param('id') ticketId: string,
    @Body('message') message: string,
  ) {
    if (!message) {
      throw new BadRequestException('Message is required');
    }
    return this.supportService.addReply(user.sub, ticketId, message, user.name);
  }
}
