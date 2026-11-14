import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Unknown application error' };
  }

  render() {
    if (this.state.hasError) {
      let displayMessage = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed && parsed.error) {
          displayMessage = `${parsed.error} (${parsed.operationType || 'operation'} · ${parsed.path || 'unknown'})`;
        }
      } catch {
        // Plain message
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
          <div className="w-full max-w-lg rounded-xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-slate-900 p-6">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Rakkoon Sirnaa Uumameera
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 break-words">
                  {displayMessage}
                </p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 dark:bg-slate-100 px-4 py-2 text-xs font-semibold text-white dark:text-slate-900 hover:opacity-90 transition-opacity"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Irra Deebi&apos;ii Bani</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
