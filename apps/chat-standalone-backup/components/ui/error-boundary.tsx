"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "./button";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
    this.props.onReset?.();
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, showDetails } = this.state;
      const { fallbackTitle = "Something went wrong" } = this.props;

      return (
        <div className="flex items-center justify-center min-h-[200px] p-6">
          <div className="w-full max-w-lg rounded-xl border-2 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-6 shadow-lg">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/50">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-red-800 dark:text-red-300">
                  {fallbackTitle}
                </h2>
                <p className="text-sm text-red-600 dark:text-red-400">
                  An unexpected error occurred in this component
                </p>
              </div>
            </div>

            {/* Error Message */}
            <div className="mb-4 p-3 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
              <p className="text-sm font-mono text-red-700 dark:text-red-300 break-words">
                {error?.message || "Unknown error"}
              </p>
            </div>

            {/* Collapsible Details */}
            <button
              onClick={this.toggleDetails}
              className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 mb-4"
            >
              {showDetails ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              {showDetails ? "Hide details" : "Show details"}
            </button>

            {showDetails && (
              <div className="mb-4 p-3 rounded-lg bg-zinc-900 text-zinc-300 overflow-auto max-h-48">
                <pre className="text-xs font-mono whitespace-pre-wrap">
                  {error?.stack || "No stack trace available"}
                  {errorInfo?.componentStack && (
                    <>
                      {"\n\nComponent Stack:"}
                      {errorInfo.componentStack}
                    </>
                  )}
                </pre>
              </div>
            )}

            {/* Retry Button */}
            <Button
              onClick={this.handleReset}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrapper component for functional components
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallbackTitle?: string
) {
  return function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary fallbackTitle={fallbackTitle}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}
