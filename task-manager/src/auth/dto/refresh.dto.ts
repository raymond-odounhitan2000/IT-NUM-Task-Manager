import { ApiProperty } from '@nestjs/swagger';

export class RefreshDto {
  @ApiProperty({ required: true, example: 'eyJhbGciOiJIUzI1NiIs...' })
  refreshToken!: string;
}
