import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ required: true, example: 'john.doe@gmail.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ required: true, example: 'John' })
  @IsString()
  firstName!: string;

  @ApiProperty({ required: false, example: 'Doe' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ required: true, example: 'password123' })
  @IsString()
  @MinLength(6)
  password!: string;
}
