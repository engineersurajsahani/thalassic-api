"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const validation_pipe_1 = require("./common/pipes/validation.pipe");
const all_exception_filter_1 = require("./common/filters/all-exception.filter");
const prisma_filter_1 = require("./common/filters/prisma.filter");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("./common/guards/auth.guard");
const roles_guard_1 = require("./common/guards/roles.guard");
const jwt_1 = require("@nestjs/jwt");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.setGlobalPrefix('api');
    app.enableCors({
        origin: true,
        credentials: true,
    });
    app.useGlobalPipes(new validation_pipe_1.ValidationPipe());
    app.useGlobalFilters(new all_exception_filter_1.AllExceptionsFilter(), new prisma_filter_1.PrismaClientExceptionFilter(app.getHttpAdapter()));
    const jwtService = app.get(jwt_1.JwtService);
    const reflector = app.get(core_1.Reflector);
    app.useGlobalGuards(new auth_guard_1.AuthGuard(jwtService, reflector), new roles_guard_1.RolesGuard(reflector));
    const config = new swagger_1.DocumentBuilder()
        .setTitle('Hari Om Thalassic API')
        .setDescription('The API documentation for Hari Om Thalassic platform')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('api/docs', app, document);
    const port = process.env.PORT || 5050;
    await app.listen(port);
    console.log(`Application is running on: http://localhost:${port}/api`);
    console.log(`Swagger documentation: http://localhost:${port}/api/docs`);
}
bootstrap();
//# sourceMappingURL=main.js.map