import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateTaskDto {
  @ApiProperty({ required: true, example: 'Implement authentication' })
  @IsString()
  @MaxLength(150)
  title!: string;

  @ApiProperty({
    required: false,
    example: 'Implement user authentication with JWT',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, example: false })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  @ApiProperty({
    required: false,
    example: 'medium',
    enum: ['low', 'medium', 'high'],
  })
  @IsOptional()
  @IsEnum(['low', 'medium', 'high'])
  priority?: 'low' | 'medium' | 'high';

  @ApiProperty({ required: true, example: '2023-01-01T00:00:00.000Z' })
  @IsDateString()
  startDate!: Date;

  @ApiProperty({ required: true, example: '2023-01-01T00:00:00.000Z' })
  @IsDateString()
  dueDate!: Date;

  @ApiProperty({ required: false, example: 'john.doe@example.com' })
  @IsOptional()
  @IsString()
  assignee?: string;

  @ApiProperty({
    required: false,
    example: 'pending',
    enum: ['pending', 'in_progress', 'done'],
  })
  @IsOptional()
  @IsEnum(['pending', 'in_progress', 'done'])
  status?: 'pending' | 'in_progress' | 'done';

  @ApiProperty({ required: false, example: 'user-123' })
  @IsOptional()
  @IsUUID()
  userId?: string;
}
