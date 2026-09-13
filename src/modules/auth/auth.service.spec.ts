import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SupabaseService } from '../supabase/supabase.service';

// Mock Supabase client
const mockSupabaseAuth = {
  signInWithPassword: jest.fn().mockResolvedValue({
    data: {
      user: { id: 'auth-user-1', email: 'test@example.com', user_metadata: {} },
      session: { access_token: 'mock-supabase-token' },
    },
    error: null,
  }),
  signUp: jest.fn().mockResolvedValue({
    data: { user: { id: 'auth-user-new' } },
    error: null,
  }),
  getUser: jest.fn().mockResolvedValue({
    data: { user: { id: 'auth-user-1', email: 'test@example.com' } },
    error: null,
  }),
  resetPasswordForEmail: jest.fn().mockResolvedValue({ data: {}, error: null }),
  admin: {
    updateUserById: jest.fn().mockResolvedValue({ data: {}, error: null }),
  },
};

const mockSupabaseClient = {
  auth: mockSupabaseAuth,
  from: jest.fn().mockImplementation((table: string) => {
    return {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockImplementation((payload) => ({
        select: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: payload }),
      })),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: {
          id: '1',
          auth_user_id: 'auth-user-1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'SEAFARER',
          phone: '+91 123',
          status: 'ACTIVE',
        },
      }),
    };
  }),
};

// Mock SupabaseService
const mockSupabaseService = {
  getClient: jest.fn().mockReturnValue(mockSupabaseClient),
};

// Mock JwtService
const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest.fn().mockReturnValue({
    sub: '1',
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

  beforeEach(async () => {
    mockSupabaseClient.from.mockImplementation((table: string) => {
      return {
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockImplementation((payload) => ({
          select: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: payload }),
        })),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            id: '1',
            auth_user_id: 'auth-user-1',
            email: 'test@example.com',
            name: 'Test User',
            role: 'SEAFARER',
            phone: '+91 123',
            status: 'ACTIVE',
          },
        }),
      };
    });

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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should return token and user when user exists', async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValueOnce({
        data: {
          user: { id: 'auth-user-1', email: 'test@example.com' },
          session: { access_token: 'mock-supabase-token' },
        },
        error: null,
      });

      const result = await service.login({
        email: 'test@example.com',
        password: 'password',
      } as LoginDto);

      expect(result).toHaveProperty('token');
      expect(result.user).toHaveProperty('id', '1');
      expect(result.user).toHaveProperty('email', 'test@example.com');
      expect(result.user).toHaveProperty('role', 'SEAFARER');
    });

    it('should throw UnauthorizedException when Supabase Auth rejects credentials', async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValueOnce({
        data: null,
        error: { message: 'Invalid login credentials' },
      });

      await expect(
        service.login({
          email: 'master@gmail.com',
          password: 'WrongPassword123',
        } as LoginDto),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException when email or password is empty', async () => {
      await expect(
        service.login({
          email: '',
          password: 'password',
        } as LoginDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException when user is deactivated', async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValueOnce({
        data: {
          user: { id: 'auth-deactivated-1', email: 'deactivated@example.com' },
          session: { access_token: 'mock-token' },
        },
        error: null,
      });

      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            id: 'user-deactivated',
            auth_user_id: 'auth-deactivated-1',
            email: 'deactivated@example.com',
            role: 'SEAFARER',
            status: 'DEACTIVATED',
          },
        }),
      } as any);

      await expect(
        service.login({
          email: 'deactivated@example.com',
          password: 'password',
        } as LoginDto),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('register', () => {
    it('should throw ConflictException when email already exists', async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { id: 'existing', email: 'existing@example.com' },
        }),
      } as any);

      await expect(
        service.register({
          name: 'Test',
          email: 'existing@example.com',
          password: 'password123',
        } as RegisterDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should create user with SEAFARER role by default', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnThis(),
            ilike: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: null }),
            insert: jest.fn().mockImplementation((payload) => ({
              select: jest.fn().mockReturnThis(),
              maybeSingle: jest.fn().mockResolvedValue({ data: payload }),
            })),
          };
        }
        return {
          insert: jest.fn().mockResolvedValue({ data: {} }),
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null }),
        };
      });

      const result = await service.register({
        name: 'New User',
        email: 'new@example.com',
        password: 'password123',
      } as RegisterDto);

      expect(result.user.role).toBe('SEAFARER');
      expect(result).toHaveProperty('token');
    });
  });

  describe('getProfile', () => {
    it('should throw UnauthorizedException for invalid token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      mockSupabaseAuth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Invalid token' },
      });

      await expect(service.getProfile('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return user profile from database', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: '1',
        email: 'test@example.com',
        role: 'SEAFARER',
      });

      const result = await service.getProfile('valid-token');

      expect(result).toHaveProperty('id', '1');
      expect(result).toHaveProperty('email', 'test@example.com');
    });
  });
});
