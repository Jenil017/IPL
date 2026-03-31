import os
from sqlmodel import create_engine, Session, SQLModel

# We must import the models here so SQLModel knows about them
from models import User, Prediction, ChatMessage

# Use DATABASE_URL from environment, fallback to local SQLite for development
database_url = os.getenv("DATABASE_URL", "sqlite:///data/ipl.db")

# Connection arguments
connect_args = {}

if database_url.startswith("sqlite"):
    os.makedirs("data", exist_ok=True)
    # Enable foreign keys for SQLite
    connect_args = {"check_same_thread": False}
else:
    # Render's PostgreSQL requires SSL, and it often provides 'postgres://' 
    # instead of 'postgresql://' (which SQLAlchemy prefers)
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)

engine = create_engine(database_url, connect_args=connect_args)

def get_session():
    with Session(engine) as session:
        yield session

def init_db():
    SQLModel.metadata.create_all(engine)
