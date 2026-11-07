# Validates dataset schemas, intent coverage, minimum examples, and split isolation.
from pathlib import Path

import pandas as pd


DATA_DIR = Path(__file__).resolve().parents[1] / "data"


def load_dataset(name):
    return pd.read_csv(DATA_DIR / name, encoding="utf-8")


def test_english_datasets_exist_with_required_columns():
    for name in ("train_en.csv", "test_en.csv"):
        path = DATA_DIR / name
        assert path.is_file()
        data = load_dataset(name)
        assert {"text", "intent"}.issubset(data.columns)


def test_test_intents_are_present_in_training_data():
    train_intents = set(load_dataset("train_en.csv")["intent"])
    test_intents = set(load_dataset("test_en.csv")["intent"])

    assert test_intents.issubset(train_intents)


def test_train_and_test_texts_do_not_overlap():
    train_text = {
        text.strip().casefold()
        for text in load_dataset("train_en.csv")["text"].dropna().astype(str)
    }
    test_text = {
        text.strip().casefold()
        for text in load_dataset("test_en.csv")["text"].dropna().astype(str)
    }

    assert train_text.isdisjoint(test_text)


def test_each_intent_has_enough_training_and_test_rows():
    train_counts = load_dataset("train_en.csv")["intent"].value_counts()
    test_counts = load_dataset("test_en.csv")["intent"].value_counts()

    assert (train_counts >= 60).all()
    assert (test_counts >= 10).all()
