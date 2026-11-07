# Layer 4 adds training examples for the three observed confusion pairs.
# Trains on English examples and evaluates on a separate, fixed test dataset.
from pathlib import Path

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.pipeline import Pipeline

from normalize import normalize_text


ROOT = Path(__file__).resolve().parent
TRAIN_EN_PATH = ROOT / "data" / "train_en.csv"
TRAIN_UR_PATH = ROOT / "data" / "train_ur.csv"
TEST_EN_PATH = ROOT / "data" / "test_en.csv"
TEST_UR_PATH = ROOT / "data" / "test_ur.csv"
MODEL_PATH = ROOT / "model" / "intent_model.joblib"


def main():
    train_en = pd.read_csv(TRAIN_EN_PATH, encoding="utf-8")
    train_ur = pd.read_csv(TRAIN_UR_PATH, encoding="utf-8")
    test_en = pd.read_csv(TEST_EN_PATH, encoding="utf-8")
    test_ur = pd.read_csv(TEST_UR_PATH, encoding="utf-8")
    required_columns = {"text", "intent"}
    datasets = (train_en, train_ur, test_en, test_ur)
    if any(not required_columns.issubset(data.columns) for data in datasets):
        raise ValueError("All datasets must contain text and intent columns.")

    def clean_data(data):
        data = data.dropna(subset=["text", "intent"]).copy()
        data["text"] = data["text"].astype(str).map(normalize_text)
        data["intent"] = data["intent"].astype(str).str.strip()
        data = data[(data["text"] != "") & (data["intent"] != "")]
        return data.reset_index(drop=True)

    train_data = pd.concat(
        [clean_data(train_en), clean_data(train_ur)],
        ignore_index=True,
    )
    test_en = clean_data(test_en)
    test_ur = clean_data(test_ur)
    if train_data.empty or test_en.empty or test_ur.empty:
        raise ValueError("Training and both test datasets must contain non-empty rows.")

    print(f"Training rows: {len(train_data)}")

    model = Pipeline([
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
    model.fit(train_data["text"], train_data["intent"])

    test_predictions = {}
    for name, test_data in (("English", test_en), ("Roman Urdu", test_ur)):
        predictions = model.predict(test_data["text"])
        test_predictions[name] = predictions
        print(
            f"{name} test rows: {len(test_data)}, "
            f"accuracy: {accuracy_score(test_data['intent'], predictions):.4f}, "
            f"macro F1: {f1_score(test_data['intent'], predictions, average='macro', zero_division=0):.4f}"
        )

    combined_test = pd.concat([test_en, test_ur], ignore_index=True)
    combined_predictions = list(test_predictions["English"]) + list(test_predictions["Roman Urdu"])
    print("Classification report:")
    print(classification_report(
        combined_test["intent"],
        combined_predictions,
        labels=model.classes_,
        zero_division=0,
    ))
    labels = model.classes_
    matrix = confusion_matrix(
        combined_test["intent"],
        combined_predictions,
        labels=labels,
    )
    print("Confusion matrix:")
    print(matrix)

    confused_pairs = sorted(
        (
            (int(matrix[true_index, predicted_index]), labels[true_index], labels[predicted_index])
            for true_index in range(len(labels))
            for predicted_index in range(len(labels))
            if true_index != predicted_index and matrix[true_index, predicted_index] > 0
        ),
        key=lambda pair: (-pair[0], pair[1], pair[2]),
    )
    print("Top confused pairs (true label, predicted label, count):")
    for count, true_label, predicted_label in confused_pairs[:3]:
        print(f"({true_label}, {predicted_label}, {count})")

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    print(MODEL_PATH)


if __name__ == "__main__":
    main()
