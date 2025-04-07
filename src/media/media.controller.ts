import {
  Controller,
  Get,
  Post,
  Param,
  Delete,
  UseGuards,
  Req,
  UploadedFile,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MediaService } from './media.service';
import { UploadPhotoDto } from './dto/upload-photo.dto';

@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadPhoto(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadPhotoDto: UploadPhotoDto,
    @Req() req,
  ) {
    return this.mediaService.uploadPhoto(file, uploadPhotoDto, req.user.id);
  }

  @Get('group/:groupId')
  getGroupPhotos(@Param('groupId') groupId: string, @Req() req) {
    return this.mediaService.getGroupPhotos(groupId, req.user.id);
  }

  @Get(':id')
  getPhotoById(@Param('id') id: string, @Req() req) {
    return this.mediaService.getPhotoById(id, req.user.id);
  }

  @Delete(':id')
  deletePhoto(@Param('id') id: string, @Req() req) {
    return this.mediaService.deletePhoto(id, req.user.id);
  }
}
