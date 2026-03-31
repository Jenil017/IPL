import json
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlmodel import Session, select

from database import get_session
from auth import get_current_admin
from models import User, Prediction

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

    # Reject duplicate match_ids
    existing = session.exec(select(Prediction).where(Prediction.match_id == match_id)).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Match {match_id} already exists")

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
        predicted_winner=prediction_report.get("winner", ""),
        predicted_winner_short=prediction_report.get("winner_short", ""),
        confidence_pct=prediction_report.get("confidence_pct", 0),
        confidence_level=prediction_report.get("confidence_level", ""),
        json_data=content.decode('utf-8'),
        uploaded_by=current_admin.username
    )

    session.add(prediction)
    session.commit()
    session.refresh(prediction)

    return {"message": "Upload successful", "id": prediction.id}
