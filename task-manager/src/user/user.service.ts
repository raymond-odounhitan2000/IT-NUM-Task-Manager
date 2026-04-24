import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as argon2 from 'argon2';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const existing = await this.userRepository.findOne({
      where: { email: createUserDto.email },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }
    const hashedPassword = await argon2.hash(createUserDto.password);
    const user = this.userRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });
    return this.userRepository.save(user);
  }

  findAll() {
    return this.userRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  findByEmail(email: string) {
    return this.userRepository.findOne({ where: { email } });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.findOne(id);
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existing = await this.userRepository.findOne({
        where: { email: updateUserDto.email },
      });
      if (existing) {
        throw new ConflictException('Email already in use');
      }
    }
    const payload: Partial<User> = { ...updateUserDto };
    if (updateUserDto.password) {
      payload.password = await argon2.hash(updateUserDto.password);
    }
    const updated = this.userRepository.merge(user, payload);
    return this.userRepository.save(updated);
  }

  async setRefreshToken(id: string, refreshToken: string | null) {
    const hashedRefreshToken = refreshToken
      ? await argon2.hash(refreshToken)
      : null;
    await this.userRepository.update({ id }, { hashedRefreshToken });
  }

  async remove(id: string) {
    const user = await this.findOne(id);
    await this.userRepository.remove(user);
    return { id, deleted: true };
  }
}
