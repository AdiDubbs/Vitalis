import { Paper } from "@mantine/core";

function PanelCard({ children, padding = "md", className = "", ...props }) {
  return (
    <Paper
      radius="lg"
      p={padding}
      className={`panel-card ${className}`.trim()}
      {...props}
    >
      {children}
    </Paper>
  );
}

export default PanelCard;
