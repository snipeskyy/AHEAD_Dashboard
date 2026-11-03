"use client";
import { Component, type ReactNode } from "react";
import { ErrorState } from "./index";

/** Isolates failures (e.g. one widget) so the rest of the page keeps working. */
export class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error)
      return (
        this.props.fallback ?? (
          <ErrorState
            title="This section failed to load"
            error={this.state.error}
            onRetry={() => this.setState({ error: null })}
          />
        )
      );
    return this.props.children;
  }
}
