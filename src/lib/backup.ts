export const BACKUP_INTERVAL_MINUTES = 360;

export function formatBackupInterval(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minutes`;
  }

  const hours = minutes / 60;
  if (Number.isInteger(hours)) {
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }

  return `${hours.toFixed(1)} hours`;
}
