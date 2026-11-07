# CertSure Intent Classifier

This optional Python service classifies questions into project intents, including English and Roman Urdu examples. It does not decide certificate validity and does not make network requests at runtime.

## Intents

The classifier has 10 intents: `verify_certificate`, `lookup_record`, `issue_certificate`, `revoke_certificate`, `bulk_issue`, `admin_login`, `other`, `qr_scan`, `blockchain`, and `ai_assistant`. The `ai_assistant` intent handles questions about this certificate system, including VALID and REVOKED results, QR codes, hashes, and verification. The Node API's `faq` request mode is a UI mode name, not a classifier intent.

## Setup

From PowerShell:

```powershell
Set-Location E:\BBCVS\cert-verification\ml
.\.venv\Scripts\activate
python -m pip install -r requirements.txt
```

The `.venv` environment is kept in this folder.

## Train the model

The model trains on `data\train_en.csv` and `data\train_ur.csv` and evaluates on the separate `data\test_en.csv` and `data\test_ur.csv` sets. All text is normalized consistently during training and prediction. Check that the train and test splits do not overlap, then train and evaluate with:

```powershell
python data\check_overlap.py
python train.py
```

The script prints row count, accuracy, and macro F1 separately for English and Roman Urdu. It prints a classification report and confusion matrix for the combined test sets, then saves the pipeline to `model\intent_model.joblib`.

## Learning from approved answers

Only explicitly approved examples may be added to classifier training. List unanswered questions with `python approve.py list`, then approve one by supplying its text and one of the 10 intent labels with `python approve.py add "question text" ai_assistant`. Approved examples are stored in `data\approved_intents.csv`. Review the candidate evaluation by running `python retrain.py`; the candidate is promoted only when its English and Roman Urdu accuracies are each no more than 0.01 below the current model. Use `--force` only when you intentionally want to skip that accuracy check. The previous live model is backed up as `model\intent_model.previous.joblib`.

Raw user messages are never trained automatically. The frozen `test_en.csv` and `test_ur.csv` files are evaluation-only and are never included in training.

## Run the service

Start the service from the `ml` folder:

```powershell
uvicorn service:app --port 8001
```

Check health:

```powershell
Invoke-RestMethod http://127.0.0.1:8001/health
```

Check the loaded model metadata:

```powershell
Invoke-RestMethod http://127.0.0.1:8001/model-info
```

Classify a question:

```powershell
$body = @{ text = "How do I verify a certificate?" } | ConvertTo-Json
Invoke-RestMethod -Uri http://127.0.0.1:8001/classify -Method Post -ContentType "application/json" -Body $body
```

The response contains the predicted `intent` and its highest probability as `confidence`. Predictions below 0.35 are returned with intent `other`.

The service is optional. The Node application does not depend on it and uses its existing fallback when the service is unavailable.

## Tests

```powershell
python -m pytest -q
```
