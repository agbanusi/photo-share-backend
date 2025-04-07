import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import { Photo } from './entities/photo.entity';
import { Group } from '../groups/entities/group.entity';
import { UploadPhotoDto } from './dto/upload-photo.dto';
import { S3Service } from './s3.service';

@Injectable()
export class MediaService {
  constructor(
    @InjectRepository(Photo)
    private photoRepository: Repository<Photo>,
    @InjectRepository(Group)
    private groupRepository: Repository<Group>,
    private s3Service: S3Service,
    private configService: ConfigService,
  ) {}

  async uploadPhoto(
    file: Express.Multer.File,
    uploadPhotoDto: UploadPhotoDto,
    userId: string,
  ): Promise<Photo> {
    // Check if group exists and user is a member
    const group = await this.groupRepository.findOne({
      where: { id: uploadPhotoDto.groupId },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Check if user is a member of the group
    if (!group.memberIds.includes(userId)) {
      throw new ForbiddenException('You are not a member of this group');
    }

    // Check if group is still active and not expired
    const now = new Date();
    if (!group.isActive || now > group.expiryDate) {
      throw new ForbiddenException(
        'This group has expired or is no longer active',
      );
    }

    // Upload to S3
    const { key, url } = await this.s3Service.uploadPhoto(file, group.id);

    // Create photo record
    const photo = this.photoRepository.create({
      filename: key,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      s3Key: key,
      uploaderId: userId,
      groupId: group.id,
    });

    return this.photoRepository.save(photo);
  }

  async editPhotoWithAI(
    editPhotoDto: EditPhotoDto,
    userId: string,
  ): Promise<Photo> {
    // Find the photo
    const photo = await this.photoRepository.findOne({
      where: { id: editPhotoDto.photoId },
    });

    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    // Check if user is a member of the group
    const group = await this.groupRepository.findOne({
      where: { id: photo.groupId },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (!group.memberIds.includes(userId)) {
      throw new ForbiddenException('You are not a member of this group');
    }

    // Check if group is still active and not expired
    const now = new Date();
    if (!group.isActive || now > group.expiryDate) {
      throw new ForbiddenException(
        'This group has expired or is no longer active',
      );
    }

    try {
      // Send edit request to AI service
      const editedImageKey = await this.rabbitMQService.sendImageEditRequest(
        photo.s3Key,
        editPhotoDto.prompt,
        userId,
      );

      // Create new photo record for the edited version
      const editedPhoto = this.photoRepository.create({
        filename: editedImageKey,
        originalName: `edited_${photo.originalName}`,
        mimeType: photo.mimeType,
        size: 0, // Size will be updated when we get the file
        s3Key: editedImageKey,
        uploaderId: userId,
        groupId: group.id,
        isEdited: true,
        originalPhotoId: photo.id,
      });

      return this.photoRepository.save(editedPhoto);
    } catch (error) {
      throw new Error(`Failed to edit photo: ${error.message}`);
    }
  }

  async getGroupPhotos(groupId: string, userId: string): Promise<Photo[]> {
    // Check if group exists and user has access
    const group = await this.groupRepository.findOne({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Check access based on expiry
    const now = new Date();

    // If not expired, check if user is a member
    if (now <= group.expiryDate && !group.memberIds.includes(userId)) {
      throw new ForbiddenException('You are not a member of this group');
    }

    // If expired but within deletion window, only creator can access
    if (
      now > group.expiryDate &&
      now <= group.deletionDate &&
      group.creatorId !== userId
    ) {
      throw new ForbiddenException(
        'Only the creator can access expired groups',
      );
    }

    // If past deletion date, no one can access
    if (now > group.deletionDate) {
      throw new ForbiddenException('This group has been permanently deleted');
    }

    // Get photos
    const photos = await this.photoRepository.find({
      where: { groupId },
    });

    // Generate signed URLs for each photo
    for (const photo of photos) {
      photo['signedUrl'] = await this.s3Service.getSignedUrl(photo.s3Key);
    }

    return photos;
  }

  async getPhotoById(id: string, userId: string): Promise<Photo> {
    const photo = await this.photoRepository.findOne({
      where: { id },
    });

    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    // Check if group exists and user has access
    const group = await this.groupRepository.findOne({
      where: { id: photo.groupId },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Check access based on expiry
    const now = new Date();

    // If not expired, check if user is a member
    if (now <= group.expiryDate && !group.memberIds.includes(userId)) {
      throw new ForbiddenException('You are not a member of this group');
    }

    // If expired but within deletion window, only creator can access
    if (
      now > group.expiryDate &&
      now <= group.deletionDate &&
      group.creatorId !== userId
    ) {
      throw new ForbiddenException(
        'Only the creator can access expired groups',
      );
    }

    // If past deletion date, no one can access
    if (now > group.deletionDate) {
      throw new ForbiddenException('This group has been permanently deleted');
    }

    // Generate signed URL
    photo['signedUrl'] = await this.s3Service.getSignedUrl(photo.s3Key);

    return photo;
  }

  async deletePhoto(id: string, userId: string): Promise<void> {
    const photo = await this.photoRepository.findOne({
      where: { id },
    });

    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    // Only the uploader or group creator can delete a photo
    const group = await this.groupRepository.findOne({
      where: { id: photo.groupId },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (photo.uploaderId !== userId && group.creatorId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this photo',
      );
    }

    // Delete from S3
    await this.s3Service.deletePhoto(photo.s3Key);

    // Delete from database
    await this.photoRepository.remove(photo);
  }

  // This should be called when a group is deleted or expires
  async deleteGroupPhotos(groupId: string): Promise<void> {
    const photos = await this.photoRepository.find({
      where: { groupId },
    });

    for (const photo of photos) {
      await this.s3Service.deletePhoto(photo.s3Key);
    }

    await this.photoRepository.remove(photos);
  }
}
