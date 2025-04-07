// src/media/media.service.ts
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MediaService } from './media.service';

@Injectable()
export class MediaConsumer {
  constructor(private mediaService: MediaService) {}

  @OnEvent('ai.image.edited')
  async handleAIEditResponse(response: {
    success: boolean;
    editedImageKey: string;
    originalPhotoId: string;
    error?: string;
    size?: number;
  }) {
    await this.mediaService.processAIEditResponse({
      success: response.success,
      editedImageKey: response.editedImageKey,
      originalPhotoId: response.originalPhotoId,
      error: response.error,
      size: response.size,
    });
  }
}
