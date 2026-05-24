// Centralized API configuration
// Uses VITE_API_URL so the frontend can point to any backend without code changes

if (!import.meta.env.VITE_API_URL) {
  throw new Error(
    'VITE_API_URL environment variable is required. ' +
    'Please configure it in your hosting platform (e.g., Render).'
  );
}

const rawUrl = import.meta.env.VITE_API_URL.trim();
if (!/^https?:\/\//i.test(rawUrl)) {
  throw new Error('VITE_API_URL must start with http:// or https://');
}

const normalizedUrl = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;

export const API_BASE_URL = normalizedUrl;
