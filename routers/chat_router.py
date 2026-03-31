import os
import uuid
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import (
    APIRouter,
    Depends,
    WebSocket,
    WebSocketDisconnect,
    UploadFile,
    File,
    HTTPException,
    status
)
from sqlmodel import Session, select, desc

from database import engine, get_session
from models import User, ChatMessage
from auth import get_current_user, SECRET_KEY, ALGORITHM
from jose import jwt, JWTError
from websocket_manager import manager

router = APIRouter(prefix="/api/chat", tags=["chat"])

UPLOAD_DIR = "static/uploads/chat"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.get("/history", response_model=List[ChatMessage])
async def get_chat_history(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Fetch the last 50 chat messages from the database."""
    statement = select(ChatMessage).order_by(desc(ChatMessage.timestamp)).limit(50)
    results = session.exec(statement).all()
    return list(reversed(results))


@router.post("/upload")
async def upload_chat_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Upload an image specifically for chat."""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)

    return {"url": f"/static/uploads/chat/{unique_filename}"}


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time chat."""
    await manager.connect(websocket)
    
    token = websocket.query_params.get("token")
    if not token:
        logging.warning("WebSocket connection failed: No token provided")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        manager.disconnect(websocket)
        return

    # Validate JWT
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            logging.warning("WebSocket connection failed: JWT missing sub")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            manager.disconnect(websocket)
            return
    except JWTError as e:
        logging.warning(f"WebSocket connection failed: JWT Error: {e}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        manager.disconnect(websocket)
        return

    # Verify user exists using a short-lived session
    try:
        with Session(engine) as session:
            user = session.exec(select(User).where(User.username == username)).first()
            if not user:
                logging.warning(f"WebSocket connection failed: User {username} not found")
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                manager.disconnect(websocket)
                return
            user_username = user.username  # grab the value before session closes
    except Exception as e:
        logging.error(f"WebSocket connection failed: DB Error {e}")
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        manager.disconnect(websocket)
        return

    try:
        while True:
            data = await websocket.receive_json()
            content = data.get("content", "").strip()
            image_url = data.get("image_url")

            if not content and not image_url:
                continue

            # Use a fresh session for each message save
            with Session(engine) as session:
                new_msg = ChatMessage(
                    sender=user_username,
                    content=content,
                    image_url=image_url,
                    timestamp=datetime.utcnow()
                )
                session.add(new_msg)
                session.commit()
                session.refresh(new_msg)

                await manager.broadcast({
                    "id": new_msg.id,
                    "sender": new_msg.sender,
                    "content": new_msg.content,
                    "image_url": new_msg.image_url,
                    "timestamp": new_msg.timestamp.isoformat()
                })
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logging.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)
