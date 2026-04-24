import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

describe('UserController', () => {
  let controller: UserController;
  let service: jest.Mocked<UserService>;

  const self: AuthenticatedUser = { id: 'u1', email: 'me@example.com' };
  const other: AuthenticatedUser = { id: 'u2', email: 'other@example.com' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: {
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UserController>(UserController);
    service = module.get(UserService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('findAll delegates to service', async () => {
    const users = [{ id: 'u1' }];
    service.findAll.mockResolvedValue(users as never);

    await expect(controller.findAll()).resolves.toBe(users);
    expect(service.findAll).toHaveBeenCalled();
  });

  describe('findOne', () => {
    it('returns the user when id matches current', async () => {
      const user = { id: 'u1' };
      service.findOne.mockResolvedValue(user as never);

      await expect(controller.findOne('u1', self)).resolves.toBe(user);
      expect(service.findOne).toHaveBeenCalledWith('u1');
    });

    it('throws ForbiddenException when id differs from current user', () => {
      expect(() => controller.findOne('u1', other)).toThrow(ForbiddenException);
      expect(service.findOne).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates when id matches current', async () => {
      const dto = { firstName: 'Jane' };
      service.update.mockResolvedValue({ id: 'u1', firstName: 'Jane' } as never);

      await controller.update('u1', dto, self);

      expect(service.update).toHaveBeenCalledWith('u1', dto);
    });

    it('throws ForbiddenException when id differs', () => {
      expect(() =>
        controller.update('u1', { firstName: 'X' }, other),
      ).toThrow(ForbiddenException);
      expect(service.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('removes when id matches current', async () => {
      service.remove.mockResolvedValue({ id: 'u1', deleted: true } as never);

      await expect(controller.remove('u1', self)).resolves.toEqual({
        id: 'u1',
        deleted: true,
      });
      expect(service.remove).toHaveBeenCalledWith('u1');
    });

    it('throws ForbiddenException when id differs', () => {
      expect(() => controller.remove('u1', other)).toThrow(ForbiddenException);
      expect(service.remove).not.toHaveBeenCalled();
    });
  });
});
