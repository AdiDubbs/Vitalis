# Vitalis

**Multi-Modal Diagnostic Engine**

Vitalis is a multi-modal diagnostic engine that combines clinical notes, lab results, medical imaging, and ECG data to generate differential diagnoses using Bayesian probabilistic reasoning. The system integrates evidence across multiple medical specialties to support clinical decision-making.

## Features

### Multi-Modal Input Processing
- **Clinical Notes**: NLP-based symptom extraction with negation handling
- **Lab Results**: PDF parsing with automated biomarker range classification
- **Medical Imaging**: X-ray, MRI, CT, and skin lesion analysis
- **ECG Data**: Physiological signal processing for cardiac conditions

### AI Analysis Pipeline
- **DenseNet121** - Pneumonia detection from chest X-rays
- **ResNet18** - Brain tumor classification (MRI) and fracture detection
- **EfficientNet** - Skin lesion analysis
- **MobileNetV2** - Breast cancer screening
- **Scikit-learn** - ECG ischemia detection

### Bayesian Diagnostic Engine
- Symptom-driven differential diagnosis generation
- Prior probability modeling based on epidemiological data
- Multi-evidence fusion using Bayesian updating
- Interactive follow-up question system for diagnostic refinement

### Clinical Coverage
- **85+** disease conditions across multiple specialties
- **320+** symptom nodes with hierarchical relationships
- **45+** lab biomarkers with clinical ranges
- **Specialties**: Cardiology, Respiratory, Neurology, Oncology, Dermatology, Gastroenterology, and more

---

## Tech Stack

### Backend
- **Python 3.13** - Core runtime
- **Flask** - Web framework and REST API
- **PyTorch** - Deep learning inference
- **scikit-learn** - Traditional ML models
- **spaCy** - Natural language processing
- **wfdb** - ECG signal processing
- **PyYAML** - Configuration management

### Frontend
- **React 19** - UI framework
- **Vite** - Build tool and dev server
- **Mantine UI** - Component library
- **React Router** - Client-side routing

### Machine Learning
- **PyTorch** - Neural network inference
- **torchvision** - Image preprocessing
- **NumPy/Pandas** - Data manipulation
- **Pillow** - Image processing

---

## Installation & Setup

### Prerequisites
- **Python 3.12** (the pinned runtime was verified with 3.12)
- **Node.js 20.19+** or **22.12+**, plus npm 10+

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/vitalis.git
cd vitalis
```

### 2. Backend Setup

Create and activate a virtual environment:
```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

Install Python dependencies:
```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Download spaCy language model:
```bash
python -m spacy download en_core_web_sm
```

### 3. Frontend Setup

Navigate to the frontend directory and install dependencies:
```bash
cd frontend
npm ci
```

Build the frontend for production:
```bash
npm run build
cd ..
```

---

## Running the Application

Build the frontend and run the Flask server:
```bash
cd frontend
npm run build
cd ..
python form_app.py
```


## Usage

### 1. Enter Patient Information
- Age, sex, and demographic data
- Chief complaint or presenting symptoms

### 2. Upload Medical Data (Optional)
- **Lab Results**: PDF reports with biomarkers
- **Imaging**: PNG/JPG X-rays, MRI, or CT scans
- **ECG**: `.dat` waveform files
- **Clinical Notes**: Text descriptions

### 3. Select Symptoms
- Interactive symptom selection grouped by body system
- Follow-up questions refine the differential diagnosis

### 4. Review Results
- Ranked differential diagnoses with probabilities
- Evidence breakdown by source (symptoms, labs, imaging)
- Suggested follow-up tests or evaluations

---

## Configuration

Key configuration files in `configs/`:

- **diseases.yaml** - Disease definitions, epidemiological priors, and likelihood ratios for all conditions
- **symptom_tree_expanded.yaml** - Hierarchical symptom relationships and clinical groupings
- **confidence_map.yaml** - Symptom-to-disease probability mappings
- **primary_to_branches.yaml** - Diagnostic branching logic for follow-up questions
- **lab_ranges.yaml** - Laboratory test reference ranges and abnormal value thresholds
- **red_flags.yaml** - Clinical alert rules for urgent/emergent symptoms requiring immediate attention
- **system.yaml** - System-wide configuration and model artifact paths

Modify these files to adjust clinical reasoning parameters, add new diseases, or update reference ranges.

---

## Model Information

| Model | Task | Architecture | Input Size |
|-------|------|-------------|------------|
| Pneumonia Detection | Chest X-ray classification | DenseNet121 | 224×224 |
| Brain Tumor Classification | MRI analysis | ResNet18 | 224×224 |
| Fracture Detection | Orthopedic imaging | ResNet18 | 224×224 |
| Skin Lesion Analysis | Dermatology screening | EfficientNet | 224×224 |
| Breast Cancer Screening | Mammography/ultrasound | MobileNetV2 | 224×224 |
| ECG Ischemia Detection | Cardiac rhythm analysis | Scikit-learn | Waveform |

---

## Disclaimer

**For Research and Educational Purposes Only**

- This system is **NOT** FDA-approved or intended for clinical use
- Outputs are probabilistic suggestions, not definitive diagnoses
- Always consult qualified healthcare professionals for medical decisions
