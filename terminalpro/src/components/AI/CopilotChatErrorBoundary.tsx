import { Component, type ErrorInfo, type ReactNode } from "react";
import { useCopilotStore } from "~/lib/state/copilot";
import Icon from "../Icon";

interface ErrorBoundaryProps {
  children: ReactNode;
}

class CopilotChatErrorBoundary extends Component<
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
        <div className="px-10 py-5 flex h-screen items-center justify-center p-2 flex-col bg-white dark:bg-dark-900 copilot text-xs max-h-screen">
          <div className="text-center text-light-900 dark:text-light-50">
            <div className="flex flex-col items-center gap-4 mb-8">
              <Icon id="exclamation-outline-triangle" className="h-10 w-10" />
              <h1 className="text-lg font-bold uppercase tracking-wide">
                Something went wrong
              </h1>
            </div>
            <p className="text-light-500 dark:text-light-400 mb-4 text-lg">
              Clearing all chats may fix this.
            </p>
            <button
              onClick={() => {
                useCopilotStore.getState().resetChats();
                this.setState({ hasError: false });
              }}
              className="rounded py-1 px-2 border text-light-500 hover:text-light-700 dark:text-light-400 dark:hover:text-light-200"
            >
              Clear
            </button>
            <p className="mt-14 text-light-500 dark:text-light-400">
              For help contact{" "}
              <a
                href="mailto:support@openbb.finance"
                className="text-brand-main underline dark:text-brand-lighter"
              >
                support@openbb.finance
              </a>
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default CopilotChatErrorBoundary;
