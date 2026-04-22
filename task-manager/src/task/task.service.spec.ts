import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskService } from './task.service';
import { Task } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

describe('TaskService', () => {
  let service: TaskService;
  let repository: jest.Mocked<Partial<Repository<Task>>>;

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      merge: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        {
          provide: getRepositoryToken(Task),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);
  });

  it('should set createdBy when creating a task', async () => {
    const dto: CreateTaskDto = {
      title: 'Implement authentication',
      startDate: new Date('2026-04-22T00:00:00.000Z'),
      dueDate: new Date('2026-04-23T00:00:00.000Z'),
    };
    const persistedTask = {
      id: 'task-1',
      ...dto,
      createdBy: 'user-1',
    } as Task;

    repository.create?.mockReturnValue(persistedTask);
    repository.save?.mockResolvedValue(persistedTask);

    await expect(service.create(dto, 'user-1')).resolves.toEqual(persistedTask);
    expect(repository.create).toHaveBeenCalledWith({
      ...dto,
      createdBy: 'user-1',
    });
  });

  it('should reject a task when startDate is after dueDate', async () => {
    const dto: CreateTaskDto = {
      title: 'Broken task',
      startDate: new Date('2026-04-24T00:00:00.000Z'),
      dueDate: new Date('2026-04-23T00:00:00.000Z'),
    };

    expect(() => service.create(dto, 'user-1')).toThrow(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('should set updatedBy when updating a task', async () => {
    const nextDueDate = new Date('2026-04-26T00:00:00.000Z');
    const existingTask = {
      id: 'task-1',
      title: 'Implement authentication',
      startDate: new Date('2026-04-22T00:00:00.000Z'),
      dueDate: new Date('2026-04-25T00:00:00.000Z'),
      status: 'pending',
    } as Task;
    const dto: UpdateTaskDto = {
      dueDate: nextDueDate,
      status: 'in_progress',
    };
    const updatedTask = {
      ...existingTask,
      ...dto,
      updatedBy: 'user-2',
    } as Task;

    repository.findOne?.mockResolvedValue(existingTask);
    repository.merge?.mockReturnValue(updatedTask);
    repository.save?.mockResolvedValue(updatedTask);

    await expect(service.update('task-1', dto, 'user-2')).resolves.toEqual(
      updatedTask,
    );
    expect(repository.merge).toHaveBeenCalledWith(existingTask, {
      ...dto,
      updatedBy: 'user-2',
    });
  });

  it('should reject an update when the resulting date range is invalid', async () => {
    const existingTask = {
      id: 'task-1',
      title: 'Implement authentication',
      startDate: new Date('2026-04-22T00:00:00.000Z'),
      dueDate: new Date('2026-04-25T00:00:00.000Z'),
    } as Task;
    const dto: UpdateTaskDto = {
      dueDate: new Date('2026-04-21T00:00:00.000Z'),
    };

    repository.findOne?.mockResolvedValue(existingTask);

    await expect(service.update('task-1', dto, 'user-2')).rejects.toThrow(
      'startDate must be less than or equal to dueDate',
    );
    expect(repository.merge).not.toHaveBeenCalled();
  });
});
