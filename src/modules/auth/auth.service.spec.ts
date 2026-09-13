import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SupabaseService } from '../supabase/supabase.service';
import { User, UserRole, UserStatus } from '../../entities/user.entity';
import { SeafarerProfile } from '../../entities/seafarer-profile.entity';
import { AgentMetadata } from '../../entities/agent-metadata.entity';
import { ReferralLead } from '../../entities/referral-lead.entity';
import { AuditLog } from '../../entities/audit-log.entity';

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
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  or: jest.fn().mockReturnThis(),
  ilike: jest.fn().mockReturnThis(),
  single: jest.fn(),
  insert: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn(),
  upsert: jest.fn(),
};

// Mock SupabaseService
const mockSupabaseService = {
  getClient: jest.fn().mockReturnValue(mockSupabaseClient),
};

// Mock JwtService
const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest.fn().mockReturnValue({
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

// Mock TypeORM Repository
const mockRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn().mockImplementation((dto) => ({ id: 'new-id', ...dto })),
  save: jest
    .fn()
    .mockImplementation((entity) =>
      Promise.resolve({ id: 'new-id', ...entity }),
    ),
  count: jest.fn().mockResolvedValue(0),
};

describe('AuthService', () => {
  let service: AuthService;
  let userRepoMock: any;

  beforeEach(async () => {
    userRepoMock = { ...mockRepo };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepoMock },
        { provide: getRepositoryToken(SeafarerProfile), useValue: mockRepo },
        { provide: getRepositoryToken(AgentMetadata), useValue: mockRepo },
        { provide: getRepositoryToken(ReferralLead), useValue: mockRepo },
        { provide: getRepositoryToken(AuditLog), useValue: mockRepo },
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
      userRepoMock.findOne.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: UserRole.SEAFARER,
        phone: '+91 123',
        status: 'Active',
      });

      const result = await service.login({
        email: 'test@example.com',
        password: 'password',
      } as LoginDto);

      expect(result).toHaveProperty('token');
      expect(result.user).toHaveProperty('id', '1');
      expect(result.user).toHaveProperty('email', 'test@example.com');
      expect(result.user).toHaveProperty('role', UserRole.SEAFARER);
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

      userRepoMock.findOne.mockResolvedValue({
        id: 'user-deactivated',
        authUserId: 'auth-deactivated-1',
        email: 'deactivated@example.com',
        role: UserRole.SEAFARER,
        status: UserStatus.DEACTIVATED,
      });

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
      userRepoMock.findOne.mockResolvedValue({
        id: 'existing',
        email: 'existing@example.com',
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
      userRepoMock.findOne.mockResolvedValue(null);

      const result = await service.register({
        name: 'New User',
        email: 'new@example.com',
        password: 'password123',
      } as RegisterDto);

      expect(result.user.role).toBe(UserRole.SEAFARER);
      expect(result).toHaveProperty('token');
    });

    it('should normalize email to lowercase', async () => {
      userRepoMock.findOne.mockResolvedValue(null);

      const result = await service.register({
        name: 'Test User',
        email: 'Test@Example.com',
        password: 'password123',
      } as RegisterDto);

      expect(result.user.email).toBe('test@example.com');
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
      userRepoMock.findOne.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        name: 'Test User',
        role: 'SEAFARER',
        phone: '+91 123',
        status: 'Active',
      });

      const result = await service.getProfile('valid-token');

      expect(result).toHaveProperty('id', 'user-id');
      expect(result).toHaveProperty('email', 'test@example.com');
    });
  });
});
