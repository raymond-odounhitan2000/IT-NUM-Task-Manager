import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, IsEmail } from 'class-validator';
export class LoginDto {
  @ApiProperty({ required: true, example: 'john.doe@gmail.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ required: true, example: 'password123' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password!: string;
}
