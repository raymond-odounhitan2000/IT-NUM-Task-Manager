import { Test, TestingModule } from '@nestjs/testing';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('TaskController', () => {
  let controller: TaskController;
  const taskService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const user: AuthenticatedUser = {
    id: 'user-1',
    email: 'john.doe@example.com',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskController],
      providers: [{ provide: TaskService, useValue: taskService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TaskController>(TaskController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('forwards created tasks with the authenticated user id', () => {
    const dto: CreateTaskDto = {
      title: 'Implement authentication',
      startDate: new Date('2026-04-22T00:00:00.000Z'),
      dueDate: new Date('2026-04-23T00:00:00.000Z'),
    };

    controller.create(dto, user);

    expect(taskService.create).toHaveBeenCalledWith(
      { ...dto, userId: user.id },
      user.id,
    );
  });

  it('forwards the query and current user id to findAll', () => {
    const query: QueryTaskDto = {
      page: 2,
      limit: 10,
      sortBy: 'dueDate',
      sortOrder: 'ASC',
      status: 'in_progress',
    };

    controller.findAll(query, user);

    expect(taskService.findAll).toHaveBeenCalledWith(query, user.id);
  });

  it('forwards the id and current user id to findOne', () => {
    controller.findOne('task-1', user);

    expect(taskService.findOne).toHaveBeenCalledWith('task-1', user.id);
  });

  it('forwards updates with the authenticated user id', () => {
    const dto: UpdateTaskDto = { status: 'in_progress' };

    controller.update('task-1', dto, user);

    expect(taskService.update).toHaveBeenCalledWith('task-1', dto, user.id);
  });

  it('forwards the id and current user id to remove', () => {
    controller.remove('task-1', user);

    expect(taskService.remove).toHaveBeenCalledWith('task-1', user.id);
  });
});
