import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class UploadPhotoDto {
  @IsNotEmpty()
  @IsUUID()
  groupId: string;
}
