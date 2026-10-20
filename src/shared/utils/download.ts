/** Saves a Blob as a file (falls back to opening it when the browser ignores `download`). */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  // Long enough for in-app browsers that open the file in a new view.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
