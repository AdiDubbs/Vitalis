# vitalis_engine package
import spacy

from .core import run_case
from .config import (load_config, load_confidence_map, load_disease_database,
                     load_symptom_tree, load_primary_to_branches)
from .probability import get_follow_up_symptoms
from .nlp import extract_features_from_note

# Re-export key functions so they are available at package level
__all__ = [
    'run_case',
    'load_config',
    'load_confidence_map',
    'load_disease_database',
    'load_symptom_tree',
    'load_primary_to_branches',
    'get_follow_up_symptoms',
    'extract_features_from_note',
    'spacy'
]
