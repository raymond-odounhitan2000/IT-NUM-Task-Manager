import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
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

  async findAll(query: QueryTaskDto, currentUserId: string) {
    const {
      status,
      priority,
      completed,
      dueBefore,
      dueAfter,
      search,
      page,
      limit,
      sortBy,
      sortOrder,
    } = query;

    const qb = this.taskRepository
      .createQueryBuilder('task')
      .where('task.userId = :scopeUserId', { scopeUserId: currentUserId });

    if (status) qb.andWhere('task.status = :status', { status });
    if (priority) qb.andWhere('task.priority = :priority', { priority });
    if (completed !== undefined)
      qb.andWhere('task.completed = :completed', { completed });
    if (dueAfter) qb.andWhere('task.dueDate >= :dueAfter', { dueAfter });
    if (dueBefore) qb.andWhere('task.dueDate <= :dueBefore', { dueBefore });
    if (search) {
      qb.andWhere(
        '(task.title ILIKE :search OR task.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    qb.orderBy(`task.${sortBy}`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findOne(id: string, currentUserId: string) {
    const task = await this.taskRepository.findOne({
      where: { id, userId: currentUserId },
      relations: ['user'],
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto, actorId: string) {
    const task = await this.findOne(id, actorId);
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

  async remove(id: string, currentUserId: string) {
    const task = await this.findOne(id, currentUserId);
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
