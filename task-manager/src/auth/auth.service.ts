import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { UserService } from '../user/user.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(createUserDto: CreateUserDto) {
    const user = await this.userService.create(createUserDto);
    const tokens = await this.generateTokens(user.id, user.email);
    await this.userService.setRefreshToken(user.id, tokens.refreshToken);
    return {
      user: { id: user.id, email: user.email, firstName: user.firstName },
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.userService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const isPasswordValid = await argon2.verify(user.password, dto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const tokens = await this.generateTokens(user.id, user.email);
    await this.userService.setRefreshToken(user.id, tokens.refreshToken);
    return {
      user: { id: user.id, email: user.email, firstName: user.firstName },
      ...tokens,
    };
  }

  async logout(userId: string) {
    await this.userService.setRefreshToken(userId, null);
    return { success: true };
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.userService.findOne(userId);
    if (!user.hashedRefreshToken) {
      throw new UnauthorizedException('Access denied');
    }
    const isRefreshValid = await argon2.verify(
      user.hashedRefreshToken,
      refreshToken,
    );
    if (!isRefreshValid) {
      throw new UnauthorizedException('Access denied');
    }
    const tokens = await this.generateTokens(user.id, user.email);
    await this.userService.setRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  private async generateTokens(
    userId: string,
    email: string,
  ): Promise<AuthTokens> {
    const payload = { sub: userId, email };
    const accessExpires = (this.configService.get<string>(
      'JWT_ACCESS_EXPIRES_IN',
    ) ?? '15m') as `${number}m` | `${number}h` | `${number}d` | `${number}s`;
    const refreshExpires = (this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
    ) ?? '7d') as `${number}m` | `${number}h` | `${number}d` | `${number}s`;
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessExpires,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpires,
      }),
    ]);
    return { accessToken, refreshToken };
  }
}
