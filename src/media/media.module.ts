import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Photo } from './entities/photo.entity';
import { Group } from '../groups/entities/group.entity';
import { S3Service } from './s3.service';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { GroupsService } from 'src/groups/groups.service';
import { AuthModule } from 'src/auth/auth.module';
@Module({
  imports: [TypeOrmModule.forFeature([Photo, Group]), AuthModule],
  controllers: [MediaController],
  providers: [S3Service, MediaService, RabbitMQService, GroupsService],
  exports: [S3Service, MediaService],
})
export class MediaModule {}
