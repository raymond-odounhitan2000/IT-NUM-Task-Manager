import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { UserService } from './user.service';
import { User } from './entities/user.entity';

jest.mock('argon2');

describe('UserService', () => {
  let service: UserService;
  let repository: jest.Mocked<Repository<User>>;

  const mockUser: User = {
    id: 'user-1',
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Doe',
    password: 'hashed-password',
    hashedRefreshToken: null,
    tasks: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    const repoMock: Partial<jest.Mocked<Repository<User>>> = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      merge: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: repoMock },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    repository = module.get(getRepositoryToken(User));

    (argon2.hash as jest.Mock).mockReset();
    (argon2.hash as jest.Mock).mockResolvedValue('hashed-password');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const dto = {
      email: 'john@example.com',
      firstName: 'John',
      lastName: 'Doe',
      password: 'plain-password',
    };

    it('hashes the password and saves the user', async () => {
      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue(mockUser);
      repository.save.mockResolvedValue(mockUser);

      const result = await service.create(dto);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { email: dto.email },
      });
      expect(argon2.hash).toHaveBeenCalledWith('plain-password');
      expect(repository.create).toHaveBeenCalledWith({
        ...dto,
        password: 'hashed-password',
      });
      expect(repository.save).toHaveBeenCalledWith(mockUser);
      expect(result).toBe(mockUser);
    });

    it('throws ConflictException when email already used', async () => {
      repository.findOne.mockResolvedValue(mockUser);

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(argon2.hash).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns users ordered by createdAt DESC', () => {
      const users = [mockUser];
      repository.find.mockResolvedValue(users);

      const result = service.findAll();

      expect(repository.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
      });
      return expect(result).resolves.toBe(users);
    });
  });

  describe('findOne', () => {
    it('returns the user when found', async () => {
      repository.findOne.mockResolvedValue(mockUser);

      const result = await service.findOne('user-1');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(result).toBe(mockUser);
    });

    it('throws NotFoundException when not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findByEmail', () => {
    it('delegates to repository.findOne with email where clause', () => {
      repository.findOne.mockResolvedValue(mockUser);

      service.findByEmail('john@example.com');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { email: 'john@example.com' },
      });
    });
  });

  describe('update', () => {
    it('updates simple fields without re-hashing password', async () => {
      repository.findOne.mockResolvedValue(mockUser);
      repository.merge.mockImplementation(
        (entity, payload) => ({ ...entity, ...payload }) as User,
      );
      repository.save.mockImplementation(async (u) => u as User);

      const result = await service.update('user-1', { firstName: 'Jane' });

      expect(argon2.hash).not.toHaveBeenCalled();
      expect(repository.merge).toHaveBeenCalledWith(mockUser, {
        firstName: 'Jane',
      });
      expect(result.firstName).toBe('Jane');
    });

    it('hashes the password when present in DTO', async () => {
      repository.findOne.mockResolvedValue(mockUser);
      repository.merge.mockImplementation(
        (entity, payload) => ({ ...entity, ...payload }) as User,
      );
      repository.save.mockImplementation(async (u) => u as User);
      (argon2.hash as jest.Mock).mockResolvedValue('new-hashed');

      await service.update('user-1', { password: 'new-plain' });

      expect(argon2.hash).toHaveBeenCalledWith('new-plain');
      expect(repository.merge).toHaveBeenCalledWith(
        mockUser,
        expect.objectContaining({ password: 'new-hashed' }),
      );
    });

    it('throws ConflictException if new email is already taken by another user', async () => {
      repository.findOne
        .mockResolvedValueOnce(mockUser) // findOne(id)
        .mockResolvedValueOnce({ ...mockUser, id: 'other' }); // existing by email

      await expect(
        service.update('user-1', { email: 'taken@example.com' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('allows update when email is unchanged', async () => {
      repository.findOne.mockResolvedValue(mockUser);
      repository.merge.mockImplementation(
        (entity, payload) => ({ ...entity, ...payload }) as User,
      );
      repository.save.mockImplementation(async (u) => u as User);

      await service.update('user-1', { email: mockUser.email });

      expect(repository.findOne).toHaveBeenCalledTimes(1); // pas de lookup supplémentaire
      expect(repository.save).toHaveBeenCalled();
    });

    it('throws NotFoundException when user does not exist', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.update('missing', { firstName: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('setRefreshToken', () => {
    it('hashes the token when provided', async () => {
      (argon2.hash as jest.Mock).mockResolvedValue('hashed-rt');

      await service.setRefreshToken('user-1', 'raw-token');

      expect(argon2.hash).toHaveBeenCalledWith('raw-token');
      expect(repository.update).toHaveBeenCalledWith(
        { id: 'user-1' },
        { hashedRefreshToken: 'hashed-rt' },
      );
    });

    it('clears the token when null', async () => {
      await service.setRefreshToken('user-1', null);

      expect(argon2.hash).not.toHaveBeenCalled();
      expect(repository.update).toHaveBeenCalledWith(
        { id: 'user-1' },
        { hashedRefreshToken: null },
      );
    });
  });

  describe('remove', () => {
    it('removes the user and returns confirmation', async () => {
      repository.findOne.mockResolvedValue(mockUser);
      repository.remove.mockResolvedValue(mockUser);

      const result = await service.remove('user-1');

      expect(repository.remove).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual({ id: 'user-1', deleted: true });
    });

    it('throws NotFoundException when user is missing', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
