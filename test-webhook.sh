#!/bin/bash

# Test the Telegram Webhook locally
curl -X POST http://localhost:3001/api/telegram/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 10000,
    "message": {
      "message_id": 1,
      "from": {
        "id": 123456789,
        "is_bot": false,
        "first_name": "TestUser"
      },
      "chat": {
        "id": 123456789,
        "first_name": "TestUser",
        "type": "private"
      },
      "date": 1690000000,
      "text": "Hello bot!"
    }
  }'
