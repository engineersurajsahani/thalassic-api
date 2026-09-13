import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Query,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, ROLES } from '../../common/decorators/roles.decorator';

@Controller('invoices')
@UseGuards(AuthGuard, RolesGuard)
@Roles(
  ROLES.MASTER,
  ROLES.PARTNER_ADMIN,
  ROLES.PARTNER,
  ROLES.COMPANY_ADMIN,
  ROLES.SEAFARER,
)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  getInvoices(@Req() req: any, @Query() query: any) {
    return this.invoicesService.getInvoices(req.user, query);
  }

  @Get(':id')
  getInvoiceById(@Req() req: any, @Param('id') id: string) {
    return this.invoicesService.getInvoiceById(id, req.user);
  }

  @Get(':id/pdf')
  getInvoicePdf(@Req() req: any, @Param('id') id: string) {
    return this.invoicesService.getInvoicePdf(id, req.user);
  }

  @Post('export')
  exportInvoices(@Req() req: any, @Query() query: any) {
    return this.invoicesService.exportInvoices(req.user, query);
  }

  // --- Immutability Protection Endpoints (Reject Edit/Delete) ---
  @Put(':id')
  updateInvoicePut() {
    return this.invoicesService.updateInvoice();
  }

  @Patch(':id')
  updateInvoicePatch() {
    return this.invoicesService.updateInvoice();
  }

  @Delete(':id')
  deleteInvoice() {
    return this.invoicesService.deleteInvoice();
  }
}
