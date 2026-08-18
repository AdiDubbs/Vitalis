import { useState, useEffect, useMemo } from "react";
import {
  Alert,
  Badge,
  Button,
  Chip,
  Divider,
  Grid,
  Group,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconAlertCircle, IconSend } from "@tabler/icons-react";
import CaseSummary from "../components/CaseSummary.jsx";
import DiagnosisIntake from "./DiagnosisIntake.jsx";
import DiagnosisSymptoms from "./DiagnosisSymptoms.jsx";
import { createSymptomNameMap } from "../utils/symptomHelpers.js";

const INITIAL_UPLOADS = {
  doctor_note_upload: null,
  upload_image: null,
  upload_mri: null,
  upload_skin: null,
  upload_fracture: null,
  upload_breast: null,
};

function DiagnosisLayout() {
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [doctorNote, setDoctorNote] = useState("");
  const [fractureBodyPart, setFractureBodyPart] = useState("");
  const [uploads, setUploads] = useState(INITIAL_UPLOADS);
  const [selectedSymptoms, setSelectedSymptoms] = useState(new Set());
  const [submitHandler, setSubmitHandler] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [intakeSchema, setIntakeSchema] = useState({
    loading: true,
    data: null,
    error: "",
  });
  const [symptomLibrary, setSymptomLibrary] = useState({
    buckets: {},
    bucketOrder: [],
    loading: true,
    error: "",
  });
  const [activeCategory, setActiveCategory] = useState(null);
  const hasNoteUpload = Boolean(uploads.doctor_note_upload);
  const imagingCount =
    Object.values(uploads).filter(Boolean).length - (hasNoteUpload ? 1 : 0);
  useEffect(() => {
    const loadSymptomNames = async () => {
      try {
        setSymptomLibrary((prev) => ({
          ...prev,
          loading: true,
          error: "",
        }));
        const response = await fetch("/api/symptoms");
        if (!response.ok) {
          throw new Error("Could not load symptom categories.");
        }
        const data = await response.json();
        if (data.buckets) {
          setSymptomLibrary({
            buckets: data.buckets || {},
            bucketOrder: data.metadata?.bucketOrder || [],
            loading: false,
            error: "",
          });
          return;
        }
        throw new Error("Symptom categories were empty.");
      } catch (error) {
        setSymptomLibrary({
          buckets: {},
          bucketOrder: [],
          loading: false,
          error:
            error.message ||
            "Could not load symptom categories. Refresh and try again.",
        });
      }
    };
    loadSymptomNames();
  }, []);

  useEffect(() => {
    let active = true;
    const loadIntakeSchema = async () => {
      try {
        const response = await fetch("/api/intake-schema");
        if (!response.ok) {
          throw new Error("Could not load intake validation rules.");
        }
        const data = await response.json();
        if (active) {
          setIntakeSchema({ loading: false, data, error: "" });
        }
      } catch (error) {
        if (active) {
          setIntakeSchema({
            loading: false,
            data: null,
            error: error.message || "Could not load intake validation rules.",
          });
        }
      }
    };

    loadIntakeSchema();
    return () => {
      active = false;
    };
  }, []);

  const categoryOptions = useMemo(() => {
    const getBucketCount = (bucketData) =>
      Array.isArray(bucketData) ? bucketData.length : 0;
    const bucketOrder = symptomLibrary.bucketOrder || [];
    const buckets = symptomLibrary.buckets || {};

    const options = [
      ...bucketOrder.map((bucket) => ({
        value: bucket,
        label: `${bucket} (${getBucketCount(buckets[bucket] || [])})`,
      })),
    ];

    const extraBuckets = Object.keys(buckets).filter(
      (bucket) => !bucketOrder.includes(bucket)
    );

    extraBuckets.forEach((bucket) => {
      options.push({
        value: bucket,
        label: `${bucket} (${getBucketCount(buckets[bucket] || [])})`,
      });
    });

    return options;
  }, [symptomLibrary]);

  const symptomNameMap = useMemo(() =>
    createSymptomNameMap(symptomLibrary.buckets),
    [symptomLibrary.buckets]
  );

  const selectedSymptomLabels = useMemo(() => {
    return Array.from(selectedSymptoms).map(
      (symptomId) => symptomNameMap.get(symptomId) || symptomId
    );
  }, [selectedSymptoms, symptomNameMap]);

  const formatDemographics = () => {
    const parts = [];
    if (typeof age === "number") {
      parts.push(`${age}y`);
    }
    if (sex) {
      const label =
        sex === "MALE" ? "M" : sex === "FEMALE" ? "F" : sex.charAt(0);
      parts.push(label);
    }
    return parts.length ? parts.join(", ") : "Not provided";
  };

  return (
    <section className="section section-tight">
      <Stack gap="lg">
        <Stack gap={4}>
          <Title order={1}>Patient Intake</Title>
          <Text c="dimmed">
            Enter patient information, symptoms, and clinical data.
          </Text>
        </Stack>

        <Grid gap="lg" styles={{ root: { display: "flex" } }}>
          <Grid.Col
            span={{ base: 12, md: 4 }}
            style={{
              minHeight: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                position: "sticky",
                top: "var(--header-height, 72px)",
              }}
            >
              <Stack gap="md">
                <div
                  style={{
                    width: "100%",
                  }}
                >
                  <CaseSummary
                    selectedSymptoms={selectedSymptoms}
                    demographics={formatDemographics()}
                    doctorNote={doctorNote}
                    imagingCount={imagingCount}
                  />
                </div>

                <Paper
                  p="sm"
                  radius="lg"
                  className="panel-card"
                  style={{
                    width: "100%",
                  }}
                >
                  <Stack gap={4}>
                    <Text fw={600} size="sm">
                      Categories
                    </Text>

                    <Divider my="xs" />

                    {symptomLibrary.loading ? (
                      <Text size="xs" c="dimmed">
                        Loading categories...
                      </Text>
                    ) : symptomLibrary.error ? (
                      <Alert
                        icon={<IconAlertCircle size={14} />}
                        color="gray"
                        title="Categories unavailable"
                        className="alert-critical"
                      >
                        {symptomLibrary.error}
                      </Alert>
                    ) : categoryOptions.length > 0 ? (
                      <Grid gap={2} columns={2}>
                        {categoryOptions.map(({ value }) => {
                          const isActive = activeCategory === value;
                          return (
                            <Grid.Col key={value} span={{ base: 2, md: 1 }}>
                              <Chip
                                size="sm"
                                radius="md"
                                variant="outline"
                                checked={isActive}
                                onChange={() =>
                                  setActiveCategory(isActive ? null : value)
                                }
                                styles={{
                                  root: {
                                    width: "100%",
                                    display: "block",
                                    paddingBlock: 4,
                                    paddingInline: 2,
                                    height: "auto",
                                  },
                                  label: {
                                    width: "100%",
                                    textAlign: "center",
                                    lineHeight: 1.2,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  },
                                }}
                              >
                                {value}
                              </Chip>
                            </Grid.Col>
                          );
                        })}
                      </Grid>
                    ) : (
                      <Text size="xs" c="dimmed">
                        Categories will appear once symptoms are loaded.
                      </Text>
                    )}
                  </Stack>
                </Paper>

                <Paper
                  p="sm"
                  radius="lg"
                  className="panel-card"
                  style={{ width: "100%" }}
                >
                  <Stack gap="xs">
                    <Group justify="space-between" align="center">
                      <Text fw={600} size="sm">
                        Selected symptoms
                      </Text>
                      <Group gap="xs">
                        <Badge
                          size="xs"
                          variant={
                            selectedSymptomLabels.length ? "light" : "outline"
                          }
                          color={selectedSymptomLabels.length ? "cyan" : "gray"}
                        >
                          {selectedSymptomLabels.length} selected
                        </Badge>
                        <Button
                          size="xs"
                          variant="subtle"
                          color="gray"
                          onClick={() => setSelectedSymptoms(new Set())}
                          disabled={!selectedSymptomLabels.length}
                        >
                          Clear all
                        </Button>
                      </Group>
                    </Group>

                    <Divider my="xs" />

                    {selectedSymptomLabels.length === 0 ? (
                      <Text size="xs" c="dimmed">
                        No symptoms selected yet.
                      </Text>
                    ) : (
                      <Stack gap={6}>
                        <Group gap={6} wrap="wrap">
                          {selectedSymptomLabels.map((label, index) => (
                            <Badge
                              key={`${label}-${index}`}
                              size="sm"
                              radius="sm"
                              variant="light"
                              color="cyan"
                              styles={{
                                root: { textTransform: "none" },
                                label: { fontSize: "0.78rem" },
                              }}
                            >
                              {label}
                            </Badge>
                          ))}
                        </Group>
                      </Stack>
                    )}
                  </Stack>
                </Paper>
              </Stack>
            </div>
          </Grid.Col>

          <Grid.Col
            span={{ base: 12, md: 8 }}
            style={{
              minHeight: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Stack gap="lg">
              <DiagnosisIntake
                age={age}
                setAge={setAge}
                sex={sex}
                setSex={setSex}
                doctorNote={doctorNote}
                setDoctorNote={setDoctorNote}
                fractureBodyPart={fractureBodyPart}
                setFractureBodyPart={setFractureBodyPart}
                uploads={uploads}
                setUploads={setUploads}
                intakeSchema={intakeSchema}
                validationErrors={validationErrors}
                setValidationErrors={setValidationErrors}
              />
              <DiagnosisSymptoms
                age={age}
                sex={sex}
                doctorNote={doctorNote}
                fractureBodyPart={fractureBodyPart}
                uploads={uploads}
                selectedSymptoms={selectedSymptoms}
                setSelectedSymptoms={setSelectedSymptoms}
                setSubmitHandler={setSubmitHandler}
                setIsSubmitting={setIsSubmitting}
                activeCategory={activeCategory}
                intakeSchema={intakeSchema}
                validationErrors={validationErrors}
                setValidationErrors={setValidationErrors}
              />
            </Stack>
          </Grid.Col>
        </Grid>

        <Group justify="flex-end" mt="lg">
          <Button
            size="md"
            color="cyan"
            rightSection={<IconSend size={16} />}
            onClick={() => submitHandler?.()}
            disabled={!submitHandler || intakeSchema.loading || Boolean(intakeSchema.error)}
            loading={isSubmitting}
            loaderProps={{ type: "dots" }}
          >
            Run analysis
          </Button>
        </Group>
      </Stack>
    </section>
  );
}

export default DiagnosisLayout;
