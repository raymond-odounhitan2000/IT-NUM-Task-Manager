import { Test, TestingModule } from '@nestjs/testing';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

describe('TaskController', () => {
  let controller: TaskController;
  const taskService = {
    create: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskController],
      providers: [
        {
          provide: TaskService,
          useValue: taskService,
        },
      ],
    }).compile();

    controller = module.get<TaskController>(TaskController);
  });

  it('should forward created tasks with the authenticated user id', () => {
    const user: AuthenticatedUser = {
      id: 'user-1',
      email: 'john.doe@example.com',
    };
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

  it('should forward updates with the authenticated user id', () => {
    const user: AuthenticatedUser = {
      id: 'user-2',
      email: 'john.doe@example.com',
    };
    const dto: UpdateTaskDto = {
      status: 'in_progress',
    };

    controller.update('task-1', dto, user);

    expect(taskService.update).toHaveBeenCalledWith('task-1', dto, user.id);
  });
});
