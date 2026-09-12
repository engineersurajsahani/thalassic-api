import { User } from './user.entity';
import { Institute } from './institute.entity';
import { Course } from './course.entity';
import { CourseInstitute } from './course-institute.entity';
import { SeafarerProfile } from './seafarer-profile.entity';
import { SeaServiceRecord } from './sea-service-record.entity';
import { Document } from './document.entity';
import { Company } from './company.entity';
import { CompanyAdmin } from './company-admin.entity';
import { CompanySeafarer } from './company-seafarer.entity';
import { Partner } from './partner.entity';
import { PartnerAdmin } from './partner-admin.entity';
import { PartnerReferral } from './partner-referral.entity';
import { PartnerCoursePricing } from './partner-course-pricing.entity';
import { PartnerPricingProposal } from './partner-pricing-proposal.entity';
import { Enrollment } from './enrollment.entity';
import { Invoice } from './invoice.entity';
import { InvoiceCounter } from './invoice-counter.entity';
import { Payment } from './payment.entity';
import { PartnerPayable } from './partner-payable.entity';
import { Settlement } from './settlement.entity';
import { SettlementItem } from './settlement-item.entity';
import { SupportTicket } from './support-ticket.entity';
import { SupportTicketReply } from './support-ticket-reply.entity';
import { Notification } from './notification.entity';
import { AuditLog } from './audit-log.entity';
import { PlatformSettings } from './platform-settings.entity';

export * from './user.entity';
export * from './institute.entity';
export * from './course.entity';
export * from './course-institute.entity';
export * from './seafarer-profile.entity';
export * from './sea-service-record.entity';
export * from './document.entity';
export * from './company.entity';
export * from './company-admin.entity';
export * from './company-seafarer.entity';
export * from './partner.entity';
export * from './partner-admin.entity';
export * from './partner-referral.entity';
export * from './partner-course-pricing.entity';
export * from './partner-pricing-proposal.entity';
export * from './enrollment.entity';
export * from './invoice.entity';
export * from './invoice-counter.entity';
export * from './payment.entity';
export * from './partner-payable.entity';
export * from './settlement.entity';
export * from './settlement-item.entity';
export * from './support-ticket.entity';
export * from './support-ticket-reply.entity';
export * from './notification.entity';
export * from './audit-log.entity';
export * from './platform-settings.entity';

export const allEntities = [
  User,
  Institute,
  Course,
  CourseInstitute,
  SeafarerProfile,
  SeaServiceRecord,
  Document,
  Company,
  CompanyAdmin,
  CompanySeafarer,
  Partner,
  PartnerAdmin,
  PartnerReferral,
  PartnerCoursePricing,
  PartnerPricingProposal,
  Enrollment,
  Invoice,
  InvoiceCounter,
  Payment,
  PartnerPayable,
  Settlement,
  SettlementItem,
  SupportTicket,
  SupportTicketReply,
  Notification,
  AuditLog,
  PlatformSettings,
];
