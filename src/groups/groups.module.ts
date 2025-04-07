import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { Group } from './entities/group.entity';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';
import { GroupCleanupService } from './group-cleanup.service';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Group]),
    ScheduleModule.forRoot(),
    AuthModule,
    MediaModule,
  ],
  controllers: [GroupsController],
  providers: [GroupsService, GroupCleanupService],
  exports: [TypeOrmModule, GroupsService],
})
export class GroupsModule {}
