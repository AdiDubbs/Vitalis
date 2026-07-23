import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import { MantineProvider, createTheme } from "@mantine/core";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/components.css";
import "./styles/pages.css";
import App from "./App.jsx";

const theme = createTheme({
  fontFamily: "Geist, system-ui, sans-serif",
  fontSizes: {
    xs: "0.82rem",
    sm: "0.94rem",
    md: "1.06rem",
    lg: "1.2rem",
    xl: "1.36rem",
  },
  headings: {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontWeight: 800,
    sizes: {
      h1: { fontSize: "2.7rem", lineHeight: "1.15" },
      h2: { fontSize: "2.1rem", lineHeight: "1.2" },
      h3: { fontSize: "1.65rem", lineHeight: "1.25" },
      h4: { fontSize: "1.35rem", lineHeight: "1.3" },
      h5: { fontSize: "1.15rem", lineHeight: "1.35" },
      h6: { fontSize: "1.05rem", lineHeight: "1.4" },
    },
  },
  colors: {
    forest: [
      "#e4edeb",
      "#d0dedb",
      "#b9cbc7",
      "#9db5b0",
      "#7f9b95",
      "#5e7e78",
      "#4b6b66",
      "#35524d",
      "#1f3a36",
      "#152828",
    ],
    gray: [
      "#f5f7f8",
      "#e6eaed",
      "#d6dde1",
      "#c3cbd1",
      "#aab4bc",
      "#8f9aa3",
      "#6f7782",
      "#59616b",
      "#414852",
      "#2b3038",
    ],
    dark: [
      "#f6f8f9",
      "#dfe6ea",
      "#97a3b0",
      "#7a8794",
      "#616c77",
      "#4a545f",
      "#353d46",
      "#242a31",
      "#181c21",
      "#10211f",
    ],
  },
  primaryColor: "cyan",
  primaryShade: 9,
  defaultRadius: "lg",
  autoContrast: true,
  luminanceThreshold: 0.5,
  focusRing: "auto",
  cursorType: "pointer",
  components: {
    Card: {
      defaultProps: {
        radius: "lg",
        padding: "lg",
      },
      styles: {
        root: {
          backgroundColor: "var(--surface)",
          borderColor: "color-mix(in srgb, var(--accent) 20%, transparent)",
        },
      },
    },
    Paper: {
      defaultProps: {
        radius: "lg",
        p: "lg",
      },
      styles: {
        root: {
          backgroundColor: "var(--surface)",
          borderColor: "color-mix(in srgb, var(--accent) 20%, transparent)",
        },
      },
    },
    Button: {
      defaultProps: {
        radius: "lg",
        size: "md",
      },
      styles: {
        root: {
          fontWeight: 600,
          letterSpacing: "0.01em",
        },
      },
    },
    ActionIcon: {
      defaultProps: {
        radius: "xl",
      },
      styles: {
        root: {
          borderColor: "color-mix(in srgb, var(--accent) 20%, transparent)",
        },
      },
    },
    Badge: {
      defaultProps: {
        radius: "xl",
      },
      styles: {
        root: {
          fontWeight: 600,
          letterSpacing: "0.01em",
        },
      },
    },
    RingProgress: {
      styles: {
        track: {
          stroke: "#ffffff",
          strokeWidth: 16,
        },
      },
    },
    Modal: {
      styles: {
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
      },
    },
    SegmentedControl: {
      styles: {
        root: {
          backgroundColor: "var(--surface)",
          border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
          padding: 4,
        },
        control: {
          border: "none",
        },
        label: {
          color: "var(--text-secondary)",
          fontWeight: 500,
        },
      },
    },
  },
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <App />
    </MantineProvider>
  </StrictMode>
);
