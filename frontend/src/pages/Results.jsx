import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { createSymptomNameMap, formatContribution } from "../utils/symptomHelpers.js";
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Center,
  Divider,
  Grid,
  Group,
  Modal,
  Paper,
  Progress,
  RingProgress,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconArrowLeft,
  IconChartBar,
  IconChevronDown,
  IconInfoCircle,
} from "@tabler/icons-react";
import PanelCard from "../components/PanelCard";
import EvidenceBadge from "../components/EvidenceBadge";

function Results() {
  const location = useLocation();
  const state = location.state || {};
  const analysis = state.analysis || null;
  const caseId = state.caseId || "";
  const selectedSymptoms = state.selectedSymptoms || [];
  const doctorNoteProvided = state.doctorNoteProvided || false;
  const age = state.age ?? null;
  const sex = state.sex || "";

  const isMobile = useMediaQuery('(max-width: 768px)');

  const [data, setData] = useState({
    symptomCategories: {},
    diseaseMap: {},
    error: "",
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
    
    const fetchData = async () => {
      try {
        const [symptomsRes, diseasesRes] = await Promise.all([
          fetch("/api/symptoms"),
          fetch("/api/diseases")
        ]);

        if (!symptomsRes.ok) throw new Error("Unable to load symptom library.");
        const symptomsData = await symptomsRes.json();
        
        let diseasesData = {};
        if (diseasesRes.ok) {
           diseasesData = await diseasesRes.json();
        }

        if (active) {
          setData({
            symptomCategories: symptomsData?.buckets || {},
            diseaseMap: diseasesData || {},
            error: "",
          });
        }
      } catch (error) {
        if (active) {
          setData(prev => ({
            ...prev,
            error: error.message || "Unable to load data.",
          }));
        }
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

  const ageDisplay =
    typeof age === "number" && !Number.isNaN(age) ? `${age} years` : "Not provided";
  const sexDisplay = sex
    ? sex === "MALE"
      ? "Male"
      : sex === "FEMALE"
      ? "Female"
      : sex.charAt(0).toUpperCase() + sex.slice(1).toLowerCase()
    : "Not provided";
  const caseIdDisplay = caseId || "Pending";

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

  return (
    <section className="section section-tight results-section">
      <Stack gap="lg">
        <Group justify="space-between" align="center" wrap="wrap">
          <Stack gap={4}>
              <Title order={1}>Results</Title>
            <Text c="dimmed">
              Review ranked differentials and red flag alerts.
            </Text>
          </Stack>
          <Group gap="sm">
            <Button component={Link} to="/diagnosis" variant="light">
              Restart diagnosis
            </Button>
            <Button
              component={Link}
              to="/diagnosis"
              variant="light"
              leftSection={<IconArrowLeft size={16} />}
            >
              Back to intake
            </Button>
            <Button variant="light" onClick={() => window.print()}>
              Print / PDF
            </Button>
          </Group>
        </Group>

        {!analysis ? (
          <Alert
            icon={<IconAlertCircle size={16} />}
            color="yellow"
            title="No results loaded"
          >
            Run a diagnosis from the intake screen to generate results.
          </Alert>
        ) : (
          <Grid gutter="lg" align="flex-start">
            <Grid.Col span={{ base: 12, md: 4 }} order={{ base: 2, md: 1 }} className="results-sidebar">
              <div className="results-sidebar-wrapper">
                <Stack gap="md">
                <Paper p="md" radius="lg" className="panel-card">
                  <Stack gap="sm">
                    <Group gap="xs">
                      <Text fw={600} size="sm">
                        Case Summary
                      </Text>
                      {caseId ? (
                        <Badge variant="light" size="xs">Case {caseId}</Badge>
                      ) : null}
                    </Group>

                    <Divider />

                    <Stack gap="xs">
                      <Group justify="space-between">
                        <Text size="xs" c="dimmed">
                          Patient
                        </Text>
                        <Text size="xs" fw={500}>
                          {formatDemographics() || "—"}
                        </Text>
                      </Group>

                      <Group justify="space-between">
                        <Text size="xs" c="dimmed">
                          Symptoms selected
                        </Text>
                        <Badge
                          size="xs"
                          variant={selectedSymptoms.length ? "light" : "outline"}
                          color={selectedSymptoms.length ? "cyan" : "gray"}
                        >
                          {selectedSymptoms.length}
                        </Badge>
                      </Group>

                      <Group justify="space-between">
                        <Text size="xs" c="dimmed">
                          Medical history
                        </Text>
                        <Badge
                          size="xs"
                          variant={doctorNoteProvided ? "light" : "outline"}
                          color={doctorNoteProvided ? "green" : "gray"}
                        >
                          {doctorNoteProvided ? "Provided" : "Missing"}
                        </Badge>
                      </Group>

                      {riskStratification && (
                        <Group justify="space-between" align="center">
                          <Group gap={4}>
                            <Text size="xs" c="dimmed">
                              Risk Level
                            </Text>
                            <Tooltip
                              label="Risk level based on red flags, confidence, and symptom severity. High risk requires urgent evaluation."
                              position="top"
                              withArrow
                              multiline
                              w={220}
                            >
                              <ActionIcon size="xs" variant="subtle" color="gray">
                                <IconInfoCircle size={14} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                          <Badge
                            variant="filled"
                            color={riskStratification.color}
                            size="sm"
                            leftSection={riskStratification.level === 'high' ? <IconAlertTriangle size={14} /> : undefined}
                            className={`results-risk-badge${riskStratification.badgeClass ? ` ${riskStratification.badgeClass}` : ""}`}
                          >
                            {riskStratification.label}
                          </Badge>
                        </Group>
                      )}
                    </Stack>
                  </Stack>
                </Paper>

                <Paper p="sm" radius="lg" className="panel-card">
                  <Stack gap="xs">
                    <Group justify="space-between" align="center">
                      <Text fw={600} size="sm">
                        Selected symptoms
                      </Text>
                      <Badge
                        size="xs"
                        variant={selectedSymptoms.length ? "light" : "outline"}
                        color={selectedSymptoms.length ? "cyan" : "gray"}
                      >
                        {selectedSymptoms.length} selected
                      </Badge>
                    </Group>

                    <Divider my="xs" />

                    {data.error ? (
                      <Text size="xs" c="dimmed">
                        Symptom labels unavailable.
                      </Text>
                    ) : selectedSymptoms.length === 0 ? (
                      <Text size="xs" c="dimmed">
                        No symptoms selected yet.
                      </Text>
                    ) : (
                      <Stack gap={6}>
                        <Group gap={6} wrap="wrap">
                          {selectedSymptoms.slice(0, 8).map((symptomId) => (
                            <Badge
                              key={symptomId}
                              size="sm"
                              radius="sm"
                              variant="light"
                              color="cyan"
                              className="badge-compact"
                            >
                              {symptomNameMap.get(symptomId) || symptomId}
                            </Badge>
                          ))}
                        </Group>
                        {selectedSymptoms.length > 8 && (
                          <Button
                            variant="light"
                            size="xs"
                            onClick={toggleSymptomModal}
                          >
                            View all ({selectedSymptoms.length})
                          </Button>
                        )}
                      </Stack>
                    )}
                  </Stack>
                </Paper>

                <Paper p="sm" radius="lg" className="panel-card">
                  <Stack gap="xs">
                    <Group justify="space-between" align="center" wrap="nowrap">
                      <Text fw={600} size="sm">
                        Next Steps
                      </Text>
                      {primaryDx ? (
                        <Badge variant="light" color="teal" size="xs">
                          {formatDxName(primaryDx.name)}
                        </Badge>
                      ) : null}
                    </Group>

                    <Divider my="xs" />

                    {riskStratification && (
                      <Stack gap="xs">
                        {riskStratification.level === 'high' && (
                          <Stack gap={4}>
                            <Text size="xs" fw={600} c="red">Urgent Evaluation</Text>
                            <Text size="xs" c="dimmed">
                              • Address red flags immediately
                              <br />• Consider emergency consultation
                              <br />• Order tests without delay
                            </Text>
                          </Stack>
                        )}

                        {riskStratification.level === 'medium' && (
                          <Stack gap={4}>
                            <Text size="xs" fw={600}>Standard Workup</Text>
                            <Text size="xs" c="dimmed">
                              • Order verification tests
                              <br />• Monitor symptom progression
                              <br />• Follow-up in 48-72 hours
                            </Text>
                          </Stack>
                        )}

                        {riskStratification.level === 'low' && (
                          <Stack gap={4}>
                            <Text size="xs" fw={600}>Routine Management</Text>
                            <Text size="xs" c="dimmed">
                              • Tests if clinically indicated
                              <br />• Provide patient education
                              <br />• Routine follow-up as needed
                            </Text>
                          </Stack>
                        )}
                      </Stack>
                    )}

                    {primaryRecommendedTests.length > 0 && (
                      <>
                        <Divider my="xs" />
                        <Stack gap="xs">
                          <Text size="xs" fw={600}>Verification Tests</Text>
                          {primaryRecommendedTests.map((test) => (
                            <Paper
                              key={test.test_id}
                              withBorder
                              p="xs"
                              radius="md"
                              bg="var(--panel-card-bg-deeper)"
                              className="results-test-card"
                            >
                              <Stack gap={2}>
                                <Text size="xs" fw={500}>
                                  {test.display_name}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  {test.category}
                                </Text>
                              </Stack>
                            </Paper>
                          ))}
                        </Stack>
                      </>
                    )}
                  </Stack>
                </Paper>
              </Stack>
              </div>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 8 }} order={{ base: 1, md: 2 }} className="results-main">
              <Stack gap="lg">
                  {analysis?.red_flags?.length ? (
                    <PanelCard className="results-red-flag-card">
                      <Stack gap="sm">
                        <Group gap="xs">
                          <IconAlertCircle size={20} color="var(--mantine-color-red-8)" />
                          <Text fw={700} c="red.5">Critical Red Flag Alerts</Text>
                        </Group>
                        <Divider />
                        <Stack gap="xs">
                          {analysis.red_flags.map((flag, index) => {
                            const label =
                              typeof flag === "string"
                                ? flag
                                : flag?.message || flag?.condition || flag?.rule_id || "Red flag alert";
                            const key =
                              typeof flag === "string"
                                ? flag
                                : flag?.rule_id || `${label}-${index}`;
                            return (
                              <Alert
                                key={key}
                                color="gray"
                                variant="light"
                                className="alert-critical"
                              >
                                {label}
                              </Alert>
                            );
                          })}
                        </Stack>
                      </Stack>
                    </PanelCard>
                  ) : null}

                  <PanelCard>
                    <Stack gap="md">
                      <Stack gap="xs">
                        <Group gap="xs">
                          <ThemeIcon variant="light" color="cyan" size="md" radius="lg">
                            <IconChartBar size={16} />
                          </ThemeIcon>
                          <Text className="card-heading">Ranked Differentials</Text>
                        </Group>
                        <Text size="sm" c="dimmed">
                          Conditions ranked by diagnostic confidence. Review evidence and consider verification tests.
                        </Text>
                      </Stack>
                      <Divider />
                      {rankedConditions.length ? (
                        <Stack gap="md">
                          {rankedConditions.map((dx, index) => {
                            if (index > 0 && index > 2 && !ui.showAllSecondary) {
                              return null;
                            }

                            const { combined } = getReasonData(dx.name);
                            const isTop = index === 0;
                            const allReasons = combined;

                            return (
                              <Stack
                                key={dx.name}
                                gap="xs"
                              >
                                {index > 0 ? <Divider opacity={0.7} /> : null}

                                {isTop ? (
                                  <Group
                                    align="center"
                                    gap="xl"
                                    wrap="nowrap"
                                    mb="xs"
                                  >
                                    <Tooltip
                                      label="Diagnostic confidence based on symptom patterns, demographics, and clinical data. Higher % = stronger match."
                                      position="top"
                                      withArrow
                                      multiline
                                      w={220}
                                    >
                                      <RingProgress
                                        size={160}
                                        thickness={24}
                                        roundCaps
                                        sections={[
                                          {
                                            value: dx.probability * 100,
                                            color: "cyan",
                                          },
                                        ]}
                                        label={
                                          <Center>
                                            <Text c="teal" fw={900} size="xl">
                                              {(dx.probability * 100).toFixed(0)}%
                                            </Text>
                                          </Center>
                                        }
                                      />
                                    </Tooltip>
                                    <Stack gap={4} className="results-primary-stack">
                                      <Badge
                                        variant="light"
                                        color="teal"
                                        size="lg"
                                        mb={2}
                                        w="fit-content"
                                      >
                                        Primary Diagnosis
                                      </Badge>
                                      <Title
                                        order={2}
                                        fw={600}
                                        className="results-primary-title"
                                      >
                                        {formatDxName(dx.name)}
                                      </Title>
                                      <Stack gap="xs" mt={4}>
                                        <Group gap={6} wrap="wrap">
                                          {allReasons.map((reason) => {
                                            const featureLabel =
                                              symptomNameMap.get(reason.featureId) || reason.featureId;

                                            return (
                                              <EvidenceBadge
                                                key={`${dx.name}-top-${reason.featureId}-${reason.source}`}
                                                category={reason.category}
                                                contribution={reason.contribution}
                                                label={featureLabel}
                                              />
                                            );
                                          })}
                                        </Group>
                                      </Stack>
                                    </Stack>
                                  </Group>
                                ) : (
                                  <>
                                    <Group justify="space-between">
                                      <Text size="sm" fw={600}>
                                        {formatDxName(dx.name)}
                                      </Text>
                                      <Text size="sm" c="dimmed">
                                        {(dx.probability * 100).toFixed(1)}%
                                      </Text>
                                    </Group>
                                    <Progress
                                      value={Math.min(
                                        100,
                                        dx.probability * 100
                                      )}
                                      radius="lg"
                                    />
                                  </>
                                )}
                                
                                {!isTop && combined.length ? (
                                  <Stack gap="xs">
                                    <Group gap={6} wrap="wrap">
                                      {allReasons.map((reason) => {
                                        const categoryClass = `badge-evidence badge-evidence-${reason.category}`;
                                        const contributionType =
                                          reason.contribution >= 0
                                            ? "positive"
                                            : "negative";
                                        const featureLabel =
                                          symptomNameMap.get(reason.featureId) || reason.featureId;

                                        return (
                                          <Badge
                                            key={`${dx.name}-${reason.featureId}-${reason.source}`}
                                            size="md"
                                            variant="light"
                                            className={categoryClass}
                                            data-contribution={contributionType}
                                            styles={{
                                              root: {
                                                textTransform: "none",
                                                opacity: 0.85,
                                              },
                                            }}
                                          >
                                            {featureLabel}
                                            <span style={{ marginLeft: '4px', fontWeight: 500, opacity: 0.6, fontSize: '0.9em' }}>
                                              {formatContribution(reason.contribution)}
                                            </span>
                                          </Badge>
                                        );
                                      })}
                                    </Group>
                                  </Stack>
                                ) : !isTop ? (
                                  <Text size="xs" c="dimmed">
                                    No feature reasons returned.
                                  </Text>
                                ) : null}

                              </Stack>
                            );
                          }).filter(Boolean)}
                          {rankedConditions.length > 3 && !ui.showAllSecondary && (
                            <Button
                              variant="light"
                              size="sm"
                              leftSection={<IconChevronDown size={16} />}
                              onClick={toggleSecondaryDiagnoses}
                              fullWidth
                            >
                              Show {rankedConditions.length - 3} more condition{rankedConditions.length - 3 > 1 ? 's' : ''}
                            </Button>
                          )}
                          {rankedConditions.length > 3 && ui.showAllSecondary && (
                            <Button
                              variant="light"
                              size="sm"
                              onClick={toggleSecondaryDiagnoses}
                              fullWidth
                            >
                              Show less
                            </Button>
                          )}
                        </Stack>
                      ) : (
                        <Text size="sm" c="dimmed">
                          No ranked conditions returned.
                        </Text>
                      )}
                    </Stack>
                  </PanelCard>
                </Stack>
            </Grid.Col>
          </Grid>
        )}

        <Modal
          opened={ui.symptomModalOpen}
          onClose={toggleSymptomModal}
          title="Selected Symptoms"
          centered
          fullScreen={isMobile}
          size="md"
          radius="lg"
          padding="lg"
          overlayProps={{ backgroundOpacity: 0.7, blur: 2, color: "var(--bg)" }}
        >
          {selectedSymptoms.length === 0 ? (
            <Text size="sm" c="dimmed">
              No symptoms selected yet.
            </Text>
          ) : (
            <ScrollArea h={isMobile ? "100%" : 300}>
              <Stack gap="xs">
                {selectedSymptoms.map((symptomId) => (
                  <Text key={symptomId} size="sm">
                    {symptomNameMap.get(symptomId) || symptomId}
                  </Text>
                ))}
              </Stack>
            </ScrollArea>
          )}
        </Modal>
      </Stack>
    </section>
  );
}

export default Results;
