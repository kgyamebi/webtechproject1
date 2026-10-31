/** Pure rules for the course-week loop. Times use the server clock. */

export function quietHoursSleeping(on: boolean, startMinute: number, endMinute: number, now: Date): boolean {
  if (!on || startMinute === endMinute) {
    return false;
  }
  const minute = now.getHours() * 60 + now.getMinutes();
  if (startMinute < endMinute) {
    return minute >= startMinute && minute < endMinute;
  }
  return minute >= startMinute || minute < endMinute;
}

export function clashesWith(eventStart: Date, itemAt: Date, windowMs = 2 * 60 * 60 * 1000): boolean {
  return Math.abs(eventStart.getTime() - itemAt.getTime()) <= windowMs;
}

export function weekStartMonday(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() + diff);
  return copy;
}

export function formatMinute(minute: number): string {
  const safe = ((minute % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export const PRESENCE_LABEL = {
  AVAILABLE: "Available",
  IN_CLASS: "In class",
  FOCUSING: "Focusing",
} as const;

export const UNSEND_MS = 3 * 60 * 1000;
export const DESK_TOGETHER_MS = 25 * 60 * 1000;
