from pathlib import Path

import pandas as pd

from normalize import normalize_text


DATA_DIR = Path(__file__).resolve().parents[1] / "data"


def load_dataset(name):
    return pd.read_csv(DATA_DIR / name, encoding="utf-8")


def test_roman_urdu_training_data_has_at_least_40_rows_per_intent():
    train_data = load_dataset("train_ur.csv")

    assert (train_data["intent"].value_counts() >= 40).all()


def test_roman_urdu_test_data_has_exactly_10_rows_per_intent():
    test_data = load_dataset("test_ur.csv")
    counts = test_data["intent"].value_counts()

    assert len(counts) == 10
    assert counts["ai_assistant"] == 20
    assert (counts.drop("ai_assistant") == 10).all()


def test_roman_urdu_test_data_does_not_overlap_training_data_after_normalization():
    test_text = {
        normalize_text(text)
        for text in load_dataset("test_ur.csv")["text"].dropna().astype(str)
    }
    train_ur_text = {
        normalize_text(text)
        for text in load_dataset("train_ur.csv")["text"].dropna().astype(str)
    }
    train_en_text = {
        normalize_text(text)
        for text in load_dataset("train_en.csv")["text"].dropna().astype(str)
    }

    assert test_text.isdisjoint(train_ur_text)
    assert test_text.isdisjoint(train_en_text)


def test_normalize_text_maps_common_spelling_variants():
    assert normalize_text("kese") == "kaise"
    assert normalize_text("veryfy") == "verify"


def test_normalize_text_lowercases_and_collapses_extra_spaces():
    assert normalize_text("  QR   SCAN   kaise karun?  ") == "qr scan kaise karun?"
