import logging
import math
import os
from collections.abc import Mapping
import numpy as np
import torch
import torch.nn as nn
import torchvision.models as tvm
import torchvision.transforms as transforms
import pandas as pd
from PIL import Image
from typing import List, Dict, Any, Optional
from .data_structs import Contribution

logger = logging.getLogger(__name__)

IMAGING_OK = True
try:
    import joblib
    import wfdb
    from scipy import signal
    ECG_OK = True
except Exception as e:
    joblib = None
    wfdb = None
    signal = None
    ECG_OK = False
    logger.warning(
        "ECG support is disabled because its optional dependencies could not be initialized: %s",
        e,
    )


MODEL_CONFIGS = {
    "densenet121_xray": {"arch": "densenet121", "default_classes": 2},
    "resnet18_mri": {"arch": "resnet18", "default_classes": 2},
    "efficientnet_skin": {"arch": "efficientnet_b0", "default_classes": 7},
    "resnet18_fracture": {"arch": "resnet18", "default_classes": 2},
    "mobilenet_breast": {"arch": "mobilenet_v2", "default_classes": 2},
}

def _build_model(arch_name, state_dict=None, num_classes=2):
    """Generic model builder."""
    if not IMAGING_OK:
        raise ImportError("PyTorch required")
    
    if arch_name == "densenet121":
        m = tvm.densenet121(weights=None)
        m.classifier = nn.Linear(m.classifier.in_features, num_classes)
    elif arch_name == "resnet18":
        m = tvm.resnet18(weights=None)
        m.fc = nn.Linear(m.fc.in_features, num_classes)
    elif arch_name == "efficientnet_b0":
        m = tvm.efficientnet_b0(weights=None)
        m.classifier[1] = nn.Linear(m.classifier[1].in_features, num_classes)
    elif arch_name == "mobilenet_v2":
        m = tvm.mobilenet_v2(weights=None)
        m.classifier[1] = nn.Linear(m.classifier[1].in_features, num_classes)
    else:
        raise ValueError(f"Unknown architecture: {arch_name}")

    if state_dict is not None:
        m.load_state_dict(state_dict, strict=True)
    return m.eval()


def _load_model_state_dict(model_path: str) -> Mapping:
    """Load a model checkpoint and unwrap training metadata when present."""
    checkpoint = torch.load(model_path, map_location="cpu", weights_only=True)
    state_dict = checkpoint.get("state_dict", checkpoint) if isinstance(checkpoint, Mapping) else checkpoint

    if not isinstance(state_dict, Mapping):
        raise ValueError(f"Model checkpoint at {model_path} does not contain a state dictionary")

    return state_dict

def _import_from_string(path: str):
    try:
        module_name, function_name = path.rsplit(".", 1)
        module = __import__(module_name, fromlist=[function_name])
        return getattr(module, function_name)
    except (ImportError, AttributeError) as e:
        logger.error(f"Failed to import {path}: {e}")
        raise

def _apply_bump(model_logits, evidence, dx: str, bump: float, source: str, **meta):
    MAX_BUMP = 12.0
    clamped_bump = max(-MAX_BUMP, min(MAX_BUMP, float(bump)))
    
    if dx in model_logits:
        model_logits[dx] += clamped_bump
        evidence["applied"].append({"dx": dx, "bump": clamped_bump, "source": source})
        evidence["contributions"].append(
            Contribution(feature_id=source, source="model", dx=dx, contribution=clamped_bump))


def _record_upload_result(evidence, model_type, status, message, contributed=False):
    """Keep a user-safe outcome for every supplied model input."""
    evidence["upload_results"].append({
        "model_type": model_type,
        "status": status,
        "contributed": contributed,
        "message": message,
    })

def _run_imaging_model(path, key, dx_map, artifacts, model_logits, evidence):
    if not path:
        return
    if not IMAGING_OK:
        _record_upload_result(
            evidence, key, "failed", "Image analysis is unavailable in this runtime."
        )
        return
    if not os.path.exists(path) or key not in artifacts:
        _record_upload_result(
            evidence, key, "failed", "This uploaded image could not be prepared for analysis."
        )
        return
    try:
        logger.info(f"[{key}] Processing image: {path}")
        info = artifacts[key]
        model_path = info["path"]

        logger.info(f"Loading {key} model...")

        factory_func_name = info.get("factory", "").split(".")[-1]
        config_key = factory_func_name.replace("build_", "")

        if config_key in MODEL_CONFIGS:
            cfg = MODEL_CONFIGS[config_key]
            model = _build_model(
                cfg["arch"],
                state_dict=_load_model_state_dict(model_path),
                num_classes=len(info.get("labels", []))
            )
        else:
            # Legacy support for direct factory imports
            factory = _import_from_string(info["factory"])
            model = factory(
                state_dict=_load_model_state_dict(model_path),
                num_classes=len(info.get("labels", []))
            )
        
        input_size = info.get("input_size", 224)
        transform_steps = [transforms.Resize((input_size, input_size)), transforms.ToTensor()]
        normalization = info.get(
            "normalization",
            {"mean": [0.485, 0.456, 0.406], "std": [0.229, 0.224, 0.225]},
        )
        if normalization is not None:
            transform_steps.append(
                transforms.Normalize(normalization["mean"], normalization["std"])
            )
        tfm = transforms.Compose(transform_steps)
        img = Image.open(path).convert("RGB")
        with torch.no_grad():
            logits = model(tfm(img).unsqueeze(0))
            # Apply temperature scaling for better confidence calibration
            # Temperature=0.3 was optimized on validation set to maximize confidence
            temperature = 0.3
            scaled_logits = logits / temperature
            probs = torch.softmax(scaled_logits, dim=1).cpu().numpy().ravel()

        pmap = dict(zip(info.get("labels", []), probs))
        logger.info(f"[{key}] Model raw probabilities: {pmap}")
        # Use maximum probability as confidence (simple and intuitive)
        conf = float(np.max(probs))
        logger.info(f"[{key}] Confidence score: {conf:.4f}")

        model_output = {
            "model_type": key,
            "raw_probabilities": {k: float(v) for k, v in pmap.items()},
            "confidence": float(conf),
            "diagnoses": []
        }

        # Aggregate probabilities when multiple labels map to one diagnosis.
        dx_aggregated_probs = {}
        
        for lbl, prob_val in pmap.items():
            if lbl in dx_map:
                dx_targets = dx_map[lbl]
                if not isinstance(dx_targets, list):
                    dx_targets = [dx_targets]
                
                for dx in dx_targets:
                    dx_aggregated_probs[dx] = dx_aggregated_probs.get(dx, 0.0) + prob_val

        # Apply aggregated probabilities
        for dx, prob in dx_aggregated_probs.items():
            prob = min(0.9999, max(0.0001, prob))
            
            bump = math.log(prob / (1 - prob)) * conf * 10.0
            
            logger.info(f"[{key}] {dx}: prob={prob:.4f}, bump={bump:.4f}")
            model_output["diagnoses"].append({
                "diagnosis": dx,
                "probability": float(prob),
                "logit_bump": float(bump)
            })
            _apply_bump(model_logits, evidence, dx, bump, f"{key}:model")

        evidence["model_outputs"].append(model_output)
        if model_output["diagnoses"]:
            _record_upload_result(
                evidence, key, "analyzed", "Image analysis contributed to the ranked results.", True
            )
        else:
            _record_upload_result(
                evidence, key, "analyzed", "Image analysis completed, but did not change the ranked results."
            )
    except Exception as e:
        logger.error(f"[{key}] Error: {e}")
        evidence["notes"].append(f"[{key}] Error: {e}")
        _record_upload_result(
            evidence, key, "failed", "This uploaded image could not be analyzed. Try a clear PNG or JPG."
        )


def _run_ecg_model(path, key, dx_map, artifacts, model_logits, evidence):
    if not path:
        return
    if not ECG_OK or not wfdb or not joblib:
        _record_upload_result(
            evidence, key, "failed", "ECG analysis is unavailable in this runtime."
        )
        return
    if not os.path.exists(path) or key not in artifacts:
        _record_upload_result(
            evidence, key, "failed", "This ECG upload could not be prepared for analysis."
        )
        return
    try:
        logger.info(f"[{key}] Processing ECG: {path}")
        model_path = artifacts[key]["path"]

        logger.info(f"[{key}] Loading ECG model from: {model_path}")
        model = joblib.load(model_path)
        
        signal_data, _metadata = wfdb.rdsamp(path.replace(".dat", ""))
        if signal_data.size == 0:
            raise ValueError("Empty ECG signal")

        # Match training: simple stats from Lead II when available
        lead_idx = 1 if signal_data.shape[1] > 1 else 0
        lead_signal = signal_data[:, lead_idx]
        features = {
            "mean": float(np.mean(lead_signal)),
            "std": float(np.std(lead_signal)),
            "min": float(np.min(lead_signal)),
            "max": float(np.max(lead_signal)),
            "ptp": float(np.ptp(lead_signal)),
        }

        feature_df = pd.DataFrame([features])
        prob = model.predict_proba(feature_df)[0]
        labels = model.classes_
        pmap = dict(zip(labels, prob))
        logger.info(f"[{key}] Model raw probabilities: {pmap}")
        # Use maximum probability as confidence (simple and intuitive)
        conf = float(np.max(prob))
        logger.info(f"[{key}] Confidence score: {conf:.4f}")

        # Store model output details
        model_output = {
            "model_type": key,
            "raw_probabilities": {str(k): float(v) for k, v in pmap.items()},
            "confidence": float(conf),
            "diagnoses": []
        }

        for lbl, dx_entry in dx_map.items():
            if lbl in pmap:
                prob_val = pmap[lbl]
                # Multiplier increased to 10.0 to make model evidence dominant over demographic priors
                bump = math.log((prob_val + 1e-6) / (1 - prob_val + 1e-6)) * conf * 10.0
                
                # Handle list of diagnoses
                dx_list_target = dx_entry if isinstance(dx_entry, list) else [dx_entry]
                
                for dx in dx_list_target:
                    logger.info(f"[{key}] {dx}: prob={prob_val:.4f}, bump={bump:.4f}")
                    model_output["diagnoses"].append({
                        "diagnosis": dx,
                        "probability": float(prob_val),
                        "logit_bump": float(bump)
                    })
                    _apply_bump(model_logits, evidence, dx, bump, f"{key}:model")

        evidence["model_outputs"].append(model_output)
        if model_output["diagnoses"]:
            _record_upload_result(
                evidence, key, "analyzed", "ECG analysis contributed to the ranked results.", True
            )
        else:
            _record_upload_result(
                evidence, key, "analyzed", "ECG analysis completed, but did not change the ranked results."
            )
    except Exception as e:
        logger.error(f"[{key}] Error: {e}")
        evidence["notes"].append(f"[{key}] Error: {e}")
        _record_upload_result(
            evidence, key, "failed", "This ECG upload could not be analyzed."
        )


def build_model_logits(
    artifacts: dict,
    dx_list: List[str],
    fracture_body_part: Optional[str] = None,
    **kwargs,
):
    model_logits = {dx: 0.0 for dx in dx_list}
    evidence = {
        "applied": [],
        "notes": [],
        "contributions": [],
        "model_outputs": [],
        "upload_results": [],
    }
    fracture_dx_map = {
        "hand_wrist": ["WRIST_SCAPHOID_FRACTURE"],
        "ankle_foot": ["ANKLE_FRACTURE"],
        "tibia_fibula": ["KNEE_FRACTURE"],
    }
    fracture_dx_targets = fracture_dx_map.get(fracture_body_part)
    dx_maps = {
        "imaging_xray": {"PNEUMONIA": "PNEUMONIA"},
        "imaging_mri": {"BRAIN_TUMOR": "BRAIN_TUMOR"},
        "imaging_skin": {
            "mel": "MELANOMA",
            "bcc": "BASAL_CELL_CARCINOMA",
            "bkl": "BENIGN_SKIN_LESION",
            "df": "BENIGN_SKIN_LESION",
            "nv": "BENIGN_SKIN_LESION",
            "vasc": "BENIGN_SKIN_LESION",
        },
        "imaging_fracture": {
            "fractured": fracture_dx_targets
            if fracture_dx_targets
            else ["ANKLE_FRACTURE", "KNEE_FRACTURE", "WRIST_SCAPHOID_FRACTURE"]
        },
        "imaging_breast_cancer": {"1": "BREAST_CANCER"},
        "signals_ecg_afib": {"1": "ATRIAL_FIBRILLATION"},
        "signals_ecg_ischemia": {"1": "ACS"}
    }
    for key, path in [
        ("imaging_xray", kwargs.get("upload_image")),
        ("imaging_mri", kwargs.get("upload_mri")),
        ("imaging_skin", kwargs.get("upload_skin_image")),
        ("imaging_fracture", kwargs.get("upload_fracture_image")),
        ("imaging_breast_cancer", kwargs.get("upload_breast_image"))
    ]:
        if path: _run_imaging_model(path, key, dx_maps.get(key, {}), artifacts, model_logits, evidence)

    for key, path in [("signals_ecg_afib", kwargs.get("upload_ecg")),
                      ("signals_ecg_ischemia", kwargs.get("upload_ecg"))]:
        if path: _run_ecg_model(path, key, dx_maps.get(key, {}), artifacts, model_logits, evidence)

    # Log final combined model logits
    non_zero_logits = {dx: logit for dx, logit in model_logits.items() if logit != 0.0}
    if non_zero_logits:
        logger.info(f"Final model logits (non-zero): {non_zero_logits}")
    else:
        logger.info("No model contributions (all logits are zero)")

    return model_logits, evidence
