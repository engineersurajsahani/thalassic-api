"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const dnsModule = require('dns');
const originalLookup = dnsModule.lookup;
dnsModule.lookup = (hostname, options, callback) => {
    let cb = callback;
    let opt = options;
    if (typeof options === 'function') {
        cb = options;
        opt = {};
    }
    if (hostname === 'expzlbadryzwvsxfmads.supabase.co') {
        if (opt && opt.all) {
            return cb(null, [{ address: '104.18.38.10', family: 4 }]);
        }
        return cb(null, '104.18.38.10', 4);
    }
    return originalLookup(hostname, options, callback);
};
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.setGlobalPrefix('api');
    app.enableCors({
        origin: '*',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
    }));
    const port = process.env.PORT || 4000;
    await app.listen(port);
    console.log(`🚀 NestJS Backend running on: http://localhost:${port}/api`);
}
bootstrap();
//# sourceMappingURL=main.js.map