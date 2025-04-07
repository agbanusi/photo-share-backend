import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect } from 'amqplib';
import { EventEmitter2 } from '@nestjs/event-emitter';

interface ImageEditResponse {
  success: boolean;
  editedImageKey: string;
  originalPhotoId: string;
  error?: string;
  correlationId: string;
  size?: number;
}

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private connection: any;
  private channel: any;
  private readonly requestQueue = 'image_edit_request';
  private readonly responseQueue = 'image_edit_response';
  private readonly logger = new Logger(RabbitMQService.name);

  constructor(
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    try {
      const rabbitmqUrl =
        this.configService.get<string>('RABBITMQ_URL') ||
        'amqp://localhost:5672';
      this.connection = await connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();

      // Declare queues
      await this.channel.assertQueue(this.requestQueue, { durable: true });
      await this.channel.assertQueue(this.responseQueue, { durable: true });

      // Start consuming response messages for persistent listeners
      this.startConsumer();

      this.logger.log('RabbitMQ connection established');
    } catch (error) {
      this.logger.error('Failed to connect to RabbitMQ:', error.message);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch (error) {
      this.logger.error('Error closing RabbitMQ connection:', error.message);
    }
  }

  private async startConsumer() {
    this.channel.consume(
      this.responseQueue,
      async (msg) => {
        if (msg) {
          try {
            // Parse the message
            const response: ImageEditResponse = JSON.parse(
              msg.content.toString(),
            );

            this.eventEmitter.emit('ai.image.edited', response);
            // Acknowledge the message
            this.channel.ack(msg);
            this.logger.log(
              `Successfully processed AI edit response for photo ${response.originalPhotoId}`,
            );
          } catch (error) {
            this.logger.error(`Error processing message: ${error.message}`);

            // For non-parseable messages or other fatal errors, don't requeue
            const requeue = error.message.includes('not found') ? false : true;
            this.channel.nack(msg, false, requeue);
          }
        }
      },
      { noAck: false }, // Manual acknowledgment
    );

    this.logger.log('Started RabbitMQ consumer for AI edit responses');
  }

  async sendImageEditRequest(
    s3Key: string,
    prompt: string,
    userId: string,
    photoId: string,
    editPhotoId: string,
  ): Promise<void> {
    const correlationId = Math.random().toString() + Date.now().toString();
    const message = {
      s3Key,
      prompt,
      userId,
      photoId,
      editPhotoId,
      correlationId,
    };

    // Send request
    this.channel.sendToQueue(
      this.requestQueue,
      Buffer.from(JSON.stringify(message)),
      {
        correlationId,
        persistent: true,
      },
    );

    this.logger.log(`Sent AI edit request for photo ${photoId}`);
  }
}
