/**
 * Converts an image URL from the backend format to the correct frontend-accessible format.
 * Backend stores: /uploads/question-images/file.png
 * Frontend should request: /storage/question-images/file.png
 */
export function imageUrl(url: string | null | undefined): string {
  if (!url) return '';

  // If already an absolute URL or a storage URL, return as is
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/storage/')) {
    return url;
  }

  // Convert /uploads/ to /storage/
  if (url.startsWith('/uploads/')) {
    return url.replace('/uploads/', '/storage/');
  }

  return url;
}
