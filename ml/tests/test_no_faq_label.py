from pathlib import Path

import joblib
import pandas as pd
import pytest


ML_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ML_DIR / "data"
MODEL_PATH = ML_DIR / "model" / "intent_model.joblib"


def test_no_dataset_contains_faq_intent():
    for path in DATA_DIR.glob("*.csv"):
        data = pd.read_csv(path, encoding="utf-8-sig")
        if "intent" in data.columns:
            intents = data["intent"].dropna().astype(str).str.strip().str.casefold()
            assert "faq" not in set(intents), f"FAQ intent remains in {path.name}"


def test_saved_model_does_not_contain_faq_class():
    if not MODEL_PATH.is_file():
        pytest.skip("Trained model is absent; run train.py to check classifier classes.")

    model = joblib.load(MODEL_PATH)
    assert "faq" not in set(model.classes_)
