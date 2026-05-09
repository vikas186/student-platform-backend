/** Shared CSV line splitting (quoted commas supported). */
export const parseSimpleCsvLines = (content: string): string[][] =>
  content
    .trim()
    .split(/\r?\n/)
    .filter(line => line.trim().length > 0)
    .map(line => {
      const out: string[] = [];
      let cur = '';
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          inQ = !inQ;
          continue;
        }
        if (!inQ && c === ',') {
          out.push(cur.trim());
          cur = '';
        } else {
          cur += c;
        }
      }
      out.push(cur.trim());
      return out;
    });
