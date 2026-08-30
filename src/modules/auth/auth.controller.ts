import { Controller, Post, Get, Body, Req, HttpCode } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Get('profile')
  async profile(@Req() req: Request) {
    const authHeader = req.headers.authorization ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    return this.authService.getProfile(token);
  }

  @Post('logout')
  @HttpCode(200)
  logout() {
    // JWT is stateless — client clears the cookie; nothing to do server-side
    return { message: 'Logged out successfully' };
  }
}

