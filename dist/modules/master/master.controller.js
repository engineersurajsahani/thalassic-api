"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MasterController = void 0;
const common_1 = require("@nestjs/common");
const master_service_1 = require("./master.service");
const auth_guard_1 = require("../auth/auth.guard");
let MasterController = class MasterController {
    masterService;
    constructor(masterService) {
        this.masterService = masterService;
    }
    getDashboard() {
        return this.masterService.getDashboardData();
    }
    getReports(days) {
        return this.masterService.getReportsData(days);
    }
    getCourses() {
        return this.masterService.getCourses();
    }
    createCourse(dto) {
        return this.masterService.createCourse(dto);
    }
    updateCourse(id, dto) {
        return this.masterService.updateCourse(id, dto);
    }
    deleteCourse(id) {
        return this.masterService.deleteCourse(id);
    }
    getUsers(role) {
        return this.masterService.getUsers(role);
    }
    createUser(dto) {
        return this.masterService.createUser(dto);
    }
    getUserProfile(id) {
        return this.masterService.getUserProfile(id);
    }
    updateUserStatus(id, status) {
        return this.masterService.updateUserStatus(id, status);
    }
    getSettings() {
        return this.masterService.getSettings();
    }
    updateSettings(dto) {
        return this.masterService.updateSettings(dto);
    }
    updateProfile(req, dto) {
        const authHeader = req.headers.authorization ?? '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
        const jwt = require('jsonwebtoken');
        const secret = process.env.JWT_SECRET || 'your-secret-key';
        const decoded = jwt.verify(token, secret);
        const adminId = decoded.sub;
        return this.masterService.updateAdminProfile(adminId, dto);
    }
    verifyMasterRole(req) {
        if (!req.user || req.user.role !== 'MASTER') {
            throw new common_1.ForbiddenException('Access denied. Master role required.');
        }
    }
    getPayments(req, query) {
        this.verifyMasterRole(req);
        return this.masterService.getPayments(query);
    }
    getInvoices(req, query) {
        this.verifyMasterRole(req);
        return this.masterService.getInvoices(req.user, query);
    }
    getInvoicePdf(req, id) {
        this.verifyMasterRole(req);
        return this.masterService.getInvoicePdf(id, req.user);
    }
    resendInvoice(req, id) {
        this.verifyMasterRole(req);
        return this.masterService.resendInvoice(id, req.user);
    }
    getCommissions(req) {
        this.verifyMasterRole(req);
        return this.masterService.getCommissionsOverview();
    }
    getSettlements(req) {
        this.verifyMasterRole(req);
        return this.masterService.getSettlements();
    }
    approveSettlement(req, id) {
        this.verifyMasterRole(req);
        const adminId = req.user?.id || 'system';
        const adminName = req.user?.name || 'Master Admin';
        return this.masterService.approveSettlement(id, adminId, adminName);
    }
    paySettlement(req, id) {
        this.verifyMasterRole(req);
        const adminId = req.user?.id || 'system';
        const adminName = req.user?.name || 'Master Admin';
        return this.masterService.paySettlement(id, adminId, adminName);
    }
};
exports.MasterController = MasterController;
__decorate([
    (0, common_1.Get)('dashboard'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MasterController.prototype, "getDashboard", null);
__decorate([
    (0, common_1.Get)('reports'),
    __param(0, (0, common_1.Query)('days')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MasterController.prototype, "getReports", null);
__decorate([
    (0, common_1.Get)('courses'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MasterController.prototype, "getCourses", null);
__decorate([
    (0, common_1.Post)('courses'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MasterController.prototype, "createCourse", null);
__decorate([
    (0, common_1.Patch)('courses/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], MasterController.prototype, "updateCourse", null);
__decorate([
    (0, common_1.Delete)('courses/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MasterController.prototype, "deleteCourse", null);
__decorate([
    (0, common_1.Get)('users'),
    __param(0, (0, common_1.Query)('role')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MasterController.prototype, "getUsers", null);
__decorate([
    (0, common_1.Post)('users'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MasterController.prototype, "createUser", null);
__decorate([
    (0, common_1.Get)('users/:id/profile'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MasterController.prototype, "getUserProfile", null);
__decorate([
    (0, common_1.Patch)('users/:id/status'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], MasterController.prototype, "updateUserStatus", null);
__decorate([
    (0, common_1.Get)('settings'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MasterController.prototype, "getSettings", null);
__decorate([
    (0, common_1.Patch)('settings'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MasterController.prototype, "updateSettings", null);
__decorate([
    (0, common_1.Patch)('profile'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], MasterController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.Get)('finance/payments'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], MasterController.prototype, "getPayments", null);
__decorate([
    (0, common_1.Get)('finance/invoices'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], MasterController.prototype, "getInvoices", null);
__decorate([
    (0, common_1.Get)('finance/invoices/:id/pdf'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MasterController.prototype, "getInvoicePdf", null);
__decorate([
    (0, common_1.Post)('finance/invoices/:id/resend'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MasterController.prototype, "resendInvoice", null);
__decorate([
    (0, common_1.Get)('finance/commissions'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MasterController.prototype, "getCommissions", null);
__decorate([
    (0, common_1.Get)('finance/settlements'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MasterController.prototype, "getSettlements", null);
__decorate([
    (0, common_1.Post)('finance/settlements/:id/approve'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MasterController.prototype, "approveSettlement", null);
__decorate([
    (0, common_1.Post)('finance/settlements/:id/pay'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MasterController.prototype, "paySettlement", null);
exports.MasterController = MasterController = __decorate([
    (0, common_1.Controller)('master'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [master_service_1.MasterService])
], MasterController);
//# sourceMappingURL=master.controller.js.map