from sqlmodel import Session, select
from database import engine
from models import User
from auth import get_password_hash

def seed_users():
    with Session(engine) as session:
        # Check admin
        admin = session.exec(select(User).where(User.username == "jainil")).first()
        if not admin:
            admin_user = User(
                username="jainil",
                password_hash=get_password_hash("jainil"),
                role="admin"
            )
            session.add(admin_user)
            print("Admin user 'jainil' seeded.")

        # Check viewer
        viewer = session.exec(select(User).where(User.username == "takshat")).first()
        if not viewer:
            viewer_user = User(
                username="takshat",
                password_hash=get_password_hash("takshat"),
                role="viewer"
            )
            session.add(viewer_user)
            print("Viewer user 'takshat' seeded.")
        
        session.commit()
