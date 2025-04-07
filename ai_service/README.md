# AI Image Editing Microservice

A Python microservice that handles AI-powered image editing requests using RabbitMQ for communication.

## Features

- Receives image editing requests via RabbitMQ
- Downloads images from AWS S3
- Processes images using AI services (currently using OpenAI's DALL-E)
- Uploads edited images back to S3
- Sends responses back through RabbitMQ

## Prerequisites

- Python 3.8 or later
- RabbitMQ server
- AWS S3 bucket
- OpenAI API key (for DALL-E)

## Installation

1. Create a virtual environment:

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Create environment file:

```bash
cp .env.example .env
```

4. Update the `.env` file with your configuration:

- AWS credentials and bucket name
- RabbitMQ connection details
- OpenAI API key

## Usage

Start the microservice:

```bash
python main.py
```

The service will:

1. Connect to RabbitMQ
2. Listen for messages on the 'image_edit_request' queue
3. Process images when requests are received
4. Send responses back through the 'image_edit_response' queue

## Message Format

### Request

```json
{
  "s3_key": "path/to/image.jpg",
  "prompt": "Edit the image to make it more vibrant"
}
```

### Response

```json
{
  "success": true,
  "edited_image_key": "edited/path/to/image.jpg"
}
```

## Error Handling

If an error occurs during processing, the service will send an error response:

```json
{
  "success": false,
  "error": "Error message"
}
```

## Development

To modify the AI processing:

1. Update the `process_image` function in `main.py`
2. Implement your preferred AI service
3. Update the response format if needed

## License

This project is licensed under the MIT License - see the LICENSE file for details.
