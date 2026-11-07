from pathlib import Path

import pandas as pd

from normalize import normalize_text


DATA_DIR = Path(__file__).resolve().parents[1] / "data"


def load_dataset(name):
    return pd.read_csv(DATA_DIR / name, encoding="utf-8")


def test_other_has_at_least_90_training_rows_across_languages():
    train_en = load_dataset("train_en.csv")
    train_ur = load_dataset("train_ur.csv")

    other_count = (train_en["intent"] == "other").sum() + (train_ur["intent"] == "other").sum()
    assert other_count >= 90


def test_ai_assistant_has_at_least_110_english_training_rows():
    train_en = load_dataset("train_en.csv")

    assert (train_en["intent"] == "ai_assistant").sum() >= 110


def test_issue_and_revoke_have_at_least_80_training_rows_across_languages():
    train_en = load_dataset("train_en.csv")
    train_ur = load_dataset("train_ur.csv")

    for intent in ("issue_certificate", "revoke_certificate"):
        count = (train_en["intent"] == intent).sum() + (train_ur["intent"] == intent).sum()
        assert count >= 80


def test_both_frozen_test_sets_have_exactly_ten_rows_per_intent():
    for name in ("test_en.csv", "test_ur.csv"):
        counts = load_dataset(name)["intent"].value_counts()
        assert len(counts) == 10
        assert counts["ai_assistant"] == 20
        assert (counts.drop("ai_assistant") == 10).all()


def test_neither_test_set_overlaps_either_training_file_after_normalization():
    train_text = set()
    for name in ("train_en.csv", "train_ur.csv"):
        train_text.update(
            normalize_text(text)
            for text in load_dataset(name)["text"].dropna().astype(str)
        )

    for name in ("test_en.csv", "test_ur.csv"):
        test_text = {
            normalize_text(text)
            for text in load_dataset(name)["text"].dropna().astype(str)
        }
        assert test_text.isdisjoint(train_text)
