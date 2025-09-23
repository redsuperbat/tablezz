import { Component, type ReactNode } from "react";
import { toast } from "sonner";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: string;
  onError?: (error: Error) => void;
}

interface ErrorBoundaryState {
  error?: Error;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: undefined };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error): void {
    setTimeout(() => {
      toast.error(error.message);
    }, 10);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="grid place-items-center w-screen h-screen">
          <div className="flex flex-col items-center max-w-2xl">
            <h3 className="font-bold">An unexpected error occurred</h3>
            <span>{this.state.error.message}</span>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
