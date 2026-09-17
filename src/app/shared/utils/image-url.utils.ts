import { getApiBaseUrl } from './api-url.utils';

/**
 * Converts an image URL from the backend format to the correct frontend-accessible format.
 * Backend stores: /uploads/question-images/file.png
 * Frontend should request: {backend}/storage/question-images/file.png
 */
export function imageUrl(url: string | null | undefined): string {
  if (!url) return '';

  // Already absolute (the backend can also return full URLs directly)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  const base = getApiBaseUrl();

  if (url.startsWith('/storage/')) {
    return `${base}${url}`;
  }

  // Convert /uploads/ to /storage/
  if (url.startsWith('/uploads/')) {
    return `${base}${url.replace('/uploads/', '/storage/')}`;
  }

  return `${base}${url}`;
}
