/**
 * Validate file is a PDF by checking magic bytes
 */
export function isPdfFile(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer, 0, 5);
  // PDF magic bytes: %PDF-
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2D;
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Generate a unique file ID
 */
export function generateFileId(): string {
  return crypto.randomUUID();
}

/**
 * Clean filename for use as document title
 */
export function cleanFilename(name: string): string {
  return name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();
}

/**
 * Validate file constraints
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  const MAX_SIZE = 50 * 1024 * 1024; // 50MB

  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return { valid: false, error: 'Only PDF files are accepted' };
  }

  if (file.size > MAX_SIZE) {
    return { valid: false, error: `File exceeds 50MB limit (${formatBytes(file.size)})` };
  }

  if (file.size === 0) {
    return { valid: false, error: 'File is empty' };
  }

  return { valid: true };
}

/**
 * Max files in a batch
 */
export const MAX_BATCH_SIZE = 10;

/**
 * Download bytes as file
 */
export function downloadFile(bytes: ArrayBuffer, filename: string): void {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Download text content as file
 */
export function downloadTextFile(content: string, filename: string, mimeType: string = 'application/json'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
