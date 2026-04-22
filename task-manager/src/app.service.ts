import { Injectable } from '@nestjs/common';

export interface HealthResponse {
  status: 'ok';
  message: string;
}

@Injectable()
export class AppService {
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      message: 'API MARCHE',
    };
  }
}
