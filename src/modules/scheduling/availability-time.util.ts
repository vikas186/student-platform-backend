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
