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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const supabase_js_1 = require("@supabase/supabase-js");
let SupabaseService = class SupabaseService {
    configService;
    client;
    constructor(configService) {
        this.configService = configService;
        const supabaseUrl = this.configService.get('SUPABASE_URL') || 'https://placeholder.supabase.co';
        const supabaseKey = this.configService.get('SUPABASE_SERVICE_ROLE_KEY') || 'placeholder-key';
        this.client = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey, {
            auth: {
                persistSession: false,
            },
        });
    }
    getClient() {
        return this.client;
    }
    async onModuleInit() {
        try {
            const supabase = this.client;
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash('password123', 10);
            const now = new Date();
            const { data: existingAgent, error: agentCheckError } = await supabase
                .from('User')
                .select('id')
                .eq('email', 'agent@thalassic.in')
                .maybeSingle();
            let agentId = existingAgent?.id;
            if (!existingAgent && !agentCheckError) {
                console.log("Seeding Agent User...");
                agentId = require('crypto').randomUUID();
                const { error } = await supabase
                    .from('User')
                    .insert([{
                        id: agentId,
                        email: 'agent@thalassic.in',
                        password: hashedPassword,
                        name: 'Agent User',
                        phone: '+91 99999 88888',
                        role: 'agent',
                        updatedAt: now
                    }]);
                if (error) {
                    console.error("Error seeding agent user:", error);
                    agentId = null;
                }
                else {
                    console.log("Agent user successfully seeded: agent@thalassic.in / password123");
                }
            }
            if (agentId) {
                const { error: metaErr } = await supabase
                    .from('agent_metadata')
                    .upsert({
                    user_id: agentId,
                    referral_code: 'REFAGENT123',
                    onboarding_status: 'Active',
                    general_commission: 5.0,
                    updated_at: now
                }, { onConflict: 'user_id' });
                if (metaErr) {
                    console.error("Error upserting agent metadata:", metaErr);
                }
                else {
                    console.log("Agent metadata activated successfully: onboarding_status = Active");
                }
            }
            const { data: existingAdmin, error: adminCheckError } = await supabase
                .from('User')
                .select('id')
                .eq('email', 'admin@thalassic.in')
                .maybeSingle();
            if (!existingAdmin && !adminCheckError) {
                console.log("Seeding Agent Admin User...");
                const adminId = require('crypto').randomUUID();
                const { error } = await supabase
                    .from('User')
                    .insert([{
                        id: adminId,
                        email: 'admin@thalassic.in',
                        password: hashedPassword,
                        name: 'Agent Admin',
                        phone: '+91 88888 77777',
                        role: 'agent-admin',
                        updatedAt: now
                    }]);
                if (error) {
                    console.error("Error seeding agent admin user:", error);
                }
                else {
                    console.log("Agent admin user successfully seeded: admin@thalassic.in / password123");
                }
            }
        }
        catch (e) {
            console.error("Failed to run DB seed check for agents:", e);
        }
    }
};
exports.SupabaseService = SupabaseService;
exports.SupabaseService = SupabaseService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], SupabaseService);
//# sourceMappingURL=supabase.service.js.map