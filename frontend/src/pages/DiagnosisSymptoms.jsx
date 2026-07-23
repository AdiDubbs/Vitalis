import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  ActionIcon,
  Badge,
  Button,
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertCircle,
  IconArrowRight,
  IconSearch,
  IconSparkles,
  IconX,
} from "@tabler/icons-react";

const getSymptomText = (symptom) =>
  `${symptom?.id || ""} ${symptom?.text || ""}`.toLowerCase();

const SYMPTOMS_PAGE_SIZE = 12;
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

const CATEGORY_METADATA = {
  "General": {
    description: "Fever, tiredness, weight changes"
  },
  "Respiratory": {
    description: "Cough, breathing problems, chest pain"
  },
  "ENT": {
    description: "Sore throat, runny nose, ear pain"
  },
  "Digestion": {
    description: "Nausea, belly pain, bowel issues"
  },
  "Neurology": {
    description: "Headache, dizziness, weakness, cognition"
  },
  "Mental Health": {
    description: "Mood, anxiety, sleep problems"
  },
  "Cardiology": {
    description: "Chest pain, palpitations, swelling"
  },
  "Urinary": {
    description: "Urination issues, kidney pain"
  },
  "Acute Injuries": {
    description: "Sprains, fractures, acute injuries"
  },
  "Chronic Joint Pain": {
    description: "Chronic pain, stiffness, back issues"
  },
  "Women's Health": {
    description: "Periods, reproductive symptoms"
  },
  "Skin & Appearance": {
    description: "Rashes, itching, skin changes"
  },
  "Physical Exam": {
    description: "Vitals and exam findings"
  },
  "Lab Results": {
    description: "Lab values and test findings"
  },
};

const modalStyles = {
  content: {
    backgroundColor: "var(--surface)",
    border: "1px solid var(--panel-card-border)",
    boxShadow: "0 24px 60px rgba(0, 0, 0, 0.35)",
  },
  header: {
    backgroundColor: "var(--surface)",
    borderBottom: "1px solid var(--panel-card-border)",
  },
  title: {
    color: "var(--mantine-color-gray-0)",
    fontWeight: 600,
  },
  close: {
    color: "var(--mantine-color-gray-3)",
    "&:hover": {
      backgroundColor: "var(--surface-elevated)",
    },
  },
  body: {
    backgroundColor: "var(--surface)",
  },
};

function DiagnosisSymptoms({
  age,
  sex,
  doctorNote,
  fractureBodyPart,
  uploads,
  selectedSymptoms,
  setSelectedSymptoms,
  setSubmitHandler,
  setIsSubmitting,
  activeCategory,
  intakeSchema,
  validationErrors,
  setValidationErrors,
}) {
  const navigate = useNavigate();
  const activeCategoryDescription = activeCategory
    ? CATEGORY_METADATA[activeCategory]?.description || ""
    : "";

  const [symptomData, setSymptomData] = useState({
    buckets: {},
    bucketOrder: [],
    loading: true,
    error: "",
  });

  const [ui, setUi] = useState({
    query: "",
    confirmModalOpen: false,
  });

  const [submit, setSubmit] = useState({
    loading: false,
    error: "",
  });

  const [followUpSymptoms, setFollowUpSymptoms] = useState([]);
  const [loadingFollowUps, setLoadingFollowUps] = useState(false);

  useEffect(() => {
    setSubmitHandler(() => handleSubmit);
    return () => setSubmitHandler(null);
  }, [selectedSymptoms, setSubmitHandler]);

  useEffect(() => {
    let isMounted = true;
    const loadSymptoms = async () => {
      setSymptomData(prev => ({ ...prev, loading: true, error: "" }));
      try {
        const response = await fetch("/api/symptoms");
        if (!response.ok) {
          throw new Error("Unable to load symptom library.");
        }
        const data = await response.json();
        if (isMounted) {
          setSymptomData({
            buckets: data.buckets || {},
            bucketOrder: data.metadata?.bucketOrder || [],
            loading: false,
            error: "",
          });
        }
      } catch (error) {
        if (isMounted) {
          setSymptomData(prev => ({
            ...prev,
            loading: false,
            error: error.message || "Unable to load symptoms.",
          }));
        }
      }
    };

    loadSymptoms();
    return () => {
      isMounted = false;
    };
  }, []);

  const symptomNameMap = useMemo(() => {
    const map = new Map();
    Object.values(symptomData.buckets).forEach((bucketData) => {
      if (Array.isArray(bucketData)) {
        bucketData.forEach((symptom) => {
          if (symptom?.id) {
            map.set(symptom.id, symptom.text || symptom.id);
          }
        });
      }
    });
    return map;
  }, [symptomData.buckets]);

  useEffect(() => {
    const fetchFollowUps = async () => {
      if (selectedSymptoms.size === 0) {
        setFollowUpSymptoms([]);
        return;
      }

      setLoadingFollowUps(true);
      try {
        const response = await fetch("/api/follow_ups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selected_symptoms: Array.from(selectedSymptoms)
          })
        });

        if (!response.ok) throw new Error("Failed to fetch follow-ups");

        const data = await response.json();
        const followUpPayload = Array.isArray(data)
          ? data
          : (data.follow_up_data || []);

        const followUps = followUpPayload
          .filter((item) => item?.id && !selectedSymptoms.has(item.id))
          .map((item) => ({
            id: item.id,
            text: item.text || symptomNameMap.get(item.id) || item.id,
          }))
          .filter((item) => item.text);

        setFollowUpSymptoms(followUps);
      } catch (error) {
        console.error("Error fetching follow-ups:", error);
        setFollowUpSymptoms([]);
      } finally {
        setLoadingFollowUps(false);
      }
    };

    // Debounce: wait 500ms after symptoms change
    const timeoutId = setTimeout(fetchFollowUps, 500);
    return () => clearTimeout(timeoutId);
  }, [selectedSymptoms, symptomNameMap]);

  const suggestedSymptoms = useMemo(() => {
    return SUGGESTED_SYMPTOM_IDS.map((id) => ({
      id,
      text: symptomNameMap.get(id),
    })).filter((symptom) => symptom.text);
  }, [symptomNameMap]);

  const defaultSuggestions = useMemo(() => {
    const allSymptoms = [];
    symptomData.bucketOrder.forEach((bucket) => {
      const bucketData = symptomData.buckets[bucket];
      if (!bucketData) return;

      if (Array.isArray(bucketData)) {
        allSymptoms.push(...bucketData);
      }
    });

    return allSymptoms.slice(0, SYMPTOMS_PAGE_SIZE);
  }, [symptomData.buckets, symptomData.bucketOrder]);

  const initialSuggestions = suggestedSymptoms.length
    ? suggestedSymptoms
    : defaultSuggestions;

  const allSymptomsByBucket = useMemo(() => {
    const results = [];

    Object.entries(symptomData.buckets).forEach(([bucket, bucketData]) => {
      if (Array.isArray(bucketData)) {
        bucketData.forEach((symptom) => {
          results.push({ symptom, bucket });
        });
      }
    });

    return results;
  }, [symptomData.buckets]);

  const searchResults = useMemo(() => {
    if (!ui.query.trim()) return [];
    const query = ui.query.trim().toLowerCase();

    return allSymptomsByBucket.filter(({ symptom }) =>
      getSymptomText(symptom).includes(query)
    );
  }, [allSymptomsByBucket, ui.query]);

  const filteredResults = useMemo(() => {
    if (!activeCategory) return allSymptomsByBucket;

    return allSymptomsByBucket.filter(({ bucket }) => bucket === activeCategory);
  }, [allSymptomsByBucket, activeCategory]);

  const handleSymptomToggle = (symptomId) => {
    setValidationErrors((previous) => {
      if (!previous.symptoms) return previous;
      const next = { ...previous };
      delete next.symptoms;
      return next;
    });
    setSelectedSymptoms((prev) => {
      const next = new Set(prev);
      if (next.has(symptomId)) {
        next.delete(symptomId);
      } else {
        next.add(symptomId);
      }
      return next;
    });
  };

  const handleSubmit = () => {
    if (selectedSymptoms.size === 0) {
      setUi(prev => ({ ...prev, confirmModalOpen: true }));
      return;
    }

    performSubmit();
  };

  const performSubmit = async () => {
    if (!intakeSchema.data) {
      setSubmit({
        loading: false,
        error: "Intake validation rules are unavailable. Refresh and try again.",
      });
      return;
    }

    const errors = {};
    const schema = intakeSchema.data;
    if (age !== "" && age !== null) {
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
    if (doctorNote.length > schema.doctor_note.max_length) {
      errors.doctor_note = `Clinical notes must be at most ${schema.doctor_note.max_length} characters.`;
    }
    if (uploads.upload_fracture && !fractureBodyPart) {
      errors.fracture_body_part = "Select the body part shown in the fracture image.";
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setSubmit({
        loading: false,
        error: "Please correct the highlighted fields before running analysis.",
      });
      return;
    }

    setValidationErrors({});
    setSubmit({ loading: true, error: "" });
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      if (age !== "" && age !== null) {
        formData.append("age", String(age));
      }
      if (sex) {
        formData.append("sex", sex);
      }
      if (doctorNote.trim()) {
        formData.append("doctor_note", doctorNote.trim());
      }

      formData.append("symptoms", JSON.stringify(Array.from(selectedSymptoms)));

      Object.entries(uploads).forEach(([key, value]) => {
        if (value) {
          formData.append(key, value);
        }
      });

      if (fractureBodyPart) {
        formData.append("fracture_body_part", fractureBodyPart);
      }

      const response = await fetch("/api/submit", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok || data.status !== "success") {
        if (data.errors) {
          setValidationErrors(data.errors);
        }
        throw new Error(data.message || "Submission failed.");
      }

      console.log("Model Analysis Output:", data.summary);

      notifications.show({
        color: "teal",
        title: "Analysis ready",
        message: "Redirecting to results.",
      });

      navigate(`/results?case_id=${encodeURIComponent(data.case_id)}`, {
        state: {
          analysis: data.analysis,
          caseId: data.case_id,
          selectedSymptoms: Array.from(selectedSymptoms),
          doctorNoteProvided: Boolean(doctorNote.trim()),
          age,
          sex,
        },
      });
      setIsSubmitting(false);
    } catch (error) {
      setSubmit({
        loading: false,
        error: `${error.message || "Submission failed."} Check patient details and uploads, then try again.`,
      });
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Stack gap="lg">
        <Paper
              id="section-symptoms"
              radius="lg"
              p="lg"
              className="panel-card"
            >
              <Stack gap="md">
              <Stack gap="xs">
                <Group gap="xs">
                  <ThemeIcon variant="light" color="cyan" size="md" radius="lg">
                    <IconSparkles size={16} />
                  </ThemeIcon>
                  <Text className="card-heading">
                    Symptom selection
                  </Text>
                </Group>
                <Text size="sm" c="dimmed">
                  Search, filter, or start with common symptoms to build a focused list.
                </Text>
              </Stack>
                <Divider />

                {validationErrors.symptoms && (
                  <Alert
                    icon={<IconAlertCircle size={16} />}
                    color="red"
                    title="Symptom selection needs attention"
                  >
                    {validationErrors.symptoms}
                  </Alert>
                )}

                <TextInput
                  placeholder="Search symptoms"
                  value={ui.query}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setUi(prev => ({ ...prev, query: value }));
                  }}
                  leftSection={<IconSearch size={16} />}
                  rightSection={
                    ui.query && (
                      <ActionIcon
                        variant="subtle"
                        size="sm"
                        onClick={() => setUi(prev => ({ ...prev, query: "" }))}
                        aria-label="Clear search"
                      >
                        <IconX size={16} />
                      </ActionIcon>
                    )
                  }
                  classNames={{
                    wrapper: "symptom-search-wrapper",
                    input: "symptom-search-input",
                  }}
                  styles={{
                    input: {
                      backgroundColor: "var(--surface-elevated)",
                      fontSize: "1rem",
                      lineHeight: 1.6,
                      caretColor: "var(--mantine-color-cyan-6)",
                      transition: "border-color 180ms ease",
                    },
                  }}
                />
                {activeCategory && (
                  <Text size="xs" c="dimmed">
                    {activeCategoryDescription
                      ? `${activeCategory}: ${activeCategoryDescription}`
                      : `Filtering by ${activeCategory}.`}
                  </Text>
                )}

                {(() => {
                  if (symptomData.loading) {
                    return (
                      <Group justify="center" py="md">
                        <Loader size="sm" type="dots" />
                      </Group>
                    );
                  }

                  if (symptomData.error) {
                    return (
                      <Alert
                        icon={<IconAlertCircle size={16} />}
                        color="gray"
                        title="Unable to load symptoms"
                        className="alert-critical"
                      >
                        {symptomData.error}
                      </Alert>
                    );
                  }

                  const hasSearchQuery = ui.query.trim();
                  const resultsToDisplay = hasSearchQuery ? searchResults : filteredResults;

                  if (!hasSearchQuery && !activeCategory) {
                    return (
                      <Stack gap="sm">
                        <Text size="sm" c="dimmed">
                          Start typing to search for symptoms, choose a category, or pick a suggested starter.
                        </Text>
                        {initialSuggestions.length ? (
                          <SimpleGrid
                            cols={{ base: 1, sm: 2 }}
                            spacing="xs"
                          >
                            {initialSuggestions.map((symptom) => {
                              const isSelected = selectedSymptoms.has(symptom.id);
                              return (
                                <Button
                                  key={symptom.id}
                                  variant={isSelected ? "filled" : "light"}
                                  fullWidth
                                  color="cyan"
                                  size="sm"
                                  onClick={() => handleSymptomToggle(symptom.id)}
                                >
                                  {symptom.text}
                                </Button>
                              );
                            })}
                          </SimpleGrid>
                        ) : (
                          <Text size="sm" c="dimmed">
                            No suggested symptoms available yet.
                          </Text>
                        )}
                      </Stack>
                    );
                  }

                  if (!resultsToDisplay.length) {
                    return (
                      <Alert
                        icon={<IconAlertCircle size={16} />}
                        color="yellow"
                        title="No matches"
                      >
                        {hasSearchQuery
                          ? "Try a different keyword or broader term."
                          : activeCategory
                            ? `No symptoms found in the ${activeCategory} category.`
                            : "No symptoms found."}
                      </Alert>
                    );
                  }

                  const bucketCounts = new Map();
                  const grouped = new Map();

                  resultsToDisplay.forEach(({ bucket, symptom }) => {
                    bucketCounts.set(bucket, (bucketCounts.get(bucket) || 0) + 1);
                    if (!grouped.has(bucket)) {
                      grouped.set(bucket, []);
                    }
                    grouped.get(bucket).push(symptom);
                  });

                  const orderedBuckets = [
                    ...symptomData.bucketOrder,
                    ...Array.from(grouped.keys()).filter(
                      (bucket) => !symptomData.bucketOrder.includes(bucket)
                    ),
                  ];

                  return (
                    <Stack gap="md">
                      <Text size="sm" c="dimmed">
                        Showing {resultsToDisplay.length} {hasSearchQuery ? "matches" : "symptoms"}
                      </Text>
                      {orderedBuckets.map((bucket) => {
                        const bucketSymptoms = grouped.get(bucket);
                        if (!bucketSymptoms || bucketSymptoms.length === 0) {
                          return null;
                        }
                        const metadata = CATEGORY_METADATA[bucket];

                        return (
                          <Stack key={bucket} gap="xs">
                            <Group justify="space-between" align="flex-start">
                              <div>
                                <Text fw={600} size="sm">
                                  {bucket}
                                </Text>
                                {metadata?.description && (
                                  <Text size="xs" c="dimmed">
                                    {metadata.description}
                                  </Text>
                                )}
                              </div>
                              <Badge variant="light">
                                {bucketCounts.get(bucket)}
                              </Badge>
                            </Group>

                            <SimpleGrid
                              cols={{ base: 1, sm: 2 }}
                              spacing="xs"
                            >
                              {bucketSymptoms.map((symptom) => {
                                const isSelected = selectedSymptoms.has(symptom.id);
                                return (
                                  <Button
                                    key={symptom.id}
                                    variant={isSelected ? "filled" : "light"}
                                    fullWidth
                                    color="cyan"
                                    size="sm"
                                    onClick={() => handleSymptomToggle(symptom.id)}
                                  >
                                    {symptom.text}
                                  </Button>
                                );
                              })}
                            </SimpleGrid>
                          </Stack>
                        );
                      })}
                    </Stack>
              );
            })()}
          </Stack>
            </Paper>

            {/* Dynamic Follow-up Questions */}
            {followUpSymptoms.length > 0 && (
              <Paper p="md" radius="md" className="panel-card" mt="md">
                <Stack gap="sm">
                  <Group justify="space-between" align="center">
                    <Group gap="xs">
                      <ThemeIcon size="sm" variant="light" color="violet">
                        <IconSparkles size={14} />
                      </ThemeIcon>
                      <Text fw={600} size="sm">
                        Suggested Follow-up Questions
                      </Text>
                    </Group>
                    <Badge size="xs" variant="light" color="violet">
                      {followUpSymptoms.length} {followUpSymptoms.length === 1 ? 'suggestion' : 'suggestions'}
                    </Badge>
                  </Group>

                  <Text size="xs" c="dimmed">
                    Based on your selected symptoms, these questions may help narrow the diagnosis:
                  </Text>

                  {loadingFollowUps ? (
                    <Group justify="center" p="md">
                      <Loader size="sm" type="dots" />
                    </Group>
                  ) : (
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                      {followUpSymptoms.slice(0, 8).map((symptom) => (
                        <Button
                          key={symptom.id}
                          variant="light"
                          color="violet"
                          size="sm"
                          fullWidth
                          onClick={() => handleSymptomToggle(symptom.id)}
                          leftSection={
                            <ThemeIcon size="xs" variant="light" color="violet" radius="xl">
                              <IconArrowRight size={12} />
                            </ThemeIcon>
                          }
                          styles={{
                            inner: { justifyContent: 'flex-start' },
                            label: { textAlign: 'left' }
                          }}
                        >
                          {symptom.text}
                        </Button>
                      ))}
                    </SimpleGrid>
                  )}
                </Stack>
              </Paper>
            )}

            {submit.error && (
              <Alert
                icon={<IconAlertCircle size={16} />}
                color="gray"
                title="Submission failed"
                className="alert-critical"
              >
                {submit.error}
                <Text size="xs" mt={6} c="dimmed">
                  If this continues, refresh and resubmit with smaller files or fewer uploads.
                </Text>
              </Alert>
            )}
      </Stack>

      <Modal
        opened={ui.confirmModalOpen}
        onClose={() => setUi(prev => ({ ...prev, confirmModalOpen: false }))}
        title="No Symptoms Selected"
        centered
        radius="lg"
        padding="lg"
        overlayProps={{ backgroundOpacity: 0.7, blur: 2, color: "var(--bg)" }}
        styles={modalStyles}
      >
        <Stack gap="md">
          <Text size="sm">
            You haven't selected any symptoms. Running analysis without symptoms may produce limited or inaccurate results.
          </Text>
          <Text size="sm" fw={600}>
            Are you sure you want to continue?
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button
              variant="default"
              onClick={() => setUi(prev => ({ ...prev, confirmModalOpen: false }))}
            >
              Go Back
            </Button>
            <Button
              color="orange"
              onClick={() => {
                setUi(prev => ({ ...prev, confirmModalOpen: false }));
                performSubmit();
              }}
            >
              Continue Anyway
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

export default DiagnosisSymptoms;
