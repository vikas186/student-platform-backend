/** Normalize DB / Sequelize TIME values to HH:mm for API and HTML time inputs. */
export const formatAvailabilityTime = (value: unknown): string => {
  if (value == null) return '';

  if (typeof value === 'string') {
    const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
    if (match) {
      return `${match[1].padStart(2, '0')}:${match[2]}`;
    }
    return value.trim().slice(0, 5);
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const h = value.getUTCHours();
    const m = value.getUTCMinutes();
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  const asString = String(value).trim();
  const match = asString.match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    return `${match[1].padStart(2, '0')}:${match[2]}`;
  }
  return asString.slice(0, 5);
};

export const timeToMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const isValidAvailabilityWindow = (startTime: string, endTime: string): boolean =>
  timeToMinutes(endTime) > timeToMinutes(startTime);

export const intervalsOverlap = (
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean =>
  timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(bStart) < timeToMinutes(aEnd);

/** Returns dayOfWeek if any same-day windows overlap; otherwise null. */
export const findOverlappingDayOfWeek = (
  windows: { dayOfWeek: number; startTime: string; endTime: string }[],
): number | null => {
  const byDay = new Map<number, typeof windows>();
  for (const w of windows) {
    const list = byDay.get(w.dayOfWeek) ?? [];
    list.push(w);
    byDay.set(w.dayOfWeek, list);
  }
  for (const [day, list] of byDay) {
    const sorted = [...list].sort(
      (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime),
    );
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i]!;
        const b = sorted[j]!;
        if (intervalsOverlap(a.startTime, a.endTime, b.startTime, b.endTime)) {
          return day;
        }
      }
    }
  }
  return null;
};
