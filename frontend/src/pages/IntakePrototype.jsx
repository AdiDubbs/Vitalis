import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Button,
  FileButton,
  NumberInput,
  SegmentedControl,
  Select,
  Textarea,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertCircle,
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconFileDescription,
  IconPhoto,
  IconScan,
  IconSearch,
  IconSparkles,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { createSymptomNameMap } from "../utils/symptomHelpers.js";

const STEPS = ["Patient", "Evidence", "Symptoms & review"];

const EVIDENCE_CATEGORY_ICONS = {
  Radiology: IconScan,
  Dermatology: IconPhoto,
};

const SUGGESTED_SYMPTOM_IDS = [
  "fatigue",
  "fever",
  "sym_cough",
  "sym_shortness_of_breath",
  "sym_headache",
  "sym_chest_pain",
  "sym_abdominal_pain",
  "sym_nausea_vomiting",
  "dizziness",
  "sym_diarrhea",
];

const INITIAL_UPLOADS = {
  doctor_note_upload: null,
  upload_image: null,
  upload_mri: null,
  upload_skin: null,
  upload_fracture: null,
  upload_breast: null,
};

const STEP_FOR_FIELD = {
  age: 0,
  sex: 0,
  doctor_note: 0,
  doctor_note_upload: 0,
  upload_image: 1,
  upload_mri: 1,
  upload_fracture: 1,
  upload_breast: 1,
  upload_skin: 1,
  fracture_body_part: 1,
  symptoms: 2,
};

const formatMaxSize = (bytes) => `${Math.round((bytes || 0) / (1024 * 1024))}MB`;

const validateFile = (file, field) => {
  if (!file || !field) return { valid: true };

  if (field.max_size && file.size > field.max_size) {
    return { valid: false, error: `File size exceeds ${formatMaxSize(field.max_size)} limit.` };
  }

  const fileName = file.name.toLowerCase();
  const isValidType = field.extensions.some((extension) => fileName.endsWith(extension));
  if (!isValidType) {
    return { valid: false, error: `Supported formats: ${field.formats}.` };
  }

  return { valid: true };
};

const stepForErrors = (errors) => {
  const steps = Object.keys(errors).map((key) => STEP_FOR_FIELD[key] ?? 2);
  return steps.length ? Math.min(...steps) : null;
};

function StepRail({ activeStep, setActiveStep }) {
  return (
    <nav className="intake-prototype-steps" aria-label="Diagnostic intake progress">
      {STEPS.map((label, index) => {
        const isActive = index === activeStep;
        const isComplete = index < activeStep;

        return (
          <div className="intake-prototype-step-wrap" key={label}>
            <button
              type="button"
              className="intake-prototype-step"
              data-active={isActive || undefined}
              data-complete={isComplete || undefined}
              onClick={() => setActiveStep(index)}
              aria-current={isActive ? "step" : undefined}
            >
              <span className="intake-prototype-step-number" aria-hidden="true">
                {isComplete ? <IconCheck size={15} stroke={2.4} /> : index + 1}
              </span>
              <span>{label}</span>
            </button>
            {index < STEPS.length - 1 && (
              <span className="intake-prototype-step-line" aria-hidden="true" />
            )}
          </div>
        );
      })}
    </nav>
  );
}

function CaseReview({ age, sex, historyProvided, evidenceCount, symptomLabels }) {
  const patient = age || sex ? [age ? `${age} years` : null, sex].filter(Boolean).join(", ") : "Not provided";
  const completedAreas = [age || sex, historyProvided, evidenceCount, symptomLabels.length].filter(
    Boolean
  ).length;

  const rows = [
    ["Patient", patient],
    ["History", historyProvided ? "Added" : "Not added"],
    ["Evidence", `${evidenceCount} ${evidenceCount === 1 ? "file" : "files"}`],
    ["Symptoms", `${symptomLabels.length} selected`],
  ];

  return (
    <aside className="intake-prototype-review" aria-label="Case review">
      <div className="intake-prototype-review-heading">
        <span className="intake-prototype-kicker">Your case</span>
        <h2>Taking shape</h2>
        <p>Everything you add stays visible while you move through the intake.</p>
      </div>
      <div className="intake-prototype-progress" aria-label={`${completedAreas} of 4 case areas added`}>
        <span style={{ width: `${(completedAreas / 4) * 100}%` }} />
      </div>
      <p className="intake-prototype-progress-label">{completedAreas} of 4 areas added</p>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {symptomLabels.length > 0 && (
        <div className="intake-prototype-review-symptoms">
          <span className="intake-prototype-review-symptoms-label">Selected symptoms</span>
          <div className="intake-prototype-review-symptom-chips">
            {symptomLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

function PatientStep({ age, setAge, sex, setSex, note, setNote, noteFile, onNoteFileChange, schema, errors, clearError }) {
  const [noteMode, setNoteMode] = useState("type");
  const uploadRule = schema?.uploads?.doctor_note_upload;

  return (
    <section className="intake-prototype-step-content" aria-labelledby="patient-step-title">
      <header>
        <span className="intake-prototype-kicker">Step 1 · Begin with the person</span>
        <h1 id="patient-step-title">Patient information</h1>
        <p>A little context helps Vitalis interpret every symptom and result more thoughtfully.</p>
      </header>

      <div className="intake-prototype-field-grid">
        <NumberInput
          label="Age"
          name="age"
          placeholder="e.g., 42…"
          autoComplete="off"
          min={schema?.age?.min ?? 0}
          max={schema?.age?.max ?? 120}
          value={age}
          onChange={(value) => {
            setAge(value);
            clearError("age");
          }}
          clampBehavior="strict"
          error={errors.age}
          classNames={{ root: "intake-prototype-field" }}
        />
        <Select
          label="Sex"
          name="sex"
          placeholder="Select sex…"
          autoComplete="off"
          data={schema?.sex?.options || []}
          value={sex}
          onChange={(value) => {
            setSex(value || "");
            clearError("sex");
          }}
          clearable
          error={errors.sex}
          classNames={{ root: "intake-prototype-field" }}
        />
      </div>

      <div className="intake-prototype-history">
        <label>Medical history</label>
        <SegmentedControl
          aria-label="Medical history input method"
          value={noteMode}
          onChange={setNoteMode}
          data={[
            { value: "type", label: "Type notes" },
            { value: "upload", label: "Upload transcript" },
          ]}
          fullWidth
        />
        {noteMode === "type" ? (
          <Textarea
            aria-label="Medical history notes"
            name="medical_history"
            autoComplete="off"
            placeholder="Enter medical history, past diagnoses, treatments, and relevant context…"
            minRows={5}
            autosize
            value={note}
            onChange={(event) => {
              setNote(event.currentTarget.value);
              clearError("doctor_note");
            }}
            maxLength={schema?.doctor_note?.max_length}
            error={errors.doctor_note}
          />
        ) : (
          <>
            <FileButton
              accept={uploadRule?.extensions?.join(",") || ".txt"}
              onChange={(file) => onNoteFileChange(file)}
            >
              {(props) => (
                <button type="button" className="intake-prototype-upload" {...props}>
                  <IconUpload size={20} aria-hidden="true" />
                  <span>{noteFile?.name || "Choose a transcript"}</span>
                  <small>
                    {uploadRule?.formats || "TXT"}, up to {formatMaxSize(uploadRule?.max_size || 1048576)}
                  </small>
                </button>
              )}
            </FileButton>
            {errors.doctor_note_upload && (
              <p className="intake-prototype-field-error">{errors.doctor_note_upload}</p>
            )}
          </>
        )}
        <p className="intake-prototype-helper">
          Include key conditions, surgeries, medications, allergies, and relevant family history.
        </p>
      </div>
    </section>
  );
}

function EvidenceStep({
  schema,
  uploads,
  onFileChange,
  onFileClear,
  fractureBodyPart,
  setFractureBodyPart,
  errors,
  clearError,
}) {
  const fileCategories = useMemo(() => {
    if (!schema?.uploads) return [];
    return Object.entries(schema.uploads)
      .filter(([key]) => key !== "doctor_note_upload")
      .reduce((categories, [key, rule]) => {
        const categoryName = rule.category;
        const category = categories.find((item) => item.category === categoryName);
        const field = { key, ...rule };
        if (category) {
          category.fields.push(field);
        } else {
          categories.push({
            category: categoryName,
            icon: EVIDENCE_CATEGORY_ICONS[categoryName] || IconUpload,
            fields: [field],
          });
        }
        return categories;
      }, []);
  }, [schema]);

  const attachedCount = Object.entries(uploads).filter(
    ([key, value]) => key !== "doctor_note_upload" && value
  ).length;

  return (
    <section className="intake-prototype-step-content" aria-labelledby="evidence-step-title">
      <header>
        <span className="intake-prototype-kicker">Step 2 · Add what you have</span>
        <h1 id="evidence-step-title">Add clinical evidence</h1>
        <p>Attach only what is available. This step is optional.</p>
      </header>

      {fileCategories.length === 0 ? (
        <p className="intake-prototype-helper">Loading supported evidence types…</p>
      ) : (
        fileCategories.map((category) => {
          const CategoryIcon = category.icon;
          return (
            <div className="intake-prototype-evidence-group" key={category.category}>
              <div className="intake-prototype-evidence-section-label">
                <span>
                  <CategoryIcon size={15} stroke={1.8} aria-hidden="true" /> {category.category}
                </span>
              </div>
              <div className="intake-prototype-evidence-list">
                {category.fields.map((field) => {
                  const file = uploads[field.key];
                  return (
                    <div
                      key={field.key}
                      className="intake-prototype-evidence-row"
                      data-selected={file || undefined}
                    >
                      <CategoryIcon size={22} stroke={1.7} aria-hidden="true" />
                      <span>
                        <strong>{field.label}</strong>
                        <small>
                          {file ? file.name : `${field.formats} · Max ${formatMaxSize(field.max_size)}`}
                        </small>
                        {errors[field.key] && (
                          <small className="intake-prototype-field-error">{errors[field.key]}</small>
                        )}
                      </span>
                      {file ? (
                        <button
                          type="button"
                          className="intake-prototype-evidence-remove"
                          onClick={() => onFileClear(field.key)}
                          aria-label={`Remove ${field.label}`}
                        >
                          <IconX size={16} aria-hidden="true" />
                        </button>
                      ) : (
                        <FileButton
                          accept={field.extensions.join(",")}
                          onChange={(selectedFile) => onFileChange(field.key, selectedFile)}
                        >
                          {(props) => (
                            <button type="button" className="intake-prototype-evidence-upload-button" {...props}>
                              <IconUpload size={15} stroke={1.8} aria-hidden="true" />
                              Add file
                            </button>
                          )}
                        </FileButton>
                      )}
                    </div>
                  );
                })}
              </div>
              {category.fields.some((field) => field.key === "upload_fracture") && uploads.upload_fracture && (
                <Select
                  placeholder="Select body part shown in the fracture image"
                  data={schema?.fracture_body_part?.options || []}
                  value={fractureBodyPart}
                  onChange={(value) => {
                    setFractureBodyPart(value || "");
                    clearError("fracture_body_part");
                  }}
                  clearable
                  error={errors.fracture_body_part}
                  classNames={{ root: "intake-prototype-field intake-prototype-fracture-select" }}
                />
              )}
            </div>
          );
        })
      )}

      <p className="intake-prototype-notice">
        {attachedCount} {attachedCount === 1 ? "file" : "files"} attached.
      </p>
    </section>
  );
}

function SymptomsStep({
  symptomLibrary,
  selectedSymptoms,
  onToggleSymptom,
  onClearSymptoms,
  followUpSymptoms,
  loadingFollowUps,
  query,
  setQuery,
  activeCategory,
  setActiveCategory,
  symptomNameMap,
  error,
}) {
  const allSymptomsByBucket = useMemo(() => {
    const results = [];
    Object.entries(symptomLibrary.buckets).forEach(([bucket, bucketData]) => {
      if (Array.isArray(bucketData)) {
        bucketData.forEach((symptom) => results.push({ symptom, bucket }));
      }
    });
    return results;
  }, [symptomLibrary.buckets]);

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return allSymptomsByBucket.filter(({ symptom }) =>
      `${symptom?.id || ""} ${symptom?.text || ""}`.toLowerCase().includes(q)
    );
  }, [allSymptomsByBucket, query]);

  const categoryResults = useMemo(() => {
    if (!activeCategory) return [];
    return allSymptomsByBucket.filter(({ bucket }) => bucket === activeCategory);
  }, [allSymptomsByBucket, activeCategory]);

  const suggestedSymptoms = useMemo(() => {
    const fromIds = SUGGESTED_SYMPTOM_IDS.map((id) => ({ id, text: symptomNameMap.get(id) })).filter(
      (symptom) => symptom.text
    );
    if (fromIds.length) return fromIds;

    const flattened = [];
    symptomLibrary.bucketOrder.forEach((bucket) => {
      const bucketData = symptomLibrary.buckets[bucket];
      if (Array.isArray(bucketData)) flattened.push(...bucketData);
    });
    return flattened.slice(0, 10);
  }, [symptomNameMap, symptomLibrary]);

  const selectedLabels = useMemo(
    () => Array.from(selectedSymptoms).map((id) => symptomNameMap.get(id) || id),
    [selectedSymptoms, symptomNameMap]
  );

  const hasQuery = Boolean(query.trim());
  const resultsToDisplay = hasQuery ? searchResults : activeCategory ? categoryResults : null;

  const groupedResults = useMemo(() => {
    if (!resultsToDisplay) return [];
    const grouped = new Map();
    resultsToDisplay.forEach(({ bucket, symptom }) => {
      if (!grouped.has(bucket)) grouped.set(bucket, []);
      grouped.get(bucket).push(symptom);
    });
    const orderedBuckets = [
      ...symptomLibrary.bucketOrder,
      ...Array.from(grouped.keys()).filter((bucket) => !symptomLibrary.bucketOrder.includes(bucket)),
    ];
    return orderedBuckets
      .filter((bucket) => grouped.has(bucket))
      .map((bucket) => ({ bucket, symptoms: grouped.get(bucket) }));
  }, [resultsToDisplay, symptomLibrary.bucketOrder]);

  return (
    <section className="intake-prototype-step-content" aria-labelledby="symptoms-step-title">
      <header>
        <span className="intake-prototype-kicker">Step 3 · Connect the clues</span>
        <h1 id="symptoms-step-title">Symptoms &amp; review</h1>
        <p>Select the findings that should shape the differential.</p>
      </header>

      {error && <p className="intake-prototype-field-error intake-prototype-banner-error">{error}</p>}

      {selectedLabels.length > 0 && (
        <div className="intake-prototype-selected-symptoms">
          <div className="intake-prototype-evidence-section-label">
            <span>{selectedLabels.length} selected</span>
            <button type="button" className="intake-prototype-clear-link" onClick={onClearSymptoms}>
              Clear all
            </button>
          </div>
          <div className="intake-prototype-selected-chips">
            {Array.from(selectedSymptoms).map((id) => (
              <button type="button" key={id} onClick={() => onToggleSymptom(id)}>
                {symptomNameMap.get(id) || id}
                <IconX size={13} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}

      <TextInput
        label="Find symptoms"
        name="symptom_search"
        autoComplete="off"
        placeholder="Search symptoms…"
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        leftSection={<IconSearch size={18} aria-hidden="true" />}
        classNames={{ root: "intake-prototype-field" }}
      />

      {symptomLibrary.bucketOrder.length > 0 && (
        <div className="intake-prototype-categories" role="group" aria-label="Filter by category">
          {symptomLibrary.bucketOrder.map((bucket) => (
            <button
              type="button"
              key={bucket}
              data-active={activeCategory === bucket || undefined}
              onClick={() => setActiveCategory(activeCategory === bucket ? null : bucket)}
            >
              {bucket}
            </button>
          ))}
        </div>
      )}

      {symptomLibrary.loading ? (
        <p className="intake-prototype-helper">Loading symptom library…</p>
      ) : symptomLibrary.error ? (
        <p className="intake-prototype-field-error">{symptomLibrary.error}</p>
      ) : resultsToDisplay === null ? (
        <div className="intake-prototype-symptoms">
          {suggestedSymptoms.map((symptom) => {
            const selected = selectedSymptoms.has(symptom.id);
            return (
              <button
                type="button"
                key={symptom.id}
                data-selected={selected || undefined}
                aria-pressed={selected}
                onClick={() => onToggleSymptom(symptom.id)}
              >
                <span>{symptom.text}</span>
                {selected && <IconCheck size={17} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      ) : groupedResults.length === 0 ? (
        <p className="intake-prototype-helper">No matching symptoms. Try a different search or category.</p>
      ) : (
        <div className="intake-prototype-symptom-groups">
          {groupedResults.map(({ bucket, symptoms }) => (
            <div key={bucket} className="intake-prototype-symptom-group">
              <div className="intake-prototype-evidence-section-label">
                <span>{bucket}</span>
                <span>{symptoms.length}</span>
              </div>
              <div className="intake-prototype-symptoms">
                {symptoms.map((symptom) => {
                  const selected = selectedSymptoms.has(symptom.id);
                  return (
                    <button
                      type="button"
                      key={symptom.id}
                      data-selected={selected || undefined}
                      aria-pressed={selected}
                      onClick={() => onToggleSymptom(symptom.id)}
                    >
                      <span>{symptom.text}</span>
                      {selected && <IconCheck size={17} aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {followUpSymptoms.length > 0 && (
        <div className="intake-prototype-followups">
          <div className="intake-prototype-evidence-section-label">
            <span>
              <IconSparkles size={14} aria-hidden="true" /> Suggested follow-ups
            </span>
            <span>{followUpSymptoms.length}</span>
          </div>
          {loadingFollowUps ? (
            <p className="intake-prototype-helper">Loading suggestions…</p>
          ) : (
            <div className="intake-prototype-symptoms">
              {followUpSymptoms.slice(0, 8).map((symptom) => (
                <button type="button" key={symptom.id} onClick={() => onToggleSymptom(symptom.id)}>
                  <span>{symptom.text}</span>
                  <IconArrowRight size={15} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function IntakePrototype() {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);

  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [note, setNote] = useState("");
  const [uploads, setUploads] = useState(INITIAL_UPLOADS);
  const [fractureBodyPart, setFractureBodyPart] = useState("");
  const [selectedSymptoms, setSelectedSymptoms] = useState(new Set());

  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(null);

  const [validationErrors, setValidationErrors] = useState({});
  const [submitState, setSubmitState] = useState({ loading: false, error: "" });
  const [pendingConfirm, setPendingConfirm] = useState(false);

  const [intakeSchema, setIntakeSchema] = useState({ loading: true, data: null, error: "" });
  const [symptomLibrary, setSymptomLibrary] = useState({
    buckets: {},
    bucketOrder: [],
    loading: true,
    error: "",
  });
  const [followUpSymptoms, setFollowUpSymptoms] = useState([]);
  const [loadingFollowUps, setLoadingFollowUps] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/intake-schema");
        if (!response.ok) throw new Error("Could not load intake validation rules.");
        const data = await response.json();
        if (active) setIntakeSchema({ loading: false, data, error: "" });
      } catch (error) {
        if (active) {
          setIntakeSchema({
            loading: false,
            data: null,
            error: error.message || "Could not load intake validation rules.",
          });
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/symptoms");
        if (!response.ok) throw new Error("Could not load symptom categories.");
        const data = await response.json();
        if (active) {
          setSymptomLibrary({
            buckets: data.buckets || {},
            bucketOrder: data.metadata?.bucketOrder || [],
            loading: false,
            error: "",
          });
        }
      } catch (error) {
        if (active) {
          setSymptomLibrary({
            buckets: {},
            bucketOrder: [],
            loading: false,
            error: error.message || "Could not load symptoms.",
          });
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const symptomNameMap = useMemo(() => createSymptomNameMap(symptomLibrary.buckets), [symptomLibrary.buckets]);

  useEffect(() => {
    if (selectedSymptoms.size === 0) {
      setFollowUpSymptoms([]);
      return;
    }

    let active = true;
    setLoadingFollowUps(true);
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch("/api/follow_ups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selected_symptoms: Array.from(selectedSymptoms) }),
        });
        if (!response.ok) throw new Error("Failed to fetch follow-ups");
        const data = await response.json();
        const payload = Array.isArray(data) ? data : data.follow_up_data || [];
        const followUps = payload
          .filter((item) => item?.id && !selectedSymptoms.has(item.id))
          .map((item) => ({ id: item.id, text: item.text || symptomNameMap.get(item.id) || item.id }))
          .filter((item) => item.text);
        if (active) setFollowUpSymptoms(followUps);
      } catch {
        if (active) setFollowUpSymptoms([]);
      } finally {
        if (active) setLoadingFollowUps(false);
      }
    }, 500);

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [selectedSymptoms, symptomNameMap]);

  const clearError = (key) => {
    setValidationErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  };

  const handleFileChange = (fieldKey, file) => {
    if (!file) return;
    const field = intakeSchema.data?.uploads?.[fieldKey];
    const validation = validateFile(file, field);
    if (!validation.valid) {
      notifications.show({
        color: "red",
        title: "File validation failed",
        message: validation.error,
        autoClose: 5000,
      });
      return;
    }
    setUploads((prev) => ({ ...prev, [fieldKey]: file }));
    clearError(fieldKey);
  };

  const handleFileClear = (fieldKey) => {
    setUploads((prev) => ({ ...prev, [fieldKey]: null }));
    if (fieldKey === "upload_fracture") {
      setFractureBodyPart("");
      clearError("fracture_body_part");
    }
    clearError(fieldKey);
  };

  const toggleSymptom = (symptomId) => {
    clearError("symptoms");
    setSelectedSymptoms((prev) => {
      const next = new Set(prev);
      if (next.has(symptomId)) next.delete(symptomId);
      else next.add(symptomId);
      return next;
    });
  };

  const clearSymptoms = () => setSelectedSymptoms(new Set());

  const historyProvided = Boolean(note.trim()) || Boolean(uploads.doctor_note_upload);
  const evidenceCount = Object.entries(uploads).filter(
    ([key, value]) => key !== "doctor_note_upload" && value
  ).length;
  const selectedLabelsForReview = useMemo(
    () => Array.from(selectedSymptoms).map((id) => symptomNameMap.get(id) || id),
    [selectedSymptoms, symptomNameMap]
  );
  const sexLabel = useMemo(() => {
    const options = intakeSchema.data?.sex?.options || [];
    return options.find((option) => option.value === sex)?.label || sex;
  }, [sex, intakeSchema.data]);

  const next = () => setActiveStep((step) => Math.min(step + 1, STEPS.length - 1));
  const previous = () => setActiveStep((step) => Math.max(step - 1, 0));

  const runClientValidation = () => {
    const schema = intakeSchema.data;
    const errors = {};
    if (age !== "" && age !== null && age !== undefined) {
      const parsedAge = Number(age);
      if (!Number.isInteger(parsedAge) || parsedAge < schema.age.min || parsedAge > schema.age.max) {
        errors.age = `Age must be between ${schema.age.min} and ${schema.age.max}.`;
      }
    }
    if (sex && !schema.sex.options.some((option) => option.value === sex)) {
      errors.sex = "Select either Male or Female.";
    }
    if (selectedSymptoms.size > schema.symptoms.max_items) {
      errors.symptoms = `Select at most ${schema.symptoms.max_items} symptoms.`;
    }
    if (note.length > schema.doctor_note.max_length) {
      errors.doctor_note = `Clinical notes must be at most ${schema.doctor_note.max_length} characters.`;
    }
    if (uploads.upload_fracture && !fractureBodyPart) {
      errors.fracture_body_part = "Select the body part shown in the fracture image.";
    }
    return errors;
  };

  const performSubmit = async () => {
    if (!intakeSchema.data) {
      setSubmitState({ loading: false, error: "Intake validation rules are unavailable. Refresh and try again." });
      return;
    }

    const errors = runClientValidation();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      const step = stepForErrors(errors);
      if (step !== null) setActiveStep(step);
      setSubmitState({ loading: false, error: "Please correct the highlighted fields before running analysis." });
      return;
    }

    setValidationErrors({});
    setSubmitState({ loading: true, error: "" });

    try {
      const formData = new FormData();
      if (age !== "" && age !== null && age !== undefined) formData.append("age", String(age));
      if (sex) formData.append("sex", sex);
      if (note.trim()) formData.append("doctor_note", note.trim());
      formData.append("symptoms", JSON.stringify(Array.from(selectedSymptoms)));
      Object.entries(uploads).forEach(([key, value]) => {
        if (value) formData.append(key, value);
      });
      if (fractureBodyPart) formData.append("fracture_body_part", fractureBodyPart);

      const response = await fetch("/api/submit", { method: "POST", body: formData });
      const data = await response.json();

      if (!response.ok || data.status !== "success") {
        if (data.errors) {
          setValidationErrors(data.errors);
          const step = stepForErrors(data.errors);
          if (step !== null) setActiveStep(step);
        }
        throw new Error(data.message || "Submission failed.");
      }

      notifications.show({ color: "teal", title: "Analysis ready", message: "Redirecting to results." });

      navigate(`/results?case_id=${encodeURIComponent(data.case_id)}`, {
        state: {
          analysis: data.analysis,
          caseId: data.case_id,
          selectedSymptoms: Array.from(selectedSymptoms),
          doctorNoteProvided: Boolean(note.trim()),
          age,
          sex,
        },
      });
      setSubmitState({ loading: false, error: "" });
    } catch (error) {
      setSubmitState({
        loading: false,
        error: `${error.message || "Submission failed."} Check patient details and uploads, then try again.`,
      });
    }
  };

  const handleSubmit = () => {
    if (selectedSymptoms.size === 0 && !pendingConfirm) {
      setPendingConfirm(true);
      return;
    }
    setPendingConfirm(false);
    performSubmit();
  };

  const isLastStep = activeStep === STEPS.length - 1;

  return (
    <div className="intake-prototype-page">
      <header className="intake-prototype-header">
        <Link to="/" className="intake-prototype-brand" aria-label="Vitalis home">
          <span aria-hidden="true" />
          Vitalis
        </Link>
        <Link to="/" className="intake-prototype-exit">
          Exit
        </Link>
      </header>

      <main className="intake-prototype-main">
        <StepRail activeStep={activeStep} setActiveStep={setActiveStep} />

        <div className="intake-prototype-workspace">
          <div className="intake-prototype-primary">
            {activeStep === 0 && (
              <PatientStep
                age={age}
                setAge={setAge}
                sex={sex}
                setSex={setSex}
                note={note}
                setNote={setNote}
                noteFile={uploads.doctor_note_upload}
                onNoteFileChange={(file) => handleFileChange("doctor_note_upload", file)}
                schema={intakeSchema.data}
                errors={validationErrors}
                clearError={clearError}
              />
            )}
            {activeStep === 1 && (
              <EvidenceStep
                schema={intakeSchema.data}
                uploads={uploads}
                onFileChange={handleFileChange}
                onFileClear={handleFileClear}
                fractureBodyPart={fractureBodyPart}
                setFractureBodyPart={setFractureBodyPart}
                errors={validationErrors}
                clearError={clearError}
              />
            )}
            {activeStep === 2 && (
              <SymptomsStep
                symptomLibrary={symptomLibrary}
                selectedSymptoms={selectedSymptoms}
                onToggleSymptom={toggleSymptom}
                onClearSymptoms={clearSymptoms}
                followUpSymptoms={followUpSymptoms}
                loadingFollowUps={loadingFollowUps}
                query={query}
                setQuery={setQuery}
                activeCategory={activeCategory}
                setActiveCategory={setActiveCategory}
                symptomNameMap={symptomNameMap}
                error={validationErrors.symptoms}
              />
            )}
          </div>

          <CaseReview
            age={age}
            sex={sexLabel}
            historyProvided={historyProvided}
            evidenceCount={evidenceCount}
            symptomLabels={selectedLabelsForReview}
          />
        </div>

        {pendingConfirm && (
          <div className="intake-prototype-confirm" role="alertdialog" aria-label="Confirm submission without symptoms">
            <p>
              <IconAlertCircle size={16} aria-hidden="true" /> No symptoms selected. Running analysis without
              symptoms may produce limited or inaccurate results.
            </p>
            <div>
              <Button variant="subtle" color="gray" onClick={() => setPendingConfirm(false)}>
                Go back
              </Button>
              <Button color="orange" onClick={handleSubmit}>
                Continue anyway
              </Button>
            </div>
          </div>
        )}

        {submitState.error && !pendingConfirm && (
          <p className="intake-prototype-field-error intake-prototype-banner-error">{submitState.error}</p>
        )}

        <footer className="intake-prototype-actions">
          <div className="intake-prototype-action-bar">
            <div>
              {activeStep > 0 ? (
                <Button variant="subtle" color="gray" leftSection={<IconArrowLeft size={17} />} onClick={previous}>
                  Back
                </Button>
              ) : (
                <Button component={Link} to="/" variant="subtle" color="gray">
                  Save and exit
                </Button>
              )}
            </div>

            <div className="intake-prototype-action-status" aria-live="polite">
              {!isLastStep ? (
                <Button rightSection={<IconArrowRight size={17} />} onClick={next}>
                  {activeStep === 0 ? "Continue to evidence" : "Continue to symptoms"}
                </Button>
              ) : (
                <Button
                  leftSection={<IconFileDescription size={17} />}
                  onClick={handleSubmit}
                  loading={submitState.loading}
                  disabled={intakeSchema.loading || Boolean(intakeSchema.error)}
                >
                  Run analysis
                </Button>
              )}
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default IntakePrototype;
