import os
import math
import json
import spacy
from typing import Dict, Any, Optional
from pathlib import Path
from datetime import datetime, timezone

from .data_structs import FeatureEvidence
from .config import (load_config, load_system_config, load_priors_data, load_lr_store,
                     load_confidence_map, load_disease_database, load_symptom_tree,
                     load_primary_to_branches, load_consolidated_diseases, load_diseases_all)
from .nlp import extract_features_from_note
from .probability import (
    get_demographic_priors,
    fuse_probabilities,
    analyze_feature_contributions_per_diagnosis,
    get_follow_up_symptoms,
)
from .inference import build_model_logits
from .heuristics import evaluate_red_flags

def _validate_inputs(age: Optional[int], sex: Optional[str]) -> None:
    """Validate age/sex inputs for range and supported values."""
    if age is not None:
        if not isinstance(age, (int, float)):
            raise ValueError(f"Age must be a number, got {type(age).__name__}")
        if age < 0 or age > 120:
            raise ValueError(f"Age must be between 0 and 120, got {age}")

    if sex is not None:
        valid_sex = ["MALE", "FEMALE", "M", "F", "male", "female", "m", "f"]
        if sex not in valid_sex:
            raise ValueError(f"Sex must be one of {valid_sex}, got '{sex}'")

def run_case(
        *,
        features: Optional[Dict[str, Any]] = None,
        doctor_note: Optional[str] = None,
        lab_pdf_text: Optional[str] = None,
        age: Optional[int] = None,
        sex: Optional[str] = None,
        upload_image: Optional[str] = None,
        upload_mri: Optional[str] = None,
        upload_skin_image: Optional[str] = None,
        upload_fracture_image: Optional[str] = None,
        upload_breast_image: Optional[str] = None,
        upload_ecg: Optional[str] = None,
        fracture_body_part: Optional[str] = None,
        **kwargs
) -> Dict[str, Any]:
    _validate_inputs(age, sex)

    engine_dir = Path(__file__).parent
    base_dir = os.getenv("HEALTH_AI_BASE_DIR", engine_dir.parent)

    system_config = load_system_config(str(Path(base_dir) / "configs" / "system.yaml"))
    dx_list = system_config.get("dx_list", [])
    negative_map = system_config.get("dx_negative_evidence_map", {})
    runtime_cfg = system_config.get("runtime", {}) or {}

    mpath = Path(base_dir) / "models" / "manifest.json"
    try:
        with open(mpath, "r") as f:
            artifacts = json.load(f).get("artifacts", {})
    except:
        artifacts = {}

    diseases_path = str(Path(base_dir) / "configs" / "diseases.yaml")
    disease_data = load_diseases_all(diseases_path)
    priors = disease_data['priors']
    lr_store = disease_data['lr_store']
    disease_db = disease_data['disease_db']

    confidence_map_path = runtime_cfg.get("confidence_map_path", "configs/confidence_map.yaml")
    confidence_map = load_confidence_map(str(Path(base_dir) / confidence_map_path))

    symptom_tree_path = runtime_cfg.get("symptom_tree_path", "configs/symptom_tree_expanded.yaml")
    symptom_tree = load_symptom_tree(str(Path(base_dir) / symptom_tree_path))

    branches_path = runtime_cfg.get("primary_to_branches_path", "configs/primary_to_branches.yaml")
    branches = load_primary_to_branches(str(Path(base_dir) / branches_path))

    combined_text = (doctor_note or "") + "\n" + (lab_pdf_text or "")
    nlp_model = None
    try:
        nlp_model = spacy.load("en_core_web_sm", disable=["parser", "ner"])
    except:
        pass
    extracted = extract_features_from_note(combined_text, nlp_model)
    features = features or {}
    features.update(extracted)

    priors = get_demographic_priors(dx_list, priors, age, sex)
    ev_list = []
    ts = datetime.now(timezone.utc).isoformat()
    for fid, val in features.items():
        if val:
            ev_list.append(FeatureEvidence(str(fid), "intake", True, confidence_map.get(fid, 0.7), ts))
    selected_features = [str(fid) for fid, val in features.items() if val]
    follow_up_symptoms = get_follow_up_symptoms(selected_features, confidence_map, symptom_tree, branches)

    logits, ev_meta = build_model_logits(artifacts, dx_list, upload_image=upload_image, upload_mri=upload_mri,
                                         upload_skin_image=upload_skin_image,
                                         upload_fracture_image=upload_fracture_image,
                                         upload_breast_image=upload_breast_image, upload_ecg=upload_ecg,
                                         fracture_body_part=fracture_body_part)

    fusion = fuse_probabilities(dx_list, priors, ev_list, lr_store, logits, negative_map, base_dir=str(base_dir))

    feature_explanations = analyze_feature_contributions_per_diagnosis(
        fusion["contributions"],
        dx_list,
        top_n=5
    )

    red_flags = evaluate_red_flags(features, str(base_dir))

    cis = {}
    for dx, prob in fusion["probs"].items():
        se = math.sqrt(prob * (1 - prob) / 1000)
        cis[dx] = (max(0, prob - 1.96 * se), min(1, prob + 1.96 * se))

    return {
        "fused_probabilities": fusion["probs"],
        "contributions": fusion["contributions"],
        "feature_explanations": feature_explanations,
        "confidence_intervals": cis,
        "active_symptoms": list(features.keys()),
        "follow_up_symptoms": follow_up_symptoms,
        "disease_db": disease_db,
        "extracted_features": features,
        "red_flags": red_flags,
        "model_outputs": ev_meta.get("model_outputs", [])
    }
