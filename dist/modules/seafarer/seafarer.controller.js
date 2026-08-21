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
exports.SeafarerController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const seafarer_service_1 = require("./seafarer.service");
const auth_guard_1 = require("../auth/auth.guard");
let SeafarerController = class SeafarerController {
    seafarerService;
    constructor(seafarerService) {
        this.seafarerService = seafarerService;
    }
    uid(req) {
        const user = req.user;
        if (!user?.id)
            throw new common_1.UnauthorizedException('User not authenticated');
        return user.id;
    }
    getDashboard(req) {
        return this.seafarerService.getDashboard(this.uid(req));
    }
    getNotifications(req) {
        const user = req.user;
        return this.seafarerService.getNotifications(user?.id, user?.role);
    }
    markRead(id) {
        return this.seafarerService.markNotificationRead(id);
    }
    markAllRead() {
        return this.seafarerService.markAllNotificationsRead();
    }
    getAllCourses() {
        return this.seafarerService.getAllCourses();
    }
    getMyEnrollments(req) {
        return this.seafarerService.getMyEnrollments(this.uid(req));
    }
    enrollInCourse(req, courseId, referralCode) {
        return this.seafarerService.enrollInCourse(this.uid(req), courseId, referralCode);
    }
    updateProgress(req, courseId, progress) {
        return this.seafarerService.updateCourseProgress(this.uid(req), courseId, progress);
    }
    getDocuments(req) {
        return this.seafarerService.getDocuments(this.uid(req));
    }
    uploadDocument(req, type, expiryDate, body, file) {
        return this.seafarerService.uploadDocument(this.uid(req), type || body?.type, expiryDate || body?.expiryDate, file, body);
    }
    updateDocument(req, docId, body, file) {
        return this.seafarerService.updateDocument(this.uid(req), docId, body, file);
    }
    downloadDocument(req, docId) {
        const user = req.user;
        return this.seafarerService.downloadDocument(this.uid(req), docId, user?.role);
    }
    deleteDocument(req, docId) {
        return this.seafarerService.deleteDocument(this.uid(req), docId);
    }
    getUserProfile(req) {
        return this.seafarerService.getUserProfile(this.uid(req));
    }
    updateUserProfile(req, details) {
        return this.seafarerService.updateUserProfile(this.uid(req), details);
    }
    addSeaService(req, record) {
        return this.seafarerService.addSeaService(this.uid(req), record);
    }
    deleteSeaService(id) {
        return this.seafarerService.deleteSeaService(id);
    }
    getTickets(req) {
        return this.seafarerService.getTickets(this.uid(req));
    }
    getTicketById(req, id) {
        return this.seafarerService.getTicketById(this.uid(req), id);
    }
    createTicket(req, subject, description) {
        return this.seafarerService.createTicket(this.uid(req), subject, description);
    }
    addReply(req, ticketId, message) {
        return this.seafarerService.addReply(this.uid(req), ticketId, message);
    }
    getReferrals(req) {
        return this.seafarerService.getReferrals(this.uid(req));
    }
};
exports.SeafarerController = SeafarerController;
__decorate([
    (0, common_1.Get)('dashboard'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SeafarerController.prototype, "getDashboard", null);
__decorate([
    (0, common_1.Get)('notifications'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SeafarerController.prototype, "getNotifications", null);
__decorate([
    (0, common_1.Patch)('notifications/:id/read'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SeafarerController.prototype, "markRead", null);
__decorate([
    (0, common_1.Post)('notifications/read-all'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SeafarerController.prototype, "markAllRead", null);
__decorate([
    (0, common_1.Get)('courses'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SeafarerController.prototype, "getAllCourses", null);
__decorate([
    (0, common_1.Get)('courses/my'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SeafarerController.prototype, "getMyEnrollments", null);
__decorate([
    (0, common_1.Post)('courses/:id/enroll'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)('referralCode')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], SeafarerController.prototype, "enrollInCourse", null);
__decorate([
    (0, common_1.Put)('courses/:id/progress'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)('progress')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Number]),
    __metadata("design:returntype", void 0)
], SeafarerController.prototype, "updateProgress", null);
__decorate([
    (0, common_1.Get)('documents'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SeafarerController.prototype, "getDocuments", null);
__decorate([
    (0, common_1.Post)('documents/upload'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)('type')),
    __param(2, (0, common_1.Body)('expiryDate')),
    __param(3, (0, common_1.Body)()),
    __param(4, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object, Object]),
    __metadata("design:returntype", void 0)
], SeafarerController.prototype, "uploadDocument", null);
__decorate([
    (0, common_1.Put)('documents/:id'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object, Object]),
    __metadata("design:returntype", void 0)
], SeafarerController.prototype, "updateDocument", null);
__decorate([
    (0, common_1.Get)('documents/:id/download'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SeafarerController.prototype, "downloadDocument", null);
__decorate([
    (0, common_1.Delete)('documents/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SeafarerController.prototype, "deleteDocument", null);
__decorate([
    (0, common_1.Get)('users/profile'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SeafarerController.prototype, "getUserProfile", null);
__decorate([
    (0, common_1.Put)('users/profile'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], SeafarerController.prototype, "updateUserProfile", null);
__decorate([
    (0, common_1.Post)('users/sea-service'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], SeafarerController.prototype, "addSeaService", null);
__decorate([
    (0, common_1.Delete)('users/sea-service/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SeafarerController.prototype, "deleteSeaService", null);
__decorate([
    (0, common_1.Get)('support'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SeafarerController.prototype, "getTickets", null);
__decorate([
    (0, common_1.Get)('support/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SeafarerController.prototype, "getTicketById", null);
__decorate([
    (0, common_1.Post)('support'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)('subject')),
    __param(2, (0, common_1.Body)('description')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], SeafarerController.prototype, "createTicket", null);
__decorate([
    (0, common_1.Post)('support/:id/reply'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)('message')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], SeafarerController.prototype, "addReply", null);
__decorate([
    (0, common_1.Get)('referrals'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SeafarerController.prototype, "getReferrals", null);
exports.SeafarerController = SeafarerController = __decorate([
    (0, common_1.Controller)(),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [seafarer_service_1.SeafarerService])
], SeafarerController);
//# sourceMappingURL=seafarer.controller.js.map