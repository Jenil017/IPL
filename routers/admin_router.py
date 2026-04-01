import json
import traceback
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import desc
from sqlmodel import Session, select

from database import get_session
from auth import get_current_admin, get_password_hash
from models import User, Prediction
from constants import COMING_SOON_MATCH_ID

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


class ComingSoonUpdate(BaseModel):
    team_a: str
    team_b: str
    team_a_short: str
    team_b_short: str


@router.put("/coming-soon")
def upsert_coming_soon_placeholder(
    body: ComingSoonUpdate,
    current_admin: User = Depends(get_current_admin),
    session: Session = Depends(get_session),
):
    """
    One global dashboard coming-soon row (fixed match_id). Updates teams in place,
    auto-features on dashboard, removes legacy cs_<timestamp> rows.
    """
    to_drop = [
        p
        for p in session.exec(select(Prediction)).all()
        if isinstance(p.match_id, str) and p.match_id.startswith("cs_")
    ]
    for p in to_drop:
        session.delete(p)

    payload = {
        "match_info": {
            "match_id": COMING_SOON_MATCH_ID,
            "season": 2026,
            "match_number": 0,
            "stage": "league",
            "team_a": body.team_a,
            "team_b": body.team_b,
            "team_a_short": body.team_a_short,
            "team_b_short": body.team_b_short,
            "venue_name": "TBD",
            "venue_city": "TBD",
            "date": "Coming Soon",
            "start_time_ist": "TBA",
        },
        "prediction_report": {
            "is_coming_soon": True,
            "winner": "TBD",
            "winner_short": "TBD",
            "confidence_pct": 0,
            "confidence_level": "none",
        },
        "dimension_scoring": {"final_scores": {}},
    }
    raw = json.dumps(payload, ensure_ascii=False)

    clear_featured_predictions(session)

    existing = session.exec(
        select(Prediction).where(Prediction.match_id == COMING_SOON_MATCH_ID)
    ).first()

    if existing:
        existing.team_a = body.team_a
        existing.team_b = body.team_b
        existing.team_a_short = body.team_a_short
        existing.team_b_short = body.team_b_short
        existing.match_date = "Coming Soon"
        existing.predicted_winner = "TBD"
        existing.predicted_winner_short = "TBD"
        existing.confidence_pct = 0
        existing.confidence_level = "none"
        existing.json_data = raw
        existing.uploaded_by = current_admin.username
        existing.uploaded_at = datetime.utcnow()
        existing.is_featured = True
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return {
            "message": "Coming soon dashboard updated",
            "id": existing.id,
            "match_id": COMING_SOON_MATCH_ID,
        }

    prediction = Prediction(
        match_id=COMING_SOON_MATCH_ID,
        season=2026,
        match_number=0,
        stage="league",
        team_a=body.team_a,
        team_b=body.team_b,
        team_a_short=body.team_a_short,
        team_b_short=body.team_b_short,
        venue_name="TBD",
        venue_city="TBD",
        match_date="Coming Soon",
        start_time_ist="TBA",
        predicted_winner="TBD",
        predicted_winner_short="TBD",
        confidence_pct=0,
        confidence_level="none",
        json_data=raw,
        uploaded_by=current_admin.username,
        is_featured=True,
    )
    session.add(prediction)
    session.commit()
    session.refresh(prediction)
    return {
        "message": "Coming soon dashboard created",
        "id": prediction.id,
        "match_id": COMING_SOON_MATCH_ID,
    }


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
    rows = []
    for p in preds:
        mid = p.match_id or ""
        if isinstance(mid, str) and mid.startswith("cs_"):
            continue
        rows.append(
            {
                "id": p.id,
                "match_id": p.match_id,
                "team_a_short": p.team_a_short,
                "team_b_short": p.team_b_short,
                "is_featured": p.is_featured,
                "uploaded_at": p.uploaded_at,
                "is_coming_soon_slot": p.match_id == COMING_SOON_MATCH_ID,
            }
        )
    come = next((r for r in rows if r.get("is_coming_soon_slot")), None)
    rest = [r for r in rows if not r.get("is_coming_soon_slot")]
    rest.sort(key=lambda r: r["uploaded_at"], reverse=True)
    ordered = ([come] if come else []) + rest
    return ordered


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
