import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private connection: amqp.Connection;
  private channel: amqp.Channel;
  private readonly requestQueue = 'image_edit_request';
  private readonly responseQueue = 'image_edit_response';

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    try {
      const rabbitmqUrl =
        this.configService.get<string>('RABBITMQ_URL') ||
        'amqp://localhost:5672';
      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();

      // Declare queues
      await this.channel.assertQueue(this.requestQueue, { durable: true });
      await this.channel.assertQueue(this.responseQueue, { durable: true });

      console.log('RabbitMQ connection established');
    } catch (error) {
      console.error('Failed to connect to RabbitMQ:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch (error) {
      console.error('Error closing RabbitMQ connection:', error);
    }
  }

  async sendImageEditRequest(
    s3Key: string,
    prompt: string,
    userId: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const correlationId = Math.random().toString() + Date.now().toString();
      const message = {
        s3_key: s3Key,
        prompt,
        userId,
        correlationId,
      };

      // Set up response listener
      this.channel.consume(
        this.responseQueue,
        (msg) => {
          if (msg) {
            const response = JSON.parse(msg.content.toString());
            if (response.correlationId === correlationId) {
              this.channel.ack(msg);
              if (response.success) {
                resolve(response.editedImageKey);
              } else {
                reject(
                  new Error(response.error || 'Unknown error in image editing'),
                );
              }
            }
          }
        },
        { noAck: false },
      );

      // Send request
      this.channel.sendToQueue(
        this.requestQueue,
        Buffer.from(JSON.stringify(message)),
        {
          correlationId,
          replyTo: this.responseQueue,
          persistent: true,
        },
      );

      // Set timeout for request
      setTimeout(() => {
        reject(new Error('Image edit request timed out'));
      }, 60000); // 60 seconds timeout
    });
  }
}
