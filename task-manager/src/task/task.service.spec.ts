import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { TaskService } from './task.service';
import { Task } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';

type TaskQueryBuilder = jest.Mocked<SelectQueryBuilder<Task>>;

const buildQbMock = (): TaskQueryBuilder => {
  const qb: Partial<jest.Mocked<SelectQueryBuilder<Task>>> = {};
  qb.leftJoinAndSelect = jest.fn().mockReturnValue(qb);
  qb.where = jest.fn().mockReturnValue(qb);
  qb.andWhere = jest.fn().mockReturnValue(qb);
  qb.orderBy = jest.fn().mockReturnValue(qb);
  qb.skip = jest.fn().mockReturnValue(qb);
  qb.take = jest.fn().mockReturnValue(qb);
  qb.getManyAndCount = jest.fn();
  return qb as TaskQueryBuilder;
};

const defaultQuery = (overrides: Partial<QueryTaskDto> = {}): QueryTaskDto => ({
  page: 1,
  limit: 20,
  sortBy: 'createdAt',
  sortOrder: 'DESC',
  ...overrides,
});

describe('TaskService', () => {
  let service: TaskService;
  let repository: jest.Mocked<Repository<Task>>;

  beforeEach(async () => {
    const repoMock: Partial<jest.Mocked<Repository<Task>>> = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      merge: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        { provide: getRepositoryToken(Task), useValue: repoMock },
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);
    repository = module.get(getRepositoryToken(Task));
  });

  describe('create', () => {
    it('sets createdBy and persists the task', async () => {
      const dto: CreateTaskDto = {
        title: 'Implement authentication',
        startDate: new Date('2026-04-22T00:00:00.000Z'),
        dueDate: new Date('2026-04-23T00:00:00.000Z'),
      };
      const persisted = { id: 'task-1', ...dto, createdBy: 'user-1' } as Task;

      repository.create.mockReturnValue(persisted);
      repository.save.mockResolvedValue(persisted);

      await expect(service.create(dto, 'user-1')).resolves.toEqual(persisted);
      expect(repository.create).toHaveBeenCalledWith({
        ...dto,
        createdBy: 'user-1',
      });
    });

    it('rejects a task when startDate is after dueDate', () => {
      const dto: CreateTaskDto = {
        title: 'Broken task',
        startDate: new Date('2026-04-24T00:00:00.000Z'),
        dueDate: new Date('2026-04-23T00:00:00.000Z'),
      };

      expect(() => service.create(dto, 'user-1')).toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('scopes on current user and applies default paging/sort', async () => {
      const qb = buildQbMock();
      qb.getManyAndCount.mockResolvedValue([[{ id: 't1' } as Task], 1]);
      repository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(defaultQuery(), 'user-1');

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('task');
      expect(qb.leftJoinAndSelect).not.toHaveBeenCalled();
      expect(qb.where).toHaveBeenCalledWith('task.userId = :scopeUserId', {
        scopeUserId: 'user-1',
      });
      expect(qb.orderBy).toHaveBeenCalledWith('task.createdAt', 'DESC');
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(20);
      expect(result).toEqual({
        data: [{ id: 't1' }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });
    });

    it('applies all optional filters when provided', async () => {
      const qb = buildQbMock();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      repository.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(
        defaultQuery({
          status: 'in_progress',
          priority: 'high',
          completed: false,
          dueAfter: '2026-04-20',
          dueBefore: '2026-05-01',
          search: 'auth',
        }),
        'user-1',
      );

      expect(qb.andWhere).toHaveBeenCalledWith('task.status = :status', {
        status: 'in_progress',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('task.priority = :priority', {
        priority: 'high',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('task.completed = :completed', {
        completed: false,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('task.dueDate >= :dueAfter', {
        dueAfter: '2026-04-20',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('task.dueDate <= :dueBefore', {
        dueBefore: '2026-05-01',
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        '(task.title ILIKE :search OR task.description ILIKE :search)',
        { search: '%auth%' },
      );
    });

    it('computes pagination offset from page/limit', async () => {
      const qb = buildQbMock();
      qb.getManyAndCount.mockResolvedValue([[], 42]);
      repository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(
        defaultQuery({ page: 3, limit: 10, sortBy: 'dueDate', sortOrder: 'ASC' }),
        'user-1',
      );

      expect(qb.skip).toHaveBeenCalledWith(20);
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(qb.orderBy).toHaveBeenCalledWith('task.dueDate', 'ASC');
      expect(result.meta).toEqual({
        total: 42,
        page: 3,
        limit: 10,
        totalPages: 5,
      });
    });

    it('returns totalPages=1 when there are no results', async () => {
      const qb = buildQbMock();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      repository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(defaultQuery(), 'user-1');

      expect(result.meta.totalPages).toBe(1);
    });
  });

  describe('findOne', () => {
    it('returns the task when owned by the current user', async () => {
      const task = { id: 'task-1' } as Task;
      repository.findOne.mockResolvedValue(task);

      await expect(service.findOne('task-1', 'user-1')).resolves.toBe(task);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 'task-1', userId: 'user-1' },
        relations: ['user'],
      });
    });

    it('throws NotFoundException when task does not exist', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing', 'user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws NotFoundException when task belongs to another user', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('task-1', 'user-intruder'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 'task-1', userId: 'user-intruder' },
        relations: ['user'],
      });
    });
  });

  describe('update', () => {
    const existing = {
      id: 'task-1',
      title: 'Implement authentication',
      startDate: new Date('2026-04-22T00:00:00.000Z'),
      dueDate: new Date('2026-04-25T00:00:00.000Z'),
      status: 'pending',
    } as Task;

    it('sets updatedBy and persists (scoped to owner)', async () => {
      const dto: UpdateTaskDto = {
        dueDate: new Date('2026-04-26T00:00:00.000Z'),
        status: 'in_progress',
      };
      const updated = { ...existing, ...dto, updatedBy: 'user-2' } as Task;

      repository.findOne.mockResolvedValue(existing);
      repository.merge.mockReturnValue(updated);
      repository.save.mockResolvedValue(updated);

      await expect(service.update('task-1', dto, 'user-2')).resolves.toEqual(
        updated,
      );
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 'task-1', userId: 'user-2' },
        relations: ['user'],
      });
      expect(repository.merge).toHaveBeenCalledWith(existing, {
        ...dto,
        updatedBy: 'user-2',
      });
    });

    it('throws NotFoundException when trying to update another user task', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.update('task-1', { status: 'done' }, 'user-intruder'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.merge).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('ignores userId passed in the DTO', async () => {
      const dto = { userId: 'hacker-id' } as UpdateTaskDto;
      repository.findOne.mockResolvedValue(existing);
      repository.merge.mockImplementation((e, p) => ({ ...e, ...p }) as Task);
      repository.save.mockImplementation(async (t) => t as Task);

      await service.update('task-1', dto, 'user-2');

      const mergePayload = repository.merge.mock.calls[0][1] as Record<
        string,
        unknown
      >;
      expect(mergePayload).not.toHaveProperty('userId');
      expect(mergePayload.updatedBy).toBe('user-2');
    });

    it('rejects an update with invalid date range', async () => {
      repository.findOne.mockResolvedValue(existing);

      await expect(
        service.update(
          'task-1',
          { dueDate: new Date('2026-04-21T00:00:00.000Z') },
          'user-2',
        ),
      ).rejects.toThrow('startDate must be less than or equal to dueDate');
      expect(repository.merge).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when task is missing', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.update('missing', { status: 'done' }, 'user-2'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('removes the task when owned by current user', async () => {
      const task = { id: 'task-1' } as Task;
      repository.findOne.mockResolvedValue(task);
      repository.remove.mockResolvedValue(task);

      await expect(service.remove('task-1', 'user-1')).resolves.toEqual({
        id: 'task-1',
        deleted: true,
      });
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 'task-1', userId: 'user-1' },
        relations: ['user'],
      });
      expect(repository.remove).toHaveBeenCalledWith(task);
    });

    it('throws NotFoundException when task is missing', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.remove('missing', 'user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws NotFoundException when task belongs to another user', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.remove('task-1', 'user-intruder'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.remove).not.toHaveBeenCalled();
    });
  });
});
