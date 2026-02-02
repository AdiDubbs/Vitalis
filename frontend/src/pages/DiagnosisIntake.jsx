import { useState } from "react";
import {
  Accordion,
  ActionIcon,
  Box,
  Divider,
  FileInput,
  Grid,
  Group,
  NumberInput,
  Paper,
  Select,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
  Title,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconBrain,
  IconHeartbeat,
  IconInfoCircle,
  IconPhoto,
  IconScan,
  IconStethoscope,
  IconUser,
  IconUpload,
  IconPencil,
} from "@tabler/icons-react";

const FILE_CATEGORIES = [
  {
    category: "Radiology",
    icon: IconScan,
    fields: [
      {
        key: "upload_image",
        label: "Chest X-Ray",
        accept: [
          "image/png",
          "image/jpeg",
          "image/jpg",
          ".dcm",
          ".dicom",
          "application/dicom",
        ],
        maxSize: 50 * 1024 * 1024,
        formats: "PNG, JPG, DICOM",
      },
      {
        key: "upload_mri",
        label: "Brain MRI",
        accept: [
          "image/png",
          "image/jpeg",
          "image/jpg",
          ".dcm",
          ".dicom",
          "application/dicom",
        ],
        maxSize: 50 * 1024 * 1024,
        formats: "PNG, JPG, DICOM",
      },
      {
        key: "upload_fracture",
        label: "Fracture Image",
        accept: [
          "image/png",
          "image/jpeg",
          "image/jpg",
          ".dcm",
          ".dicom",
          "application/dicom",
        ],
        maxSize: 50 * 1024 * 1024,
        formats: "PNG, JPG, DICOM",
      },
      {
        key: "upload_breast",
        label: "Breast Image",
        accept: [
          "image/png",
          "image/jpeg",
          "image/jpg",
          ".dcm",
          ".dicom",
          "application/dicom",
        ],
        maxSize: 50 * 1024 * 1024,
        formats: "PNG, JPG, DICOM",
      },
    ],
  },
  {
    category: "Cardiology",
    icon: IconHeartbeat,
    fields: [
      {
        key: "upload_ecg",
        label: "ECG",
        accept: [".dat"],
        maxSize: 10 * 1024 * 1024,
        formats: "DAT",
      },
    ],
  },
  {
    category: "Dermatology",
    icon: IconPhoto,
    fields: [
      {
        key: "upload_skin",
        label: "Skin Image",
        accept: ["image/png", "image/jpeg", "image/jpg"],
        maxSize: 20 * 1024 * 1024,
        formats: "PNG, JPG",
      },
    ],
  },
];

const FILE_FIELDS = FILE_CATEGORIES.flatMap((cat) => cat.fields);

const FRACTURE_BODY_PART_OPTIONS = [
  { value: "hand_wrist", label: "Hand / Wrist" },
  { value: "forearm_elbow", label: "Forearm / Elbow" },
  { value: "humerus_shoulder", label: "Humerus / Shoulder" },
  { value: "ankle_foot", label: "Ankle / Foot" },
  { value: "tibia_fibula", label: "Tibia / Fibula" },
  { value: "femur_hip", label: "Femur / Hip" },
  { value: "ribs", label: "Ribs" },
  { value: "spine", label: "Spine" },
  { value: "pelvis", label: "Pelvis" },
];

function DiagnosisIntake({
  age,
  setAge,
  sex,
  setSex,
  doctorNote,
  setDoctorNote,
  fractureBodyPart,
  setFractureBodyPart,
  uploads,
  setUploads,
}) {
  const [noteInputMode, setNoteInputMode] = useState("type");

  const validateFile = (file, field) => {
    if (!file) return { valid: true };

    if (field.maxSize && file.size > field.maxSize) {
      const maxSizeMB = (field.maxSize / (1024 * 1024)).toFixed(0);
      return {
        valid: false,
        error: `File size exceeds ${maxSizeMB}MB limit. Please choose a smaller file.`,
      };
    }

    const fileName = file.name.toLowerCase();
    const fileType = file.type.toLowerCase();

    const isValidType = field.accept.some((acceptType) => {
      if (acceptType.startsWith(".")) {
        return fileName.endsWith(acceptType);
      }
      return (
        fileType === acceptType || fileType.startsWith(acceptType.split("/")[0])
      );
    });

    if (!isValidType) {
      return {
        valid: false,
        error: `Invalid file type. Accepted formats: ${field.accept.join(
          ", "
        )}`,
      };
    }

    return { valid: true };
  };

  const handleFileChange = (fieldKey, file) => {
    const field = FILE_FIELDS.find((f) => f.key === fieldKey);
    if (!field) return;

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

    setUploads((prev) => ({
      ...prev,
      [fieldKey]: file,
    }));
  };

  return (
    <>
      <Stack gap="lg">
        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Paper
              id="section-demographics"
              radius="lg"
              p="lg"
              className="panel-card"
              style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Stack gap="md" style={{ flex: 1 }}>
                <Stack gap="xs">
                  <Group gap="xs">
                    <ThemeIcon
                      variant="light"
                      color="cyan"
                      size="md"
                      radius="lg"
                    >
                      <IconUser size={16} />
                    </ThemeIcon>
                    <Text className="card-heading">Demographics</Text>
                  </Group>
                  <Text size="sm" c="dimmed">
                    Tell us a little about the patient to personalize the
                    analysis.
                  </Text>
                </Stack>
                <Divider />
                <Stack gap="lg" style={{ flex: 1, justifyContent: "center" }}>
                  <Group align="center" wrap="nowrap">
                    <Text size="sm" fw={500} style={{ minWidth: "100px" }}>
                      Age
                    </Text>
                    <NumberInput
                      size="sm"
                      radius="lg"
                      placeholder="Enter age"
                      value={age}
                      onChange={setAge}
                      min={0}
                      max={130}
                      clampBehavior="strict"
                      rightSection={
                        <Text size="xs" c="dimmed">
                          yrs
                        </Text>
                      }
                      rightSectionWidth={45}
                      style={{ flex: 1 }}
                    />
                  </Group>
                  <Group align="center" wrap="nowrap">
                    <Text size="sm" fw={500} style={{ minWidth: "100px" }}>
                      Sex
                    </Text>
                    <Select
                      size="sm"
                      radius="lg"
                      placeholder="Select"
                      value={sex}
                      onChange={setSex}
                      data={[
                        { value: "MALE", label: "Male" },
                        { value: "FEMALE", label: "Female" },
                        { value: "INTERSEX", label: "Intersex" },
                        { value: "OTHER", label: "Other" },
                      ]}
                      clearable
                      style={{ flex: 1 }}
                    />
                  </Group>
                </Stack>
              </Stack>
            </Paper>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 7 }}>
            <Paper
              id="section-medical-history"
              radius="lg"
              p="lg"
              className="panel-card"
              style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Stack gap="md" style={{ flex: 1 }}>
                <Stack gap="xs">
                  <Group gap="xs">
                    <ThemeIcon
                      variant="light"
                      color="cyan"
                      size="md"
                      radius="lg"
                    >
                      <IconStethoscope size={16} />
                    </ThemeIcon>
                    <Text className="card-heading">Medical History</Text>
                  </Group>
                  <Text size="sm" c="dimmed">
                    Add a brief clinical note or upload a transcript for
                    context.
                  </Text>
                </Stack>
                <Divider />
                <Stack gap="sm" style={{ flex: 1 }}>
                  <SegmentedControl
                    size="xs"
                    radius="lg"
                    color="cyan"
                    value={noteInputMode}
                    onChange={setNoteInputMode}
                    data={[
                      { value: "type", label: "Type notes" },
                      { value: "upload", label: "Upload file" },
                    ]}
                  />
                  {noteInputMode === "type" ? (
                    <>
                      <Text size="xs" c="dimmed">
                        Summarize family history, medications, allergies, and
                        key findings.
                      </Text>
                      <Textarea
                        placeholder="Type a short clinical summary..."
                        rows={2}
                        value={doctorNote}
                        onChange={(event) =>
                          setDoctorNote(event.currentTarget.value)
                        }
                        radius="lg"
                        style={{ flex: 1 }}
                      />
                    </>
                  ) : (
                    <>
                      <Text size="xs" c="dimmed">
                        Upload a .txt note or transcript. We'll attach it to the
                        case.
                      </Text>
                      <FileInput
                        placeholder="Choose a note file"
                        accept=".txt"
                        value={uploads.doctor_note_upload}
                        onChange={(value) =>
                          setUploads((prev) => ({
                            ...prev,
                            doctor_note_upload: value,
                          }))
                        }
                        clearable
                        radius="lg"
                        rightSection={<IconUpload size={16} />}
                      />
                      <Box mt="0">
                        <Text size="xs" c="dimmed">
                          Supported format: .txt • Size limit: not specified
                        </Text>
                      </Box>
                    </>
                  )}
                </Stack>
              </Stack>
            </Paper>
          </Grid.Col>
        </Grid>

        <Paper id="section-imaging" radius="lg" p="lg" className="panel-card">
          <Stack gap="md">
            <Stack gap="xs">
              <Group gap="xs">
                <ThemeIcon variant="light" color="cyan" size="md" radius="lg">
                  <IconPhoto size={16} />
                </ThemeIcon>
                <Text className="card-heading">Imaging and signals</Text>
              </Group>
              <Text size="sm" c="dimmed">
                Upload imaging or signal files to enrich the analysis.
              </Text>
            </Stack>
            <Divider />

            <Accordion
              variant="contained"
              radius="lg"
              className="imaging-accordion"
            >
              {FILE_CATEGORIES.map((category) => {
                const CategoryIcon = category.icon;
                return (
                  <Accordion.Item
                    key={category.category}
                    value={category.category}
                  >
                    <Accordion.Control icon={<CategoryIcon size={16} />}>
                      <Text size="sm" fw={500}>
                        {category.category}
                      </Text>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                        {category.fields.map((field) => {
                          const maxSizeLabel = field.maxSize
                            ? `Max: ${(field.maxSize / (1024 * 1024)).toFixed(
                                0
                              )}MB`
                            : "No size limit";
                          return (
                            <Box key={field.key}>
                              <Group gap="xs" mb={4}>
                                <Text size="sm" fw={500}>
                                  {field.label}
                                </Text>
                                <Tooltip
                                  label={`Formats: ${field.formats} • ${maxSizeLabel}`}
                                  position="top"
                                  withArrow
                                >
                                  <ActionIcon
                                    size="xs"
                                    variant="subtle"
                                    color="gray"
                                  >
                                    <IconInfoCircle size={14} />
                                  </ActionIcon>
                                </Tooltip>
                              </Group>
                              <FileInput
                                placeholder="Choose a file"
                                accept={
                                  Array.isArray(field.accept)
                                    ? field.accept.join(",")
                                    : field.accept
                                }
                                value={uploads[field.key]}
                                onChange={(value) =>
                                  handleFileChange(field.key, value)
                                }
                                clearable
                                radius="md"
                              />
                              <Text size="xs" c="dimmed" mt={4}>
                                {`Formats: ${field.formats} • ${maxSizeLabel}`}
                              </Text>
                              {field.key === "upload_fracture" &&
                                uploads[field.key] && (
                                  <Select
                                    placeholder="Select body part"
                                    data={FRACTURE_BODY_PART_OPTIONS}
                                    value={fractureBodyPart}
                                    onChange={setFractureBodyPart}
                                    clearable
                                    size="xs"
                                    mt="xs"
                                  />
                                )}
                            </Box>
                          );
                        })}
                      </SimpleGrid>
                    </Accordion.Panel>
                  </Accordion.Item>
                );
              })}
            </Accordion>
          </Stack>
        </Paper>
      </Stack>
    </>
  );
}

export default DiagnosisIntake;
