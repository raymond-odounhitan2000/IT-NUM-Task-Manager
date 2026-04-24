import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Task } from '../../task/entities/task.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true, length: 180 })
  email!: string;

  @Column({ length: 80 })
  firstName!: string;

  @Column({ length: 80, nullable: true })
  lastName?: string | null;

  @Exclude({ toPlainOnly: true })
  @Column()
  password!: string;

  @Exclude({ toPlainOnly: true })
  @Column({ type: 'text', nullable: true })
  hashedRefreshToken?: string | null;

  @OneToMany(() => Task, (task) => task.user)
  tasks!: Task[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
