"""Merge FAQ examples into the AI assistant intent across ML datasets."""
import csv
from pathlib import Path
import sys

import pandas as pd


DATA_DIR = Path(__file__).resolve().parent
FILES_TO_RELABEL = (
    "train_en.csv",
    "train_ur.csv",
    "test_en.csv",
    "test_ur.csv",
    "intents.csv",
)


def main():
    changed_by_file = {}
    for filename in FILES_TO_RELABEL:
        path = DATA_DIR / filename
        data = pd.read_csv(path, encoding="utf-8-sig")
        if "intent" not in data.columns:
            raise ValueError(f"{filename} must contain an intent column.")

        faq_rows = data["intent"].astype(str).str.strip().str.casefold() == "faq"
        changed_count = int(faq_rows.sum())
        changed_by_file[filename] = changed_count
        if changed_count:
            data.loc[faq_rows, "intent"] = "ai_assistant"
            data.to_csv(
                path,
                index=False,
                encoding="utf-8-sig" if filename == "intents.csv" else "utf-8",
                quoting=csv.QUOTE_MINIMAL,
            )

    for filename, changed_count in changed_by_file.items():
        print(f"{filename}: {changed_count} rows changed")

    faq_files = []
    for path in sorted(DATA_DIR.glob("*.csv")):
        data = pd.read_csv(path, encoding="utf-8-sig")
        if "intent" in data.columns:
            has_faq = data["intent"].astype(str).str.strip().str.casefold().eq("faq").any()
            if has_faq:
                faq_files.append(path.name)
    if faq_files:
        print(f"FAQ intent remains in dataset file(s): {', '.join(faq_files)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
