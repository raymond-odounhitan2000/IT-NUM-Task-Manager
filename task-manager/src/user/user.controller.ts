import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The records have been successfully retrieved.',
  })
  findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The record has been successfully retrieved.',
  })
  findOne(
    @Param('id') id: string,
    @CurrentUser() current: AuthenticatedUser,
  ) {
    this.ensureSelf(id, current);
    return this.userService.findOne(id);
  }

  @HttpCode(HttpStatus.OK)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() current: AuthenticatedUser,
  ) {
    this.ensureSelf(id, current);
    return this.userService.update(id, updateUserDto);
  }

  @HttpCode(HttpStatus.OK)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() current: AuthenticatedUser) {
    this.ensureSelf(id, current);
    return this.userService.remove(id);
  }

  private ensureSelf(id: string, current: AuthenticatedUser) {
    if (id !== current.id) {
      throw new ForbiddenException(
        'You are not allowed to act on another user',
      );
    }
  }
}
