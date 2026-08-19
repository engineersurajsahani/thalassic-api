import { SupabaseService } from '../supabase/supabase.service';
import { InvoicesService } from '../invoices/invoices.service';
import { AgentAdminService } from '../agent-admin/agent-admin.service';
export declare class MasterService {
    private supabaseService;
    private invoicesService;
    private agentAdminService;
    constructor(supabaseService: SupabaseService, invoicesService: InvoicesService, agentAdminService: AgentAdminService);
    private getSupabase;
    getDashboardData(): Promise<{
        seafarersCount: number;
        coursesCount: number;
        totalBookings: number;
        totalRevenue: string;
        ledger: {
            participant: any;
            course: any;
            revenue: any;
            status: any;
        }[] | undefined;
    }>;
    getReportsData(days?: string): Promise<{
        courses: {
            id: any;
            course: any;
            bookings: number;
            revenue: string;
            rating: string;
        }[];
        averageCompletion: string;
        refundRate: string;
    }>;
    getCourses(): Promise<any[]>;
    createCourse(dto: any): Promise<any>;
    updateCourse(id: string, dto: any): Promise<any>;
    deleteCourse(id: string): Promise<{
        success: boolean;
    }>;
    getUsers(role?: string): Promise<any[]>;
    createUser(dto: any): Promise<any>;
    getUserProfile(userId: string): Promise<any>;
    updateUserStatus(id: string, status: string): Promise<{
        id: string;
        status: string;
        documents: any[] | null;
    }>;
    getSettings(): Promise<any>;
    updateSettings(dto: any): Promise<any>;
    updateAdminProfile(adminId: string, dto: any): Promise<{
        id: any;
        name: any;
        email: any;
        role: any;
    } | {
        success: boolean;
    }>;
    getPayments(query?: any): Promise<{
        id: any;
        transactionId: any;
        orderId: any;
        paymentGateway: any;
        paymentMethod: any;
        transactionDate: any;
        paymentStatus: any;
        seafarerName: any;
        registrationType: string;
        referringAgent: any;
        courseName: any;
        courseFee: any;
        discountApplied: any;
        finalAmount: any;
        invoiceNumber: any;
    }[]>;
    getCommissionsOverview(): Promise<{
        summary: {
            pendingCommission: number;
            approvedCommission: number;
            paidCommission: number;
            outstandingCommission: number;
            totalCommissionExpense: number;
        };
        commissions: {
            id: any;
            invoiceNumber: any;
            seafarerName: any;
            courseName: any;
            courseFee: string;
            commissionRate: string;
            commissionAmount: string;
            rawAmount: number;
            commissionSource: any;
            commissionVersion: any;
            remarks: any;
            rejectionReason: any;
            status: any;
            agentId: any;
            agentName: any;
            createdAt: any;
            settledAt: any;
        }[];
    }>;
    approveSettlement(settlementId: string, adminId: string, adminName: string): Promise<{
        id: string;
        status: string;
        success: boolean;
    }>;
    paySettlement(settlementId: string, adminId: string, adminName: string): Promise<{
        id: string;
        status: string;
        success: boolean;
    }>;
    getInvoices(user: any, query: any): Promise<any[]>;
    getInvoicePdf(id: string, user: any): Promise<{
        invoice: any;
        company: {
            name: string;
            address: string;
            email: any;
            phone: any;
            dgsAccreditationId: any;
            gstin: string;
        };
        terms: string[];
    }>;
    resendInvoice(id: string, user: any): Promise<{
        success: boolean;
        message: string;
    }>;
    getSettlements(): Promise<{
        id: any;
        settlementNumber: any;
        agentId: any;
        agentName: any;
        hacInvoiceNumber: any;
        totalAmount: string;
        rawAmount: number;
        status: any;
        createdAt: any;
        paidAt: any;
    }[]>;
}
