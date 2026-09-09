import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

class CopilotContentErrorBoundary extends Component<
  ErrorBoundaryProps,
  { hasError: boolean; error?: Error }
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error: error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error caught by Error Boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-[#7F1D1D33] border border-[#EF4444] rounded px-2.5 py-1 space-y-1">
          <p className="font-medium">An error occurred while rendering content.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default CopilotContentErrorBoundary;
