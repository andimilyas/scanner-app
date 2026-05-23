/** Phone / tablet: coarse pointer — avoid focusing hidden inputs (soft keyboard). */
export function isTouchPrimaryDevice(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(pointer: coarse)").matches;
}

export function isEditableInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const el = target as HTMLInputElement | HTMLTextAreaElement;
  if (el instanceof HTMLTextAreaElement) return true;
  if (!(el instanceof HTMLInputElement)) return false;
  if (el.dataset.scannerInput === "true") return false;
  const type = (el.type || "text").toLowerCase();
  return type !== "hidden";
}
