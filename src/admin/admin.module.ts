import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { AdminController } from './controllers/admin.controller';
import { User } from '../auth/entities/user.entity';
import { Group } from '../groups/entities/group.entity';
import { Photo } from '../media/entities/photo.entity';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Group, Photo]),
    AuthModule,
    MediaModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
