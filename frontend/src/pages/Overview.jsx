import { useState } from "react";
import {
  IconBrain,
  IconDeviceLaptop,
  IconSchema,
  IconSparkles,
} from "@tabler/icons-react";

const SYSTEM_STATS = [
  { label: "Diseases tracked", value: "85+" },
  { label: "Symptom nodes", value: "320+" },
  { label: "Imaging models", value: "5" },
  { label: "Lab biomarkers", value: "45+" },
];

const PIPELINE_STEPS = [
  {
    title: "Intake",
    heading: "Multi-modal intake",
    summary:
      "Notes, lab PDFs, imaging, and ECG files enter a single intake flow to unify patient context. Consistent intake reduces fragmentation and sets a clean baseline, so downstream signals stay comparable across sources.",
    mechanism:
      "Accepts clinician notes, PDFs, PNG/JPG imaging, and ECG .dat files with basic validation.",
    example:
      "Input: '72yo male, chest pain' + labs.pdf + chest_xray.jpg + ecg.dat.",
  },
  {
    title: "Extract",
    heading: "Feature extraction",
    summary:
      "Rule-based parsing converts notes and lab text into structured findings and labels. Structured signals are easier to combine with labs and imaging, and improve traceability from narrative input to model evidence.",
    mechanism:
      "Regex symptom map + lab range parsing with negation and family-history filters.",
    example:
      "'Denies chest pain' -> sym_chest_pain not set; 'WBC 14' -> wbc_high.",
  },
  {
    title: "Analyze",
    heading: "AI analysis",
    summary:
      "Models score scans and physiological signals into likelihoods. Probabilistic outputs allow direct comparison across modalities, turning raw data into decision-ready evidence.",
    mechanism:
      "DenseNet121 (X-ray), ResNet18 (MRI/fracture), EfficientNet (skin), MobileNetV2 (breast), sklearn ECG.",
    example: "Imaging X-ray -> Pneumonia 0.88; ECG -> ischemia probability.",
  },
  {
    title: "Fuse",
    heading: "Bayesian fusion",
    summary:
      "Priors and evidence combine into ranked odds with calibrated weighting. This balances baseline risk against new findings and reduces overconfidence when evidence is sparse.",
    mechanism:
      "Demographic priors + likelihood ratios + model logits with comorbidity interactions.",
    example: "P(D|E) = Prior(D) * LR(E1) * LR(E2) ... / Normalizer.",
  },
  {
    title: "Rank",
    heading: "Diagnostics",
    summary:
      "Results surface top conditions, red flags, and evidence contributions. Clinicians need fast, prioritized output, so model evidence is translated into actionable next steps.",
    mechanism:
      "Ranks differentials, computes confidence intervals, and highlights feature contributions.",
    example: "Ranked: 1. ACS (0.92), 2. PE (0.04). Alerts: [ST-Elevation].",
  },
];

const ACTIVE_MODELS = [
  {
    name: "Chest X-Ray",
    target: "Pneumonia",
    type: "DenseNet121",
    dataset: "ChestX-ray14 (NIH)",
    description:
      "Analyzes chest radiographs to detect pneumonia patterns and infiltrates with high sensitivity.",
  },
  {
    name: "Brain MRI",
    target: "Tumor class",
    type: "ResNet18",
    dataset: "Brain Tumor MRI Dataset",
    description:
      "Classifies brain tumors from MRI scans into glioma, meningioma, and pituitary tumor categories.",
  },
  {
    name: "Dermatoscopy",
    target: "Skin lesion",
    type: "EfficientNet-B0",
    dataset: "HAM10000 (ISIC)",
    description:
      "Identifies melanoma and other skin lesions from dermoscopic images using compound scaling.",
  },
  {
    name: "Fracture imaging",
    target: "Fracture",
    type: "ResNet18",
    dataset: "MURA (Stanford)",
    description:
      "Detects bone fractures in X-ray images across multiple anatomical regions with spatial precision.",
  },
  {
    name: "Breast imaging",
    target: "Breast cancer",
    type: "MobileNetV2",
    dataset: "CBIS-DDSM",
    description:
      "Screens mammograms for malignant masses and calcifications using depthwise separable convolutions.",
  },
  {
    name: "ECG signals",
    target: "Ischemia risk",
    type: "WFDB + sklearn",
    dataset: "PTB-XL Database",
    description:
      "Processes ECG waveforms to identify ST-segment changes and arrhythmias indicative of ischemia.",
  },
];

const TECH_STACK = [
  {
    category: "Frontend",
    items: ["React 19", "Mantine UI", "Vite", "React Router"],
    description:
      "Delivers responsive diagnostic dashboards with real-time state management, rendering interactive visualizations for pipeline steps, differential rankings, and evidence breakdown.",
  },
  {
    category: "Backend",
    items: ["Python 3.12", "Flask", "PyYAML", "pypdf"],
    description:
      "Exposes RESTful endpoints for case submission, inference execution, and result retrieval. Handles PDF lab extraction and YAML-based configuration for disease priors and symptom mappings.",
  },
  {
    category: "ML engine",
    items: ["PyTorch", "Torchvision", "Scikit", "WFDB"],
    description:
      "Executes multi-modal inference across imaging, lab, and signal inputs, then integrates model outputs into the Bayesian fusion pipeline.",
  },
  {
    category: "NLP",
    items: ["Regex", "Parsers", "Negation", "spaCy"],
    description:
      "Extracts clinical entities from unstructured notes and histories, handling negation so denied symptoms are not mistaken for confirmed findings.",
  },
];

function Overview() {
  const [activeStep, setActiveStep] = useState(0);
  const step = PIPELINE_STEPS[activeStep];

  return (
    <div className="overview">
      <section className="v-section overview-head">
        <div className="v-shell">
          <span className="v-kicker">
            <IconSparkles size={14} aria-hidden="true" />
            System prototype
          </span>
          <h1 className="v-display">Vitalis dashboard</h1>
          <p className="v-lede">
            Clinical decision support powered by Bayesian inference and
            multi-modal analysis.
          </p>
        </div>
      </section>

      <section className="v-section">
        <div className="v-shell">
          <dl className="v-stats">
            {SYSTEM_STATS.map((stat) => (
              <div className="v-stat" key={stat.label}>
                <dt>{stat.label}</dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="v-section">
        <div className="v-shell v-band">
          <header className="home-section-head">
            <span className="v-kicker">
              <IconSchema size={14} aria-hidden="true" />
              How a case moves
            </span>
            <h2 className="v-headline">Inference pipeline</h2>
            <p className="v-lede">
              End-to-end flow from unstructured intake to ranked clinical
              evidence. Pick a stage to see what happens inside it.
            </p>
          </header>

          <div className="overview-pipeline">
            <div
              className="overview-stage-list"
              role="tablist"
              aria-label="Pipeline stages"
            >
              {PIPELINE_STEPS.map((item, index) => (
                <button
                  type="button"
                  role="tab"
                  key={item.title}
                  className="overview-stage"
                  data-active={index === activeStep || undefined}
                  aria-selected={index === activeStep}
                  onClick={() => setActiveStep(index)}
                >
                  <span className="v-rail-dot">{index + 1}</span>
                  <span className="overview-stage-text">
                    <strong>{item.title}</strong>
                    <small>{item.heading}</small>
                  </span>
                </button>
              ))}
            </div>

            <div className="v-card overview-stage-detail">
              <span className="v-kicker">Stage {activeStep + 1}</span>
              <h3 className="v-title overview-stage-title">{step.heading}</h3>
              <p className="v-body overview-detail-summary">{step.summary}</p>

              <div className="overview-detail-grid">
                <div className="v-card--inset">
                  <span className="v-kicker">Logic &amp; mechanism</span>
                  <p className="v-mono v-body">{step.mechanism}</p>
                </div>
                <div className="v-card--inset">
                  <span className="v-kicker">Input / output</span>
                  <p className="v-mono v-body">{step.example}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="v-section">
        <div className="v-shell v-band">
          <header className="home-section-head">
            <span className="v-kicker">
              <IconBrain size={14} aria-hidden="true" />
              Under the hood
            </span>
            <h2 className="v-headline">Implementation</h2>
            <p className="v-lede">
              Models, frameworks, and core technologies behind the engine.
            </p>
          </header>

          <div className="v-section-label">
            <span>
              <IconBrain size={14} aria-hidden="true" /> Active models
            </span>
            <span>{ACTIVE_MODELS.length}</span>
          </div>

          <div className="v-table-wrap overview-models">
            <table className="v-table">
              <thead>
                <tr>
                  <th scope="col">Model</th>
                  <th scope="col">Target</th>
                  <th scope="col">Architecture</th>
                  <th scope="col">Training data</th>
                  <th scope="col" className="overview-col-note">
                    What it contributes
                  </th>
                </tr>
              </thead>
              <tbody>
                {ACTIVE_MODELS.map((model) => (
                  <tr key={model.name}>
                    <td>
                      <strong>{model.name}</strong>
                    </td>
                    <td>
                      <span className="v-chip v-chip--sage">
                        {model.target}
                      </span>
                    </td>
                    <td>
                      <span className="v-chip v-chip--mono">{model.type}</span>
                    </td>
                    <td>{model.dataset}</td>
                    <td className="overview-col-note">{model.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="v-section-label overview-stack-label">
            <span>
              <IconDeviceLaptop size={14} aria-hidden="true" /> Tech stack
            </span>
            <span>{TECH_STACK.length}</span>
          </div>

          <dl className="overview-stack">
            {TECH_STACK.map((group) => (
              <div key={group.category}>
                <dt>{group.category}</dt>
                <dd>
                  <div className="v-chips overview-stack-chips">
                    {group.items.map((item) => (
                      <span className="v-chip" key={item}>
                        {item}
                      </span>
                    ))}
                  </div>
                  <p className="v-body overview-stack-note">
                    {group.description}
                  </p>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </div>
  );
}

export default Overview;
