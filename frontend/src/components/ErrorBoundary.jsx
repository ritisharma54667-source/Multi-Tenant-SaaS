// ============================================================
// ERROR BOUNDARY — Phase 8
// ============================================================
// Catches React render/lifecycle errors anywhere below it in the
// tree and shows a friendly fallback instead of a white screen.
// Does NOT catch errors in event handlers or async code (React
// limitation) — those are handled per-page via try/catch + toast,
// same pattern used throughout the app already.
// ============================================================
import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] caught a render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
          <AlertTriangle size={32} className="text-status-warning mb-4" />
          <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
          <p className="text-muted-text max-w-sm mb-6">
            The app hit an unexpected error. Reloading usually fixes it — your data is
            safe, this was a display problem, not a data problem.
          </p>
          <button onClick={() => window.location.reload()} className="btn-primary">
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
