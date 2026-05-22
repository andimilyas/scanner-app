/**
 * SQL Server datetime/datetime2 has no timezone. The mssql driver often exposes
 * wall-clock values as UTC on the Date object (getUTCHours = DB hour).
 * Rebuild as local Date so display matches WIB / server local time.
 */
export function parseSqlServerLocalDateTime(value: unknown): Date | null {
  if (value == null) return null;

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return new Date(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
      value.getUTCHours(),
      value.getUTCMinutes(),
      value.getUTCSeconds(),
      value.getUTCMilliseconds()
    );
  }

  const str = String(value).trim();
  const match =
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?/.exec(str);
  if (match) {
    const d = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6])
    );
    return isNaN(d.getTime()) ? null : d;
  }

  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
}
