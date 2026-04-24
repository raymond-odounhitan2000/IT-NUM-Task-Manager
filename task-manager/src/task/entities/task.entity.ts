import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('tasks')
@Index('idx_tasks_user_created', ['userId', 'createdAt'])
@Index('idx_tasks_user_status', ['userId', 'status'])
@Index('idx_tasks_user_due', ['userId', 'dueDate'])
@Index('idx_tasks_user_priority', ['userId', 'priority'])
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 150 })
  title!: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ default: false })
  completed!: boolean;

  @Column({
    type: 'enum',
    enum: ['low', 'medium', 'high'],
    default: 'medium',
    nullable: true,
  })
  priority?: 'low' | 'medium' | 'high';

  @Column({ nullable: true })
  startDate!: Date;

  @Column({ nullable: true })
  dueDate!: Date;

  @Column({ nullable: true })
  assignee?: string;

  @Column({ nullable: true })
  userId?: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ nullable: true })
  createdBy?: string;

  @Column({ nullable: true })
  updatedBy?: string;

  @Column({ nullable: true })
  deletedBy?: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'in_progress', 'done'],
    default: 'pending',
  })
  status!: 'pending' | 'in_progress' | 'done';

  @UpdateDateColumn()
  updatedAt!: Date;
}
