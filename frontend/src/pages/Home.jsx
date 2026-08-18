import { Link } from "react-router-dom";
import { IconArrowRight, IconSparkles } from "@tabler/icons-react";
import ConfidenceDial from "../components/ConfidenceDial.jsx";

const LEDGER = [
  { label: "Diseases mapped", value: "85+" },
  { label: "Symptom nodes", value: "320+" },
  { label: "Models active", value: "5" },
  { label: "Lab biomarkers", value: "45+" },
];

const JOURNEY = [
  {
    title: "Patient",
    body: "Age, sex, and history frame every downstream estimate. Nothing is scored in a vacuum.",
  },
  {
    title: "Evidence",
    body: "Attach labs, imaging, or ECG waveforms. Each becomes another likelihood, not another opinion.",
  },
  {
    title: "Symptoms",
    body: "Pick findings from a structured tree. Vitalis asks follow-ups as the picture narrows.",
  },
];

/* A miniature of a real result, so the landing page shows the output rather
 * than describing it. Figures mirror an actual run. */
const SAMPLE = {
  primary: { name: "Common Cold", probability: 0.77 },
  secondary: [
    { name: "Asthma", probability: 0.117 },
    { name: "Influenza", probability: 0.089 },
  ],
};

const PRINCIPLES = [
  {
    heading: "What it does",
    points: [
      "Ranks 79 candidate diagnoses by posterior probability",
      "Shows which evidence moved each estimate, and by how much",
      "Flags red-flag patterns that warrant urgent evaluation",
    ],
  },
  {
    heading: "What it does not",
    points: [
      "Replace clinical judgment or a qualified clinician",
      "Claim regulatory clearance — this is research software",
      "Hide its reasoning behind an end-to-end black box",
    ],
  },
];

function Home() {
  return (
    <div className="home">
      <section className="v-section home-hero">
        <div className="home-hero-wash" aria-hidden="true" />
        <div className="v-shell home-hero-inner">
          <div className="home-hero-copy">
            <span className="v-kicker">
              <IconSparkles size={14} aria-hidden="true" />
              Trusted clinical workflow
            </span>
            <h1 className="v-display">
              Reasoning you can
              <br />
              follow, end to end.
            </h1>
            <p className="v-lede">
              Vitalis fuses symptoms, labs, imaging, and ECG into a ranked
              differential — and shows its work at every step, so the estimate is
              never something you have to take on faith.
            </p>

            <div className="home-hero-actions">
              <Link to="/diagnosis" className="v-btn v-btn--primary">
                Start diagnosis
                <IconArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link to="/overview" className="v-btn v-btn--quiet">
                How the engine works
              </Link>
            </div>
          </div>

          <figure className="home-preview">
            <figcaption className="v-section-label">
              <span>Ranked differentials</span>
              <span>Sample case</span>
            </figcaption>
            <div className="home-preview-primary">
              <ConfidenceDial
                value={SAMPLE.primary.probability}
                size={124}
                id="home-dial"
              />
              <div>
                <span className="v-kicker">Primary</span>
                <p className="home-preview-name">{SAMPLE.primary.name}</p>
              </div>
            </div>
            {SAMPLE.secondary.map((dx) => (
              <div className="home-preview-rank" key={dx.name}>
                <div className="home-preview-rank-head">
                  <span>{dx.name}</span>
                  <span>{(dx.probability * 100).toFixed(1)}%</span>
                </div>
                <div className="v-meter">
                  <span style={{ width: `${dx.probability * 100}%` }} />
                </div>
              </div>
            ))}
          </figure>
        </div>
      </section>

      <section className="v-section">
        <div className="v-shell">
          <dl className="v-ledger">
            {LEDGER.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="v-section">
        <div className="v-shell">
          <header className="home-section-head">
            <span className="v-kicker">Three steps, one thread</span>
            <h2 className="v-headline">Intake that builds a case.</h2>
            <p className="v-lede">
              Each step narrows the differential, and the case stays visible
              beside you the whole way through.
            </p>
          </header>

          <div className="v-rail home-journey-rail" aria-hidden="true">
            {JOURNEY.map((step, index) => (
              <div className="v-rail-node" data-active key={step.title}>
                <span className="v-rail-dot">{index + 1}</span>
                <span className="v-rail-label">{step.title}</span>
                {index < JOURNEY.length - 1 && <span className="v-rail-line" />}
              </div>
            ))}
          </div>

          <ol className="home-journey">
            {JOURNEY.map((step) => (
              <li key={step.title}>
                <h3 className="home-journey-title">{step.title}</h3>
                <p className="v-body">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="v-section">
        <div className="v-shell">
          <div className="home-principles">
            {PRINCIPLES.map((column) => (
              <div key={column.heading}>
                <div className="v-section-label">
                  <span>{column.heading}</span>
                </div>
                <ul className="home-principle-list">
                  {column.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="v-section">
        <div className="v-shell">
          <div className="v-card v-card--lit home-closing">
            <span className="v-kicker">Ready when you are</span>
            <h2 className="v-headline">Start with the person.</h2>
            <p className="v-lede">
              Intake takes a few minutes, and every field is optional except the
              findings you care about.
            </p>
            <div className="home-hero-actions">
              <Link to="/diagnosis" className="v-btn v-btn--primary">
                Start diagnosis
                <IconArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;
