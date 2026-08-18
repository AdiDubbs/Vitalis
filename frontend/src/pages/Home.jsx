import { Link } from "react-router-dom";
import {
  IconActivity,
  IconArrowRight,
  IconGitBranch,
  IconMicroscope,
  IconPhotoScan,
  IconShieldCheck,
  IconSparkles,
} from "@tabler/icons-react";
import doctorPatient from "../assets/undraw_doctor_patient.svg";
import doctors from "../assets/undraw_doctors.svg";

const FLOW_STEPS = [
  {
    title: "Symptom selection",
    description:
      "Select primary symptoms and add brief notes for timing and severity.",
    example: "28-year-old male with fever, cough, and chest tightness.",
  },
  {
    title: "Evidence upload",
    description:
      "Attach lab PDFs or scans to add objective signals to the case.",
    example: "Chest X-ray image uploaded alongside lab results.",
  },
  {
    title: "Ranked results",
    description:
      "View ranked conditions with confidence estimates and contributing evidence.",
    example: "Ranked list shows influenza, pneumonia, bronchitis.",
  },
];

const STATS = [
  { label: "Diseases mapped", value: "85+", icon: IconActivity },
  { label: "Symptom nodes", value: "320+", icon: IconGitBranch },
  { label: "Models active", value: "5", icon: IconPhotoScan },
  { label: "Lab biomarkers", value: "45+", icon: IconMicroscope },
];

function Home() {
  return (
    <div className="home">
      <section className="v-section home-hero">
        <div className="home-hero-wash" aria-hidden="true" />
        <div className="v-shell home-hero-inner">
          <div>
            <span className="v-kicker">
              <IconSparkles size={14} aria-hidden="true" />
              Trusted clinical workflow
            </span>
            <h1 className="v-display">Your diagnostic co-pilot</h1>
            <p className="v-lede">
              Vitalis supports calm, structured intake and clear reasoning so care
              teams can move from symptoms to next steps with confidence.
            </p>

            <div className="home-hero-actions">
              <Link to="/diagnosis" className="v-btn v-btn--primary">
                Start diagnosis
                <IconArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link to="/overview" className="v-btn v-btn--quiet">
                See how it works
              </Link>
            </div>

            <ul className="v-chips home-hero-stats">
              {STATS.map((stat) => (
                <li key={stat.label} className="v-chip">
                  <stat.icon size={14} aria-hidden="true" />
                  {stat.value} {stat.label.toLowerCase()}
                </li>
              ))}
            </ul>
          </div>

          <div className="home-hero-art">
            <img src={doctorPatient} alt="" />
          </div>
        </div>
      </section>

      <section className="v-section">
        <div className="v-shell">
          <header className="home-section-head">
            <span className="v-kicker">
              <IconShieldCheck size={14} aria-hidden="true" />
              From intake to guidance
            </span>
            <h2 className="v-headline">A clear, consistent diagnostic flow.</h2>
            <p className="v-lede">
              Move from intake to guidance without losing context or clarity.
            </p>
          </header>

          <ol className="v-steps home-flow">
            {FLOW_STEPS.map((step, index) => (
              <li className="v-step" key={step.title}>
                <span className="v-step-index" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="v-step-name">{step.title}</span>
                <p className="v-body home-flow-copy">{step.description}</p>
                <p className="v-fine home-flow-example">{step.example}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="v-section">
        <div className="v-shell">
          <div className="v-card v-card--lit home-closing">
            <div>
              <span className="v-kicker">Ranked, with reasoning</span>
              <h2 className="v-headline">Get results with confidence.</h2>
              <p className="v-lede">
                See ranked conditions based on symptoms, labs, and uploads in a
                single view, with confidence estimates and key signals surfaced
                for quick review.
              </p>
              <div className="home-hero-actions">
                <Link to="/diagnosis" className="v-btn v-btn--primary">
                  Start diagnosis
                  <IconArrowRight size={17} aria-hidden="true" />
                </Link>
              </div>
            </div>
            <div className="home-closing-art">
              <img src={doctors} alt="" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;
