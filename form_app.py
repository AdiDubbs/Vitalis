from flask import Flask, render_template, request, jsonify, send_from_directory, session
import json
import os
import shutil
import yaml
from pathlib import Path
from typing import Any, Dict, List, Tuple
from uuid import UUID, uuid4
from werkzeug.utils import secure_filename

from vitalis_engine import load_confidence_map, load_symptom_tree, load_primary_to_branches, get_follow_up_symptoms, extract_features_from_note, \
    spacy, run_case, load_disease_database

BASE_DIR = Path(__file__).resolve().parent
CASE_STORAGE_ROOT = BASE_DIR / "cases"
SESSION_CASE_LIMIT = 20

INTAKE_SCHEMA = {
    "age": {"min": 0, "max": 120},
    "sex": {
        "options": [
            {"value": "MALE", "label": "Male"},
            {"value": "FEMALE", "label": "Female"},
        ]
    },
    "symptoms": {"max_items": 50},
    "doctor_note": {"max_length": 10000},
    "uploads": {
        "doctor_note_upload": {
            "label": "Clinical note or transcript",
            "category": "Medical history",
            "extensions": [".txt"],
            "formats": "TXT",
            "max_size": 1024 * 1024,
        },
        "upload_image": {
            "label": "Chest X-Ray",
            "category": "Radiology",
            "extensions": [".png", ".jpg", ".jpeg"],
            "formats": "PNG, JPG",
            "max_size": 50 * 1024 * 1024,
        },
        "upload_mri": {
            "label": "Brain MRI",
            "category": "Radiology",
            "extensions": [".png", ".jpg", ".jpeg"],
            "formats": "PNG, JPG",
            "max_size": 50 * 1024 * 1024,
        },
        "upload_fracture": {
            "label": "Fracture Image",
            "category": "Radiology",
            "extensions": [".png", ".jpg", ".jpeg"],
            "formats": "PNG, JPG",
            "max_size": 50 * 1024 * 1024,
        },
        "upload_breast": {
            "label": "Breast Image",
            "category": "Radiology",
            "extensions": [".png", ".jpg", ".jpeg"],
            "formats": "PNG, JPG",
            "max_size": 50 * 1024 * 1024,
        },
        "upload_skin": {
            "label": "Skin Image",
            "category": "Dermatology",
            "extensions": [".png", ".jpg", ".jpeg"],
            "formats": "PNG, JPG",
            "max_size": 20 * 1024 * 1024,
        },
    },
    "fracture_body_part": {
        "options": [
            {"value": "hand_wrist", "label": "Hand / Wrist"},
            {"value": "ankle_foot", "label": "Ankle / Foot"},
            {"value": "tibia_fibula", "label": "Tibia / Fibula"},
        ]
    },
}

FILE_MAPPING = {
    'upload_image': 'upload_image',
    'upload_mri': 'upload_mri',
    'upload_skin': 'upload_skin_image',
    'upload_fracture': 'upload_fracture_image',
    'upload_breast': 'upload_breast_image',
}

app = Flask(__name__, static_folder="frontend/dist", static_url_path="")
app.config.update(
    CASE_STORAGE_ROOT=CASE_STORAGE_ROOT,
    # A deployment must provide a stable secret so existing signed sessions survive restarts.
    SECRET_KEY=os.environ.get("VITALIS_SESSION_SECRET") or os.urandom(32),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.environ.get("VITALIS_COOKIE_SECURE", "").lower() == "true",
)


def _create_case_directory() -> Tuple[str, Path]:
    """Create a private, unguessable directory for a single in-flight case."""
    case_id = str(uuid4())
    case_root = Path(app.config["CASE_STORAGE_ROOT"])
    case_root.mkdir(mode=0o700, parents=True, exist_ok=True)
    case_root.chmod(0o700)

    case_dir = case_root / case_id
    case_dir.mkdir(mode=0o700)
    case_dir.chmod(0o700)
    return case_id, case_dir


def _write_case_result(case_dir: Path, case_data: Dict[str, Any]) -> None:
    """Persist the minimum result payload with owner-only filesystem permissions."""
    result_path = case_dir / "result.json"
    descriptor = os.open(result_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as result_file:
        json.dump(case_data, result_file, indent=2)


def _grant_case_access(case_id: str) -> None:
    """Bind saved-case retrieval to the browser session that created the case."""
    case_ids = [saved_id for saved_id in session.get("case_ids", []) if saved_id != case_id]
    session["case_ids"] = (case_ids + [case_id])[-SESSION_CASE_LIMIT:]


def _private_json(payload: Dict[str, Any], status: int = 200):
    response = jsonify(payload)
    response.status_code = status
    response.headers["Cache-Control"] = "no-store"
    return response


def _health_checks() -> Dict[str, Any]:
    """Verify the files required for the currently exposed intake flow."""
    config_paths = [
        BASE_DIR / "configs" / "system.yaml",
        BASE_DIR / "configs" / "diseases.yaml",
        BASE_DIR / "configs" / "confidence_map.yaml",
        BASE_DIR / "configs" / "symptom_tree_expanded.yaml",
        BASE_DIR / "configs" / "primary_to_branches.yaml",
    ]
    missing_config = [str(path.relative_to(BASE_DIR)) for path in config_paths if not path.is_file()]

    manifest_path = BASE_DIR / "models" / "manifest.json"
    required_artifact_keys = {
        "imaging_xray",
        "imaging_mri",
        "imaging_skin",
        "imaging_fracture",
        "imaging_breast_cancer",
    }
    missing_artifact_keys = []
    missing_model_files = []
    manifest_ok = manifest_path.is_file()
    if manifest_ok:
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            artifacts = manifest.get("artifacts", {})
            missing_artifact_keys = sorted(required_artifact_keys - set(artifacts))
            missing_model_files = sorted(
                artifact["path"]
                for key, artifact in artifacts.items()
                if key in required_artifact_keys
                and (not artifact.get("path") or not (BASE_DIR / artifact["path"]).is_file())
            )
        except (OSError, json.JSONDecodeError):
            manifest_ok = False

    return {
        "configuration": {"ok": not missing_config, "missing": missing_config},
        "model_manifest": {
            "ok": manifest_ok and not missing_artifact_keys,
            "missing_artifacts": missing_artifact_keys,
        },
        "model_files": {"ok": not missing_model_files, "missing": missing_model_files},
    }


def frontend_ready():
    if not app.static_folder:
        return False
    return (Path(app.static_folder) / "index.html").exists()


@app.route('/api/health', methods=['GET'])
def health_route():
    """Report whether the current backend can serve supported intake modes."""
    checks = _health_checks()
    is_healthy = all(check["ok"] for check in checks.values())
    status_code = 200 if is_healthy else 503
    return jsonify({
        "status": "ok" if is_healthy else "unhealthy",
        "checks": checks,
    }), status_code


def _file_size(file_storage) -> int:
    """Return a stream's size without consuming it for a later save."""
    stream = file_storage.stream
    current_position = stream.tell()
    stream.seek(0, os.SEEK_END)
    size = stream.tell()
    stream.seek(current_position)
    return size


def _known_symptom_ids() -> set:
    symptom_data = load_symptoms_from_tree()
    symptom_ids = {
        symptom["id"]
        for symptoms in symptom_data.get("buckets", {}).values()
        for symptom in symptoms
        if symptom.get("id")
    }
    symptom_ids.update(
        symptom["id"]
        for symptom in symptom_data.get("redFlags", [])
        if symptom.get("id")
    )
    return symptom_ids


def _validate_submission(form_data, files) -> Tuple[Dict[str, Any], Dict[str, str]]:
    """Validate all request inputs before writing uploads or running inference."""
    errors: Dict[str, str] = {}

    raw_age = (form_data.get("age") or "").strip()
    age = None
    if raw_age:
        try:
            age = int(raw_age)
        except ValueError:
            errors["age"] = "Age must be a whole number."
        else:
            age_rules = INTAKE_SCHEMA["age"]
            if not age_rules["min"] <= age <= age_rules["max"]:
                errors["age"] = (
                    f"Age must be between {age_rules['min']} and {age_rules['max']}."
                )

    sex = (form_data.get("sex") or "").strip()
    allowed_sex = {option["value"] for option in INTAKE_SCHEMA["sex"]["options"]}
    if sex and sex not in allowed_sex:
        errors["sex"] = "Select either Male or Female."

    raw_symptoms = form_data.get("symptoms")
    symptoms: List[str] = []
    if raw_symptoms is None:
        errors["symptoms"] = "Symptoms must be provided as a list."
    else:
        try:
            parsed_symptoms = json.loads(raw_symptoms)
        except json.JSONDecodeError:
            errors["symptoms"] = "Symptoms must be a valid JSON list."
        else:
            if not isinstance(parsed_symptoms, list) or not all(
                isinstance(symptom, str) and symptom for symptom in parsed_symptoms
            ):
                errors["symptoms"] = "Symptoms must be a list of symptom identifiers."
            elif len(parsed_symptoms) > INTAKE_SCHEMA["symptoms"]["max_items"]:
                errors["symptoms"] = (
                    f"Select at most {INTAKE_SCHEMA['symptoms']['max_items']} symptoms."
                )
            elif len(parsed_symptoms) != len(set(parsed_symptoms)):
                errors["symptoms"] = "Each symptom may only be selected once."
            else:
                unknown_symptoms = sorted(set(parsed_symptoms) - _known_symptom_ids())
                if unknown_symptoms:
                    errors["symptoms"] = "One or more selected symptoms are not recognized."
                else:
                    symptoms = parsed_symptoms

    doctor_note = form_data.get("doctor_note") or ""
    if len(doctor_note) > INTAKE_SCHEMA["doctor_note"]["max_length"]:
        errors["doctor_note"] = (
            f"Clinical notes must be at most {INTAKE_SCHEMA['doctor_note']['max_length']} characters."
        )

    validated_files = {}
    upload_rules = INTAKE_SCHEMA["uploads"]
    for field_name in files:
        field_files = files.getlist(field_name)
        if field_name not in upload_rules:
            errors[field_name] = "This upload field is not supported."
            continue
        if len(field_files) != 1:
            errors[field_name] = "Upload exactly one file for this field."
            continue

        uploaded_file = field_files[0]
        filename = secure_filename(uploaded_file.filename or "")
        if not filename:
            errors[field_name] = "Choose a file to upload."
            continue

        rule = upload_rules[field_name]
        extension = Path(filename).suffix.lower()
        if extension not in rule["extensions"]:
            errors[field_name] = f"Supported formats: {rule['formats']}."
            continue

        if _file_size(uploaded_file) > rule["max_size"]:
            max_size_mb = rule["max_size"] // (1024 * 1024)
            errors[field_name] = f"File must be no larger than {max_size_mb}MB."
            continue

        if field_name == "doctor_note_upload":
            try:
                uploaded_file.stream.seek(0)
                uploaded_file.stream.read().decode("utf-8")
            except UnicodeDecodeError:
                errors[field_name] = "Clinical note files must use UTF-8 text."
                continue
            finally:
                uploaded_file.stream.seek(0)

        validated_files[field_name] = uploaded_file

    fracture_body_part = (form_data.get("fracture_body_part") or "").strip()
    allowed_body_parts = {
        option["value"]
        for option in INTAKE_SCHEMA["fracture_body_part"]["options"]
    }
    has_fracture_upload = "upload_fracture" in validated_files
    if fracture_body_part and fracture_body_part not in allowed_body_parts:
        errors["fracture_body_part"] = "Select a supported fracture body part."
    elif fracture_body_part and not has_fracture_upload:
        errors["fracture_body_part"] = "Upload a fracture image before selecting a body part."
    elif has_fracture_upload and not fracture_body_part:
        errors["fracture_body_part"] = "Select the body part shown in the fracture image."

    return {
        "age": age,
        "sex": sex or None,
        "symptoms": symptoms,
        "doctor_note": doctor_note,
        "fracture_body_part": fracture_body_part or None,
        "files": validated_files,
    }, errors


def load_symptoms_from_tree():
    """Load symptoms grouped by section for UI buckets."""
    base_dir = Path(__file__).parent
    symptom_tree_path = base_dir / "configs" / "symptom_tree_expanded.yaml"

    SECTION_TO_BUCKET = {
        "General & Constitutional": "General",
        "Respiratory": "Respiratory",
        "ENT (Ear, Nose, Throat) & Eyes": "ENT",
        "Cardiovascular": "Cardiology",
        "Gastrointestinal / Hepatic": "Digestion",
        "Head & Balance": "Neurology",
        "Nerves & Brain Function": "Neurology",
        "Mental Health & Sleep": "Mental Health",
        "Endocrine / Renal / GU": "SPLIT",
        "Injuries & Trauma": "Acute Injuries",
        "Chronic Joint & Back Pain": "Chronic Joint Pain",
        "Cancer — Alarm Features": None,
        "Skin": "Skin & Appearance",
        "Physical Exam": "Physical Exam",
        "Lab Results": "Lab Results",
    }

    BUCKET_ORDER = [
        "General",
        "Respiratory",
        "ENT",
        "Digestion",
        "Neurology",
        "Mental Health",
        "Cardiology",
        "Urinary",
        "Acute Injuries",
        "Chronic Joint Pain",
        "Women's Health",
        "Skin & Appearance",
        "Physical Exam",
        "Lab Results",
    ]

    URINARY_SYMPTOMS = {
        "polyuria", "polydipsia", "sym_dysuria", "sym_urinary_frequency",
        "sym_flank_pain"
    }

    WOMENS_HEALTH_SYMPTOMS = {
        "irregular_menses_pcos", "hirsutism_pcos", "dyspareunia_endo",
        "dysmenorrhea_endo"
    }

    ENERGY_SYMPTOMS = {
        "cold_intolerance_hashi", "heat_intolerance_graves"
    }

    RED_FLAG_ROUTING = {
        "persistent_cough_gt_3w": "Respiratory",
        "change_bowel_habit": "Digestion",
        "rectal_bleeding": "Digestion",
        "iron_deficiency_anemia": "Lab Results",
        "breast_lump": "Women's Health",
        "nipple_discharge": "Women's Health",
        "skin_dimpling_breast": "Women's Health",
        "axillary_lymphadenopathy": "Women's Health",
        "psa_high": "Urinary",
        "nocturia_ckd": "Urinary",
        "palpable_lymphadenopathy": "General",
        "unexplained_weight_loss": "General",
    }

    buckets = {}
    for bucket in BUCKET_ORDER:
        buckets[bucket] = []

    red_flags = []

    def add_symptom_to_bucket(bucket_spec, symptom_obj):
        if bucket_spec in buckets:
            buckets[bucket_spec].append(symptom_obj)

    with open(symptom_tree_path, 'r') as f:
        symptom_tree = yaml.safe_load(f)
        for section in symptom_tree.get('sections', []):
            section_title = section.get('title', 'Uncategorized')
            bucket_spec = SECTION_TO_BUCKET.get(section_title, "General")

            for node in section.get('nodes', []):
                symptom = {
                    'id': node.get('feature_id'),
                    'text': node.get('text')
                }

                if bucket_spec is None:
                    red_flags.append(symptom)
                    target_spec = RED_FLAG_ROUTING.get(symptom['id'], "General")
                    add_symptom_to_bucket(target_spec, symptom)

                elif bucket_spec == "SPLIT":
                    target_spec = None

                    if section_title == "Endocrine / Renal / GU":
                        if symptom['id'] in WOMENS_HEALTH_SYMPTOMS:
                            target_spec = "Women's Health"
                        elif symptom['id'] in URINARY_SYMPTOMS:
                            target_spec = "Urinary"
                        elif symptom['id'] in ENERGY_SYMPTOMS:
                            target_spec = "General"
                        else:
                            target_spec = "Urinary"

                    if target_spec:
                        add_symptom_to_bucket(target_spec, symptom)

                else:
                    add_symptom_to_bucket(bucket_spec, symptom)

    cleaned_buckets = {}
    for bucket_name, bucket_data in buckets.items():
        if bucket_data:
            cleaned_buckets[bucket_name] = bucket_data

    buckets = cleaned_buckets

    return {
        "buckets": buckets,
        "redFlags": red_flags,
        "metadata": {
            "bucketOrder": BUCKET_ORDER
        }
    }


@app.route('/')
def form():
    if frontend_ready():
        return send_from_directory(app.static_folder, "index.html")
    symptom_categories = load_symptoms_from_tree()
    return render_template('form.html', symptom_categories=symptom_categories)


@app.route('/api/symptoms', methods=['GET'])
def symptoms_route():
    return jsonify(load_symptoms_from_tree())


@app.route('/api/intake-schema', methods=['GET'])
def intake_schema_route():
    """Expose the server-owned intake contract for the React client."""
    return jsonify(INTAKE_SCHEMA)


@app.route('/api/diseases', methods=['GET'])
def diseases_route():
    """API endpoint to get the list of diseases with their full names."""
    if not disease_db:
        return jsonify({})
    
    disease_map = {dx_id: info.get('full_name', dx_id) for dx_id, info in disease_db.items()}
    return jsonify(disease_map)


@app.route('/get_follow_ups', methods=['POST'])
@app.route('/api/follow_ups', methods=['POST'])
def get_follow_ups_route():
    """API endpoint to get follow-up symptoms based on current selections."""
    data = request.json or {}
    selected_symptoms = data.get('selected_symptoms', [])

    follow_ups = get_follow_up_symptoms(selected_symptoms, confidence_map, symptom_tree, primary_to_branches)

    new_symptoms = [s for s in follow_ups if s not in selected_symptoms]

    symptom_data = load_symptoms_from_tree()
    all_symptoms = {}
    for bucket_symptoms in symptom_data.get('buckets', {}).values():
        for symptom in bucket_symptoms:
            all_symptoms[symptom['id']] = symptom['text']

    follow_up_data = [{'id': s_id, 'text': all_symptoms.get(s_id, s_id)} for s_id in new_symptoms]

    return jsonify({
        "follow_up_symptoms": new_symptoms,
        "follow_up_data": follow_up_data
    })


@app.route('/submit', methods=['POST'])
@app.route('/api/submit', methods=['POST'])
def submit():
    form_data = request.form
    files = request.files

    validated_submission, errors = _validate_submission(form_data, files)
    if errors:
        return jsonify({
            "status": "error",
            "message": "Please correct the highlighted fields.",
            "errors": errors,
        }), 400

    case_id, case_dir = _create_case_directory()
    working_dir = case_dir / "inference-inputs"
    try:
        # Uploaded files are isolated per case and exist only while inference is running.
        # They are deliberately not kept in the saved result record.
        working_dir.mkdir(mode=0o700)
        working_dir.chmod(0o700)

        fracture_body_part = validated_submission["fracture_body_part"]
        note_text_from_file = ""
        run_case_files = {}
        for key, file in validated_submission["files"].items():
            filename = secure_filename(file.filename)
            save_path = working_dir / f"{key}{Path(filename).suffix.lower()}"
            file.save(save_path)

            if key == "doctor_note_upload":
                note_text_from_file = save_path.read_text(encoding="utf-8")

            if key in FILE_MAPPING:
                run_case_files[FILE_MAPPING[key]] = str(save_path)

        symptom_list = validated_submission["symptoms"]
        features = {symptom_id: True for symptom_id in symptom_list}
        typed_note = validated_submission["doctor_note"]
        combined_note = typed_note + "\n" + note_text_from_file
        age_val = validated_submission["age"]

        analysis_result = run_case(
            features=features,
            doctor_note=combined_note,
            age=age_val,
            sex=validated_submission["sex"],
            fracture_body_part=fracture_body_part,
            **run_case_files
        )

        if 'contributions' in analysis_result:
            analysis_result['contributions'] = [
                {
                    'feature_id': c.feature_id,
                    'source': c.source,
                    'dx': c.dx,
                    'contribution': c.contribution
                } for c in analysis_result['contributions']
            ]

        fused_probs = analysis_result.get("fused_probabilities", {})
        top_20 = sorted(fused_probs.items(), key=lambda x: x[1], reverse=True)[:20]
        summary = {
            "scan_results": analysis_result.get("model_outputs", []),
            "top_20_diseases": [{"diagnosis": dx, "probability": prob} for dx, prob in top_20]
        }

        response = {
            "status": "success",
            "analysis": analysis_result,
            "summary": summary,
            "case_id": case_id,
        }

        # Do not persist raw clinical notes, original filenames, upload paths, or attachments.
        _write_case_result(case_dir, {
            "case_id": case_id,
            "demographics": {"age": age_val, "sex": validated_submission["sex"]},
            "selected_symptoms": symptom_list,
            "doctor_note_provided": bool(combined_note.strip()),
            "analysis": analysis_result,
        })
        _grant_case_access(case_id)
        return _private_json(response)

    except Exception as e:
        app.logger.error(f"Analysis failed: {e}")
        # A failed request must not leave sensitive inputs or partial results behind.
        shutil.rmtree(case_dir, ignore_errors=True)
        return jsonify({"status": "error", "message": "Analysis could not be completed."}), 500
    finally:
        shutil.rmtree(working_dir, ignore_errors=True)


@app.route('/api/cases/<case_id>', methods=['GET'])
def get_case(case_id):
    try:
        UUID(case_id)
    except (ValueError, TypeError):
        return jsonify({"status": "error", "message": "Invalid case ID."}), 400

    if case_id not in session.get("case_ids", []):
        # Return the same response as a missing record to avoid revealing whether it exists.
        return jsonify({"status": "error", "message": "Case not found."}), 404

    case_filename = Path(app.config["CASE_STORAGE_ROOT"]) / case_id / "result.json"
    if not case_filename.exists():
        return jsonify({"status": "error", "message": "Case not found."}), 404

    try:
        with open(case_filename, 'r') as f:
            case_data = json.load(f)
    except Exception as e:
        app.logger.error(f"Failed to load case {safe_case_id}: {e}")
        return jsonify({"status": "error", "message": "Failed to load case data."}), 500

    demographics = case_data.get("demographics", {})
    return _private_json({
        "status": "success",
        "case_id": case_data.get("case_id", case_id),
        "analysis": case_data.get("analysis"),
        "selected_symptoms": case_data.get("selected_symptoms", []),
        "doctor_note_provided": bool(case_data.get("doctor_note_provided")),
        "age": demographics.get("age"),
        "sex": demographics.get("sex")
    })


@app.route('/<path:path>')
def serve_frontend(path):
    if path.startswith("api/"):
        return ("Not Found", 404)
    if frontend_ready():
        file_path = Path(app.static_folder) / path
        if file_path.exists():
            return send_from_directory(app.static_folder, path)
        return send_from_directory(app.static_folder, "index.html")
    return ("Not Found", 404)

base_dir = Path(__file__).parent
confidence_path = base_dir / "configs" / "confidence_map.yaml"
symptom_tree_path = base_dir / "configs" / "symptom_tree_expanded.yaml"
branches_path = base_dir / "configs" / "primary_to_branches.yaml"

confidence_map = load_confidence_map(str(confidence_path))
symptom_tree = load_symptom_tree(str(symptom_tree_path))
primary_to_branches = load_primary_to_branches(str(branches_path))
disease_db_path = base_dir / "configs" / "diseases.yaml"
disease_db = load_disease_database(str(disease_db_path))

try:
    nlp_model = spacy.load("en_core_web_sm", disable=["parser", "ner"])
except:
    nlp_model = None

if __name__ == '__main__':
    app.run(debug=True)
