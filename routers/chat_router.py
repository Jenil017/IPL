import os
import uuid
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

from database import get_session
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
    # Reverse to show in chronological order for the client
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
async def websocket_endpoint(websocket: WebSocket, session: Session = Depends(get_session)):
    """WebSocket endpoint for real-time chat."""
    # We can't use Depends(get_current_user) directly on WebSocket because it's not a standard HTTP request.
    # We'll expect the client to send a token in the query params or as the first message.
    # For simplicity, let's use a query parameter 'token' for connection.
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    except JWTError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user = session.exec(select(User).where(User.username == username)).first()
    if not user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(websocket)
    try:
        while True:
            # We expect a JSON: {"content": "...", "image_url": "..."}
            data = await websocket.receive_json()
            content = data.get("content", "").strip()
            image_url = data.get("image_url")

            if not content and not image_url:
                continue

            # Save to DB
            new_msg = ChatMessage(
                sender=user.username,
                content=content,
                image_url=image_url,
                timestamp=datetime.utcnow()
            )
            session.add(new_msg)
            session.commit()
            session.refresh(new_msg)

            # Broadcast to everyone
            await manager.broadcast({
                "id": new_msg.id,
                "sender": new_msg.sender,
                "content": new_msg.content,
                "image_url": new_msg.image_url,
                "timestamp": new_msg.timestamp.isoformat()
            })
    except WebSocketDisconnect:
        manager.disconnect(websocket)
