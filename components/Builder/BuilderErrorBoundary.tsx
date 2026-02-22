"use client";

import React from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class BuilderErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[BuilderErrorBoundary] Caught error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-4">
          <div className="max-w-md w-full bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-red-200 dark:border-red-900 p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0" />
              <h2 className="text-lg font-bold text-red-600 dark:text-red-400">
                Builder Error
              </h2>
            </div>

            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              Something went wrong in the Builder. The error has been logged for debugging.
            </p>

            {this.state.error && (
              <div className="mb-4 p-3 bg-zinc-100 dark:bg-zinc-700 rounded text-xs font-mono text-zinc-700 dark:text-zinc-300 overflow-auto max-h-32">
                {this.state.error.message}
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
