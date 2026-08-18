import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { createSymptomNameMap, formatContribution } from "../utils/symptomHelpers.js";
import { Modal, ScrollArea } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import ConfidenceDial from "../components/ConfidenceDial.jsx";
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconArrowLeft,
  IconChartBar,
  IconChevronDown,
  IconPrinter,
} from "@tabler/icons-react";

function Results() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const state = location.state || {};
  const caseIdFromState = state.caseId || "";
  const caseIdFromQuery = searchParams.get("case_id") || "";
  const caseId = caseIdFromState || caseIdFromQuery;

  const isMobile = useMediaQuery('(max-width: 768px)');
  const [hydratedCase, setHydratedCase] = useState(null);
  const [caseFetch, setCaseFetch] = useState({
    loading: false,
    error: "",
  });

  const [data, setData] = useState({
    symptomCategories: {},
    diseaseMap: {},
    symptomsError: "",
    diseasesError: "",
  });

  const [ui, setUi] = useState({
    showAllSecondary: false,
    symptomModalOpen: false,
  });

  const toggleSecondaryDiagnoses = () => {
    setUi(prev => ({
      ...prev,
      showAllSecondary: !prev.showAllSecondary
    }));
  };

  const toggleSymptomModal = () => {
    setUi(prev => ({
      ...prev,
      symptomModalOpen: !prev.symptomModalOpen
    }));
  };

  useEffect(() => {
    let active = true;
    const fetchCase = async () => {
      if (state.analysis || !caseId) {
        return;
      }
      setCaseFetch({ loading: true, error: "" });
      try {
        const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}`);
        const payload = await response.json();
        if (!response.ok || payload.status !== "success") {
          throw new Error(payload.message || "Could not load this saved case.");
        }
        if (active) {
          setHydratedCase(payload);
          setCaseFetch({ loading: false, error: "" });
        }
      } catch (error) {
        if (active) {
          setCaseFetch({
            loading: false,
            error: error.message || "Could not load this saved case.",
          });
        }
      }
    };
    fetchCase();
    return () => {
      active = false;
    };
  }, [caseId, state.analysis]);

  const analysis = state.analysis || hydratedCase?.analysis || null;
  const selectedSymptoms = state.selectedSymptoms || hydratedCase?.selected_symptoms || [];
  const uploadResults = analysis?.upload_results || [];
  const doctorNoteProvided =
    typeof state.doctorNoteProvided === "boolean"
      ? state.doctorNoteProvided
      : Boolean(hydratedCase?.doctor_note_provided);
  const age = state.age ?? hydratedCase?.age ?? null;
  const sex = state.sex || hydratedCase?.sex || "";

  useEffect(() => {
    let active = true;
    
    const fetchData = async () => {
      let symptomCategories = {};
      let diseaseMap = {};
      let symptomsError = "";
      let diseasesError = "";

      try {
        const symptomsRes = await fetch("/api/symptoms");
        if (!symptomsRes.ok) {
          throw new Error("Could not load symptom labels.");
        }
        const symptomsData = await symptomsRes.json();
        symptomCategories = symptomsData?.buckets || {};
      } catch (error) {
        symptomsError = error.message || "Could not load symptom labels.";
      }

      try {
        const diseasesRes = await fetch("/api/diseases");
        if (!diseasesRes.ok) {
          throw new Error("Could not load disease names.");
        }
        diseaseMap = await diseasesRes.json();
      } catch (error) {
        diseasesError = error.message || "Could not load disease names.";
      }

      if (active) {
        setData({
          symptomCategories,
          diseaseMap,
          symptomsError,
          diseasesError,
        });
      }
    };

    fetchData();
    return () => {
      active = false;
    };
  }, []);

  const rankedConditions = useMemo(() => {
    if (!analysis?.fused_probabilities) {
      return [];
    }
    return Object.entries(analysis.fused_probabilities)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, probability]) => ({ name, probability }));
  }, [analysis]);
  const primaryDx = rankedConditions[0] || null;
  const primaryRecommendedTests =
    analysis?.disease_db?.[primaryDx?.name]?.recommended_tests || [];

  const featureExplanations = analysis?.feature_explanations || {};

  const symptomNameMap = useMemo(() =>
    createSymptomNameMap(data.symptomCategories),
    [data.symptomCategories]
  );

  const riskStratification = useMemo(() => {
    if (!analysis) return null;

    const hasRedFlags = (analysis.red_flags?.length || 0) > 0;
    const topProbability = primaryDx?.probability || 0;
    const symptomCount = selectedSymptoms.length;

    if (hasRedFlags || topProbability > 0.85) {
      return {
        level: "high",
        label: "High Risk",
        color: "gray",
        badgeClass: "badge-critical",
      };
    }

    if (topProbability > 0.60 || symptomCount > 10) {
      return {
        level: "medium",
        label: "Medium Risk",
        color: "orange",
        badgeClass: "",
      };
    }

    return {
      level: "low",
      label: "Low Risk",
      color: "green",
      badgeClass: "",
    };
  }, [analysis, primaryDx, selectedSymptoms]);

  const categorizeReasonSource = (source) => {
    const value = typeof source === "string" ? source.toLowerCase() : "";
    if (!value) {
      return "patient";
    }
    const objectiveKeywords = [
      "lab",
      "labs",
      "imaging",
      "scan",
      "ct",
      "mri",
      "xray",
      "x-ray",
      "objective",
      "vital",
      "ecg",
      "test",
    ];
    if (objectiveKeywords.some((keyword) => value.includes(keyword))) {
      return "objective";
    }
    return "patient";
  };

  const normalizeReasons = (reasons, type) =>
    (reasons || []).map(([featureId, contribution, source]) => ({
      featureId,
      contribution: type === "opposing" ? -contribution : contribution,
      source,
      category: categorizeReasonSource(source),
      type,
    }));

  const getReasonData = (dxName) => {
    const reasons = featureExplanations?.[dxName];
    if (!reasons) {
      return { combined: [] };
    }
    const supporting = normalizeReasons(reasons.supporting, "supporting");
    const combined = [...supporting].sort(
      (a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)
    );
    const grouped = combined.reduce(
      (acc, reason) => {
        const bucket = reason.category === "objective" ? "objective" : "patient";
        acc[bucket].push(reason);
        return acc;
      },
      { patient: [], objective: [] }
    );
    return { combined, grouped };
  };

  const formatDemographics = () => {
    const parts = [];
    if (typeof age === "number") {
      parts.push(`${age}-year-old`);
    }
    if (sex) {
      const label =
        sex === "MALE"
          ? "male"
          : sex === "FEMALE"
          ? "female"
          : sex.toLowerCase();
      parts.push(label);
    }
    if (!parts.length) {
      return "";
    }
    return parts.join(" ");
  };

  const formatDxName = (name) => {
    if (!name) {
      return "";
    }

    if (data.diseaseMap[name]) {
      return data.diseaseMap[name];
    }

    const cleaned = name.replace(/_/g, " ").trim();
    const isAllCaps = cleaned === cleaned.toUpperCase();
    if (!isAllCaps) {
      return cleaned;
    }
    return cleaned
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const formatModelName = (modelType) => {
    const names = {
      imaging_xray: "Chest X-Ray",
      imaging_mri: "Brain MRI",
      imaging_skin: "Skin image",
      imaging_fracture: "Fracture image",
      imaging_breast_cancer: "Breast image",
      signals_ecg_afib: "ECG",
      signals_ecg_ischemia: "ECG",
    };
    return names[modelType] || "Uploaded evidence";
  };


  const notices = [
    caseFetch.error && {
      key: "case",
      tone: "danger",
      title: "Could not load case",
      body: `${caseFetch.error} Open a case from the intake flow and try again.`,
    },
    data.symptomsError && {
      key: "symptoms",
      tone: "warn",
      title: "Symptom labels unavailable",
      body: `${data.symptomsError} Symptom IDs may be shown instead of names.`,
    },
    data.diseasesError && {
      key: "diseases",
      tone: "warn",
      title: "Disease names unavailable",
      body: `${data.diseasesError} Internal IDs may be shown for conditions.`,
    },
  ].filter(Boolean);

  const visibleConditions = ui.showAllSecondary
    ? rankedConditions
    : rankedConditions.slice(0, 3);

  const nextSteps = {
    high: {
      title: "Urgent evaluation",
      items: [
        "Address red flags immediately",
        "Consider emergency consultation",
        "Order tests without delay",
      ],
    },
    medium: {
      title: "Standard workup",
      items: [
        "Order verification tests",
        "Monitor symptom progression",
        "Follow-up in 48–72 hours",
      ],
    },
    low: {
      title: "Routine management",
      items: [
        "Tests if clinically indicated",
        "Provide patient education",
        "Routine follow-up as needed",
      ],
    },
  }[riskStratification?.level || "low"];

  return (
    <div className="results">
      <section className="v-section">
        <div className="v-shell">
          <header className="results-head">
            <div>
              <span className="v-kicker">
                <IconChartBar size={14} aria-hidden="true" />
                Case output
              </span>
              <h1 className="v-display">Results</h1>
              <p className="v-lede">
                Review ranked differentials and red flag alerts.
              </p>
            </div>
            <div className="results-actions">
              <Link to="/diagnosis" className="v-btn">
                <IconArrowLeft size={16} aria-hidden="true" />
                Back to intake
              </Link>
              <button
                type="button"
                className="v-btn v-btn--quiet"
                onClick={() => window.print()}
              >
                <IconPrinter size={16} aria-hidden="true" />
                Print / PDF
              </button>
            </div>
          </header>
        </div>
      </section>

      <section className="v-section">
        <div className="v-shell">
          {notices.map((notice) => (
            <div className="results-notice" data-tone={notice.tone} key={notice.key}>
              <IconAlertCircle size={17} aria-hidden="true" />
              <div>
                <strong>{notice.title}</strong>
                <p className="v-fine">{notice.body}</p>
              </div>
            </div>
          ))}

          {analysis && uploadResults.length ? (
            <div className="v-card--inset results-uploads">
              <div className="v-section-label">
                <span>Uploaded evidence</span>
                <span>{uploadResults.length}</span>
              </div>
              <div className="v-tiles">
                {uploadResults.map((result, index) => (
                  <div
                    className="results-upload-row"
                    key={`${result.model_type}-${index}`}
                  >
                    <span
                      className={`v-chip ${
                        result.status === "failed"
                          ? "v-chip--danger"
                          : result.contributed
                          ? "v-chip--sage"
                          : ""
                      }`}
                    >
                      {result.status === "failed"
                        ? "Not analyzed"
                        : result.contributed
                        ? "Used in results"
                        : "Analyzed"}
                    </span>
                    <p className="v-fine">
                      <strong>{formatModelName(result.model_type)}:</strong>{" "}
                      {result.message}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {caseFetch.loading ? (
            <div className="v-card results-empty">
              <h2 className="v-title">Loading saved case</h2>
              <p className="v-body">Restoring this result from the server.</p>
            </div>
          ) : !analysis ? (
            <div className="v-card results-empty">
              <span className="v-kicker">Nothing to show yet</span>
              <h2 className="v-title">No results loaded</h2>
              <p className="v-body">
                Run a diagnosis from the intake screen to generate results, or
                open a URL with a <code>case_id</code> parameter.
              </p>
              <Link to="/diagnosis" className="v-btn v-btn--primary">
                Start a diagnosis
              </Link>
            </div>
          ) : (
            <div className="v-split v-split--sidebar results-body">
              <div className="results-main">
                {analysis?.red_flags?.length ? (
                  <div className="v-card results-flags">
                    <div className="v-section-label">
                      <span>
                        <IconAlertTriangle size={14} aria-hidden="true" /> Red
                        flag alerts
                      </span>
                      <span>{analysis.red_flags.length}</span>
                    </div>
                    <ul className="results-flag-list">
                      {analysis.red_flags.map((flag, index) => {
                        const label =
                          typeof flag === "string"
                            ? flag
                            : flag?.message ||
                              flag?.condition ||
                              flag?.rule_id ||
                              "Red flag alert";
                        const key =
                          typeof flag === "string"
                            ? flag
                            : flag?.rule_id || `${label}-${index}`;
                        return <li key={key}>{label}</li>;
                      })}
                    </ul>
                  </div>
                ) : null}

                <div className="v-card">
                  <div className="v-section-label">
                    <span>Ranked differentials</span>
                    <span>{rankedConditions.length}</span>
                  </div>

                  {!rankedConditions.length ? (
                    <p className="v-body">No ranked conditions returned.</p>
                  ) : (
                    <>
                      {visibleConditions.map((dx, index) => {
                        const { combined } = getReasonData(dx.name);
                        const isTop = index === 0;

                        if (isTop) {
                          return (
                            <div className="results-primary" key={dx.name}>
                              <div className="results-dial">
                                <ConfidenceDial value={dx.probability} id="results-dial" />
                              </div>
                              <div>
                                <span className="v-kicker">
                                  Primary diagnosis
                                </span>
                                <h2 className="v-headline results-primary-name">
                                  {formatDxName(dx.name)}
                                </h2>
                                {combined.length ? (
                                  <div className="results-rank-evidence">
                                    {combined.map((reason) => (
                                      <span
                                        className={`v-chip ${
                                          reason.category === "objective"
                                            ? "v-chip--warm"
                                            : "v-chip--sage"
                                        }`}
                                        key={`${dx.name}-top-${reason.featureId}-${reason.source}`}
                                      >
                                        {symptomNameMap.get(reason.featureId) ||
                                          reason.featureId}
                                        <small>
                                          {formatContribution(
                                            reason.contribution
                                          )}
                                        </small>
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div className="results-rank" key={dx.name}>
                            <div className="results-rank-head">
                              <span className="results-rank-name">
                                {formatDxName(dx.name)}
                              </span>
                              <span className="results-rank-value">
                                {(dx.probability * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="v-meter">
                              <span
                                style={{
                                  width: `${Math.min(
                                    100,
                                    dx.probability * 100
                                  )}%`,
                                }}
                              />
                            </div>
                            {combined.length ? (
                              <div className="results-rank-evidence">
                                {combined.map((reason) => (
                                  <span
                                    className="v-chip"
                                    key={`${dx.name}-${reason.featureId}-${reason.source}`}
                                  >
                                    {symptomNameMap.get(reason.featureId) ||
                                      reason.featureId}
                                    <small>
                                      {formatContribution(reason.contribution)}
                                    </small>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="v-fine results-rank-empty">
                                No feature reasons returned.
                              </p>
                            )}
                          </div>
                        );
                      })}

                      {rankedConditions.length > 3 && (
                        <button
                          type="button"
                          className="v-btn results-more"
                          onClick={toggleSecondaryDiagnoses}
                        >
                          {ui.showAllSecondary ? (
                            "Show less"
                          ) : (
                            <>
                              <IconChevronDown size={16} aria-hidden="true" />
                              Show {rankedConditions.length - 3} more condition
                              {rankedConditions.length - 3 > 1 ? "s" : ""}
                            </>
                          )}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              <aside className="v-sticky results-aside">
                <div className="v-card v-card--lit">
                  <span className="v-kicker">Your case</span>
                  <h2 className="v-title">Summary</h2>

                  <dl className="v-rows results-summary-rows">
                    <div className="v-row">
                      <dt>Patient</dt>
                      <dd>{formatDemographics() || "Not provided"}</dd>
                    </div>
                    <div className="v-row">
                      <dt>Symptoms</dt>
                      <dd>{selectedSymptoms.length} selected</dd>
                    </div>
                    <div className="v-row">
                      <dt>History</dt>
                      <dd>{doctorNoteProvided ? "Provided" : "Not added"}</dd>
                    </div>
                    {riskStratification && (
                      <div className="v-row">
                        <dt>Risk level</dt>
                        <dd>
                          <span
                            className={`v-chip ${
                              riskStratification.level === "high"
                                ? "v-chip--danger"
                                : riskStratification.level === "medium"
                                ? "v-chip--warm"
                                : "v-chip--sage"
                            }`}
                          >
                            {riskStratification.label}
                          </span>
                        </dd>
                      </div>
                    )}
                  </dl>

                  {caseId ? (
                    <p className="v-fine results-case-id">Case {caseId}</p>
                  ) : null}
                </div>

                {selectedSymptoms.length > 0 && !data.symptomsError ? (
                  <div className="v-card--quiet results-aside-card">
                    <div className="v-section-label">
                      <span>Selected symptoms</span>
                      <span>{selectedSymptoms.length}</span>
                    </div>
                    <div className="v-chips">
                      {selectedSymptoms.slice(0, 8).map((symptomId) => (
                        <span className="v-chip v-chip--sage" key={symptomId}>
                          {symptomNameMap.get(symptomId) || symptomId}
                        </span>
                      ))}
                    </div>
                    {selectedSymptoms.length > 8 && (
                      <button
                        type="button"
                        className="v-btn v-btn--quiet results-view-all"
                        onClick={toggleSymptomModal}
                      >
                        View all ({selectedSymptoms.length})
                      </button>
                    )}
                  </div>
                ) : null}

                {nextSteps && (
                  <div className="v-card--quiet results-aside-card">
                    <div className="v-section-label">
                      <span>Next steps</span>
                      {primaryDx ? (
                        <span>{formatDxName(primaryDx.name)}</span>
                      ) : null}
                    </div>
                    <p className="results-next-title">{nextSteps.title}</p>
                    <ul className="results-next-list">
                      {nextSteps.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>

                    {primaryRecommendedTests.length > 0 && (
                      <>
                        <div className="v-section-label results-tests-label">
                          <span>Verification tests</span>
                        </div>
                        <div className="v-tiles">
                          {primaryRecommendedTests.map((test) => (
                            <div
                              className="v-card--inset results-test"
                              key={test.test_id}
                            >
                              <strong>{test.display_name}</strong>
                              <small>{test.category}</small>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </aside>
            </div>
          )}
        </div>
      </section>

      <Modal
        opened={ui.symptomModalOpen}
        onClose={toggleSymptomModal}
        title="Selected symptoms"
        centered
        fullScreen={isMobile}
        size="md"
        radius="lg"
        padding="lg"
        overlayProps={{ backgroundOpacity: 0.7, blur: 2, color: "var(--bg)" }}
      >
        {selectedSymptoms.length === 0 ? (
          <p className="v-body">No symptoms selected yet.</p>
        ) : (
          <ScrollArea h={isMobile ? "100%" : 320}>
            <div className="v-chips">
              {selectedSymptoms.map((symptomId) => (
                <span className="v-chip v-chip--sage" key={symptomId}>
                  {symptomNameMap.get(symptomId) || symptomId}
                </span>
              ))}
            </div>
          </ScrollArea>
        )}
      </Modal>
    </div>
  );
}

export default Results;
