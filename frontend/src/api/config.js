// Centralized API configuration
// Uses VITE_API_URL so the frontend can point to any backend without code changes

const rawUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000').trim();
const normalizedUrl = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;

export const API_BASE_URL = normalizedUrl;
