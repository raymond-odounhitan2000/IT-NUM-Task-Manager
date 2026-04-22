import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './entities/task.entity';

@Injectable()
export class TaskService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
  ) {}

  create(createTaskDto: CreateTaskDto, actorId: string) {
    this.ensureValidDateRange(createTaskDto.startDate, createTaskDto.dueDate);

    const task = this.taskRepository.create({
      ...createTaskDto,
      createdBy: actorId,
    });

    return this.taskRepository.save(task);
  }

  findAll() {
    return this.taskRepository.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const task = await this.taskRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto, actorId: string) {
    const task = await this.findOne(id);
    const { userId: _ignoredUserId, ...updatePayload } = updateTaskDto;

    this.ensureValidDateRange(
      updatePayload.startDate ?? task.startDate,
      updatePayload.dueDate ?? task.dueDate,
    );

    const updated = this.taskRepository.merge(task, {
      ...updatePayload,
      updatedBy: actorId,
    });

    return this.taskRepository.save(updated);
  }

  async remove(id: string) {
    const task = await this.findOne(id);
    await this.taskRepository.remove(task);
    return { id, deleted: true };
  }

  private ensureValidDateRange(
    startDate: Date | string | undefined,
    dueDate: Date | string | undefined,
  ) {
    if (!startDate || !dueDate) {
      return;
    }

    const start = new Date(startDate);
    const due = new Date(dueDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(due.getTime())) {
      return;
    }

    if (start.getTime() > due.getTime()) {
      throw new BadRequestException(
        'startDate must be less than or equal to dueDate',
      );
    }
  }
}
