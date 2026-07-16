"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcrypt"));
const crypto_1 = require("crypto");
const supabase_service_1 = require("../supabase/supabase.service");
const ROLE_MAP = {
    seafarer: 'SEAFARER',
    'company-admin': 'COMPANY_ADMIN',
    master: 'MASTER',
};
let AuthService = class AuthService {
    supabaseService;
    jwtService;
    configService;
    constructor(supabaseService, jwtService, configService) {
        this.supabaseService = supabaseService;
        this.jwtService = jwtService;
        this.configService = configService;
    }
    async login(loginDto) {
        const { email, password } = loginDto;
        const supabase = this.supabaseService.getClient();
        const { data: user, error } = await supabase
            .from('User')
            .select('id, email, password, name, role, phone')
            .eq('email', email)
            .single();
        if (error || !user) {
            throw new common_1.BadRequestException('Invalid email or password');
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new common_1.BadRequestException('Invalid email or password');
        }
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
        };
        const token = this.jwtService.sign(payload, {
            secret: this.configService.get('JWT_SECRET') || 'your-secret-key',
            expiresIn: '24h',
        });
        return {
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone ?? null,
            },
        };
    }
    async register(registerDto) {
        const { name, email, password, phone, role = 'seafarer' } = registerDto;
        const supabase = this.supabaseService.getClient();
        const dbRole = ROLE_MAP[role] ?? 'SEAFARER';
        const { data: existing } = await supabase
            .from('User')
            .select('id')
            .eq('email', email)
            .single();
        if (existing) {
            throw new common_1.ConflictException('An account with this email already exists');
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const { data: newUser, error } = await supabase
            .from('User')
            .insert({
            id: (0, crypto_1.randomUUID)(),
            name,
            email,
            password: hashedPassword,
            phone: phone ?? null,
            role: dbRole,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        })
            .select('id, email, name, role, phone')
            .single();
        if (error || !newUser) {
            throw new common_1.BadRequestException(error?.message ?? 'Registration failed. Please try again.');
        }
        const payload = { sub: newUser.id, email: newUser.email, role: newUser.role };
        const token = this.jwtService.sign(payload, {
            secret: this.configService.get('JWT_SECRET') || 'your-secret-key',
            expiresIn: '24h',
        });
        return {
            token,
            user: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                phone: newUser.phone,
            },
        };
    }
    async getProfile(token) {
        const jwt = require('jsonwebtoken');
        const secret = this.configService.get('JWT_SECRET') || 'your-secret-key';
        let decoded;
        try {
            decoded = jwt.verify(token, secret);
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid or expired token');
        }
        const supabase = this.supabaseService.getClient();
        const { data: user, error } = await supabase
            .from('User')
            .select('id, email, name, role, phone')
            .eq('id', decoded.sub)
            .single();
        if (error || !user) {
            throw new common_1.UnauthorizedException('User not found');
        }
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone ?? null,
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map