import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { User } from '../auth/entities/user.entity';
import { Group } from '../groups/entities/group.entity';
import { Photo } from '../media/entities/photo.entity';
import { AuthModule } from '../auth/auth.module';
import { AuthService } from 'src/auth/auth.service';
import { MediaService } from 'src/media/media.service';
import { S3Service } from 'src/media/s3.service';
import { RabbitMQService } from 'src/rabbitmq/rabbitmq.service';
@Module({
  imports: [TypeOrmModule.forFeature([User, Group, Photo]), AuthModule],
  controllers: [AdminController],
  providers: [
    AdminService,
    AuthService,
    MediaService,
    S3Service,
    RabbitMQService,
  ],
})
export class AdminModule {}
