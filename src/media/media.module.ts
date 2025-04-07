import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Photo } from './entities/photo.entity';
import { Group } from '../groups/entities/group.entity';
import { S3Service } from './s3.service';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { AuthModule } from '../auth/auth.module';
import { GroupsModule } from '../groups/groups.module';

@Module({
  imports: [TypeOrmModule.forFeature([Photo, Group]), AuthModule, GroupsModule],
  controllers: [MediaController],
  providers: [S3Service, MediaService],
  exports: [TypeOrmModule, S3Service, MediaService],
})
export class MediaModule {}
