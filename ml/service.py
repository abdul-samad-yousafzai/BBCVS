# Serves the trained intent classifier with simple input validation.
from pathlib import Path
from datetime import datetime

import joblib
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, field_validator

from normalize import normalize_text


MODEL_PATH = Path(__file__).resolve().parent / "model" / "intent_model.joblib"
CONFIDENCE_THRESHOLD = 0.20

try:
    model = joblib.load(MODEL_PATH)
except FileNotFoundError:
    model = None


class ClassifyRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500)

    @field_validator("text", mode="before")
    @classmethod
    def validate_text(cls, value):
        return value.strip() if isinstance(value, str) else value


app = FastAPI(title="CertSure Intent Classifier")


@app.get("/health")
def health():
    return {
        "ok": True,
        "modelLoaded": model is not None,
    }


@app.get("/model-info")
def model_info():
    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Model not trained. Run train.py first.",
        )
    try:
        trained_at = datetime.fromtimestamp(MODEL_PATH.stat().st_mtime).astimezone().isoformat()
    except FileNotFoundError as error:
        raise HTTPException(
            status_code=503,
            detail="Model file is unavailable.",
        ) from error

    return {
        "modelFile": MODEL_PATH.name,
        "trainedAt": trained_at,
        "classes": [str(intent) for intent in model.classes_],
    }


@app.post("/classify")
def classify(payload: ClassifyRequest):
    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Model not trained. Run train.py first.",
        )

    probabilities = model.predict_proba([normalize_text(payload.text)])[0]
    best_index = int(probabilities.argmax())
    confidence = round(float(probabilities[best_index]), 3)
    intent = str(model.classes_[best_index])
    if confidence < CONFIDENCE_THRESHOLD:
        intent = "other"

    return {"intent": intent, "confidence": confidence}
