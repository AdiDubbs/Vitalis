import { useMemo, useState } from "react";
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
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconInfoCircle,
  IconPhoto,
  IconScan,
  IconStethoscope,
  IconUser,
  IconUpload,
} from "@tabler/icons-react";

const CATEGORY_ICONS = {
  Radiology: IconScan,
  Dermatology: IconPhoto,
};

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
  intakeSchema,
  validationErrors,
  setValidationErrors,
}) {
  const [noteInputMode, setNoteInputMode] = useState("type");

  const schema = intakeSchema.data;
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
            icon: CATEGORY_ICONS[categoryName] || IconUpload,
            fields: [field],
          });
        }
        return categories;
      }, []);
  }, [schema]);

  const fileFields = useMemo(
    () => fileCategories.flatMap((category) => category.fields),
    [fileCategories]
  );

  const clearValidationError = (fieldKey) => {
    setValidationErrors((previous) => {
      if (!previous[fieldKey]) return previous;
      const next = { ...previous };
      delete next[fieldKey];
      return next;
    });
  };

  const validateFile = (file, field) => {
    if (!file) return { valid: true };

    if (field.max_size && file.size > field.max_size) {
      const maxSizeMB = (field.max_size / (1024 * 1024)).toFixed(0);
      return {
        valid: false,
        error: `File size exceeds ${maxSizeMB}MB limit. Please choose a smaller file.`,
      };
    }

    const fileName = file.name.toLowerCase();
    const isValidType = field.extensions.some((extension) =>
      fileName.endsWith(extension)
    );

    if (!isValidType) {
      return {
        valid: false,
        error: `Supported formats: ${field.formats}.`,
      };
    }

    return { valid: true };
  };

  const handleFileChange = (fieldKey, file) => {
    const field = [
      ...fileFields,
      schema?.uploads?.doctor_note_upload && {
        key: "doctor_note_upload",
        ...schema.uploads.doctor_note_upload,
      },
    ]
      .filter(Boolean)
      .find((candidate) => candidate.key === fieldKey);
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
    clearValidationError(fieldKey);
  };

  if (intakeSchema.loading) {
    return <Text c="dimmed">Loading intake validation rules…</Text>;
  }

  if (!schema) {
    return <Text c="red">{intakeSchema.error || "Intake validation rules are unavailable."}</Text>;
  }

  return (
    <>
      <Stack gap="lg">
        <Grid gap="lg">
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
                      onChange={(value) => {
                        setAge(value);
                        clearValidationError("age");
                      }}
                      min={schema.age.min}
                      max={schema.age.max}
                      clampBehavior="strict"
                      error={validationErrors.age}
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
                      onChange={(value) => {
                        setSex(value || "");
                        clearValidationError("sex");
                      }}
                      data={schema.sex.options}
                      clearable
                      error={validationErrors.sex}
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
                        onChange={(event) => {
                          setDoctorNote(event.currentTarget.value);
                          clearValidationError("doctor_note");
                        }}
                        radius="lg"
                        maxLength={schema.doctor_note.max_length}
                        style={{ flex: 1 }}
                        error={validationErrors.doctor_note}
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
                        accept={schema.uploads.doctor_note_upload.extensions.join(",")}
                        value={uploads.doctor_note_upload}
                        onChange={(value) => handleFileChange("doctor_note_upload", value)}
                        clearable
                        radius="lg"
                        rightSection={<IconUpload size={16} />}
                        error={validationErrors.doctor_note_upload}
                      />
                      <Box mt="0">
                        <Text size="xs" c="dimmed">
                          {`Supported format: ${schema.uploads.doctor_note_upload.formats} • Max: ${(schema.uploads.doctor_note_upload.max_size / (1024 * 1024)).toFixed(0)}MB`}
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
                <Text className="card-heading">Imaging evidence</Text>
              </Group>
              <Text size="sm" c="dimmed">
                Upload a supported image to enrich the analysis.
              </Text>
            </Stack>
            <Divider />

            <Accordion
              variant="contained"
              radius="lg"
              className="imaging-accordion"
            >
              {fileCategories.map((category) => {
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
                          const maxSizeLabel = field.max_size
                            ? `Max: ${(field.max_size / (1024 * 1024)).toFixed(
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
                                accept={field.extensions.join(",")}
                                value={uploads[field.key]}
                                onChange={(value) =>
                                  handleFileChange(field.key, value)
                                }
                                clearable
                                radius="md"
                                error={validationErrors[field.key]}
                              />
                              <Text size="xs" c="dimmed" mt={4}>
                                {`Formats: ${field.formats} • ${maxSizeLabel}`}
                              </Text>
                              {field.key === "upload_fracture" &&
                                uploads[field.key] && (
                                  <Select
                                    placeholder="Select body part"
                                    data={schema.fracture_body_part.options}
                                    value={fractureBodyPart}
                                    onChange={(value) => {
                                      setFractureBodyPart(value || "");
                                      clearValidationError("fracture_body_part");
                                    }}
                                    clearable
                                    size="xs"
                                    mt="xs"
                                    error={validationErrors.fracture_body_part}
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
