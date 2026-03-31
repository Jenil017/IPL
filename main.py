import asyncio
import httpx
import os
import logging
from fastapi import FastAPI, Request, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
import time

from database import init_db
from seed import seed_users

# Import routers
from routers import (
    auth_router,
    prediction_router,
    upload_router,
    result_router,
    admin_router,
    chat_router,
)

# Configure logging
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="IPL Match Prediction App", version="1.0.0")

# --- Render Keep-Alive Logic ---
# Since Render spins down free apps after 15 mins of inactivity,
# we add a background loop that pings our own endpoint every 14 mins.
# Note: For this to work efficiently on Render, it needs at least ONE
# check-in before the initial spin-down.

async def keep_alive_loop():
    """Background loop to ping ourselves every 14 minutes."""
    # We wait a bit first to let the server fully start
    await asyncio.sleep(60)
    
    # Ideally, you'd put your Render URL here once you deploy it.
    # For now, we'll try to find the host Dynamically if possible,
    # or just use a placeholder to update later.
    self_url = os.getenv("RENDER_EXTERNAL_URL", "http://localhost:8000")
    ping_url = f"{self_url}/api/ping"
    
    async with httpx.AsyncClient() as client:
        while True:
            try:
                logging.info(f"Self-pinging to keep alive: {ping_url}")
                await client.get(ping_url)
            except Exception as e:
                logging.error(f"Keep-alive ping failed: {e}")
            
            # Sleep for 14 minutes (840 seconds)
            await asyncio.sleep(840)

@app.get("/api/ping")
async def ping():
    """Endpoint for keep-alive pings."""
    return {"status": "alive", "time": time.time()}

@app.middleware("http")
async def log_requests(request: Request, call_next):
    try:
        response = await call_next(request)
        return response
    except Exception as e:
        logging.error(f"Request error: {request.method} {request.url} - {e}")
        raise


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    init_db()
    seed_users()
    # Start the keep-alive loop as a background task
    asyncio.create_task(keep_alive_loop())


app.include_router(auth_router.router)
app.include_router(prediction_router.router)
app.include_router(upload_router.router)
app.include_router(result_router.router)
app.include_router(admin_router.router)
app.include_router(chat_router.router)

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
def read_root():
    return RedirectResponse(url="/static/index.html")
