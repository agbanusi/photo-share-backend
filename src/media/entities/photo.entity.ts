import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  DeleteDateColumn,
} from 'typeorm';
import { Group } from '../../groups/entities/group.entity';

@Entity('photos')
export class Photo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  filename: string;

  @Column()
  originalName: string;

  @Column()
  mimeType: string;

  @Column()
  size: number;

  @Column()
  s3Key: string;

  @Column()
  uploaderId: string;

  @ManyToOne(() => Group, (group) => group.photos)
  group: Group;

  @Column()
  groupId: string;

  @Column({ default: false })
  isEdited: boolean;

  @Column({ nullable: true })
  originalPhotoId: string;

  @ManyToOne(() => Photo, { nullable: true })
  originalPhoto: Photo;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
