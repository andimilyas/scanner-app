/**
 * Pola input alat barcode (keyboard wedge):
 * - Karakter cepat berurutan, diakhiri Enter/Tab
 * - Jeda lama antar scan = sesi baru (bukan reset di tengah barcode)
 */

/** Jeda antar karakter dalam satu barcode (ms). Di atas ini = barcode baru. */
export const SCAN_SESSION_GAP_MS = 500;

export const SCAN_DEDUP_MS = 2000;

export function isScanTerminator(key: string): boolean {
  return key === "Enter" || key === "Tab";
}

export function appendScannerChar(
  buffer: string,
  char: string,
  lastKeyAt: number,
  now: number
): { buffer: string; lastKeyAt: number } {
  if (now - lastKeyAt > SCAN_SESSION_GAP_MS && buffer.length > 0) {
    buffer = "";
  }
  return { buffer: buffer + char, lastKeyAt: now };
}

export function flushScannerBuffer(buffer: string): string {
  return buffer.trim();
}
