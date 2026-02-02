import re
import logging
import spacy
from typing import Dict, Any, Optional
from .config import STANDARD_LAB_RANGES

logger = logging.getLogger(__name__)

try:
    from pypdf import PdfReader
    PDF_OK = True
except ImportError:
    PDF_OK = False
    logging.warning("pypdf not installed. PDF parsing will be disabled. (pip install pypdf)")

def extract_text_from_pdf(pdf_path: str) -> str:
    """Return raw text from a PDF."""
    if not PDF_OK: return ""
    try:
        reader = PdfReader(pdf_path)
        text = ""
        for page in reader.pages: text += page.extract_text() + "\n"
        return text
    except Exception as e:
        logger.error(f"Failed to read PDF {pdf_path}: {e}")
        return ""

def parse_lab_values(text: str) -> Dict[str, bool]:
    """Scan text for lab values and map them to features."""
    detected_features = {}
    text = text.lower().replace("\n", " ")

    num = r"([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)"
    patterns = {
        "wbc": [rf"total leukocyte count\s*[:\-]?\s+{num}", rf"tlc\s*[:\-]?\s+{num}", rf"wbc\s*[:\-]?\s+{num}"],
        "hemoglobin": [rf"hemoglobin\s*[:\-]?\s+{num}", rf"hb\s*[:\-]?\s+{num}"],
        "platelets": [rf"platelet count\s*[:\-]?\s+{num}"],
        "esr": [rf"e\.s\.r\.\s*[:\-]?\s+{num}"],
        "ast": [rf"ast\s*\(sgot\)\s*[:\-]?\s+{num}", rf"sgot\s*[:\-]?\s+{num}"],
        "alt": [rf"alt\s*\(sgpt\)\s*[:\-]?\s+{num}", rf"sgpt\s*[:\-]?\s+{num}"],
        "alp": [rf"alkaline phosphatase\s*[:\-]?\s+{num}", rf"alp\s*[:\-]?\s+{num}"],
        "bilirubin_total": [rf"bilirubin total\s*[:\-]?\s+{num}"],
        "albumin": [rf"albumin\s*[:\-]?\s+{num}"],
        "creatinine": [rf"creatinine\s*[:\-]?\s+{num}"],
        "urea": [rf"urea\s*[:\-]?\s+{num}"],
        "uric_acid": [rf"uric acid\s*[:\-]?\s+{num}"],
        "calcium": [rf"calcium, total\s*[:\-]?\s+{num}"],
        "hba1c": [rf"hba1c\s*[:\-]?\s+{num}"],
        "glucose_fasting": [rf"glucose, fasting\s*[:\-]?\s+{num}"],
        "tsh": [rf"tsh\s*[:\-]?\s+{num}"],
        "psa": [rf"psa, total\s*[:\-]?\s+{num}"],
        "vitamin_b12": [rf"vitamin b12\s*[:\-]?\s+{num}"],
        "vitamin_d": [rf"vitamin d\s*[:\-]?\s+{num}"],
        "iron": [rf"iron\s*[:\-]?\s+{num}"],
        "cholesterol_total": [rf"cholesterol, total\s*[:\-]?\s+{num}"],
        "triglycerides": [rf"triglycerides\s*[:\-]?\s+{num}"],
        "ldl": [rf"ldl cholesterol\s*[:\-]?\s+{num}"],
        "hscrp": [rf"c-reactive protein\s*[:\-]?\s+{num}"],
        "amylase": [rf"amylase\s*[:\-]?\s+{num}"],
        "lipase": [rf"lipase\s*[:\-]?\s+{num}"],
        "magnesium": [rf"magnesium\s*[:\-]?\s+{num}"],
        "rheumatoid_factor": [rf"rheumatoid factor\s*[:\-]?\s+{num}", rf"ra factor\s*[:\-]?\s+{num}"],
        "ana": [rf"antinuclear antibody\s*[:\-]?\s+{num}", rf"ana titer\s*[:\-]?\s+{num}"]
    }

    for lab_name, regex_list in patterns.items():
        for pattern in regex_list:
            matches = list(re.finditer(pattern, text))
            if matches:
                try:
                    value_str = matches[-1].group(1).replace(",", "")
                    value = float(value_str)
                    ref = STANDARD_LAB_RANGES.get(lab_name)
                    if ref:
                        if value > ref["max"] * 100:
                            value /= 1000.0

                        if ref["high_id"] and value > ref["max"]:
                            detected_features[ref["high_id"]] = True
                            logger.info(f"Lab Parser: High {lab_name} ({value}) -> {ref['high_id']}")
                        if ref["low_id"] and value < ref["min"]:
                            detected_features[ref["low_id"]] = True
                            logger.info(f"Lab Parser: Low {lab_name} ({value}) -> {ref['low_id']}")
                except ValueError:
                    continue
    return detected_features


def _is_negated(text: str, match_start: int, match_end: int) -> bool:
    """Return True if the mention is negated within sentence context."""
    sentence_breaks = ".!?\n"
    sent_start = max(text.rfind(ch, 0, match_start) for ch in sentence_breaks) + 1
    sent_end_candidates = [text.find(ch, match_end) for ch in sentence_breaks]
    sent_end_candidates = [i for i in sent_end_candidates if i != -1]
    sent_end = min(sent_end_candidates) if sent_end_candidates else len(text)
    sentence = text[sent_start:sent_end]

    local_start = max(0, match_start - sent_start)
    local_end = max(0, match_end - sent_start)
    context_window = 50
    pre_context = sentence[max(0, local_start - context_window):local_start]
    post_context = sentence[local_end:min(len(sentence), local_end + 15)]

    negation_before = [
        r'\bno\b', r'\bdeny\b', r'\bdenies\b', r'\bdenied\b',
        r'\bwithout\b', r'\babsent\b', r'\bnegative for\b', r'\bfree of\b',
        r'\bno evidence of\b', r'\bno sign of\b', r'\bno complaint of\b',
        r'\brules? out\b', r'\br/o\b'  # "rule out" or "r/o"
    ]

    negation_after = [
        r'^-free\b', r'^\s+absent\b', r'^\s+negative\b', r'^\s+denied\b',
        r'^\s+is\s+not\b'  # "cough is not productive"
    ]

    if re.search(r'\bnot\b', pre_context[-10:]):
        logger.debug(f"Negation 'not' detected directly before: '{pre_context[-10:]}'")
        return True

    for neg_pattern in negation_before:
        if re.search(neg_pattern, pre_context):
            logger.debug(f"Negation detected before: '{pre_context}'")
            return True

    for neg_pattern in negation_after:
        if re.search(neg_pattern, post_context):
            logger.debug(f"Negation detected after: '{post_context}'")
            return True

    return False


def _is_family_history(text: str, match_start: int, match_end: int) -> bool:
    """Return True if the mention is in family-history context."""
    pre_context = text[max(0, match_start - 80):match_start]

    if re.search(r'\bpatient\b', pre_context[-50:]):
        return False

    family_patterns = [
        r'\bfamily history of\b', r'\bfh:\s*\w+\s+with\b',
        r'\b(mother|father|sister|brother|parent|grandmother|grandfather)\s+(had|has|with)\b',
    ]

    for fh_pattern in family_patterns:
        if re.search(fh_pattern, pre_context):
            logger.debug(f"Family history detected in context: '{pre_context[-60:]}'")
            return True

    return False


def extract_features_from_note(note: Optional[str], nlp_model: Optional[spacy.language.Language] = None) -> Dict[str, Any]:
    if not note: return {}

    features = {}

    lab_features = parse_lab_values(note)
    features.update(lab_features)

    symptom_map = {
        "chest pain": "sym_chest_pain",
        "cough": "sym_cough",
        "fever": "fever",
        "shortness of breath": "sym_shortness_of_breath",
        "fatigue": "fatigue",
        "headache": "sym_headache",
        "dizziness": "dizziness",
        "nausea": "sym_nausea_vomiting",
        "vomiting": "sym_vomiting",
        "weakness": "unilateral_weakness",
        "swelling": "leg_swelling",
        "palpitations": "sym_palpitations",
        "hemoptysis": "hemoptysis",
        "dysuria": "sym_dysuria",
        "breast lump": "breast_lump",
        "rectal bleeding": "rectal_bleeding",
        "seizures": "seizures",
        "wheezing": "wheezing",
        "pleuritic pain": "pleuritic_pain",
        "diaphoresis": "diaphoresis",
        "exertional": "exertional",
        "rlq pain": "rlq_pain",
        "llq pain": "llq_pain",
        "abdominal pain": "sym_abdominal_pain",
        "heartburn": "heartburn",
        "dark urine": "dark_urine",
        "sore throat": "pharyngitis",
        "runny nose": "runny_nose",
        "sneezing": "sneezing",
        "loss of smell": "loss_of_smell_taste",
        "weight loss": "sym_weight_loss",
        "weight gain": "sym_weight_gain",
        "night sweats": "sym_night_sweats",
        "anorexia": "anorexia",
        "loss of appetite": "anorexia",
        "productive cough": "productive_cough",
        "dry cough": "dry_cough",
        "jaundice": "sym_jaundice",
        "diarrhea": "sym_diarrhea",
        "constipation": "sym_constipation",
        "bradycardia": "bradycardia",
        "facial pain": "facial_pain",
        "sinus pain": "facial_pain",
        "ear pain": "ear_pain",
        "stiff neck": "stiff_neck",
        "photophobia": "sensitivity_light",
        "cold intolerance": "cold_intolerance_hashi",
        "feeling cold": "cold_intolerance_hashi",
        # Fallback Keywords if regex misses
        "high wbc": "wbc_high", "leukocytosis": "wbc_high", "anemia": "microcytic_anemia",
        "low hemoglobin": "microcytic_anemia", "low iron": "low_ferritin",
        "high troponin": "troponin_highly_elevated", "kidney failure": "egfr_low",
        "blood in urine": "hematuria", "st elevation": "ecg_st_elevation",
        "positive flu": "lab_flu_test_positive", "high tsh": "tsh_high", "low tsh": "tsh_low",
        "positive monospot": "lab_monospot_positive",
        "high amylase": "amylase_high",
        "elevated amylase": "amylase_high",
        "high lipase": "lipase_high",
        "elevated lipase": "lipase_high",
        "pancreatitis markers": "lipase_high",
        "positive rf": "rheumatoid_factor_positive",
        "high rheumatoid factor": "rheumatoid_factor_positive",
        "positive ana": "ana_positive",
        "autoimmune markers": "ana_positive",
        "low magnesium": "hypomagnesemia",
        "high magnesium": "hypermagnesemia"
    }

    text = note.lower()

    for phrase, fid in symptom_map.items():
        # Create regex pattern with word boundaries
        # Replace spaces with \s+ to match any whitespace
        pattern = r'\b' + re.escape(phrase).replace(r'\ ', r'\s+') + r'\b'

        # Search for all matches
        for match in re.finditer(pattern, text, re.IGNORECASE):
            match_start = match.start()
            match_end = match.end()

            # Skip if negated
            if _is_negated(text, match_start, match_end):
                logger.debug(f"Skipping negated symptom: {phrase}")
                continue

            # Skip if family history
            if _is_family_history(text, match_start, match_end):
                logger.debug(f"Skipping family history mention: {phrase}")
                continue

            # Valid symptom found
            features[fid] = True
            logger.info(f"Extracted symptom: {phrase} -> {fid}")
            break  # Only need to find it once

    return features
