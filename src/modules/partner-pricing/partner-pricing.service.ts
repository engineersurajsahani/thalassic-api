import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface CoursePricingRecord {
  id: string;
  courseCode: string;
  courseName: string;
  category: string;
  standardFee: number;
  activePayableAmount: number;
  proposedPayableAmount?: number | null;
  proposedDate?: string | null;
  status: 'Active' | 'Pending Approval' | 'Rejected';
  rejectionReason?: string;
  lastUpdated: string;
}

@Injectable()
export class PartnerPricingService {
  private pricings: CoursePricingRecord[] = [
    {
      id: 'c-bst-001',
      courseCode: 'BST-001',
      courseName: 'STCW Basic Safety Training (BST)',
      category: 'Safety & Emergency',
      standardFee: 12000,
      activePayableAmount: 10000,
      proposedPayableAmount: null,
      status: 'Active',
      lastUpdated: '2026-08-15T10:00:00.000Z',
    },
    {
      id: 'c-aff-002',
      courseCode: 'AFF-002',
      courseName: 'Advanced Fire Fighting (AFF)',
      category: 'Fire & Safety Ops',
      standardFee: 15000,
      activePayableAmount: 12500,
      proposedPayableAmount: 13000,
      proposedDate: '2026-08-28T14:30:00.000Z',
      status: 'Pending Approval',
      lastUpdated: '2026-08-28T14:30:00.000Z',
    },
    {
      id: 'c-mfa-003',
      courseCode: 'MFA-003',
      courseName: 'Medical First Aid (MFA)',
      category: 'Medical Care',
      standardFee: 8000,
      activePayableAmount: 6500,
      proposedPayableAmount: null,
      status: 'Active',
      lastUpdated: '2026-08-10T12:00:00.000Z',
    },
    {
      id: 'c-pscrb-004',
      courseCode: 'PSCRB-004',
      courseName: 'Proficiency in Survival Craft & Rescue Boats',
      category: 'Lifeboat & Survival',
      standardFee: 14000,
      activePayableAmount: 11000,
      proposedPayableAmount: null,
      status: 'Active',
      lastUpdated: '2026-08-01T09:00:00.000Z',
    },
    {
      id: 'c-tco-005',
      courseCode: 'TCO-005',
      courseName: 'Tanker Cargo Operations (TCO)',
      category: 'Cargo & Vessel Ops',
      standardFee: 18000,
      activePayableAmount: 15000,
      proposedPayableAmount: 16000,
      proposedDate: '2026-08-30T11:15:00.000Z',
      status: 'Pending Approval',
      lastUpdated: '2026-08-30T11:15:00.000Z',
    },
    {
      id: 'c-snr-006',
      courseCode: 'SNR-006',
      courseName: 'Ship Navigation & Radar Operations',
      category: 'Nautical & Bridge',
      standardFee: 22000,
      activePayableAmount: 18500,
      proposedPayableAmount: null,
      status: 'Active',
      lastUpdated: '2026-08-20T16:45:00.000Z',
    },
  ];

  constructor(private readonly supabaseService: SupabaseService) {}

  getAllPricings(): CoursePricingRecord[] {
    return this.pricings;
  }

  getPricingById(id: string): CoursePricingRecord {
    const item = this.pricings.find((x) => x.id === id);
    if (!item) throw new NotFoundException(`Pricing record with ID ${id} not found.`);
    return item;
  }

  proposePrice(id: string, proposedPayableAmount: number): CoursePricingRecord {
    const item = this.getPricingById(id);
    item.proposedPayableAmount = proposedPayableAmount;
    item.proposedDate = new Date().toISOString();
    item.status = 'Pending Approval';
    item.rejectionReason = undefined;
    item.lastUpdated = new Date().toISOString();
    return item;
  }

  approvePrice(id: string): CoursePricingRecord {
    const item = this.getPricingById(id);
    if (item.proposedPayableAmount != null) {
      item.activePayableAmount = item.proposedPayableAmount;
    }
    item.proposedPayableAmount = null;
    item.proposedDate = null;
    item.status = 'Active';
    item.rejectionReason = undefined;
    item.lastUpdated = new Date().toISOString();
    return item;
  }

  rejectPrice(id: string, reason?: string): CoursePricingRecord {
    const item = this.getPricingById(id);
    item.proposedPayableAmount = null;
    item.proposedDate = null;
    item.status = 'Rejected';
    item.rejectionReason = reason || 'Price change proposal rejected by Master Admin.';
    item.lastUpdated = new Date().toISOString();
    return item;
  }
}
