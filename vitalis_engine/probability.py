import math
import os
import yaml
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from .data_structs import FeatureEvidence, Contribution

def load_exclusions(base_dir=None):
    if base_dir is None:
        engine_dir = Path(__file__).parent
        base_dir = os.getenv("HEALTH_AI_BASE_DIR", engine_dir.parent)

    path = Path(base_dir) / "configs" / "exclusions.yaml"
    if not path.exists():
        return []
    try:
        with open(path, "r") as f:
            data = yaml.safe_load(f)
            return data.get("exclusions", [])
    except:
        return []

def get_demographic_priors(dx_list, priors_data, age, sex):
    sex_key = sex.upper() if sex and sex.upper() in ["MALE", "FEMALE"] else "DEFAULT"
    age_group = '30-44'
    if age is not None:
        if age <= 4:
            age_group = '0-4'
        elif age <= 17:
            age_group = '5-17'
        elif age <= 29:
            age_group = '18-29'
        elif age <= 44:
            age_group = '30-44'
        elif age <= 64:
            age_group = '45-64'
        else:
            age_group = '65+'

    exclusions = load_exclusions()
    excluded_diseases = set()

    for rule in exclusions:
        dx = rule.get("disease")
        criteria = rule.get("criteria", {})
        
        if "sex" in criteria:
            if criteria["sex"] == sex_key:
                excluded_diseases.add(dx)
        
        if age is not None:
            if "age_lt" in criteria and age < criteria["age_lt"]:
                excluded_diseases.add(dx)
            if "age_gt" in criteria and age > criteria["age_gt"]:
                excluded_diseases.add(dx)

    raw_priors = {}
    default_prev = priors_data.get("DEFAULT_PREVALENCE", 10)

    for dx in dx_list:
        if dx in excluded_diseases:
            raw_priors[dx] = 0.0
            continue

        d_data = priors_data.get(dx, default_prev)
        if isinstance(d_data, (int, float)):
            raw_priors[dx] = d_data
            continue
        if not isinstance(d_data, dict):
            raw_priors[dx] = default_prev
            continue

        sex_data = d_data.get(sex_key, d_data.get("DEFAULT", {}))
        if isinstance(sex_data, (int, float)):
            val = sex_data
        elif isinstance(sex_data, dict):
            val = sex_data.get(age_group, default_prev)
        else:
            val = default_prev
        raw_priors[dx] = val

    total = sum(raw_priors.values())
    if total == 0:
        eligible = [d for d in dx_list if d not in excluded_diseases]
        if not eligible:
            return {d: 0.0 for d in dx_list}
        return {d: (1.0 / len(eligible) if d in eligible else 0.0) for d in dx_list}
    
    return {d: p / total for d, p in raw_priors.items()}

def fuse_probabilities(
        dx_list: List[str],
        priors: Dict[str, float],
        features: List[FeatureEvidence],
        lr_store: Dict[str, Dict[str, float]],
        model_logits: Optional[Dict[str, float]] = None,
        negative_evidence_map: Optional[Dict[str, List[str]]] = None,
        base_dir: Optional[str] = None
) -> Dict[str, Any]:
    model_logits = model_logits or {}
    negative_evidence_map = negative_evidence_map or {}
    EPS = 1e-12
    S = {d: math.log(priors.get(d, 1.0 / len(dx_list)) + EPS) for d in dx_list}
    present_features = {f.feature_id for f in features if f.value}
    contributions = []
    has_positive_feature_support = {d: False for d in dx_list}

    def _adaptive_mandatory_penalty(model_evidence):
        """Return penalty and tag based on model evidence."""
        EVIDENCE_THRESHOLD = 0.0
        BASE_PENALTY = -10.0

        if model_evidence > EVIDENCE_THRESHOLD:
            penalty = 0.0
            tag = "MISSING_MANDATORY_MIN"
        else:
            penalty = BASE_PENALTY
            tag = "MISSING_MANDATORY"

        return penalty, tag

    # Penalize missing symptom likelihoods to downweight mismatched diseases.
    MISSING_SYMPTOM_LR = 0.3
    MISSING_SYMPTOM_PENALTY = math.log(MISSING_SYMPTOM_LR)

    for f in features:
        fid = f.feature_id.lower()
        c = max(0.0, min(1.0, f.confidence))
        fmap = lr_store.get(fid, {})
        for d in dx_list:
            if f.value:
                if d in fmap:
                    LR = fmap[d]
                    if LR <= 0:
                        continue
                    contribution = c * math.log(LR)
                else:
                    contribution = c * MISSING_SYMPTOM_PENALTY
            elif f.value is False:
                if fmap.get(d, 1.0) > 1.0:
                    contribution = -0.5 * c
                else:
                    continue
            else:
                continue

            S[d] += contribution
            contributions.append(Contribution(feature_id=fid, source="feature", dx=d, contribution=contribution))
            if contribution > 0:
                has_positive_feature_support[d] = True

    has_any_present_feature = any(f.value for f in features)
    if has_any_present_feature:
        NO_SYMPTOM_SUPPORT_PENALTY = -3.0
        for d in dx_list:
            if not has_positive_feature_support.get(d, False):
                S[d] += NO_SYMPTOM_SUPPORT_PENALTY
                contributions.append(
                    Contribution(
                        feature_id="no_symptom_support",
                        source="constraint",
                        dx=d,
                        contribution=NO_SYMPTOM_SUPPORT_PENALTY,
                    )
                )

    for d in dx_list:
        required_symptoms = negative_evidence_map.get(d, [])
        if required_symptoms:
            has_mandatory = any(req in present_features for req in required_symptoms)
            if not has_mandatory:
                model_evidence = model_logits.get(d, 0.0)
                penalty, penalty_tag = _adaptive_mandatory_penalty(model_evidence)
                contributions.append(
                    Contribution(
                        feature_id=penalty_tag,
                        source="constraint",
                        dx=d,
                        contribution=penalty,
                    )
                )
                S[d] += penalty

    for d, add in model_logits.items():
        if d in S:
            S[d] += float(add)
            contributions.append(Contribution(feature_id="model_logits", source="model", dx=d, contribution=add))

    m = max(S.values())
    exps = {d: math.exp(S[d] - m) for d in dx_list}
    Z = sum(exps.values()) + EPS
    probs = {d: exps[d] / Z for d in dx_list}

    return {"probs": probs, "contributions": contributions}

def analyze_feature_contributions_per_diagnosis(contributions, dx_list, top_n=5):
    """
    Analyze which features strongly support or oppose each diagnosis.

    Returns:
        Dictionary mapping disease -> {
            'supporting': [(feature_id, contribution), ...],
            'opposing': [(feature_id, contribution), ...]
        }
    """
    dx_contributions = {dx: {'supporting': [], 'opposing': []} for dx in dx_list}

    for contrib in contributions:
        dx = contrib.dx
        if dx not in dx_contributions:
            continue

        # Skip certain meta-contributions for clarity
        if contrib.feature_id in [
            "MISSING_MANDATORY",
            "MISSING_MANDATORY_SOFT",
            "MISSING_MANDATORY_REDUCED",
            "MISSING_MANDATORY_MIN",
            "model_logits",
        ]:
            continue

        # Categorize as supporting (positive) or opposing (negative)
        if contrib.contribution > 0.05:  # Threshold for significance
            dx_contributions[dx]['supporting'].append((contrib.feature_id, contrib.contribution, contrib.source))
        elif contrib.contribution < -0.05:
            dx_contributions[dx]['opposing'].append((contrib.feature_id, abs(contrib.contribution), contrib.source))

    # Sort and limit to top_n
    for dx in dx_contributions:
        dx_contributions[dx]['supporting'] = sorted(
            dx_contributions[dx]['supporting'],
            key=lambda x: x[1],
            reverse=True
        )[:top_n]

        dx_contributions[dx]['opposing'] = sorted(
            dx_contributions[dx]['opposing'],
            key=lambda x: x[1],
            reverse=True
        )[:top_n]

    return dx_contributions

def get_follow_up_symptoms(selected, conf_map, tree, branches):
    follow = set()
    if branches:
        for s in selected:
            link = branches.get(s.lower(), {})
            for fid in link.get("suggest_features", []):
                if fid not in selected: follow.add(fid)
            for sec in link.get("sections", []):
                for section in tree.get("sections", []):
                    if section.get("title") == sec:
                        for node in section.get("nodes", []):
                            fid = node.get("feature_id")
                            if fid and fid not in selected and conf_map.get(fid, 0) > 0.75:
                                follow.add(fid)
    return sorted(follow, key=lambda x: conf_map.get(x, 0), reverse=True)
