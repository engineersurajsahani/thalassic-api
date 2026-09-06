import pino from 'pino';
import { ConfigService } from '@nestjs/config';

let loggerInstance: pino.Logger | null = null;

export const getLogger = (configService?: ConfigService): pino.Logger => {
  if (loggerInstance) return loggerInstance;

  const env = configService?.get<string>('NODE_ENV') || 'development';

  loggerInstance = pino({
    level: env === 'production' ? 'info' : 'debug',
    ...(env === 'production'
      ? {}
      : {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          },
        }),
    base: {
      env,
    },
    formatters: {
      level: (label) => ({ level: label }),
    },
  });

  return loggerInstance;
};

export const createLogger = (context: string, configService?: ConfigService) => {
  const logger = getLogger(configService);
  return logger.child({ context });
};
