import crypto from "node:crypto";

export function formatWorkorderNumber(serialNumber: number): string {
  return `OS-${serialNumber.toString().padStart(6, "0")}`;
}

export function temporaryWorkorderNumber(): string {
  return `TMP-${crypto.randomUUID()}`;
}
