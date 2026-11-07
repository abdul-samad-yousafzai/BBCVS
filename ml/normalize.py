"""Text normalization shared by model training and prediction."""
import re


# Demo normalization list for common Roman Urdu and certificate-related variants.
SPELLING_VARIANTS = {
    "kese": "kaise",
    "kesay": "kaise",
    "kaisay": "kaise",
    "kaisy": "kaise",
    "kasy": "kaise",
    "krun": "karun",
    "karon": "karun",
    "kru": "karun",
    "krna": "karna",
    "krny": "karne",
    "kray": "kare",
    "krain": "karein",
    "btao": "batao",
    "btaye": "bataye",
    "btaen": "batayein",
    "mujhy": "mujhe",
    "apka": "aapka",
    "apni": "apni",
    "hain": "hai",
    "hy": "hai",
    "kahan": "kahan",
    "kiya": "kya",
    "kia": "kya",
    "cheak": "check",
    "chek": "check",
    "sertificate": "certificate",
    "certficate": "certificate",
    "certifcate": "certificate",
    "veryfy": "verify",
    "verfiy": "verify",
    "scaning": "scan",
}


def normalize_text(text: str) -> str:
    """Lowercase text, normalize common spelling variants, and remove noise."""
    normalized = re.sub(r"[^a-z0-9 ?'/-]", " ", text.lower().strip())
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return re.sub(
        r"\b[a-z0-9']+\b",
        lambda match: SPELLING_VARIANTS.get(match.group(0), match.group(0)),
        normalized,
    )
