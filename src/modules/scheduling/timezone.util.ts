/** Calendar date as YYYY-MM-DD in an IANA timezone. */
export const formatDateInZone = (instant: Date, timeZone: string): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    instant,
  );

/** Day of week 0=Sun … 6=Sat for a calendar date in `timeZone`. */
export const getDayOfWeekInZone = (dateStr: string, timeZone: string): number => {
  const noon = localTimeInZoneToUtc(dateStr, '12:00', timeZone);
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(noon);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[weekday] ?? 0;
};

/** Convert a local wall-clock time in `timeZone` to a UTC `Date`. */
export const localTimeInZoneToUtc = (dateStr: string, timeStr: string, timeZone: string): Date => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, min] = timeStr.split(':').map(Number);
  let t = Date.UTC(y, m - 1, d, h, min, 0);

  for (let i = 0; i < 4; i++) {
    const probe = new Date(t);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(probe);

    const g = (type: string) => parseInt(parts.find(p => p.type === type)?.value ?? '0', 10);
    const zy = g('year');
    const zm = g('month');
    const zd = g('day');
    const zh = g('hour');
    const zmin = g('minute');
    const targetMs = Date.UTC(y, m - 1, d, h, min, 0);
    const actualMs = Date.UTC(zy, zm - 1, zd, zh, zmin, 0);
    const delta = targetMs - actualMs;
    if (delta === 0) break;
    t += delta;
  }

  return new Date(t);
};

/** Advance a YYYY-MM-DD calendar date by one day in `timeZone`. */
export const nextCalendarDateInZone = (dateStr: string, timeZone: string): string => {
  const utc = localTimeInZoneToUtc(dateStr, '12:00', timeZone);
  utc.setUTCDate(utc.getUTCDate() + 1);
  return formatDateInZone(utc, timeZone);
};
