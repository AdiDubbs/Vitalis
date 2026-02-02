import {
  Badge,
  Divider,
  Group,
  Stack,
  Text,
} from "@mantine/core";
import PanelCard from "./PanelCard";

function CaseSummary({
  selectedSymptoms,
  demographics,
  doctorNote,
  imagingCount,
}) {
  return (
    <PanelCard
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Stack gap="sm" style={{ flex: 1, justifyContent: 'space-evenly' }}>
        <Group gap="xs">
          <Text fw={600} size="sm">
            Case Summary
          </Text>
        </Group>

        <Divider />

        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              Patient
            </Text>
            <Text size="xs" fw={500}>
              {demographics || "—"}
            </Text>
          </Group>

          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              Symptoms selected
            </Text>
            <Badge
              size="xs"
              variant={selectedSymptoms.size > 0 ? "light" : "outline"}
              color={selectedSymptoms.size > 0 ? "cyan" : "gray"}
            >
              {selectedSymptoms.size}
            </Badge>
          </Group>

          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              Medical history
            </Text>
            <Badge
              size="xs"
              variant={doctorNote?.trim() ? "light" : "outline"}
              color={doctorNote?.trim() ? "green" : "gray"}
            >
              {doctorNote?.trim() ? "Provided" : "Missing"}
            </Badge>
          </Group>

          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              Imaging
            </Text>
            <Badge size="xs" variant="light" color="cyan">
              {imagingCount}
            </Badge>
          </Group>
        </Stack>

      </Stack>
    </PanelCard>
  );
}

export default CaseSummary;
