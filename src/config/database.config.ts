import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

// Export a factory function instead of direct config object
export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  return {
    type: 'postgres',
    host: configService.get<string>('MAIN_DB_HOST', '127.0.0.1'),
    port: configService.get<number>('MAIN_DB_PORT', 5432),
    username: configService.get<string>('MAIN_DB_USERNAME', 'postgres'),
    password: configService.get<string>('MAIN_DB_PASSWORD', 'password'),
    database: configService.get<string>('MAIN_DB_NAME', 'photo_share'),
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: configService.get<string>('NODE_ENV') !== 'production',
    logging: false, //configService.get<string>('NODE_ENV') !== 'production',
  };
};
