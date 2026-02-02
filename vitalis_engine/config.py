import os
import sys
import yaml
import json
import logging
from typing import Dict, Any, List, Optional
from pathlib import Path

logger = logging.getLogger(__name__)

_config_cache: Dict[str, Any] = {}

def _load_yaml_cached(path: str, cache_key: Optional[str] = None) -> Dict[str, Any]:
    """Load YAML with caching."""
    key = cache_key or path
    if key in _config_cache:
        return _config_cache[key]

    try:
        with open(path, 'r') as f:
            data = yaml.safe_load(f)
            _config_cache[key] = data
            return data
    except Exception as e:
        logger.error(f"Error loading config {path}: {e}")
        return {}

def load_system_config(path: str) -> Dict[str, Any]:
    """Load system configuration."""
    return _load_yaml_cached(path, 'system')

def load_config(path: str) -> Dict[str, Any]:
    """Load a config file."""
    try:
        with open(path, 'r') as f:
            return yaml.safe_load(f)
    except Exception as e:
        logger.error(f"Error loading config {path}: {e}")
        return {}

def load_lab_ranges(path: str) -> Dict[str, Any]:
    """Load lab reference ranges."""
    if not path or not os.path.exists(path):
        logger.warning(f"Lab ranges config not found: {path}")
        return {}
    try:
        data = _load_yaml_cached(path, 'lab_ranges')
        ranges = data.get('ranges', {})
        return {
            test_id: {
                'min': test_data.get('min'),
                'max': test_data.get('max'),
                'high_id': test_data.get('high_feature'),
                'low_id': test_data.get('low_feature')
            }
            for test_id, test_data in ranges.items()
        }
    except Exception as e:
        logger.error(f"Error loading lab ranges {path}: {e}")
        return {}

def get_lab_ranges(base_path: Optional[str] = None) -> Dict[str, Any]:
    """Get lab ranges from config."""
    if base_path is None:
        base_path = str(Path(__file__).parent.parent / "configs" / "lab_ranges.yaml")
    return load_lab_ranges(base_path)

STANDARD_LAB_RANGES = get_lab_ranges()

def load_consolidated_diseases(path: str) -> Dict[str, Any]:
    """Load consolidated disease config."""
    if not path or not os.path.exists(path):
        logger.warning(f"Consolidated diseases config not found: {path}")
        return {}
    return _load_yaml_cached(path, 'diseases')

def load_diseases_all(path: str) -> Dict[str, Any]:
    """
    Load diseases.yaml once and extract all components (priors, lr_store, disease_db).
    This avoids loading the same file three separate times.

    Returns:
        Dictionary with keys: 'priors', 'lr_store', 'disease_db'
    """
    consolidated = load_consolidated_diseases(path)

    if not consolidated or 'diseases' not in consolidated:
        return {'priors': {}, 'lr_store': {}, 'disease_db': {}}

    priors = {}
    for disease_id, disease_data in consolidated['diseases'].items():
        if 'prevalence' in disease_data:
            prev_data = disease_data['prevalence']
            converted = {}
            if 'male' in prev_data:
                converted['MALE'] = prev_data['male']
            if 'female' in prev_data:
                converted['FEMALE'] = prev_data['female']
            if 'default' in prev_data:
                converted['DEFAULT'] = prev_data['default']
            priors[disease_id] = converted

    lr_store = {}
    for disease_id, disease_data in consolidated['diseases'].items():
        lrs = disease_data.get('likelihood_ratios', {})
        for symptom_id, lr_value in lrs.items():
            if symptom_id not in lr_store:
                lr_store[symptom_id] = {}
            lr_store[symptom_id][disease_id] = lr_value

    disease_db = {}
    for disease_id, disease_data in consolidated['diseases'].items():
        disease_db[disease_id] = {
            'full_name': disease_data.get('full_name', disease_id),
            'diagnostic_criteria': disease_data.get('diagnostic_criteria', {}),
            'recommended_tests': disease_data.get('recommended_tests', [])
        }

    return {
        'priors': priors,
        'lr_store': lr_store,
        'disease_db': disease_db
    }

def load_lr_store(path: str) -> Dict[str, Dict[str, float]]:
    """Load likelihood ratios from JSON or consolidated YAML."""
    if not path or not os.path.exists(path): return {}
    try:
        if path.endswith('.yaml') or path.endswith('.yml'):
            consolidated = load_consolidated_diseases(path)
            if 'diseases' in consolidated:
                lr_store = {}
                for disease_id, disease_data in consolidated['diseases'].items():
                    lrs = disease_data.get('likelihood_ratios', {})
                    for symptom_id, lr_value in lrs.items():
                        if symptom_id not in lr_store:
                            lr_store[symptom_id] = {}
                        lr_store[symptom_id][disease_id] = lr_value
                return lr_store
            return {}

        with open(path, "r") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading LR store {path}: {e}")
        return {}

def load_confidence_map(path: str) -> Dict[str, float]:
    if not path or not os.path.exists(path): return {}
    try:
        with open(path, "r") as f:
            return yaml.safe_load(f)
    except Exception:
        return {}

def load_priors_data(path: str) -> Dict[str, Any]:
    """Load disease prevalence data."""
    if not path or not os.path.exists(path): return {}
    try:
        with open(path, "r") as f:
            data = yaml.safe_load(f)

        if 'diseases' in data and '_metadata' in data:
            priors = {}
            for disease_id, disease_data in data['diseases'].items():
                if 'prevalence' in disease_data:
                    prev_data = disease_data['prevalence']
                    converted = {}
                    if 'male' in prev_data:
                        converted['MALE'] = prev_data['male']
                    if 'female' in prev_data:
                        converted['FEMALE'] = prev_data['female']
                    if 'default' in prev_data:
                        converted['DEFAULT'] = prev_data['default']
                    priors[disease_id] = converted
            return priors

        return data
    except Exception as e:
        logger.error(f"Error loading priors {path}: {e}")
        return {}

def load_symptom_tree(path: str) -> Dict[str, Any]:
    if not path or not os.path.exists(path): return {}
    try:
        with open(path, "r") as f:
            return yaml.safe_load(f)
    except Exception:
        return {}

def load_disease_database(path: str) -> Dict[str, Any]:
    """Load disease definitions including recommended tests."""
    if not path or not os.path.exists(path): return {}
    try:
        with open(path, "r") as f:
            data = yaml.safe_load(f)

        if 'diseases' in data and '_metadata' in data:
            disease_db = {}
            for disease_id, disease_data in data['diseases'].items():
                disease_db[disease_id] = {
                    'full_name': disease_data.get('full_name', disease_id),
                    'diagnostic_criteria': disease_data.get('diagnostic_criteria', {}),
                    'recommended_tests': disease_data.get('recommended_tests', [])
                }
            return disease_db

        return data
    except Exception as e:
        logger.error(f"Error loading disease database {path}: {e}")
        return {}

def load_primary_to_branches(path: str) -> dict:
    if not path or not os.path.exists(path): return {}
    try:
        with open(path, "r") as f:
            return yaml.safe_load(f).get("links", {})
    except Exception:
        return {}
