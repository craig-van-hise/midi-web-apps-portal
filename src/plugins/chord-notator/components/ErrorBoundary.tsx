import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white flex items-center justify-center p-8 font-sans">
          <div className="max-w-md w-full">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Application Error</h1>
            <p className="text-gray-600 mb-6">The application crashed. This is likely due to a theoretical database loading failure or a rendering engine error.</p>
            <div className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-60 mb-6 font-mono border border-gray-200">
              {this.state.error?.toString()}
              <br />
              {this.state.error?.stack}
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="bg-[#aa3bff] text-white px-6 py-2 rounded-full font-bold hover:bg-[#912ee0] transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
