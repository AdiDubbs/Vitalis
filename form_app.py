from flask import Flask, render_template, request, jsonify, send_from_directory
import json
import os
import yaml
from pathlib import Path
from werkzeug.utils import secure_filename

from vitalis_engine import load_confidence_map, load_symptom_tree, load_primary_to_branches, get_follow_up_symptoms, extract_features_from_note, \
    spacy, run_case, load_disease_database

UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'dat', 'pdf', 'txt'}

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
if not os.path.exists('cases'):
    os.makedirs('cases')

app = Flask(__name__, static_folder="frontend/dist", static_url_path="")
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER


def frontend_ready():
    if not app.static_folder:
        return False
    return (Path(app.static_folder) / "index.html").exists()


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


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
    fracture_body_part = form_data.get("fracture_body_part") or None

    uploaded_files = {}
    note_text_from_file = ""

    file_mapping = {
        'upload_image': 'upload_image',
        'upload_mri': 'upload_mri',
        'upload_ecg': 'upload_ecg',
        'upload_skin': 'upload_skin_image',
        'upload_fracture': 'upload_fracture_image',
        'upload_breast': 'upload_breast_image'
    }
    
    run_case_files = {}

    for key, file in files.items():
        if file and file.filename and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            save_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(save_path)
            uploaded_files[key] = save_path

            if key == 'doctor_note_upload' and filename.endswith('.txt'):
                with open(save_path, 'r') as f:
                    note_text_from_file = f.read()

            if key in file_mapping:
                run_case_files[file_mapping[key]] = save_path

    app.logger.info(f"Form data keys received: {list(form_data.keys())}")

    symptom_list = []
    try:
        symptoms_json = form_data.get('symptoms', '[]')
        symptom_list = json.loads(symptoms_json)
        features = {s_id: True for s_id in symptom_list}
    except json.JSONDecodeError:
        app.logger.error("Failed to parse symptoms JSON")
        features = {}
        
    app.logger.info(f"Extracted features: {list(features.keys())}")

    typed_note = form_data.get('doctor_note', '')

    combined_note = typed_note + "\n" + note_text_from_file

    try:
        age_val = int(form_data.get('age')) if form_data.get('age') else None

        analysis_result = run_case(
            features=features,
            doctor_note=combined_note,
            age=age_val,
            sex=form_data.get('sex'),
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
            "case_id": f"case_{form_data.get('age')}_{form_data.get('sex')}_{len(os.listdir('cases')) + 1}"
        }
        
        case_filename = f"cases/{response['case_id']}.json"
        with open(case_filename, 'w') as f:
            serializable_data = {
                "case_id": response["case_id"],
                "demographics": {"age": age_val, "sex": form_data.get('sex')},
                "features": features,
                "selected_symptoms": symptom_list,
                "doctor_note_provided": bool(combined_note.strip()),
                "doctor_note": combined_note,
                "attachments": uploaded_files,
                "fracture_body_part": fracture_body_part,
                "analysis_summary": analysis_result['fused_probabilities'],
                "analysis": analysis_result
            }
            json.dump(serializable_data, f, indent=2)

        return jsonify(response)

    except Exception as e:
        app.logger.error(f"Analysis failed: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/cases/<case_id>', methods=['GET'])
def get_case(case_id):
    safe_case_id = secure_filename(case_id)
    if not safe_case_id:
        return jsonify({"status": "error", "message": "Invalid case ID."}), 400

    case_filename = Path("cases") / f"{safe_case_id}.json"
    if not case_filename.exists():
        return jsonify({"status": "error", "message": "Case not found."}), 404

    try:
        with open(case_filename, 'r') as f:
            case_data = json.load(f)
    except Exception as e:
        app.logger.error(f"Failed to load case {safe_case_id}: {e}")
        return jsonify({"status": "error", "message": "Failed to load case data."}), 500

    demographics = case_data.get("demographics", {})
    return jsonify({
        "status": "success",
        "case_id": case_data.get("case_id", safe_case_id),
        "analysis": case_data.get("analysis"),
        "selected_symptoms": case_data.get("selected_symptoms", list(case_data.get("features", {}).keys())),
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
