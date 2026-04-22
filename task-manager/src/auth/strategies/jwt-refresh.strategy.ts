import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

export interface JwtRefreshPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_REFRESH_SECRET') ?? 'refresh',
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtRefreshPayload) {
    const refreshToken = (req.body as { refreshToken?: string })?.refreshToken;
    return { id: payload.sub, email: payload.email, refreshToken };
  }
}
