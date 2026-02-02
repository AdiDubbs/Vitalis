import {
  Badge,
  Button,
  Card,
  Container,
  Divider,
  Group,
  Image,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Box,
} from "@mantine/core";
import {
  IconArrowRight,
  IconChartDots,
  IconChecklist,
  IconShieldCheck,
  IconSparkles,
  IconStethoscope,
  IconActivity,
  IconPhotoScan,
  IconGitBranch,
  IconMicroscope,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import doctorPatient from "../assets/undraw_doctor_patient.svg";
import doctors from "../assets/undraw_doctors.svg";

const THINKING_STEPS = [
  {
    title: "Symptom Selection",
    description:
      "Select primary symptoms and add brief notes for timing and severity.",
    example:
      "Example: 28-year-old male with fever, cough, and chest tightness.",
  },
  {
    title: "Evidence Upload",
    description:
      "Attach lab PDFs or scans to add objective signals to the case.",
    example: "Example: Chest X-ray image uploaded alongside lab results.",
  },
  {
    title: "Ranked Results",
    description: "View ranked conditions with confidence estimates.",
    example: "Example: Ranked list shows influenza, pneumonia, bronchitis.",
  },
];

const LIVE_STATS = [
  { label: "Diseases Mapped", value: "85+", icon: IconActivity, color: "blue" },
  { label: "Symptom Nodes", value: "320+", icon: IconGitBranch, color: "cyan" },
  { label: "Models Active", value: "5", icon: IconPhotoScan, color: "teal" },
  { label: "Lab Biomarkers", value: "45+", icon: IconMicroscope, color: "grape" },
];

function Home() {
  const navigate = useNavigate();
  const subtleTextColor = "var(--text-primary)";

  const handleStartDiagnosis = () => {
    navigate("/diagnosis");
  };

  return (
    <Stack gap="xl">
      <section className="section hero-canvas">
        <Container className="hero-content" size="lg">
          <SimpleGrid
            cols={{ base: 1, md: 2 }}
            spacing={50}
            verticalSpacing="xl"
          >
            <div className="hero-left">
              <div className="hero-blob" aria-hidden="true" />
              <Stack gap="lg" justify="center">
                <Badge
                  variant="light"
                  color="cyan"
                  leftSection={<IconSparkles size={14} />}
                  w="fit-content"
                >
                  Trusted clinical workflow
                </Badge>
                <Title
                  order={1}
                  c={subtleTextColor}
                >
                  Your diagnostic co-pilot
                </Title>
                <Text c={subtleTextColor} size="lg" className="line-height-1-6">
                  Vitalis supports calm, structured intake and clear reasoning
                  so care teams can move from symptoms to next steps with
                  confidence.
                </Text>
                <Group mt="md">
                  <Button
                    rightSection={<IconArrowRight size={20} />}
                    onClick={handleStartDiagnosis}
                    color="cyan"
                    className="btn-hover-lift"
                  >
                    Start Diagnosis
                  </Button>
                </Group>
                
                <Group gap="xs" mt="sm" wrap="wrap">
                  {LIVE_STATS.map((stat) => (
                    <Badge
                      key={stat.label}
                      variant="light"
                      color="cyan"
                      size="md"
                      leftSection={<stat.icon size={14} />}
                    >
                      {stat.value} {stat.label}
                    </Badge>
                  ))}
                </Group>
              </Stack>
            </div>
            <div className="hero-visual">
              <div className="hero-glow" aria-hidden="true" />
              <Image
                src={doctorPatient}
                alt="Clinician and patient illustration"
                fit="contain"
                className="theme-invert hero-illustration"
              />
            </div>
          </SimpleGrid>
        </Container>
      </section>

      <section className="section section-tight">
        <Container size="lg">
          <Stack gap="xl">
            <Stack gap={6}>
              <Badge
                variant="light"
                color="cyan"
                leftSection={<IconShieldCheck size={14} />}
                w="fit-content"
              >
                From intake to guidance
              </Badge>
              <Title order={2} c={subtleTextColor}>
                A clear, consistent diagnostic flow.
              </Title>
              <Text c={subtleTextColor} size="lg">
                Move from intake to guidance without losing context or clarity.
              </Text>
            </Stack>

            <div className="thinking-steps-container">
              {THINKING_STEPS.map((step, index) => (
                <Box key={step.title} className="thinking-step-wrapper">
                  <Card
                    padding="lg"
                    radius="lg"
                    className="panel-card"
                  >
                    <Stack gap="xs" className="line-height-1-6">
                      <Group gap="sm" justify="space-between" align="center">
                        <Group gap="sm" align="center">
                          <ThemeIcon
                            variant="light"
                            color="cyan"
                            size="md"
                            radius="lg"
                          >
                            {index + 1}
                          </ThemeIcon>
                          <Text fw={700} c={subtleTextColor} size="lg">
                            {step.title}
                          </Text>
                        </Group>
                      </Group>
                      <Stack gap="md" className="max-width-360">
                        <Text c={subtleTextColor} size="md">
                          {step.description}
                        </Text>
                        <Divider color="dark.5" my={6} />
                        <Text c="dimmed" size="sm">
                          {step.example}
                        </Text>
                      </Stack>
                    </Stack>
                  </Card>
                  {index < THINKING_STEPS.length - 1 && (
                    <div className="step-arrow">
                      <IconArrowRight
                        size={24}
                        color="var(--mantine-color-cyan-7)"
                      />
                    </div>
                  )}
                </Box>
              ))}
            </div>
          </Stack>
        </Container>
      </section>

      <section className="section section-tight">
        <Container size="lg">
          <Card radius="lg" padding="lg" className="panel-card">
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
              <Stack gap="md" justify="center">
                <Title order={3} c={subtleTextColor}>
                  Get results with confidence.
                </Title>
                <Text c={subtleTextColor} size="lg" className="line-height-1-7">
                  See ranked conditions based on symptoms, labs, and uploads in
                  a single view, with confidence estimates and key signals
                  surfaced for quick review.
                </Text>
                <Button
                  variant="light"
                  rightSection={<IconArrowRight size={16} />}
                  onClick={handleStartDiagnosis}
                  color="cyan"
                  className="btn-hover-lift"
                  mt="sm"
                >
                  Start Diagnosis
                </Button>
              </Stack>
              <Group justify="center">
                <Image
                  src={doctors}
                  alt="Care team illustration"
                  fit="contain"
                  className="theme-invert hero-illustration hero-illustration--compact"
                />
              </Group>
            </SimpleGrid>
          </Card>
        </Container>
      </section>
    </Stack>
  );
}

export default Home;
