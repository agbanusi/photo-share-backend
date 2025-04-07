import os
import json
import pika
import boto3
import io
import base64
from PIL import Image
from dotenv import load_dotenv
import openai

# Load environment variables
load_dotenv()

# AWS S3 configuration
s3_client = boto3.client(
    's3',
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
    region_name=os.getenv('AWS_REGION')
)

# RabbitMQ configuration
RABBITMQ_URL = os.getenv('RABBITMQ_URL')
RABBITMQ_USERNAME = os.getenv('RABBITMQ_USERNAME')
RABBITMQ_PASSWORD = os.getenv('RABBITMQ_PASSWORD')

# OpenAI configuration
openai.api_key = os.getenv('OPENAI_API_KEY')

def process_image(image_data, prompt):
    """
    Process the image using OpenAI API for image editing.
    """
    try:
        # Convert image data to PIL Image
        image = Image.open(io.BytesIO(image_data))
        
        # Save original image temporarily
        original_path = "temp_original.png"
        image.save(original_path, format="PNG")
        
        # Create a transparent mask image of the same size
        mask = Image.new("RGBA", image.size, (0, 0, 0, 0))
        mask_path = "temp_mask.png"
        mask.save(mask_path, format="PNG")

        # Call OpenAI API
        with open(original_path, "rb") as image_file, open(mask_path, "rb") as mask_file:
            response = openai.Image.create_edit(
                image=image_file,
                mask=mask_file,
                prompt=prompt,
                n=1,
                size="1024x1024",
                response_format="b64_json"
            )
            
            # Get image data from response
            edited_image_data_b64 = response["data"][0]["b64_json"]
            edited_image_data = base64.b64decode(edited_image_data_b64)
            
            # Clean up temporary files
            os.remove(original_path)
            os.remove(mask_path)
            
            return edited_image_data
                
    except Exception as e:
        print(f"Error processing image: {str(e)}")
        raise

def upload_to_s3(image_data, key):
    """
    Upload the edited image to S3.
    """
    try:
        s3_client.put_object(
            Bucket=os.getenv('AWS_S3_BUCKET'),
            Key=key,
            Body=image_data,
            ContentType='image/png'
        )
        return True
    except Exception as e:
        print(f"Error uploading to S3: {str(e)}")
        raise

def callback(ch, method, properties, body):
    """
    Process incoming messages from RabbitMQ.
    """
    try:
        # Parse message
        message = json.loads(body)
        correlation_id = properties.correlation_id
        
        # Extract the image key and prompt
        s3_key = message.get('imageKey') or message.get('s3_key')
        prompt = message.get('prompt', '')
        
        if not s3_key or not prompt:
            raise ValueError("Missing required parameters: s3_key and prompt")
        
        # Get image from S3
        response = s3_client.get_object(
            Bucket=os.getenv('AWS_S3_BUCKET'),
            Key=s3_key
        )
        image_data = response['Body'].read()
        
        # Process image with AI
        edited_image_data = process_image(image_data, prompt)
        
        # Upload edited image to S3
        new_key = f"edited/{s3_key}"
        upload_to_s3(edited_image_data, new_key)
        
        # Send response back
        response = {
            'success': True,
            'correlationId': correlation_id,
            'editedImageKey': new_key
        }
        
        ch.basic_publish(
            exchange='',
            routing_key=properties.reply_to,
            properties=pika.BasicProperties(
                correlation_id=correlation_id
            ),
            body=json.dumps(response)
        )
        ch.basic_ack(delivery_tag=method.delivery_tag)
        
    except Exception as e:
        print(f"Error processing message: {str(e)}")
        error_response = {
            'success': False,
            'correlationId': properties.correlation_id,
            'error': str(e)
        }
        ch.basic_publish(
            exchange='',
            routing_key=properties.reply_to,
            properties=pika.BasicProperties(
                correlation_id=properties.correlation_id
            ),
            body=json.dumps(error_response)
        )
        ch.basic_ack(delivery_tag=method.delivery_tag)

def main():
    """
    Main function to start the RabbitMQ consumer.
    """
    try:
        # Connect to RabbitMQ
        credentials = pika.PlainCredentials(RABBITMQ_USERNAME, RABBITMQ_PASSWORD)
        parameters = pika.ConnectionParameters(
            host=RABBITMQ_URL.split('//')[1] if '//' in RABBITMQ_URL else RABBITMQ_URL,
            credentials=credentials
        )
        
        connection = pika.BlockingConnection(parameters)
        channel = connection.channel()
        
        # Declare queues
        request_queue = 'image_edit_request'
        response_queue = 'image_edit_response'
        
        channel.queue_declare(queue=request_queue, durable=True)
        channel.queue_declare(queue=response_queue, durable=True)
        
        # Set prefetch count to process one message at a time
        channel.basic_qos(prefetch_count=1)
        
        # Start consuming
        print("[*] Waiting for messages. To exit press CTRL+C")
        channel.basic_consume(
            queue=request_queue,
            on_message_callback=callback,
            auto_ack=False
        )
        
        channel.start_consuming()
    except KeyboardInterrupt:
        print("[*] Stopping service")
    except Exception as e:
        print(f"[!] Error: {str(e)}")
        
if __name__ == '__main__':
    main() 