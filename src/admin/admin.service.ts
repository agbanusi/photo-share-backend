import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Group } from '../groups/entities/group.entity';
import { User } from '../auth/entities/user.entity';
import { Photo } from '../media/entities/photo.entity';
import { MediaService } from '../media/services/media.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Group)
    private groupRepository: Repository<Group>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Photo)
    private photoRepository: Repository<Photo>,
    private mediaService: MediaService,
  ) {}

  async getAllGroups(userId: string): Promise<Group[]> {
    // Verify the user is an admin
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user || !user.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }

    return this.groupRepository.find();
  }

  async getAllUsers(userId: string): Promise<User[]> {
    // Verify the user is an admin
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user || !user.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }

    return this.userRepository.find();
  }

  async deleteGroup(groupId: string, userId: string): Promise<void> {
    // Verify the user is an admin
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user || !user.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }

    const group = await this.groupRepository.findOne({
      where: { id: groupId },
    });

    if (!group) {
      return;
    }

    // Delete all photos in the group
    await this.mediaService.deleteGroupPhotos(groupId);

    // Delete the group
    await this.groupRepository.remove(group);
  }

  async deleteUser(targetUserId: string, adminUserId: string): Promise<void> {
    // Verify the user is an admin
    const adminUser = await this.userRepository.findOne({
      where: { id: adminUserId },
    });

    if (!adminUser || !adminUser.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }

    // Find user to delete
    const userToDelete = await this.userRepository.findOne({
      where: { id: targetUserId },
    });

    if (!userToDelete) {
      return;
    }

    // Don't allow deleting another admin
    if (userToDelete.isAdmin) {
      throw new ForbiddenException('Cannot delete another admin user');
    }

    // Delete user
    await this.userRepository.remove(userToDelete);
  }

  async getSystemStats(userId: string): Promise<any> {
    // Verify the user is an admin
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user || !user.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }

    const totalUsers = await this.userRepository.count();
    const totalGroups = await this.groupRepository.count();
    const totalPhotos = await this.photoRepository.count();

    const activeGroups = await this.groupRepository.count({
      where: { isActive: true },
    });

    // Calculate storage usage (in bytes)
    const photos = await this.photoRepository.find();
    const totalStorageBytes = photos.reduce(
      (sum, photo) => sum + photo.size,
      0,
    );
    const totalStorageMB = Math.round(totalStorageBytes / (1024 * 1024));

    return {
      totalUsers,
      totalGroups,
      totalPhotos,
      activeGroups,
      totalStorageMB,
    };
  }
}
