import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import { Photo } from './entities/photo.entity';
import { Group } from '../groups/entities/group.entity';
import { UploadPhotoDto } from './dto/upload-photo.dto';
import { EditPhotoDto } from './dto/edit-photo.dto';
import { S3Service } from './s3.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';

@Injectable()
export class MediaService {
  // Define allowed image types and extensions
  private readonly ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
  ];

  private readonly ALLOWED_EXTENSIONS = [
    'jpg',
    'jpeg',
    'png',
    'gif',
    'webp',
    'heic',
    'heif',
  ];

  constructor(
    @InjectRepository(Photo)
    private photoRepository: Repository<Photo>,
    @InjectRepository(Group)
    private groupRepository: Repository<Group>,
    private s3Service: S3Service,
    private rabbitMQService: RabbitMQService,
  ) {}

  /**
   * Validates if the file is an acceptable image
   */
  private validateImageFile(file: Express.Multer.File): boolean {
    // Check MIME type
    if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return false;
    }

    // Check file extension
    const filenameParts = file.originalname.split('.');
    const extension = filenameParts[filenameParts.length - 1].toLowerCase();
    if (!this.ALLOWED_EXTENSIONS.includes(extension)) {
      return false;
    }

    return true;
  }

  async uploadPhoto(
    files: Express.Multer.File[],
    uploadPhotoDto: UploadPhotoDto,
    userId: string,
  ): Promise<Photo[]> {
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

    // Validate files - ensure they are images with allowed extensions
    const invalidFiles = files.filter((file) => !this.validateImageFile(file));
    if (invalidFiles.length > 0) {
      const invalidFilenames = invalidFiles
        .map((f) => f.originalname)
        .join(', ');
      throw new BadRequestException(
        `Invalid file type(s). Only ${this.ALLOWED_EXTENSIONS.join(', ')} image formats are allowed. Invalid files: ${invalidFilenames}`,
      );
    }

    // Upload all files to S3 and create records
    const uploadPromises = files.map(async (file) => {
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
    });

    return Promise.all(uploadPromises);
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
      // Generate a temporary image key for the edited version
      // This will be updated by the consumer when the AI service completes
      const tempEditedImageKey = `temp_edited_${photo.s3Key}`;

      // Create new photo record for the edited version
      const editedPhoto = new Photo();
      editedPhoto.filename = tempEditedImageKey;
      editedPhoto.originalName = `edited_${photo.originalName}`;
      editedPhoto.mimeType = photo.mimeType;
      editedPhoto.size = 0; // Size will be updated when we get the file
      editedPhoto.s3Key = tempEditedImageKey;
      editedPhoto.uploaderId = userId;
      editedPhoto.groupId = group.id;
      editedPhoto.isEdited = true;
      editedPhoto.originalPhotoId = photo.id;

      // Save the edited photo record first
      const savedEditedPhoto = await this.photoRepository.save(editedPhoto);

      // Now send the edit request to the AI service
      // The RabbitMQ consumer will update this record when processing is complete
      await this.rabbitMQService.sendImageEditRequest(
        photo.s3Key,
        editPhotoDto.prompt,
        userId,
        photo.id,
        savedEditedPhoto.id,
      );

      return savedEditedPhoto;
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

  /**
   * Process AI edit response from the queue
   * This is called by the RabbitMQ service when a response is received
   */
  async processAIEditResponse(response: {
    success: boolean;
    editedImageKey: string;
    originalPhotoId: string;
    error?: string;
    size?: number;
  }): Promise<void> {
    if (!response.success) {
      throw new Error(`AI processing failed: ${response.error}`);
    }

    try {
      // Find the original photo
      const originalPhoto = await this.photoRepository.findOne({
        where: { id: response.originalPhotoId },
      });

      if (!originalPhoto) {
        throw new Error(
          `Original photo not found: ${response.originalPhotoId}`,
        );
      }

      // Find the edited photo that was created during the initial request
      const editedPhoto = await this.photoRepository.findOne({
        where: {
          originalPhotoId: response.originalPhotoId,
          isEdited: true,
        },
      });

      if (!editedPhoto) {
        throw new Error(
          `Edited photo not found for original: ${response.originalPhotoId}`,
        );
      }

      // Update the edited photo with the actual data
      editedPhoto.s3Key = response.editedImageKey;
      editedPhoto.filename =
        response.editedImageKey.split('/').pop() || editedPhoto.filename;
      editedPhoto.size = response.size || 0;

      await this.photoRepository.save(editedPhoto);

      // Soft delete the original photo
      await this.photoRepository.softDelete(originalPhoto.id);
    } catch (error) {
      throw new Error(`Failed to process AI response: ${error.message}`);
    }
  }
}
