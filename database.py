import os
from sqlmodel import create_engine, Session, SQLModel

# We must import the models here so SQLModel knows about them
from models import User, Prediction, ChatMessage

from dotenv import load_dotenv

# Load variables from .env if present
load_dotenv()

# We REQUIRE a DATABASE_URL for all environments now.
# Local development needs a .env file with DATABASE_URL=postgresql://user:pass@localhost:5432/db_name
database_url = os.getenv("DATABASE_URL")

if not database_url:
    raise ValueError("CRITICAL: DATABASE_URL not set in environment or .env file.")

# Force SQLAlchemy-compatible postgres scheme
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

# Render's PostgreSQL requires SSL in production
connect_args = {}
# No check_same_thread needed for Postgres

engine = create_engine(database_url, connect_args=connect_args)

def get_session():
    with Session(engine) as session:
        yield session

def init_db():
    SQLModel.metadata.create_all(engine)
