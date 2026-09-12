import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';
import { AuthService } from '../auth/auth.service';

describe('account roles', () => {
  describe('UsersService.getAvailableRoles', () => {
    const prisma = {
      user: { findUnique: jest.fn() },
      driverProfile: { create: jest.fn() },
    } as any;
    let service: UsersService;

    beforeEach(() => {
      jest.clearAllMocks();
      service = new UsersService(prisma);
    });

    it('offers every role the account already has a profile for', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: UserRole.PASSENGER,
        isDeleted: false,
        passenger: { id: 'p-1' },
        driver: { id: 'd-1' },
        merchant: null,
      });

      await expect(service.getAvailableRoles('user-1')).resolves.toEqual([
        UserRole.PASSENGER,
        UserRole.DRIVER,
      ]);
    });

    it('offers only the passenger role to an account with just that profile', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: UserRole.PASSENGER,
        isDeleted: false,
        passenger: { id: 'p-1' },
        driver: null,
        merchant: null,
      });

      await expect(service.getAvailableRoles('user-1')).resolves.toEqual([UserRole.PASSENGER]);
    });

    it('keeps an admin out of the village roles', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        role: UserRole.ADMIN,
        isDeleted: false,
        passenger: null,
        driver: null,
        merchant: null,
      });

      await expect(service.getAvailableRoles('admin-1')).resolves.toEqual([UserRole.ADMIN]);
    });

    it('offers nothing to a deleted account', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: UserRole.PASSENGER,
        isDeleted: true,
        passenger: { id: 'p-1' },
        driver: null,
        merchant: null,
      });

      await expect(service.getAvailableRoles('user-1')).resolves.toEqual([]);
    });
  });

  describe('UsersService.addDriverProfile', () => {
    const prisma = {
      user: { findUnique: jest.fn() },
      driverProfile: { create: jest.fn() },
    } as any;
    let service: UsersService;

    beforeEach(() => {
      jest.clearAllMocks();
      service = new UsersService(prisma);
    });

    it('keeps the passenger profile and adds a driver one beside it', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: UserRole.PASSENGER,
        isDeleted: false,
        driver: null,
        passenger: { fullName: 'Асхат' },
        merchant: null,
      });
      prisma.driverProfile.create.mockResolvedValue({ id: 'd-1' });

      await service.addDriverProfile('user-1');

      expect(prisma.driverProfile.create).toHaveBeenCalledTimes(1);
      const created = prisma.driverProfile.create.mock.calls[0][0].data;
      expect(created.userId).toBe('user-1');
      // The name they already gave us, so nobody types it twice.
      expect(created.fullName).toBe('Асхат');
    });

    it('does not create a second driver profile', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: UserRole.DRIVER,
        isDeleted: false,
        driver: { id: 'existing' },
        passenger: null,
        merchant: null,
      });

      await expect(service.addDriverProfile('user-1')).resolves.toEqual({ id: 'existing' });
      expect(prisma.driverProfile.create).not.toHaveBeenCalled();
    });
  });

  describe('AuthService.switchRole', () => {
    const usersService = {
      getAvailableRoles: jest.fn(),
      setActiveRole: jest.fn(),
      updateRefreshTokenHash: jest.fn(),
    } as any;
    const jwtService = { sign: jest.fn(() => 'token') } as any;
    const configService = { get: jest.fn(() => undefined) } as any;
    let service: AuthService;

    beforeEach(() => {
      jest.clearAllMocks();
      jwtService.sign.mockReturnValue('token');
      service = new AuthService(usersService, jwtService, {} as any, configService, {} as any);
    });

    it('refuses a role the account has no profile for', async () => {
      usersService.getAvailableRoles.mockResolvedValue([UserRole.PASSENGER]);

      await expect(service.switchRole('user-1', UserRole.DRIVER)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(usersService.setActiveRole).not.toHaveBeenCalled();
    });

    it('switches the active role and issues tokens carrying it', async () => {
      usersService.getAvailableRoles.mockResolvedValue([UserRole.PASSENGER, UserRole.DRIVER]);

      const result = await service.switchRole('user-1', UserRole.DRIVER);

      expect(usersService.setActiveRole).toHaveBeenCalledWith('user-1', UserRole.DRIVER);
      expect(result.role).toBe(UserRole.DRIVER);
      expect(result.accessToken).toBe('token');
      // Guards read the role out of the token, so it has to be signed into it.
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'user-1', role: UserRole.DRIVER, tokenType: 'access' }),
        expect.anything(),
      );
    });
  });
});
