from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from sqlalchemy import desc
from pydantic import BaseModel
import logging
import traceback

from database import get_session
from auth import get_current_admin, get_password_hash
from models import User, Prediction

router = APIRouter(prefix="/api/admin", tags=["admin"])
logger = logging.getLogger(__name__)


def clear_featured_predictions(session: Session) -> None:
    featured_predictions = session.exec(
        select(Prediction).where(Prediction.is_featured == True)
    ).all()
    for featured_prediction in featured_predictions:
        featured_prediction.is_featured = False
        session.add(featured_prediction)

# --- User Management ---


class UserCreate(BaseModel):
    username: str
    password: str


class UserActiveToggle(BaseModel):
    is_active: bool


@router.get("/users")
def list_users(
    current_admin: User = Depends(get_current_admin),
    session: Session = Depends(get_session),
):
    users = session.exec(select(User).order_by(User.id)).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": u.created_at,
        }
        for u in users
    ]


@router.post("/users")
def add_viewer(
    user: UserCreate,
    current_admin: User = Depends(get_current_admin),
    session: Session = Depends(get_session),
):
    existing = session.exec(select(User).where(User.username == user.username)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")

    if len(user.password) < 4:
        raise HTTPException(status_code=400, detail="Password too short")

    new_user = User(
        username=user.username,
        password_hash=get_password_hash(user.password),
        role="viewer",  # Forced viewer role via UI
    )

    session.add(new_user)
    session.commit()
    return {"message": "User created successfully"}


@router.patch("/users/{id}")
def toggle_user(
    id: int,
    toggle: UserActiveToggle,
    current_admin: User = Depends(get_current_admin),
    session: Session = Depends(get_session),
):
    user = session.get(User, id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == current_admin.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")

    user.is_active = toggle.is_active
    session.add(user)
    session.commit()
    return {"message": "User status updated", "is_active": user.is_active}


# --- Match Management ---
@router.get("/predictions")
def list_predictions(
    current_admin: User = Depends(get_current_admin),
    session: Session = Depends(get_session),
):
    preds = session.exec(
        select(Prediction).order_by(desc(Prediction.uploaded_at))
    ).all()
    return [
        {
            "id": p.id,
            "match_id": p.match_id,
            "team_a_short": p.team_a_short,
            "team_b_short": p.team_b_short,
            "is_featured": p.is_featured,
            "uploaded_at": p.uploaded_at,
        }
        for p in preds
    ]


@router.patch("/predictions/{id}/feature")
def set_featured_prediction(
    id: int,
    current_admin: User = Depends(get_current_admin),
    session: Session = Depends(get_session),
):
    try:
        prediction = session.get(Prediction, id)
        if not prediction:
            raise HTTPException(status_code=404, detail="Prediction not found")

        logger.info(
            "Admin %s setting featured prediction %s",
            current_admin.username,
            prediction.match_id,
        )

        clear_featured_predictions(session)
        prediction.is_featured = True
        session.add(prediction)
        session.commit()
        session.refresh(prediction)

        return {
            "message": "Dashboard match updated",
            "id": prediction.id,
            "match_id": prediction.match_id,
            "is_featured": prediction.is_featured,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Error in set_featured_prediction: {e}\n{traceback.format_exc()}"
        )
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.delete("/predictions/{id}/feature")
def unset_featured_prediction(
    id: int,
    current_admin: User = Depends(get_current_admin),
    session: Session = Depends(get_session),
):
    try:
        prediction = session.get(Prediction, id)
        if not prediction:
            raise HTTPException(status_code=404, detail="Prediction not found")

        logger.info(
            "Admin %s unsetting featured prediction %s",
            current_admin.username,
            prediction.match_id,
        )

        clear_featured_predictions(session)
        session.commit()

        return {"message": "Dashboard reset to auto-show latest match"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Error in unset_featured_prediction: {e}\n{traceback.format_exc()}"
        )
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")
