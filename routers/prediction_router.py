import json
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func

from database import get_session
from auth import get_current_user
from models import User, Prediction

router = APIRouter(prefix="/api", tags=["predictions"])

@router.get("/predictions")
def get_predictions(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    # Returns summary list
    preds = session.exec(select(Prediction).order_by(Prediction.uploaded_at.desc())).all()
    return [{
        "id": p.id,
        "match_id": p.match_id,
        "match_date": p.match_date,
        "team_a_short": p.team_a_short,
        "team_b_short": p.team_b_short,
        "predicted_winner_short": p.predicted_winner_short,
        "confidence_pct": p.confidence_pct,
        "actual_winner_short": p.actual_winner_short,
        "is_correct": p.is_correct,
        "uploaded_at": p.uploaded_at
    } for p in preds]

@router.get("/predictions/latest")
def get_latest_prediction(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    # 1. Try to get the manually featured match
    pred = session.exec(select(Prediction).where(Prediction.is_featured == True)).first()
    
    # 2. If no featured match, fallback to the latest uploaded
    if not pred:
        pred = session.exec(select(Prediction).order_by(Prediction.uploaded_at.desc())).first()
        
    if not pred:
        raise HTTPException(status_code=404, detail="No predictions found")
    return json.loads(pred.json_data)

@router.get("/predictions/{id}")
def get_prediction(id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    pred = session.get(Prediction, id)
    if not pred:
        raise HTTPException(status_code=404, detail="Prediction not found")
    data = json.loads(pred.json_data)
    data["_meta"] = {"actual_winner_short": pred.actual_winner_short, "is_correct": pred.is_correct}
    return data

@router.get("/accuracy")
def get_accuracy(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    total = session.exec(select(func.count(Prediction.id)).where(Prediction.is_correct.is_not(None))).one()
    correct = session.exec(select(func.count(Prediction.id)).where(Prediction.is_correct == 1)).one()
    incorrect = session.exec(select(func.count(Prediction.id)).where(Prediction.is_correct == 0)).one()
    
    overall = (correct / total * 100) if total > 0 else 0
    
    # By confidence
    def get_conf_stats(conf_level):
        c_tot = session.exec(select(func.count(Prediction.id)).where(Prediction.is_correct.is_not(None)).where(func.lower(Prediction.confidence_level) == conf_level.lower())).one()
        c_cor = session.exec(select(func.count(Prediction.id)).where(Prediction.is_correct == 1).where(func.lower(Prediction.confidence_level) == conf_level.lower())).one()
        return (c_cor / c_tot * 100) if c_tot > 0 else 0

    return {
        "total": total,
        "correct": correct,
        "incorrect": incorrect,
        "accuracy_pct": round(overall, 1),
        "high_accuracy_pct": round(get_conf_stats("high"), 1),
        "medium_accuracy_pct": round(get_conf_stats("medium"), 1),
        "low_accuracy_pct": round(get_conf_stats("low"), 1)
    }
