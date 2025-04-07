import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private bucket: string;

  constructor(private configService: ConfigService) {
    this.s3Client = new S3Client({
      region: this.configService.get<string>('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get<string>(
          'AWS_SECRET_ACCESS_KEY',
        ),
      },
    });
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET');
  }

  async uploadPhoto(
    file: Express.Multer.File,
    groupId: string,
  ): Promise<{ key: string; url: string }> {
    const fileId = crypto.randomUUID();
    const key = `groups/${groupId}/${fileId}-${file.originalname}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    await this.s3Client.send(command);
    const url = await this.getSignedUrl(key);

    return { key, url };
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async deletePhoto(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.s3Client.send(command);
  }

  async deleteGroupPhotos(groupId: string): Promise<void> {
    // In a real implementation, you would need to list all objects with the prefix
    // and delete them. This would require additional AWS SDK commands.
    // For simplicity, this method assumes the deletion will be handled elsewhere or
    // implemented based on specific requirements.
  }
}
