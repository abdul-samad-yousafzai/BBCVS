# Checks exact text overlap across English and Roman Urdu datasets.
from pathlib import Path
import sys

import pandas as pd

DATA_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(DATA_DIR.parent))

from normalize import normalize_text

TRAIN_EN_PATH = DATA_DIR / "train_en.csv"
TRAIN_UR_PATH = DATA_DIR / "train_ur.csv"
TEST_EN_PATH = DATA_DIR / "test_en.csv"
TEST_UR_PATH = DATA_DIR / "test_ur.csv"


def main():
    datasets = {
        "train_en": pd.read_csv(TRAIN_EN_PATH, encoding="utf-8"),
        "train_ur": pd.read_csv(TRAIN_UR_PATH, encoding="utf-8"),
        "test_en": pd.read_csv(TEST_EN_PATH, encoding="utf-8"),
        "test_ur": pd.read_csv(TEST_UR_PATH, encoding="utf-8"),
    }
    if any("text" not in data.columns for data in datasets.values()):
        raise ValueError("All datasets must contain a text column.")

    normalized = {
        name: {
            normalize_text(text)
            for text in data["text"].dropna().astype(str)
        }
        for name, data in datasets.items()
    }
    checks = (
        ("train_en vs test_en", "train_en", "test_en", True),
        ("train_en vs test_ur", "train_en", "test_ur", True),
        ("train_ur vs test_en", "train_ur", "test_en", True),
        ("train_ur vs test_ur", "train_ur", "test_ur", True),
        ("train_ur vs train_en", "train_ur", "train_en", False),
    )
    has_test_overlap = False
    for label, left, right, is_test_check in checks:
        overlap_count = len(normalized[left] & normalized[right])
        print(f"{label} overlapping texts: {overlap_count}")
        if is_test_check and overlap_count > 0:
            has_test_overlap = True
    if has_test_overlap:
        sys.exit(1)


if __name__ == "__main__":
    main()
