import json
from typing import Annotated, Optional, Tuple
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func

from database import get_session
from auth import get_current_user
from models import User, Prediction
from constants import COMING_SOON_MATCH_ID

router = APIRouter(prefix="/api", tags=["predictions"])


def _history_prediction_display(p: Prediction) -> Tuple[Optional[str], Optional[int], bool]:
    """History Predicted + Conf: driven only by stored JSON prediction_report (not DB denormalized columns)."""
    def _clean_short(val) -> Optional[str]:
        if val is None:
            return None
        s = str(val).strip()
        if not s:
            return None
        u = s.upper()
        if u in ("TBD", "N/A"):
            return None
        return s

    def _clean_conf(val) -> Optional[int]:
        if val is None:
            return None
        try:
            n = int(val)
        except (TypeError, ValueError):
            return None
        if n <= 0:
            return None
        return n

    try:
        data = json.loads(p.json_data)
        pr = data.get("prediction_report") or {}
    except (json.JSONDecodeError, TypeError):
        return None, None, False

    if pr.get("prediction_pending") is True or pr.get("is_coming_soon") is True:
        return None, None, False
    # Explicitly false = fixture / draft only; publish a pick by setting true in JSON when you upload the real analysis
    if pr.get("internet_analysis_used") is False:
        return None, None, False

    ws_src = pr.get("winner_short") if "winner_short" in pr else None
    cf_src = pr.get("confidence_pct") if "confidence_pct" in pr else None
    cl_src = pr.get("confidence_level") if "confidence_level" in pr else None

    ws = _clean_short(ws_src)
    cf = _clean_conf(cf_src)
    cl = (cl_src or "").strip().lower() if cl_src is not None else ""
    cl_ok = bool(cl) and cl != "none"
    if ws is None or cf is None or not cl_ok:
        return None, None, False
    return ws, cf, True


def _is_coming_soon_placeholder(p: Prediction) -> bool:
    """Dashboard-only placeholders (admin 'Coming Soon'); hide from history list."""
    if p.match_id == COMING_SOON_MATCH_ID:
        return True
    if isinstance(p.match_id, str) and p.match_id.startswith("cs_"):
        return True
    if p.match_date == "Coming Soon":
        return True
    try:
        data = json.loads(p.json_data)
        return bool((data.get("prediction_report") or {}).get("is_coming_soon"))
    except (json.JSONDecodeError, TypeError):
        return False


@router.get("/predictions")
def get_predictions(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    # Returns summary list (excludes coming-soon stubs — those are for dashboard only)
    preds = session.exec(select(Prediction).order_by(Prediction.uploaded_at.desc())).all()
    rows = []
    for p in preds:
        if _is_coming_soon_placeholder(p):
            continue
        disp_short, disp_conf, ready = _history_prediction_display(p)
        rows.append({
            "id": p.id,
            "match_id": p.match_id,
            "match_number": p.match_number,
            "match_date": p.match_date,
            "team_a_short": p.team_a_short,
            "team_b_short": p.team_b_short,
            "predicted_winner_short": disp_short,
            "confidence_pct": disp_conf,
            "prediction_ready": ready,
            "actual_winner_short": p.actual_winner_short,
            "is_correct": p.is_correct,
            "uploaded_at": p.uploaded_at
        })
    return rows

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
