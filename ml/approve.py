"""Manage human-approved intent examples for the ML classifier."""
import argparse
import csv
from pathlib import Path
import sys

import pandas as pd

from normalize import normalize_text


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
UNANSWERED_PATH = ROOT.parent / "data" / "unanswered.jsonl"
APPROVED_PATH = DATA_DIR / "approved_intents.csv"
INTENTS = {
    "verify_certificate",
    "lookup_record",
    "issue_certificate",
    "revoke_certificate",
    "bulk_issue",
    "admin_login",
    "other",
    "qr_scan",
    "blockchain",
    "ai_assistant",
}
TRAIN_AND_TEST_FILES = (
    "train_en.csv",
    "train_ur.csv",
    "test_en.csv",
    "test_ur.csv",
)


def existing_normalized_texts():
    existing = set()
    for filename in TRAIN_AND_TEST_FILES:
        path = DATA_DIR / filename
        data = pd.read_csv(path, encoding="utf-8")
        if "text" not in data.columns:
            raise ValueError(f"{filename} must contain a text column.")
        existing.update(
            normalize_text(text)
            for text in data["text"].dropna().astype(str)
        )
    if APPROVED_PATH.is_file():
        approved = pd.read_csv(APPROVED_PATH, encoding="utf-8")
        if "text" not in approved.columns:
            raise ValueError("approved_intents.csv must contain a text column.")
        existing.update(
            normalize_text(text)
            for text in approved["text"].dropna().astype(str)
        )
    return existing


def add_approved_text(text, intent):
    intent = intent.strip()
    if intent not in INTENTS:
        raise ValueError("Unknown intent.")

    normalized_text = normalize_text(text)
    if len(normalized_text) < 3:
        raise ValueError("Text must contain at least 3 normalized characters.")
    if len(normalized_text) > 300:
        raise ValueError("Text must not exceed 300 normalized characters.")
    if normalized_text in existing_normalized_texts():
        raise ValueError("This text already exists in the training or test data.")

    write_header = not APPROVED_PATH.exists()
    with APPROVED_PATH.open("a", encoding="utf-8", newline="") as output:
        writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)
        if write_header:
            writer.writerow(["text", "intent"])
        writer.writerow([normalized_text, intent])
    return normalized_text


def list_unanswered():
    if not UNANSWERED_PATH.is_file():
        return

    raise RuntimeError(
        "Cannot list unanswered items: the learning-store JSONL format "
        "is unavailable for verification."
    )


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("list", help="List unanswered questions")
    add_parser = subparsers.add_parser("add", help="Approve a text and intent")
    add_parser.add_argument("text")
    add_parser.add_argument("intent")

    args = parser.parse_args(argv)
    try:
        if args.command == "list":
            list_unanswered()
        else:
            add_approved_text(args.text, args.intent)
            print(f"Added approved example to {APPROVED_PATH.name}: {args.intent}")
    except (ValueError, OSError, pd.errors.ParserError, RuntimeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
