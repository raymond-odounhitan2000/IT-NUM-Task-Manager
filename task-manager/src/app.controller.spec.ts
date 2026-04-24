import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService, HealthResponse } from './app.service';

describe('AppController', () => {
  let controller: AppController;
  let service: jest.Mocked<AppService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: { getHealth: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<AppController>(AppController);
    service = module.get(AppService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHealth', () => {
    it('delegates to AppService.getHealth', () => {
      const payload: HealthResponse = { status: 'ok', message: 'API MARCHE' };
      service.getHealth.mockReturnValue(payload);

      expect(controller.getHealth()).toBe(payload);
      expect(service.getHealth).toHaveBeenCalledTimes(1);
    });

    it('returns whatever the service returns (no transformation)', () => {
      const payload: HealthResponse = { status: 'ok', message: 'custom' };
      service.getHealth.mockReturnValue(payload);

      expect(controller.getHealth()).toEqual(payload);
    });
  });
});
