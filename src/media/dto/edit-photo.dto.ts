import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class EditPhotoDto {
  @IsNotEmpty()
  @IsUUID()
  photoId: string;

  @IsNotEmpty()
  @IsString()
  prompt: string;
}
