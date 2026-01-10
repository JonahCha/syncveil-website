// Centralized API configuration
// Uses VITE_API_URL so the frontend can point to any backend without code changes

// Production-safe behavior:
// - DEV mode: Allow localhost fallback for local development
// - PROD mode: Require VITE_API_URL or fail loudly
let rawUrl;

if (import.meta.env.VITE_API_URL) {
  rawUrl = import.meta.env.VITE_API_URL.trim();
} else if (import.meta.env.DEV) {
  // Local development fallback
  rawUrl = 'http://localhost:8000';
} else {
  // Production without VITE_API_URL - fail loudly
  throw new Error(
    'VITE_API_URL environment variable is required in production. ' +
    'Please configure it in your hosting platform (e.g., Render).'
  );
}

const normalizedUrl = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;

export const API_BASE_URL = normalizedUrl;
