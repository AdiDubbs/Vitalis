import { useState } from "react";
import {
  Badge,
  Container,
  Divider,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
  rem,
  ThemeIcon,
  Table,
  Grid,
  UnstyledButton,
  Box,
  Card,
  Tabs,
} from "@mantine/core";
import {
  IconActivity,
  IconDeviceLaptop,
  IconFileText,
  IconPhotoScan,
  IconSchema,
  IconTestPipe,
  IconBrain,
  IconArrowRight,
  IconSparkles,
} from "@tabler/icons-react";
import PanelCard from "../components/PanelCard";

const SYSTEM_STATS = [
  { label: "Diseases Tracked", value: "85+", icon: IconActivity, color: "blue" },
  { label: "Symptom Nodes", value: "320+", icon: IconSchema, color: "cyan" },
  { label: "Imaging Models", value: "5", icon: IconPhotoScan, color: "teal" },
  { label: "Lab Biomarkers", value: "45+", icon: IconTestPipe, color: "grape" },
];

const PIPELINE_STEPS = [
  {
    title: "Intake",
    description: "Multi-Modal Intake",
    fullDesc:
      "Notes, lab PDFs, imaging, and ECG files enter a single intake flow to unify patient context. " +
      "Consistent intake reduces fragmentation and sets a clean baseline. " +
      "Ensures downstream signals are comparable across sources.",
    details:
      "Accepts clinician notes, PDFs, PNG/JPG imaging, and ECG .dat files with basic validation.",
    example:
      "Input: '72yo male, chest pain' + labs.pdf + chest_xray.jpg + ecg.dat.",
  },
  {
    title: "Extract",
    description: "Feature Extraction",
    fullDesc:
      "Rule-based parsing converts notes and lab text into structured findings and labels. " +
      "Structured signals are easier to combine with labs and imaging. " +
      "Improves traceability from narrative input to model evidence.",
    details:
      "Regex symptom map + lab range parsing with negation and family-history filters.",
    example:
      "Extraction: 'Denies chest pain' -> sym_chest_pain not set; 'WBC 14' -> wbc_high.",
  },
  {
    title: "Analyze",
    description: "AI Analysis",
    fullDesc:
      "Models score scans and physiological signals into likelihoods. " +
      "Probabilistic outputs allow direct comparison across modalities. " +
      "Turns raw data into decision-ready evidence.",
    details:
      "DenseNet121 (X-ray), ResNet18 (MRI/fracture), EfficientNet (skin), MobileNetV2 (breast), sklearn ECG.",
    example:
      "Output: Imaging X-ray -> Pneumonia 0.88; ECG -> ischemia probability.",
  },
  {
    title: "Fuse",
    description: "Bayesian Fusion",
    fullDesc:
      "Priors and evidence combine into ranked odds with calibrated weighting. " +
      "Balances baseline risk with new findings. " +
      "Reduces overconfidence when evidence is sparse.",
    details:
      "Demographic priors + likelihood ratios + model logits with comorbidity interactions.",
    example: "P(D|E) = Prior(D) * LR(E1) * LR(E2) ... / Normalizer.",
  },
  {
    title: "Rank",
    description: "Diagnostics",
    fullDesc:
      "Results surface top conditions, red flags, and evidence contributions. " +
      "Clinicians need fast, prioritized outputs. " +
      "Translates model evidence into actionable next steps.",
    details:
      "Ranks differentials, computes confidence intervals, and highlights feature contributions.",
    example: "Ranked: 1. ACS (0.92), 2. PE (0.04). Alerts: [ST-Elevation].",
  },
];

const ACTIVE_MODELS = [
  { 
    name: "Chest X-Ray", 
    target: "Pneumonia", 
    type: "DenseNet121",
    description: "Analyzes chest radiographs to detect pneumonia patterns and infiltrates with high sensitivity.",
    dataset: "ChestX-ray14 (NIH)",
    rationale: "Dense connections enable feature reuse across layers, critical for subtle opacity detection."
  },
  { 
    name: "Brain MRI", 
    target: "Tumor Class", 
    type: "ResNet18",
    description: "Classifies brain tumors from MRI scans into glioma, meningioma, and pituitary tumor categories.",
    dataset: "Brain Tumor MRI Dataset",
    rationale: "Residual connections prevent gradient degradation in deeper networks, improving classification accuracy."
  },
  { 
    name: "Dermatoscopy", 
    target: "Skin Lesion", 
    type: "EfficientNet-B0",
    description: "Identifies melanoma and other skin lesions from dermoscopic images using compound scaling.",
    dataset: "HAM10000 (ISIC)",
    rationale: "Balanced scaling of depth, width, and resolution optimizes accuracy while maintaining efficiency."
  },
  { 
    name: "Fracture Imaging", 
    target: "Fracture", 
    type: "ResNet18",
    description: "Detects bone fractures in X-ray images across multiple anatomical regions with spatial precision.",
    dataset: "MURA (Stanford)",
    rationale: "Proven architecture for medical imaging with strong transfer learning from ImageNet pretraining."
  },
  { 
    name: "Breast Imaging", 
    target: "Breast Cancer", 
    type: "MobileNetV2",
    description: "Screens mammograms for malignant masses and calcifications using depthwise separable convolutions.",
    dataset: "CBIS-DDSM",
    rationale: "Lightweight architecture enables real-time inference while maintaining clinical-grade performance."
  },
  { 
    name: "ECG Signals", 
    target: "Ischemia Risk", 
    type: "WFDB + sklearn",
    description: "Processes ECG waveforms to identify ST-segment changes and arrhythmias indicative of ischemia.",
    dataset: "PTB-XL Database",
    rationale: "Classical signal processing combined with ensemble methods handles time-series cardiac data effectively."
  },
];

const TECH_STACK = [
  {
    category: "Frontend",
    items: ["React 19", "Mantine UI", "Vite", "React Router"],
    description:
      "Delivers responsive diagnostic dashboards with real-time state management. Renders interactive visualizations for pipeline steps, differential rankings, and evidence breakdown across desktop and mobile devices.",
  },
  {
    category: "Backend",
    items: ["Python 3.12", "Flask", "PyYAML", "pypdf"],
    description:
      "Exposes RESTful endpoints for case submission, inference execution, and result retrieval. Handles PDF lab report extraction and YAML-based configuration management for disease priors and symptom mappings.",
  },
  {
    category: "ML Engine",
    items: ["PyTorch", "Torchvision", "Scikit", "WFDB"],
    description:
      "Executes multi-modal inference across imaging, lab, and signal inputs. Loads pretrained models for X-ray, MRI, dermatology, and fracture detection. Processes ECG waveforms and integrates outputs into Bayesian fusion pipeline.",
  },
  {
    category: "NLP",
    items: ["Regex", "Parsers", "Negation", "spaCy"],
    description:
      "Extracts clinical entities from unstructured clinician notes and patient histories. Handles negation detection to distinguish denied symptoms from confirmed findings. Normalizes medical terminology for structured input to inference engine.",
  },
];

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <PanelCard className="stat" padding="md">
      <Group justify="space-between" wrap="nowrap">
        <Stack gap={0}>
          <Text size="xs" c="dimmed" fw={700} tt="uppercase" className="overview-label">
            {label}
          </Text>
          <Text fw={800} size="xl" className="stat-number">
            {value}
          </Text>
        </Stack>
        <ThemeIcon variant="light" size={rem(42)} radius="md" color={color}>
          <Icon style={{ width: rem(24), height: rem(24) }} />
        </ThemeIcon>
      </Group>
    </PanelCard>
  );
}

function StepCard({ step, index, isActive, onClick, isLast }) {
  return (
    <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
      <UnstyledButton
        onClick={onClick}
        className={`overview-step-card ${isActive ? "is-active" : ""}`}
        style={{
          minHeight: rem(110),
          padding: rem(12),
          borderRadius: rem(12),
          transition: "all 0.2s ease",
          border: isActive ? "2px solid var(--accent)" : "1px solid var(--panel-card-border)",
          background: isActive ? "var(--surface-elevated)" : "var(--surface)",
        }}
      >
        <Stack gap={4} align="center" style={{ height: "100%", justifyContent: "center" }}>
          <ThemeIcon variant="light" color={isActive ? "cyan" : "gray"} size={rem(32)} radius="lg">
            <Text fw={700} size="sm" c={isActive ? "cyan.9" : "gray.6"}>
              {index + 1}
            </Text>
          </ThemeIcon>
          <Text 
            fw={700} 
            c={isActive ? "var(--accent)" : "var(--text-dimmed)"} 
            size="xs" 
            tt="uppercase"
            className="overview-label"
            style={{ letterSpacing: "0.06em" }}
          >
            Step {index + 1}
          </Text>
          <Text 
            fw={600} 
            size="xs" 
            ta="center" 
            lh={1.2} 
            c={isActive ? "var(--text-primary)" : "var(--text-secondary)"}
          >
            {step.title}
          </Text>
        </Stack>
      </UnstyledButton>
      {!isLast && (
        <IconArrowRight size={24} className="overview-step-arrow" style={{ opacity: 0.4, flexShrink: 0, color: "var(--accent)" }} />
      )}
    </Group>
  );
}

function SectionHeader({ title, subtitle, icon: Icon }) {
  return (
    <Stack gap={8} mb="lg">
      <Group gap="md" align="flex-start">
        <ThemeIcon variant="light" color="cyan" size={rem(44)} radius="lg">
          <Icon style={{ width: rem(24), height: rem(24) }} />
        </ThemeIcon>
        <Stack gap={4} style={{ flex: 1 }}>
          <Title order={2} size={rem(28)} fw={800} c="var(--text-primary)" lh={1.2}>
            {title}
          </Title>
          {subtitle && (
            <Text size="sm" c="var(--text-dimmed)" lh={1.5} style={{ maxWidth: rem(500) }}>
              {subtitle}
            </Text>
          )}
        </Stack>
      </Group>
    </Stack>
  );
}

function Overview() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <Stack gap="xl" pb="xl">
      <Box style={{ borderBottom: "1px solid var(--panel-card-border)" }} py="xl">
        <Container size="xl">
          <Stack gap="lg">
            <Group justify="space-between" align="flex-start" wrap="wrap" gap="xl">
              <Stack gap="md" style={{ maxWidth: rem(600) }}>
                <Badge
                  variant="light"
                  color="cyan"
                  leftSection={<IconSparkles size={16} />}
                  w="fit-content"
                  radius="md"
                  size="lg"
                  fw={600}
                >
                  System Prototype
                </Badge>
                <div>
                  <Title order={1} size={rem(44)} fw={900} c="var(--text-primary)" lh={1.1}>
                    Vitalis Dashboard
                  </Title>
                  <Text c="var(--text-primary)" size="lg" mt="xs" lh={1.6} style={{ maxWidth: rem(550) }}>
                    Clinical decision support powered by Bayesian inference and multi-modal analysis
                  </Text>
                </div>
              </Stack>
            </Group>
          </Stack>
        </Container>
      </Box>

      <Container size="xl">
        <Stack gap="xl">
          <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
            {SYSTEM_STATS.map((stat) => (
              <StatCard key={stat.label} {...stat} />
            ))}
          </SimpleGrid>

          <Box style={{ borderTop: "1px solid var(--panel-card-border)", paddingTop: rem(40) }}>
            <SectionHeader
              title="Inference Pipeline"
              subtitle="End-to-end flow from unstructured intake to ranked clinical evidence"
              icon={IconFileText}
            />
            <Stack gap="xl">
              <Group grow align="center" wrap="nowrap" style={{ overflowX: "auto", paddingBottom: rem(12) }}>
                {PIPELINE_STEPS.map((step, index) => (
                  <StepCard 
                    key={step.title}
                    step={step}
                    index={index}
                    isActive={index === activeStep}
                    onClick={() => setActiveStep(index)}
                    isLast={index === PIPELINE_STEPS.length - 1}
                  />
                ))}
              </Group>
              <Card padding={0} radius="xl" style={{ overflow: "hidden", background: "var(--surface)", border: "1px solid var(--panel-card-border)" }}>
                <Stack gap="lg" p="xl">
                  <Group justify="space-between" align="flex-start" wrap="wrap">
                    <Stack gap={4} style={{ flex: 1, maxWidth: rem(700) }}>
                      <Text fw={800} size={rem(24)} c="var(--accent)" lh={1.2}>
                        {PIPELINE_STEPS[activeStep].description}
                      </Text>
                      <Text size="md" c="var(--text-secondary)" lh={1.6} style={{ maxWidth: rem(800) }}>
                        {PIPELINE_STEPS[activeStep].fullDesc}
                      </Text>
                    </Stack>
                    <Badge variant="light" color="cyan" size="xl" radius="lg" py="sm" px="md" fw={700}>
                      Step {activeStep + 1}
                    </Badge>
                  </Group>
                  
                  <Divider my="md" label="Implementation Details" labelPosition="center" color="dark.5" />
                  
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
                    <Box p="lg" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--panel-card-border)", borderRadius: rem(12) }}>
                      <Stack gap="sm">
                        <Text size="xs" fw={800} c="var(--accent)" tt="uppercase" className="overview-label" style={{ letterSpacing: "0.08em" }}>
                          Logic & Mechanism
                        </Text>
                        <Text size="sm" ff="monospace" c="var(--text-secondary)" lh={1.6}>
                          {PIPELINE_STEPS[activeStep].details}
                        </Text>
                      </Stack>
                    </Box>
                    
                    <Box p="lg" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--panel-card-border)", borderRadius: rem(12) }}>
                      <Stack gap="sm">
                        <Text size="xs" fw={800} c="var(--accent)" tt="uppercase" className="overview-label" style={{ letterSpacing: "0.08em" }}>
                          Input/Output Example
                        </Text>
                        <Text size="sm" ff="monospace" c="var(--text-secondary)" lh={1.6}>
                          {PIPELINE_STEPS[activeStep].example}
                        </Text>
                      </Stack>
                    </Box>
                  </SimpleGrid>
                </Stack>
              </Card>
            </Stack>
          </Box>

          <Box style={{ borderTop: "1px solid var(--panel-card-border)", paddingTop: rem(40) }}>
            <SectionHeader
              title="Implementation"
              subtitle="Models, frameworks, and core technologies"
              icon={IconBrain}
            />
            
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
              <Stack gap="md">
                <Group gap="xs" mb="xs">
                  <ThemeIcon size="sm" radius="md" variant="light" color="cyan">
                    <IconBrain size={rem(14)} />
                  </ThemeIcon>
                  <Text size="sm" fw={700} c="var(--text-primary)">Active Models</Text>
                  <Badge size="xs" variant="light" color="gray" ml="auto">{ACTIVE_MODELS.length}</Badge>
                </Group>
                <Stack gap="xs">
                  {ACTIVE_MODELS.map((model) => (
                    <Box 
                      key={model.name}
                      p="md"
                      style={{ 
                        background: "var(--surface)",
                        border: "1px solid var(--panel-card-border)",
                        borderRadius: rem(12),
                        transition: "all 0.2s ease",
                        cursor: "default"
                      }}
                      className="model-card"
                      sx={{
                        '&:hover': {
                          background: 'var(--surface-elevated)',
                        }
                      }}
                    >
                      <Stack gap="sm">
                        {/* Row 1: Name and Badge */}
                        <Group justify="space-between" align="center" wrap="nowrap">
                          <Text size="sm" fw={700} c="var(--text-primary)" lh={1.2}>
                            {model.name}
                          </Text>
                          <Badge variant="dot" color="cyan" size="xs" radius="sm" fw={600}>
                            {model.target}
                          </Badge>
                        </Group>

                        {/* Row 2: Architecture and Training Data */}
                        <SimpleGrid cols={2} spacing="md">
                          <Group gap="xs" align="center">
                            <Text size="xs" c="var(--accent)" fw={700} tt="uppercase" style={{ fontSize: rem(9), letterSpacing: "0.05em" }}>
                              Architecture
                            </Text>
                            <Badge variant="outline" color="gray" size="xs" radius="md" fw={600} ff="monospace">
                              {model.type}
                            </Badge>
                          </Group>
                          <Group gap="xs" align="center">
                            <Text size="xs" c="var(--accent)" fw={700} tt="uppercase" style={{ fontSize: rem(9), letterSpacing: "0.05em" }}>
                              Training Data
                            </Text>
                            <Badge variant="outline" color="gray" size="xs" radius="md" fw={600}>
                              {model.dataset}
                            </Badge>
                          </Group>
                        </SimpleGrid>

                        {/* Divider */}
                        <Divider color="dark.5" />

                        {/* Row 3: Description */}
                        <Text size="xs" c="var(--text-secondary)" lh={1.6} fw={500}>
                          {model.description}
                        </Text>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </Stack>

              <Stack gap="md">
                <Group gap="xs" mb="xs">
                  <ThemeIcon size="sm" radius="md" variant="light" color="cyan">
                    <IconDeviceLaptop size={rem(14)} />
                  </ThemeIcon>
                  <Text size="sm" fw={700} c="var(--text-primary)">Tech Stack</Text>
                  <Badge size="xs" variant="light" color="gray" ml="auto">{TECH_STACK.length}</Badge>
                </Group>
                <Stack gap="xs">
                  {TECH_STACK.map(s => (
                    <Box 
                      key={s.category}
                      p="md"
                      style={{ 
                        background: "var(--surface)",
                        border: "1px solid var(--panel-card-border)",
                        borderRadius: rem(12),
                        transition: "all 0.2s ease",
                        cursor: "default"
                      }}
                      sx={{
                        '&:hover': {
                          background: 'var(--surface-elevated)',
                        }
                      }}
                    >
                      <Stack gap="sm">
                        {/* Row 1: Category */}
                        <Text size="sm" fw={700} c="var(--text-primary)" lh={1.2}>
                          {s.category}
                        </Text>

                        {/* Row 2: Technologies */}
                        <Group gap="xs" wrap="wrap">
                          {s.items.map(i => (
                            <Badge key={i} size="xs" variant="outline" color="gray" radius="md" fw={600}>
                              {i}
                            </Badge>
                          ))}
                        </Group>

                        {/* Divider */}
                        <Divider color="dark.5" />

                        {/* Row 3: Description */}
                        <Text size="xs" c="var(--text-secondary)" lh={1.6} fw={500}>
                          {s.description}
                        </Text>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </Stack>
            </SimpleGrid>
          </Box>
        </Stack>
      </Container>
    </Stack>
  );
}

export default Overview;
