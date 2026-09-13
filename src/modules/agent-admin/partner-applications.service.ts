import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { randomUUID } from 'crypto';
import { CreatePartnerApplicationDto } from './dto/create-partner-application.dto';
import * as fs from 'fs';
import * as path from 'path';

export interface PartnerApplication {
  id: string;
  fullName: string;
  companyName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  message?: string;
  status: 'Pending Review' | 'Contacted' | 'Approved' | 'Rejected';
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class PartnerApplicationsService {
  private readonly storageFilePath = path.join(process.cwd(), 'partner_applications_data.json');
  private inMemoryApplications: PartnerApplication[] = [];

  constructor(private readonly supabaseService: SupabaseService) {
    this.loadApplicationsFromDisk();
  }

  private loadApplicationsFromDisk() {
    try {
      if (fs.existsSync(this.storageFilePath)) {
        const raw = fs.readFileSync(this.storageFilePath, 'utf8');
        this.inMemoryApplications = JSON.parse(raw);
      } else {
        // Seed initial mock partner applications
        this.inMemoryApplications = [
          {
            id: 'p-app-001',
            fullName: 'Captain Vikram Malhotra',
            companyName: 'Apex Maritime Agency Solutions',
            email: 'vikram@apexmaritime.in',
            phone: '+91 98200 11223',
            city: 'Mumbai',
            state: 'Maharashtra',
            message: 'We are a DG Shipping licensed agency looking to partner for STCW & Refresher courses.',
            status: 'Pending Review',
            createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
            updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
          },
          {
            id: 'p-app-002',
            fullName: 'Meera Deshmukh',
            companyName: 'Oceanic Staffing & Consultancy',
            email: 'meera@oceanicstaffing.com',
            phone: '+91 97112 33445',
            city: 'Kochi',
            state: 'Kerala',
            message: 'Extremely interested in expanding our seafarer roster enrollment via Hari Om Thalassic.',
            status: 'Contacted',
            createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
            updatedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
          },
        ];
        this.saveApplicationsToDisk();
      }
    } catch (e) {
      console.error('Error loading partner applications from disk:', e);
    }
  }

  private saveApplicationsToDisk() {
    try {
      fs.writeFileSync(this.storageFilePath, JSON.stringify(this.inMemoryApplications, null, 2), 'utf8');
    } catch (e) {
      console.error('Error saving partner applications to disk:', e);
    }
  }

  async createApplication(dto: CreatePartnerApplicationDto): Promise<PartnerApplication> {
    const now = new Date().toISOString();
    const newApp: PartnerApplication = {
      id: randomUUID(),
      fullName: dto.fullName,
      companyName: dto.companyName,
      email: dto.email,
      phone: dto.phone,
      city: dto.city,
      state: dto.state,
      message: dto.message || '',
      status: 'Pending Review',
      createdAt: now,
      updatedAt: now,
    };

    // Try inserting into Supabase table if it exists
    const supabase = this.supabaseService.getClient();
    try {
      await supabase.from('partner_applications').insert({
        id: newApp.id,
        full_name: newApp.fullName,
        company_name: newApp.companyName,
        email: newApp.email,
        phone: newApp.phone,
        city: newApp.city,
        state: newApp.state,
        message: newApp.message,
        status: newApp.status,
        created_at: newApp.createdAt,
        updated_at: newApp.updatedAt,
      });
    } catch (e) {
      // ISSUE-031: Log the error instead of silently swallowing
      console.warn('Could not insert partner application into Supabase (table may not exist):', (e as any)?.message);
    }

    // Always maintain local persisted store
    this.inMemoryApplications.unshift(newApp);
    this.saveApplicationsToDisk();

    // Log to Audit Logs in Supabase
    try {
      await supabase.from('audit_logs').insert({
        id: randomUUID(),
        user_name: dto.fullName,
        action: 'PARTNER_APPLICATION_SUBMITTED',
        module: 'Partner Network',
        entity_id: newApp.id,
        details: `Business Partner Application submitted by ${dto.fullName} (${dto.companyName}) from ${dto.city}, ${dto.state}`,
        ip_address: '127.0.0.1',
        created_at: now,
      });
    } catch (err) {
      console.error('Failed to log partner application audit:', err);
    }

    // Send confirmation email simulation
    console.log(`
================================================================================
📧 [CONFIRMATION EMAIL SENT]
To: ${dto.email}
Subject: Business Partner Application Received - Hari Om Thalassic Maritime
Content:
Dear ${dto.fullName},

Thank you for your interest in becoming a Business Partner with Hari Om Thalassic Maritime!

Application Details:
- Agency/Company: ${dto.companyName}
- Location: ${dto.city}, ${dto.state}
- Mobile: ${dto.phone}

Our Agent Administration team will review your application and contact you within 24–48 business hours.

Warm regards,
Agent Administration Team
Hari Om Thalassic Maritime Career Partners
================================================================================
    `);

    return newApp;
  }

  async getApplications(): Promise<PartnerApplication[]> {
    // Try fetching from Supabase
    const supabase = this.supabaseService.getClient();
    try {
      const { data, error } = await supabase
        .from('partner_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map((d: any) => ({
          id: d.id,
          fullName: d.full_name,
          companyName: d.company_name,
          email: d.email,
          phone: d.phone,
          city: d.city,
          state: d.state,
          message: d.message,
          status: d.status,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        }));
      }
    } catch (e) {
      // Fallback to in-memory/file storage
    }

    return this.inMemoryApplications;
  }

  async updateStatus(
    id: string,
    status: 'Pending Review' | 'Contacted' | 'Approved' | 'Rejected',
    adminId = 'system',
    adminName = 'Agent Admin',
  ): Promise<PartnerApplication> {
    const app = this.inMemoryApplications.find((a) => a.id === id);
    const now = new Date().toISOString();

    if (app) {
      app.status = status;
      app.updatedAt = now;
      this.saveApplicationsToDisk();
    }

    // Try updating Supabase
    const supabase = this.supabaseService.getClient();
    try {
      await supabase
        .from('partner_applications')
        .update({ status, updated_at: now })
        .eq('id', id);
    } catch (e) {
      // ISSUE-031: Log the error instead of silently swallowing
      console.warn('Could not update partner application in Supabase:', (e as any)?.message);
    }

    // Audit log
    try {
      await supabase.from('audit_logs').insert({
        id: randomUUID(),
        user_id: adminId,
        user_name: adminName,
        action: 'UPDATE_PARTNER_APPLICATION_STATUS',
        module: 'Partner Network',
        entity_id: id,
        details: `Updated partner application status for ${app ? app.fullName : id} to ${status}`,
        ip_address: '127.0.0.1',
        created_at: now,
      });
    } catch (e) {
      // ISSUE-031: Log the error instead of silently swallowing
      console.warn('Could not log partner application status update to audit_logs:', (e as any)?.message);
    }

    if (!app) {
      throw new NotFoundException(`Partner application with ID ${id} not found`);
    }

    return app;
  }
}
