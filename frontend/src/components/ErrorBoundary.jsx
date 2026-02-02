import React from 'react';
import { Container, Title, Text, Button, Center, Stack } from '@mantine/core';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  // eslint-disable-next-line no-unused-vars
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Center h="100vh">
          <Container>
            <Stack align="center" gap="md">
              <Title order={1}>Something went wrong</Title>
              <Text c="dimmed">We encountered an unexpected error. Please try refreshing the page.</Text>
              <Button onClick={() => window.location.reload()} variant="light" color="cyan">
                Refresh Page
              </Button>
            </Stack>
          </Container>
        </Center>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
