import React, { StrictMode, Component } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './index.css';
import App from './App.jsx';

// Custom ErrorBoundary class component to catch uncaught crashes when Sentry is absent
class LocalErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("LocalErrorBoundary caught an uncaught error:", error, errorInfo);
    
    // Log uncaught client error to backend database / logs
    const baseApi = import.meta.env.VITE_API_URL || 'https://bintang-adv.duckdns.org/api';
    try {
      fetch(`${baseApi.replace(/\/$/, '')}/log-client-error/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: error?.message || String(error),
          info: errorInfo,
          url: window.location.href,
        }),
      }).catch(err => console.warn('Failed to log client error to backend:', err));
    } catch (e) {
      console.warn('Failed to send client error logs:', e);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 max-w-md mx-auto my-10 bg-red-50 border border-red-200 text-red-700 rounded-xl text-center space-y-3 shadow-sm">
          <h2 className="font-bold text-base">Terjadi Kesalahan Sistem</h2>
          <p className="text-xs text-red-600">
            Aplikasi mendeteksi error yang tidak terduga. Silakan muat ulang halaman atau coba
            lagi nanti.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition-colors"
          >
            Muat Ulang Halaman
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const sentryDsn = import.meta.env.VITE_SENTRY_DSN || '';
const apiUrl = import.meta.env.VITE_API_URL || '';

if (sentryDsn) {
  let apiHost = '';
  try {
    if (apiUrl) {
      const urlObj = new URL(apiUrl);
      apiHost = urlObj.host;
    }
  } catch (e) {
    console.warn('Failed to parse VITE_API_URL for Sentry tracing:', e);
  }

  const tracePropagationTargets = ['localhost', /^\//];
  if (apiHost) {
    // Escape dots in the hostname to construct a secure RegExp
    const escapedHost = apiHost.replace(/\./g, '\\.');
    tracePropagationTargets.push(new RegExp(`^https?:\\/\\/${escapedHost}`));
  } else {
    // Dynamically match current domain to be staging and environment-agnostic
    tracePropagationTargets.push(new RegExp(`^https?:\\/\\/${window.location.host.replace(/\./g, '\\.')}`));
  }

  Sentry.init({
    dsn: sentryDsn,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: 0.1,
    tracePropagationTargets: tracePropagationTargets,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LocalErrorBoundary>
      {sentryDsn ? (
        <Sentry.ErrorBoundary
          fallback={
            <div className="p-6 max-w-md mx-auto my-10 bg-red-50 border border-red-200 text-red-700 rounded-xl text-center space-y-3 shadow-sm">
              <h2 className="font-bold text-base">Terjadi Kesalahan Sistem</h2>
              <p className="text-xs text-red-600">
                Aplikasi mendeteksi error yang tidak terduga. Silakan muat ulang halaman atau coba
                lagi nanti.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition-colors"
              >
                Muat Ulang Halaman
              </button>
            </div>
          }
        >
          <App />
        </Sentry.ErrorBoundary>
      ) : (
        <App />
      )}
    </LocalErrorBoundary>
  </StrictMode>
);
