import os
import yaml
import logging
from typing import List, Dict, Any, Optional
from pathlib import Path

logger = logging.getLogger(__name__)

def load_red_flags(base_dir: str) -> List[Dict[str, Any]]:
    path = Path(base_dir) / "configs" / "red_flags.yaml"
    if not path.exists():
        logger.warning(f"Red flags config not found at {path}")
        return []
    try:
        with open(path, "r") as f:
            data = yaml.safe_load(f)
            return data.get("rules", [])
    except Exception as e:
        logger.error(f"Error loading red flags: {e}")
        return []

def evaluate_red_flags(features: Dict[str, Any], base_dir: Optional[str] = None) -> List[Dict[str, Any]]:
    """Return triggered alert rules for active features."""
    if base_dir is None:
        engine_dir = Path(__file__).parent
        base_dir = os.getenv("HEALTH_AI_BASE_DIR", engine_dir.parent)

    rules = load_red_flags(str(base_dir))
    active_symptoms = {k for k, v in features.items() if v}
    triggered_alerts = []

    for rule in rules:
        logic = rule.get("logic", "any")
        triggers = rule.get("triggers", [])
        
        if not triggers:
            continue

        match = False
        if logic == "all":
            if all(t in active_symptoms for t in triggers):
                match = True
        else:
            if any(t in active_symptoms for t in triggers):
                match = True
        
        if match:
            triggered_alerts.append({
                "rule_id": rule.get("id"),
                "condition": rule.get("condition"),
                "severity": rule.get("severity", "HIGH"),
                "message": rule.get("message")
            })
            
    return triggered_alerts
