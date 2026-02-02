import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes, Link, NavLink } from "react-router-dom";
import {
  AppShell,
  Button,
  Burger,
  Container,
  Drawer,
  Group,
  Stack,
  Text,
  Center,
  Loader,
} from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { useDisclosure } from "@mantine/hooks";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

const Home = lazy(() => import("./pages/Home.jsx"));
const DiagnosisLayout = lazy(() => import("./pages/Diagnosis.jsx"));
const Overview = lazy(() => import("./pages/Overview.jsx"));
const Results = lazy(() => import("./pages/Results.jsx"));

function App() {
  const [navOpened, { toggle: toggleNav, close: closeNav }] =
    useDisclosure(false);

  return (
    <BrowserRouter>
      <Notifications />
      <AppShell header={{ height: { xs: 48, sm: 64 } }} footer={{ height: 56 }}>
        <AppShell.Header className="app-header">
          <Container h="100%" size="xl">
            <Group
              h="100%"
              justify="space-between"
              className="app-header-inner"
              wrap="wrap"
            >
              <Group
                component={Link}
                to="/"
                gap="xs"
                align="center"
                className="brand-link"
              >
                <span className="brand-mark" aria-hidden="true" />
                <Text fw={700} size="lg" className="brand-name">
                  Vitalis
                </Text>
              </Group>
              <Group gap="sm" className="nav-buttons" wrap="wrap">
                <Button
                  component={NavLink}
                  to="/"
                  variant="subtle"
                  color="cyan"
                  className={({ isActive }) =>
                    isActive ? "nav-button nav-button-active" : "nav-button"
                  }
                >
                  Home
                </Button>
                <Button
                  component={NavLink}
                  to="/overview"
                  variant="subtle"
                  color="cyan"
                  className={({ isActive }) =>
                    isActive ? "nav-button nav-button-active" : "nav-button"
                  }
                >
                  Overview
                </Button>
                <Button
                  component={NavLink}
                  to="/diagnosis"
                  variant="light"
                  color="cyan"
                  className={({ isActive }) =>
                    isActive ? "nav-button nav-button-active" : "nav-button"
                  }
                >
                  Start Diagnosis
                </Button>
              </Group>
              <Burger
                opened={navOpened}
                onClick={toggleNav}
                size="sm"
                className="nav-burger"
                aria-label="Toggle navigation"
              />
            </Group>
          </Container>
        </AppShell.Header>
        <AppShell.Main className="app-main">
          <ErrorBoundary>
            <Container size="xl">
              <Suspense
                fallback={
                  <Center h={400}>
                    <Loader type="dots" />
                  </Center>
                }
              >
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/overview" element={<Overview />} />
                  <Route path="/diagnosis" element={<DiagnosisLayout />} />
                  <Route path="/results" element={<Results />} />
                  <Route path="*" element={<Home />} />
                </Routes>
              </Suspense>
            </Container>
          </ErrorBoundary>
        </AppShell.Main>
        <AppShell.Footer className="app-footer">
          <Container py="md" size="xl">
            <Group
              justify="space-between"
              align="center"
              wrap="wrap"
              className="app-footer-inner"
            >
              <Group
                gap="xs"
                align="center"
                wrap="wrap"
                className="app-footer-brand"
              >
                <Group
                  component={Link}
                  to="/"
                  gap="xs"
                  align="center"
                  className="brand-link"
                >
                  <span className="brand-mark" aria-hidden="true" />
                  <Text fw={700} size="sm" className="brand-name">
                    Vitalis
                  </Text>
                </Group>
                <Text size="xs" c="dimmed">
                  •
                </Text>
                <Text size="sm" c="dimmed">
                  Your diagnostic co-pilot for structured clinical workflows.
                </Text>
              </Group>

              <Group
                gap="xs"
                align="center"
                wrap="wrap"
                className="app-footer-meta"
              >
                <Text size="sm" c="dimmed">
                  Prototype demo — not for clinical decisions.
                </Text>
              </Group>
            </Group>
          </Container>
        </AppShell.Footer>
        <Drawer
          opened={navOpened}
          onClose={closeNav}
          position="right"
          size="xs"
          title="Navigate"
          overlayProps={{ backgroundOpacity: 0.5, blur: 2 }}
          className="nav-drawer"
        >
          <Stack gap="xs">
            <Button
              component={NavLink}
              to="/"
              variant="subtle"
              color="cyan"
              className={({ isActive }) =>
                isActive ? "nav-button nav-button-active" : "nav-button"
              }
              onClick={closeNav}
              fullWidth
            >
              Home
            </Button>
            <Button
              component={NavLink}
              to="/overview"
              variant="subtle"
              color="cyan"
              className={({ isActive }) =>
                isActive ? "nav-button nav-button-active" : "nav-button"
              }
              onClick={closeNav}
              fullWidth
            >
              Overview
            </Button>
            <Button
              component={NavLink}
              to="/diagnosis"
              variant="subtle"
              color="cyan"
              className={({ isActive }) =>
                isActive ? "nav-button nav-button-active" : "nav-button"
              }
              onClick={closeNav}
              fullWidth
            >
              Start Diagnosis
            </Button>
          </Stack>
        </Drawer>
      </AppShell>
    </BrowserRouter>
  );
}

export default App;
