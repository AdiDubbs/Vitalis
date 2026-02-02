import { useState, useEffect, useMemo } from "react";
import {
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
import { IconSend } from "@tabler/icons-react";
import CaseSummary from "../components/CaseSummary.jsx";
import DiagnosisIntake from "./DiagnosisIntake.jsx";
import DiagnosisSymptoms from "./DiagnosisSymptoms.jsx";
import { createSymptomNameMap } from "../utils/symptomHelpers.js";

const INITIAL_UPLOADS = {
  doctor_note_upload: null,
  upload_image: null,
  upload_mri: null,
  upload_ecg: null,
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
  const [symptomLibrary, setSymptomLibrary] = useState({
    buckets: {},
    bucketOrder: [],
  });
  const [activeCategory, setActiveCategory] = useState(null);
  const hasNoteUpload = Boolean(uploads.doctor_note_upload);
  const imagingCount =
    Object.values(uploads).filter(Boolean).length - (hasNoteUpload ? 1 : 0);
  useEffect(() => {
    const loadSymptomNames = async () => {
      try {
        const response = await fetch("/api/symptoms");
        const data = await response.json();
        if (data.buckets) {
          setSymptomLibrary({
            buckets: data.buckets || {},
            bucketOrder: data.metadata?.bucketOrder || [],
          });
        }
      } catch (error) {
        console.error("Failed to load symptom names:", error);
      }
    };
    loadSymptomNames();
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

  const selectedSymptomsByBucket = useMemo(() => {
    const grouped = new Map();
    const bucketMap = new Map();
    Object.entries(symptomLibrary.buckets || {}).forEach(
      ([bucket, symptoms]) => {
        symptoms.forEach((symptom) => {
          if (symptom?.id) {
            bucketMap.set(symptom.id, bucket);
          }
        });
      }
    );

    selectedSymptoms.forEach((symptomId) => {
      const bucket = bucketMap.get(symptomId) || "Other";
      if (!grouped.has(bucket)) {
        grouped.set(bucket, []);
      }
      grouped.get(bucket).push(symptomId);
    });
    return grouped;
  }, [selectedSymptoms, symptomLibrary.buckets]);

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

        <Grid gutter="lg" styles={{ root: { display: "flex" } }}>
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

                    {categoryOptions.length > 0 ? (
                      <Grid gutter={2} columns={2}>
                        {categoryOptions.map(({ value }) => {
                          const hasSelections =
                            selectedSymptomsByBucket.has(value);
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
            disabled={!submitHandler}
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
