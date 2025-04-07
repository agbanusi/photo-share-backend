import { Module } from '@nestjs/common';
import { MediaService } from 'src/media/media.service';
import { RabbitMQService } from './rabbitmq.service';

@Module({
  imports: [],
  controllers: [],
  providers: [RabbitMQService],
  exports: [RabbitMQService],
})
export class RabbitMQModule {}
