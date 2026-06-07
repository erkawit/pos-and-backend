/**
 * Thai Buddhist Calendar Conversions & Date Formatting Helpers
 */

/**
 * Convert Gregorian year to Buddhist year
 */
export function toBuddhistYear(gregorianYear: number): number {
  return gregorianYear + 543;
}

/**
 * Convert Buddhist year to Gregorian year
 */
export function toGregorianYear(buddhistYear: number): number {
  return buddhistYear - 543;
}

/**
 * Format string YYYY-MM-DD into "D MMM พ.ศ. XXXX"
 */
export function formatThaiBuddhistDate(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDate();
    const months = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];
    const monthStr = months[d.getMonth()];
    const buddhistYear = d.getFullYear() + 543;
    return `${day} ${monthStr} พ.ศ. ${buddhistYear}`;
  } catch (e) {
    return dateStr;
  }
}

/**
 * Helper to get current Thai year-month-day
 */
export function getCurrentThaiFormatted(): { year: number; month: number; day: number } {
  const d = new Date();
  return {
    year: d.getFullYear() + 543,
    month: d.getMonth() + 1,
    day: d.getDate()
  };
}
