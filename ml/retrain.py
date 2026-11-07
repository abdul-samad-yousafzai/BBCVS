"""Train and evaluate a candidate classifier using approved examples."""
import argparse
from pathlib import Path
import shutil
from typing import Mapping

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score
from sklearn.pipeline import Pipeline

from normalize import normalize_text


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
TRAIN_FILES = ("train_en.csv", "train_ur.csv")
APPROVED_PATH = DATA_DIR / "approved_intents.csv"
TEST_FILES = (("English", "test_en.csv"), ("Roman Urdu", "test_ur.csv"))
MODEL_DIR = ROOT / "model"
MODEL_PATH = MODEL_DIR / "intent_model.joblib"
CANDIDATE_PATH = MODEL_DIR / "candidate_intent_model.joblib"
BACKUP_PATH = MODEL_DIR / "intent_model.previous.joblib"


def should_promote(current: Mapping[str, float], candidate: Mapping[str, float]) -> bool:
    """Return whether both candidate accuracy scores stay within tolerance."""
    return (
        candidate["english_accuracy"] >= current["english_accuracy"] - 0.01
        and candidate["roman_urdu_accuracy"] >= current["roman_urdu_accuracy"] - 0.01
    )


def make_model():
    return Pipeline([
        ("tfidf", TfidfVectorizer(
            analyzer="char_wb",
            lowercase=True,
            ngram_range=(3, 5),
            sublinear_tf=True,
        )),
        ("classifier", LogisticRegression(
            max_iter=1000,
            class_weight="balanced",
        )),
    ])


def clean_data(data, filename):
    required_columns = {"text", "intent"}
    if not required_columns.issubset(data.columns):
        raise ValueError(f"{filename} must contain text and intent columns.")
    cleaned = data.dropna(subset=["text", "intent"]).copy()
    cleaned["text"] = cleaned["text"].astype(str).map(normalize_text)
    cleaned["intent"] = cleaned["intent"].astype(str).str.strip()
    cleaned = cleaned[(cleaned["text"] != "") & (cleaned["intent"] != "")]

    conflicting_labels = cleaned.groupby("text")["intent"].nunique()
    if (conflicting_labels > 1).any():
        raise ValueError(f"{filename} contains normalized text with conflicting intents.")
    return cleaned.drop_duplicates(subset=["text", "intent"]).reset_index(drop=True)


def load_training_data():
    base_data_frames = [
        clean_data(pd.read_csv(DATA_DIR / filename, encoding="utf-8"), filename)
        for filename in TRAIN_FILES
    ]
    base_data = pd.concat(base_data_frames, ignore_index=True)
    if APPROVED_PATH.is_file():
        approved = clean_data(
            pd.read_csv(APPROVED_PATH, encoding="utf-8"),
            APPROVED_PATH.name,
        )
    else:
        approved = pd.DataFrame(columns=["text", "intent"])

    approved_rows = len(
        approved.merge(
            base_data.drop_duplicates(subset=["text", "intent"]),
            on=["text", "intent"],
            how="left",
            indicator=True,
        ).query('_merge == "left_only"').drop_duplicates(subset=["text", "intent"])
    )
    combined = pd.concat([base_data, approved], ignore_index=True)
    conflicting_labels = combined.groupby("text")["intent"].nunique()
    if (conflicting_labels > 1).any():
        raise ValueError("Training data contains normalized text with conflicting intents.")
    combined = combined.drop_duplicates(subset=["text", "intent"]).reset_index(drop=True)
    return combined, approved_rows


def load_test_data():
    tests = []
    for name, filename in TEST_FILES:
        data = clean_data(pd.read_csv(DATA_DIR / filename, encoding="utf-8"), filename)
        if data.empty:
            raise ValueError(f"{filename} must contain non-empty rows.")
        tests.append((name, data))
    return tests


def evaluate(model, test_sets):
    metrics = {}
    for name, data in test_sets:
        predictions = model.predict(data["text"])
        prefix = "english" if name == "English" else "roman_urdu"
        metrics[f"{prefix}_accuracy"] = accuracy_score(data["intent"], predictions)
        metrics[f"{prefix}_f1"] = f1_score(
            data["intent"], predictions, average="macro", zero_division=0
        )
    return metrics


def print_comparison(current_metrics, candidate_metrics):
    print(f"{'Metric':<25} {'Current':>12} {'Candidate':>12}")
    rows = (
        ("English accuracy", "english_accuracy"),
        ("English macro F1", "english_f1"),
        ("Roman Urdu accuracy", "roman_urdu_accuracy"),
        ("Roman Urdu macro F1", "roman_urdu_f1"),
    )
    for label, key in rows:
        current = f"{current_metrics[key]:.4f}" if current_metrics else "N/A"
        print(f"{label:<25} {current:>12} {candidate_metrics[key]:>12.4f}")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="Promote without the accuracy check")
    args = parser.parse_args(argv)

    training_data, approved_rows = load_training_data()
    if training_data.empty:
        raise ValueError("Training data must contain non-empty rows.")
    test_sets = load_test_data()
    current_metrics = None
    if MODEL_PATH.is_file():
        current_model = joblib.load(MODEL_PATH)
        current_metrics = evaluate(current_model, test_sets)

    candidate_model = make_model()
    candidate_model.fit(training_data["text"], training_data["intent"])
    candidate_metrics = evaluate(candidate_model, test_sets)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(candidate_model, CANDIDATE_PATH)
    print(f"Approved rows used: {approved_rows}")
    print_comparison(current_metrics, candidate_metrics)

    promote = args.force or current_metrics is None or should_promote(
        current_metrics, candidate_metrics
    )
    if args.force:
        print("Warning: --force used; promotion accuracy check skipped.")
    if promote:
        if MODEL_PATH.is_file():
            shutil.copy2(MODEL_PATH, BACKUP_PATH)
        shutil.copy2(CANDIDATE_PATH, MODEL_PATH)
        print("Candidate promoted.")
    else:
        print("Candidate not promoted: accuracy dropped.")


if __name__ == "__main__":
    main()
