'use client';

import React from 'react';

type Props = { children: React.ReactNode; fallback?: React.ReactNode };
type State = { hasError: boolean; error?: Error };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log per Vercel (server logs) e console del browser
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="m-4 rounded-xl border border-rose-500/40 bg-rose-900/20 p-4 text-rose-100">
          <div className="text-lg font-semibold">Si è verificato un errore in pagina</div>
          <div className="mt-1 text-sm opacity-80">
            Ricarica o torna alla Lobby. Se persiste, condividi lo screenshot della console.
          </div>
          {this.state.error && (
            <pre className="mt-3 max-h-48 overflow-auto text-xs bg-black/30 p-3 rounded">
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
