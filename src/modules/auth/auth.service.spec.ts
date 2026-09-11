import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService, ROLES } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SupabaseService } from '../supabase/supabase.service';

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  ilike: jest.fn().mockReturnThis(),
  single: jest.fn(),
  insert: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockImplementation(() => mockSupabaseClient.single()),
  upsert: jest.fn(),
};

// Mock SupabaseService
const mockSupabaseService = {
  getClient: jest.fn().mockReturnValue(mockSupabaseClient),
};

// Mock JwtService
const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest
    .fn()
    .mockReturnValue({
      sub: 'test-id',
      email: 'test@example.com',
      role: 'SEAFARER',
    }),
};

// Mock ConfigService
const mockConfigService = {
  get: jest.fn().mockImplementation((key: string) => {
    if (key === 'JWT_SECRET') return 'test-jwt-secret';
    return null;
  }),
};

describe('AuthService', () => {
  let service: AuthService;
  let supabaseService: SupabaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    supabaseService = module.get<SupabaseService>(SupabaseService);
    mockSupabaseClient.maybeSingle.mockImplementation(() =>
      mockSupabaseClient.single(),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should throw BadRequestException when user not found', async () => {
      mockSupabaseClient.maybeSingle.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      await expect(
        service.login({
          email: 'nonexistent@example.com',
          password: 'password',
        } as LoginDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when password is invalid', async () => {
      mockSupabaseClient.maybeSingle.mockResolvedValue({
        data: {
          id: '1',
          email: 'test@example.com',
          password: '$2a$10$hashedpassword',
          name: 'Test',
          role: 'SEAFARER',
          phone: '123',
        },
        error: null,
      });
      jest.spyOn(require('bcryptjs'), 'compare').mockResolvedValue(false);

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'wrongpassword',
        } as LoginDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return token and user when credentials are valid', async () => {
      mockSupabaseClient.maybeSingle.mockResolvedValue({
        data: {
          id: '1',
          email: 'test@example.com',
          password: '$2a$10$hashedpassword',
          name: 'Test User',
          role: ROLES.SEAFARER,
          phone: '+91 123',
        },
        error: null,
      });
      jest.spyOn(require('bcryptjs'), 'compare').mockResolvedValue(true);

      const result = await service.login({
        email: 'test@example.com',
        password: 'password',
      } as LoginDto);

      expect(result).toHaveProperty('token');
      expect(result.user).toHaveProperty('id', '1');
      expect(result.user).toHaveProperty('email', 'test@example.com');
      expect(result.user).toHaveProperty('role', ROLES.SEAFARER);
    });
  });

  describe('register', () => {
    it('should throw ConflictException when email already exists', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: { id: 'existing' },
        error: null,
      });

      await expect(
        service.register({
          name: 'Test',
          email: 'existing@example.com',
          password: 'password123',
        } as RegisterDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should create user with SEAFARER role by default', async () => {
      mockSupabaseClient.single
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({
          data: {
            id: 'new-id',
            email: 'new@example.com',
            name: 'New User',
            role: ROLES.SEAFARER,
            phone: null,
          },
          error: null,
        });
      mockSupabaseClient.insert.mockReturnThis();
      mockSupabaseClient.select.mockReturnThis();

      const result = await service.register({
        name: 'New User',
        email: 'new@example.com',
        password: 'password123',
      } as RegisterDto);

      expect(result.user.role).toBe(ROLES.SEAFARER);
      expect(result).toHaveProperty('token');
    });

    it('should normalize email to lowercase', async () => {
      mockSupabaseClient.single
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({
          data: {
            id: 'new-id',
            email: 'test@example.com',
            name: 'Test User',
            role: ROLES.SEAFARER,
            phone: null,
          },
          error: null,
        });
      mockSupabaseClient.insert.mockReturnThis();
      mockSupabaseClient.select.mockReturnThis();

      await service.register({
        name: 'Test User',
        email: 'Test@Example.com',
        password: 'password123',
      } as RegisterDto);

      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
        }),
      );
    });
  });

  describe('getProfile', () => {
    it('should throw UnauthorizedException for invalid token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.getProfile('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return user profile from database', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'user-id',
        email: 'test@example.com',
        role: 'SEAFARER',
      });
      mockSupabaseClient.maybeSingle.mockResolvedValue({
        data: {
          id: 'user-id',
          email: 'test@example.com',
          name: 'Test User',
          role: 'SEAFARER',
          phone: '+91 123',
        },
        error: null,
      });

      const result = await service.getProfile('valid-token');

      expect(result).toHaveProperty('id', 'user-id');
      expect(result).toHaveProperty('email', 'test@example.com');
    });
  });
});
