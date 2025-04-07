import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { Group } from './entities/group.entity';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';
import { GroupCleanupService } from './group-cleanup.service';
import { AuthModule } from '../auth/auth.module';
import { MediaService } from 'src/media/media.service';
import { Photo } from 'src/media/entities/photo.entity';
import { S3Service } from 'src/media/s3.service';
import { RabbitMQService } from 'src/rabbitmq/rabbitmq.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Photo, Group]),
    ScheduleModule.forRoot(),
    AuthModule,
  ],
  controllers: [GroupsController],
  providers: [
    GroupsService,
    GroupCleanupService,
    MediaService,
    S3Service,
    RabbitMQService,
  ],
  exports: [GroupsService],
})
export class GroupsModule {}
