from dataclasses import dataclass
from typing import Any

@dataclass
class FeatureEvidence:
    feature_id: str
    source: str
    value: Any
    confidence: float
    timestamp: str

@dataclass
class Contribution:
    feature_id: str
    source: str
    dx: str
    contribution: float
