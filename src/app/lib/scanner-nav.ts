import { isTouchPrimaryDevice } from "@/app/lib/device";

export type ScanMode = "validation" | "dispensing";
export type ScanInput = "camera" | "hardware";

export const LAST_MODE_KEY = "scanner_last_mode";
export const LAST_INPUT_KEY = "scanner_input_mode";

export function buildScannerUrl(mode: ScanMode, input: ScanInput): string {
  return `/scanner?mode=${mode}&input=${input}`;
}

export function defaultScanInput(): ScanInput {
  return isTouchPrimaryDevice() ? "camera" : "hardware";
}

export function parseScanInput(value: string | null): ScanInput | null {
  if (value === "camera" || value === "hardware") return value;
  return null;
}
