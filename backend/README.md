# Figma Gumloop Proxy Backend

Backend server for the Figma AI Design Predictor plugin.

## Setup

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Create `.env` file:**
   ```bash
   cp .env.example .env
   ```

3. **Add your Gumloop credentials to `.env`:**
   ```
   GUMLOOP_API_KEY=your_api_key
   GUMLOOP_USER_ID=your_user_id
   ```

4. **Run the server:**
   ```bash
   python main.py
   ```

Server will start at `http://localhost:8000`

## API Endpoints

### POST /run-flow
Trigger a Gumloop flow and wait for results.

**Query Parameters:**
- `saved_item_id` (required): Your Gumloop pipeline/saved item ID

**Request Body:**
```json
{
  "figma_json": "[{\"name\":\"Rectangle 1\",\"type\":\"RECTANGLE\",\"x\":100,\"y\":200,\"w\":300,\"h\":400}]"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "run_id": "...",
    "state": "DONE",
    "output": { ... }
  },
  "error": null
}
```

### GET /health
Health check endpoint.

## Features

- ✅ Asynchronous polling with 2-second intervals
- ✅ 60-second timeout protection
- ✅ CORS support for Figma plugins
- ✅ Secure API key handling via environment variables
- ✅ Comprehensive error handling
- ✅ Request logging
- ✅ Detailed error messages

## Security

- API keys are never exposed to the Figma plugin
- Only accepts requests from configured origins
- Handles errors gracefully without leaking sensitive info
- Uses httpx for secure async HTTP requests
