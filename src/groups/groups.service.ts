import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { nanoid } from 'nanoid';
import { Group } from './entities/group.entity';
import { CreateGroupDto } from './dto/create-group.dto';
import { JoinGroupDto } from './dto/join-group.dto';

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group)
    private groupRepository: Repository<Group>,
  ) {}

  async createGroup(
    createGroupDto: CreateGroupDto,
    userId: string,
  ): Promise<Group> {
    // Generate a unique share ID for the group
    const shareId = nanoid(10);

    // Calculate expiry and deletion dates
    const now = new Date();
    const expiryDate = new Date(now);
    expiryDate.setDate(expiryDate.getDate() + 30); // 30 days for expiry

    const deletionDate = new Date(expiryDate);
    deletionDate.setDate(deletionDate.getDate() + 30); // 30 days after expiry for deletion

    const group = this.groupRepository.create({
      ...createGroupDto,
      shareId,
      creatorId: userId,
      expiryDate,
      deletionDate,
      memberIds: [userId], // Creator is automatically a member
    });

    return this.groupRepository.save(group);
  }

  async joinGroup(joinGroupDto: JoinGroupDto, userId: string): Promise<Group> {
    const group = await this.groupRepository.findOne({
      where: { shareId: joinGroupDto.shareId },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Check if group is active and not expired
    if (!group.isActive || new Date() > group.expiryDate) {
      throw new ForbiddenException(
        'This group has expired or is no longer active',
      );
    }

    // Check if user is already a member
    if (!group.memberIds.includes(userId)) {
      group.memberIds.push(userId);
      await this.groupRepository.save(group);
    }

    return group;
  }

  async getGroupById(id: string, userId: string): Promise<Group> {
    const group = await this.groupRepository.findOne({
      where: { id },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Check access based on expiry
    const now = new Date();

    // If group is not expired, any member can access
    if (now <= group.expiryDate && group.memberIds.includes(userId)) {
      return group;
    }

    // If group is expired but within deletion window, only creator can access
    if (
      now > group.expiryDate &&
      now <= group.deletionDate &&
      group.creatorId === userId
    ) {
      return group;
    }

    // Otherwise, access denied
    throw new ForbiddenException('You do not have access to this group');
  }

  async getMyGroups(userId: string): Promise<Group[]> {
    // Find all groups where user is a member
    const groups = await this.groupRepository
      .createQueryBuilder('group')
      .where(':userId = ANY(group.memberIds)', { userId })
      .getMany();

    // Filter based on expiry rules
    const now = new Date();
    return groups.filter((group) => {
      // If not expired, show to all members
      if (now <= group.expiryDate) {
        return true;
      }

      // If expired but within deletion window, only show to creator
      if (
        now > group.expiryDate &&
        now <= group.deletionDate &&
        group.creatorId === userId
      ) {
        return true;
      }

      return false;
    });
  }

  async deleteGroup(id: string, userId: string): Promise<void> {
    const group = await this.groupRepository.findOne({
      where: { id },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Only the creator can delete a group
    if (group.creatorId !== userId) {
      throw new ForbiddenException('Only the creator can delete the group');
    }

    // Mark as inactive rather than deleting
    group.isActive = false;
    await this.groupRepository.save(group);
  }

  // This method should be run by a scheduled job to clean up expired groups
  async deleteExpiredGroups(): Promise<void> {
    const now = new Date();

    const expiredGroups = await this.groupRepository
      .createQueryBuilder('group')
      .where('group.deletionDate < :now', { now })
      .getMany();

    if (expiredGroups.length > 0) {
      await this.groupRepository.remove(expiredGroups);
    }
  }
}
