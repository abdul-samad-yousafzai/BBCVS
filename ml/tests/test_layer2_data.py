# Checks Layer 2 training additions and confirms the fixed test set was preserved.
from pathlib import Path

import pandas as pd


DATA_DIR = Path(__file__).resolve().parents[1] / "data"


def test_target_intents_have_requested_training_counts():
    train_data = pd.read_csv(DATA_DIR / "train_en.csv", encoding="utf-8")
    counts = train_data["intent"].value_counts()

    assert counts["ai_assistant"] >= 100
    assert counts["verify_certificate"] >= 90
    assert counts["lookup_record"] >= 80
    assert counts["ai_assistant"] >= 80


def test_test_set_still_has_exactly_ten_rows_per_intent():
    test_data = pd.read_csv(DATA_DIR / "test_en.csv", encoding="utf-8")
    counts = test_data["intent"].value_counts()

    assert len(counts) == 10
    assert counts["ai_assistant"] == 20
    assert (counts.drop("ai_assistant") == 10).all()
