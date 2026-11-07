import csv
from datetime import datetime
from pathlib import Path

import pandas as pd
from fastapi.testclient import TestClient

import approve
import retrain
import service


def prepare_approval_data(tmp_path, monkeypatch):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    for filename in ("train_en.csv", "train_ur.csv", "test_en.csv", "test_ur.csv"):
        pd.DataFrame(
            [{"text": f"example for {filename}", "intent": "other"}]
        ).to_csv(data_dir / filename, index=False, encoding="utf-8")
    monkeypatch.setattr(approve, "DATA_DIR", data_dir)
    monkeypatch.setattr(approve, "APPROVED_PATH", data_dir / "approved_intents.csv")


def test_approve_rejects_unknown_intent(tmp_path, monkeypatch):
    prepare_approval_data(tmp_path, monkeypatch)

    try:
        approve.add_approved_text("A valid question", "unknown_intent")
    except ValueError as error:
        assert str(error) == "Unknown intent."
    else:
        raise AssertionError("An unknown intent was accepted.")


def test_approve_rejects_text_shorter_than_three_characters(tmp_path, monkeypatch):
    prepare_approval_data(tmp_path, monkeypatch)

    try:
        approve.add_approved_text(" a ", "other")
    except ValueError as error:
        assert "at least 3" in str(error)
    else:
        raise AssertionError("Text shorter than three characters was accepted.")


def test_approve_rejects_text_already_in_training_data(tmp_path, monkeypatch):
    prepare_approval_data(tmp_path, monkeypatch)
    train_path = approve.DATA_DIR / "train_en.csv"
    pd.DataFrame([{"text": "Verify this certificate.", "intent": "verify_certificate"}]).to_csv(
        train_path, index=False, encoding="utf-8"
    )

    try:
        approve.add_approved_text("VERIFY   this certificate.", "verify_certificate")
    except ValueError as error:
        assert "already exists" in str(error)
    else:
        raise AssertionError("A duplicate training example was accepted.")
    assert not approve.APPROVED_PATH.exists()


def test_approve_appends_csv_with_header_and_normalized_text(tmp_path, monkeypatch):
    prepare_approval_data(tmp_path, monkeypatch)

    normalized = approve.add_approved_text("How exactly does it work?", "ai_assistant")

    assert normalized == "how exactly does it work?"
    with approve.APPROVED_PATH.open(encoding="utf-8", newline="") as source:
        rows = list(csv.reader(source))
    assert rows == [
        ["text", "intent"],
        ["how exactly does it work?", "ai_assistant"],
    ]


def test_should_promote_accepts_candidate_within_accuracy_tolerance():
    current = {"english_accuracy": 0.90, "roman_urdu_accuracy": 0.85}
    candidate = {"english_accuracy": 0.89, "roman_urdu_accuracy": 0.84}

    assert retrain.should_promote(current, candidate) is True


def test_should_promote_rejects_candidate_dropping_more_than_tolerance():
    current = {"english_accuracy": 0.90, "roman_urdu_accuracy": 0.85}
    candidate = {"english_accuracy": 0.90, "roman_urdu_accuracy": 0.839}

    assert retrain.should_promote(current, candidate) is False


def test_model_info_returns_classes_and_filename_only(tmp_path, monkeypatch):
    expected_classes = [
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
    ]

    class FakeModel:
        classes_ = expected_classes

    model_path = tmp_path / "intent_model.joblib"
    model_path.write_bytes(b"test model")
    monkeypatch.setattr(service, "model", FakeModel())
    monkeypatch.setattr(service, "MODEL_PATH", model_path)

    with TestClient(service.app) as client:
        response = client.get("/model-info")

    assert response.status_code == 200
    result = response.json()
    assert result["modelFile"] == model_path.name
    assert result["classes"] == expected_classes
    assert str(tmp_path) not in str(result)
    assert datetime.fromisoformat(result["trainedAt"]).tzinfo is not None
