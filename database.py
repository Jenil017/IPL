import os
from sqlmodel import create_engine, Session, SQLModel

# We must import the models here so SQLModel knows about them
from models import User, Prediction, ChatMessage

os.makedirs("data", exist_ok=True)
sqlite_file_name = "data/ipl.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

# Enable foreign keys for SQLite
connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, connect_args=connect_args)

def get_session():
    with Session(engine) as session:
        yield session

def init_db():
    SQLModel.metadata.create_all(engine)
