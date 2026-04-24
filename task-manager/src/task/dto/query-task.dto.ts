import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const toBool = ({ value }: { value: unknown }) => {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

export type TaskSortBy = 'createdAt' | 'dueDate' | 'priority' | 'status';
export type SortOrder = 'ASC' | 'DESC';

export class QueryTaskDto {
  @ApiPropertyOptional({ enum: ['pending', 'in_progress', 'done'] })
  @IsOptional()
  @IsEnum(['pending', 'in_progress', 'done'])
  status?: 'pending' | 'in_progress' | 'done';

  @ApiPropertyOptional({ enum: ['low', 'medium', 'high'] })
  @IsOptional()
  @IsEnum(['low', 'medium', 'high'])
  priority?: 'low' | 'medium' | 'high';

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  completed?: boolean;

  @ApiPropertyOptional({ description: 'Tâches avec dueDate <= ce ISO timestamp' })
  @IsOptional()
  @IsDateString()
  dueBefore?: string;

  @ApiPropertyOptional({ description: 'Tâches avec dueDate >= ce ISO timestamp' })
  @IsOptional()
  @IsDateString()
  dueAfter?: string;

  @ApiPropertyOptional({ description: 'Recherche dans title / description' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({
    default: 'createdAt',
    enum: ['createdAt', 'dueDate', 'priority', 'status'],
  })
  @IsOptional()
  @IsIn(['createdAt', 'dueDate', 'priority', 'status'])
  sortBy: TaskSortBy = 'createdAt';

  @ApiPropertyOptional({ default: 'DESC', enum: ['ASC', 'DESC'] })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsIn(['ASC', 'DESC'])
  sortOrder: SortOrder = 'DESC';
}
