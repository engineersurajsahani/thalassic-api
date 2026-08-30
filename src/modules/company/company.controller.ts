import { Controller, Get, Post, Patch, Body, Req, Query, Param, UseGuards, UnauthorizedException } from '@nestjs/common';
import { CompanyService } from './company.service';
import { AuthGuard } from '../auth/auth.guard';
import { RegisterWalkInDto } from './dto/register-walk-in.dto';
import { VerifyDocumentDto } from './dto/verify-document.dto';
import { UpdateSeafarerDto } from './dto/update-seafarer.dto';
import { GenerateInvoiceDto } from './dto/generate-invoice.dto';
import { PaginationDto } from './dto/pagination.dto';

@Controller('company')
@UseGuards(AuthGuard)
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  private getAdminId(req: any): string {
    const user = req.user;
    if (!user || !user.id) throw new UnauthorizedException('Admin not authenticated');
    return user.id;
  }

  // --- DASHBOARD ---
  @Get('dashboard')
  getDashboard(@Req() req: any) {
    return this.companyService.getDashboard(this.getAdminId(req));
  }

  // --- SEAFARER MANAGEMENT ---
  @Get('seafarers')
  getSeafarers(@Req() req: any, @Query() pagination: PaginationDto) {
    return this.companyService.getSeafarers(
      this.getAdminId(req), 
      pagination.page ? parseInt(pagination.page) : 1, 
      pagination.limit ? parseInt(pagination.limit) : 10,
      pagination.search
    );
  }

  @Get('seafarers/:id')
  getSeafarerProfile(@Req() req: any, @Param('id') seafarerId: string) {
    return this.companyService.getSeafarerProfile(this.getAdminId(req), seafarerId);
  }

  @Patch('seafarers/:id')
  updateSeafarerProfile(@Req() req: any, @Param('id') seafarerId: string, @Body() dto: UpdateSeafarerDto) {
    return this.companyService.updateSeafarerProfile(this.getAdminId(req), seafarerId, dto);
  }

  // --- WALK-IN REGISTRATION ---
  @Post('walk-in')
  registerWalkIn(@Req() req: any, @Body() dto: RegisterWalkInDto) {
    return this.companyService.registerWalkIn(this.getAdminId(req), dto);
  }

  // --- DOCUMENTS ---
  @Get('documents')
  getDocuments(@Req() req: any, @Query() pagination: PaginationDto, @Query('status') status?: string) {
    return this.companyService.getDocuments(
      this.getAdminId(req),
      pagination.page ? parseInt(pagination.page) : 1,
      pagination.limit ? parseInt(pagination.limit) : 10,
      status
    );
  }

  @Patch('documents/:id/verify')
  verifyDocument(@Req() req: any, @Param('id') docId: string, @Body() dto: VerifyDocumentDto) {
    return this.companyService.verifyDocument(this.getAdminId(req), docId, dto.status, dto.remarks);
  }

  // --- PAYMENTS & INVOICES ---
  @Get('payments')
  getPayments(@Req() req: any, @Query() pagination: PaginationDto) {
    return this.companyService.getPayments(
      this.getAdminId(req),
      pagination.page ? parseInt(pagination.page) : 1,
      pagination.limit ? parseInt(pagination.limit) : 10
    );
  }

  @Get('invoices')
  getInvoices(@Req() req: any, @Query() pagination: PaginationDto) {
    return this.companyService.getInvoices(
      this.getAdminId(req),
      pagination.page ? parseInt(pagination.page) : 1,
      pagination.limit ? parseInt(pagination.limit) : 10
    );
  }

  @Post('invoices')
  generateInvoice(@Req() req: any, @Body() dto: GenerateInvoiceDto) {
    return this.companyService.generateInvoice(this.getAdminId(req), dto.amount, dto.email);
  }

  // --- REPORTS ---
  @Get('reports/:type')
  getReport(@Req() req: any, @Param('type') type: string) {
    return this.companyService.getReport(this.getAdminId(req), type);
  }
}
