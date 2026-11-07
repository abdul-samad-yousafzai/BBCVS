# Checks API responses, Pydantic validation, and behavior without a trained model.
import numpy as np
from fastapi.testclient import TestClient

import service


class FakeIntentModel:
    classes_ = ["verify_certificate", "other"]

    def predict_proba(self, texts):
        self.received_texts = texts
        return np.array([[0.82, 0.18]])


def test_health_returns_ok():
    with TestClient(service.app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_classify_rejects_empty_text():
    with TestClient(service.app) as client:
        response = client.post("/classify", json={"text": "   "})

    assert response.status_code == 422


def test_classify_returns_intent_and_confidence(monkeypatch):
    fake_model = FakeIntentModel()
    monkeypatch.setattr(service, "model", fake_model)

    with TestClient(service.app) as client:
        response = client.post(
            "/classify",
            json={"text": "Kese   veryfy this sertificate?"},
        )

    assert response.status_code == 200
    assert fake_model.received_texts == ["kaise verify this certificate?"]
    result = response.json()
    assert isinstance(result["intent"], str) and result["intent"]
    assert 0 <= result["confidence"] <= 1


def test_classify_returns_503_when_model_is_missing(monkeypatch):
    monkeypatch.setattr(service, "model", None)

    with TestClient(service.app) as client:
        response = client.post("/classify", json={"text": "verify this certificate"})

    assert response.status_code == 503
    assert response.json() == {"detail": "Model not trained. Run train.py first."}
