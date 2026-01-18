import os
import time
import asyncio
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI()

# CORS configuration for Figma plugin (null origin) and development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "null",  # Figma plugin origin
        "http://localhost:3000",
        "http://localhost:8000",
        "http://localhost:5000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000",
        "http://127.0.0.1:5000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
GUMLOOP_API_KEY = os.getenv("GUMLOOP_API_KEY")
GUMLOOP_USER_ID = os.getenv("GUMLOOP_USER_ID")
GUMLOOP_BASE_URL = "https://api.gumloop.com/api/v1"
POLLING_INTERVAL = 2  # seconds
TIMEOUT_SECONDS = 60  # seconds

if not GUMLOOP_API_KEY or not GUMLOOP_USER_ID:
    raise ValueError("Missing GUMLOOP_API_KEY or GUMLOOP_USER_ID in environment variables")


class FlowInput(BaseModel):
    """Input data for triggering a Gumloop flow"""
    figma_json: str


class FlowResponse(BaseModel):
    """Response from flow execution"""
    success: bool
    data: dict = None
    error: str = None


async def poll_gumloop_result(run_id: str) -> dict:
    """
    Poll Gumloop's get_pl_run endpoint until the flow completes or times out.
    
    Args:
        run_id: The run ID returned from start_pipeline
        
    Returns:
        The completed flow result
        
    Raises:
        HTTPException: If polling times out or encounters an error
    """
    start_time = time.time()
    attempt = 0
    
    async with httpx.AsyncClient() as client:
        while time.time() - start_time < TIMEOUT_SECONDS:
            attempt += 1
            
            try:
                response = await client.get(
                    f"{GUMLOOP_BASE_URL}/get_pl_run",
                    params={
                        "api_key": GUMLOOP_API_KEY,
                        "user_id": GUMLOOP_USER_ID,
                        "run_id": run_id,
                    },
                    timeout=10.0,
                )
                
                if response.status_code != 200:
                    error_detail = response.text
                    print(f"Polling attempt {attempt}: Gumloop returned {response.status_code}")
                    print(f"Response: {error_detail}")
                    
                    if response.status_code >= 500:
                        # Server error, wait and retry
                        await asyncio.sleep(POLLING_INTERVAL)
                        continue
                    else:
                        # Client error, fail immediately
                        raise HTTPException(
                            status_code=response.status_code,
                            detail=f"Gumloop API error: {error_detail}",
                        )
                
                result = response.json()
                print(f"Polling attempt {attempt}: State = {result.get('state', 'UNKNOWN')}")
                
                # Check if flow is complete
                if result.get("state") == "DONE":
                    print(f"Flow completed successfully!")
                    return result
                elif result.get("state") == "FAILED":
                    error_msg = result.get("error", "Unknown error")
                    raise HTTPException(
                        status_code=400,
                        detail=f"Gumloop flow failed: {error_msg}",
                    )
                
                # Flow still running, wait before next poll
                print(f"Flow still running... waiting {POLLING_INTERVAL}s before next poll")
                await asyncio.sleep(POLLING_INTERVAL)
                
            except httpx.TimeoutException:
                print(f"Polling attempt {attempt}: Request timeout")
                await asyncio.sleep(POLLING_INTERVAL)
                continue
            except Exception as e:
                print(f"Polling attempt {attempt}: Error: {str(e)}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Polling error: {str(e)}",
                )
    
    # Timeout reached
    raise HTTPException(
        status_code=504,
        detail=f"Gumloop flow did not complete within {TIMEOUT_SECONDS} seconds",
    )


@app.post("/run-flow")
async def run_flow(saved_item_id: str, input_data: FlowInput) -> FlowResponse:
    """
    Trigger a Gumloop flow and wait for results.
    
    Args:
        saved_item_id: The Gumloop saved item/pipeline ID
        input_data: The input data containing figma_json
        
    Returns:
        FlowResponse with the completed flow data or error
    """
    try:
        print(f"Starting flow: {saved_item_id}")
        print(f"Input: {input_data.figma_json[:100]}...")  # Log first 100 chars
        
        # Start the pipeline
        async with httpx.AsyncClient() as client:
            start_response = await client.post(
                f"{GUMLOOP_BASE_URL}/start_pipeline",
                params={
                    "api_key": GUMLOOP_API_KEY,
                    "user_id": GUMLOOP_USER_ID,
                    "saved_item_id": saved_item_id,
                },
                json={"figma_json": input_data.figma_json},
                timeout=10.0,
            )
            
            if start_response.status_code != 200:
                error_detail = start_response.text
                print(f"Failed to start pipeline: {start_response.status_code}")
                print(f"Response: {error_detail}")
                raise HTTPException(
                    status_code=start_response.status_code,
                    detail=f"Failed to start Gumloop flow: {error_detail}",
                )
            
            start_data = start_response.json()
            run_id = start_data.get("run_id")
            
            if not run_id:
                raise HTTPException(
                    status_code=400,
                    detail="No run_id returned from Gumloop",
                )
            
            print(f"Pipeline started with run_id: {run_id}")
        
        # Poll for results
        result = await poll_gumloop_result(run_id)
        
        return FlowResponse(
            success=True,
            data=result,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error in run_flow: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error: {str(e)}",
        )


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    
    print("Starting Figma Gumloop Proxy Server...")
    print(f"API Key loaded: {'Yes' if GUMLOOP_API_KEY else 'No'}")
    print(f"User ID: {GUMLOOP_USER_ID}")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)
