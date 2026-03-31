from datetime import datetime
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from pydantic import BaseModel

from database import get_session
from auth import get_current_admin
from models import User, Prediction

router = APIRouter(prefix="/api/predictions", tags=["results"])

class ResultUpdate(BaseModel):
    actual_winner: str
    actual_winner_short: str

@router.patch("/{id}/result")
def mark_result(id: int, result: ResultUpdate, current_admin: User = Depends(get_current_admin), session: Session = Depends(get_session)):
    pred = session.get(Prediction, id)
    if not pred:
        raise HTTPException(status_code=404, detail="Prediction not found")
    
    if pred.is_correct is not None:
        raise HTTPException(status_code=400, detail="Result already marked")
        
    pred.actual_winner = result.actual_winner
    pred.actual_winner_short = result.actual_winner_short
    
    if result.actual_winner_short == pred.predicted_winner_short:
        pred.is_correct = 1
    else:
        pred.is_correct = 0
        
    pred.result_marked_at = datetime.utcnow()
    
    session.add(pred)
    session.commit()
    
    return {"message": "Result updated successfully", "is_correct": pred.is_correct}
