from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from sqlmodel import SQLModel, Field


class User(SQLModel, table=True):
    __tablename__ = "users"
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    password_hash: str
    role: str = Field(default="viewer")  # "admin" | "viewer"
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Prediction(SQLModel, table=True):
    __tablename__ = "predictions"
    id: Optional[int] = Field(default=None, primary_key=True)
    match_id: str = Field(unique=True, index=True)
    season: int
    match_number: int
    stage: str
    team_a: str
    team_b: str
    team_a_short: str
    team_b_short: str
    venue_name: str
    venue_city: str
    match_date: str
    start_time_ist: str
    predicted_winner: str
    predicted_winner_short: str
    confidence_pct: int
    confidence_level: str
    json_data: str  # Full raw json string
    actual_winner: Optional[str] = Field(default=None)
    actual_winner_short: Optional[str] = Field(default=None)
    is_correct: Optional[int] = Field(default=None)  # 1=correct, 0=wrong
    uploaded_by: str
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    result_marked_at: Optional[datetime] = Field(default=None)
    is_featured: bool = Field(default=False)


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None


class ChatMessage(SQLModel, table=True):
    __tablename__ = "chat_messages"
    id: Optional[int] = Field(default=None, primary_key=True)
    sender: str
    content: str
    image_url: Optional[str] = Field(default=None)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
