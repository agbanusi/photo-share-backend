import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Photo } from '../../media/entities/photo.entity';

@Entity('groups')
export class Group {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  shareId: string;

  @Column()
  creatorId: string;

  @Column({ type: 'timestamp' })
  expiryDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  deletionDate: Date;

  @OneToMany(() => Photo, (photo) => photo.group)
  photos: Photo[];

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column('text', { array: true, default: [] })
  memberIds: string[];
}
