import json
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlmodel import Session, select

from database import get_session
from auth import get_current_admin
from models import User, Prediction
from constants import COMING_SOON_MATCH_ID

router = APIRouter(prefix="/api/upload", tags=["upload"])

@router.post("")
async def upload_prediction(
    file: UploadFile = File(...),
    current_admin: User = Depends(get_current_admin),
    session: Session = Depends(get_session)
):
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="Only JSON files are allowed")
    
    content = await file.read()
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file")

    # Schema Validation
    try:
        match_info = data["match_info"]
        prediction_report = data["prediction_report"]
        _ = data["dimension_scoring"]["final_scores"]
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Missing required key: {str(e)}")

    match_id = match_info.get("match_id")
    if not match_id:
        raise HTTPException(status_code=400, detail="match_id is required")

    if match_id == COMING_SOON_MATCH_ID:
        raise HTTPException(
            status_code=400,
            detail="Reserved match id: use Admin → Coming Soon to update the dashboard placeholder.",
        )

    existing = session.exec(select(Prediction).where(Prediction.match_id == match_id)).first()

    _raw_conf = prediction_report.get("confidence_pct")
    try:
        _conf_int = int(_raw_conf) if _raw_conf is not None else 0
    except (TypeError, ValueError):
        _conf_int = 0

    if existing:
        # Update existing record (Fix typo/update prediction without creating duplicates)
        existing.season = match_info.get("season", 0)
        existing.match_number = match_info.get("match_number", 0)
        existing.stage = match_info.get("stage", "")
        existing.team_a = match_info.get("team_a", "")
        existing.team_b = match_info.get("team_b", "")
        existing.team_a_short = match_info.get("team_a_short", "")
        existing.team_b_short = match_info.get("team_b_short", "")
        existing.venue_name = match_info.get("venue_name", "")
        existing.venue_city = match_info.get("venue_city", "")
        existing.match_date = match_info.get("date", "")
        existing.start_time_ist = match_info.get("start_time_ist", "")
        existing.predicted_winner = prediction_report.get("winner") or ""
        existing.predicted_winner_short = prediction_report.get("winner_short") or ""
        existing.confidence_pct = _conf_int
        existing.confidence_level = prediction_report.get("confidence_level") or ""
        existing.json_data = content.decode('utf-8')
        existing.uploaded_by = current_admin.username
        
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return {"message": "Match updated successfully", "id": existing.id}
    else:
        prediction = Prediction(
            match_id=match_id,
            season=match_info.get("season", 0),
            match_number=match_info.get("match_number", 0),
            stage=match_info.get("stage", ""),
            team_a=match_info.get("team_a", ""),
            team_b=match_info.get("team_b", ""),
            team_a_short=match_info.get("team_a_short", ""),
            team_b_short=match_info.get("team_b_short", ""),
            venue_name=match_info.get("venue_name", ""),
            venue_city=match_info.get("venue_city", ""),
            match_date=match_info.get("date", ""),
            start_time_ist=match_info.get("start_time_ist", ""),
            predicted_winner=prediction_report.get("winner") or "",
            predicted_winner_short=prediction_report.get("winner_short") or "",
            confidence_pct=_conf_int,
            confidence_level=prediction_report.get("confidence_level") or "",
            json_data=content.decode('utf-8'),
            uploaded_by=current_admin.username
        )

        session.add(prediction)
        session.commit()
        session.refresh(prediction)

        return {"message": "Upload successful", "id": prediction.id}
