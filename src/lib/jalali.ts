import moment from "jalali-moment";
import "moment-timezone";

export const TEHRAN_TZ = "Asia/Tehran";

// Helper returning a moment instance forced to Asia/Tehran timezone
export function tehranMoment(date?: string | Date | number | null): any {
  return (date ? (moment as any)(date) : (moment as any)()).tz(TEHRAN_TZ);
}

// Persian digits converter
export function toPersianDigits(n: number | string | null | undefined): string {
  if (n === null || n === undefined) return "";
  const str = String(n);
  const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return str.replace(/[0-9]/g, (w) => persianDigits[+w]);
}

// Convert Persian/Arabic digits to English digits
export function toEnglishDigits(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
}

// Format date to Jalali YYYY/MM/DD in Tehran timezone
export function formatJalaliDate(date: string | Date | number | null | undefined): string {
  if (!date) return "";
  try {
    const m = tehranMoment(date).locale("fa");
    return toPersianDigits(m.format("jYYYY/jMM/jDD"));
  } catch {
    return "";
  }
}

// Format time HH:mm in Tehran timezone
export function formatJalaliTime(date: string | Date | number | null | undefined): string {
  if (!date) return "";
  try {
    const m = tehranMoment(date).locale("fa");
    return toPersianDigits(m.format("HH:mm"));
  } catch {
    return "";
  }
}

// Format datetime YYYY/MM/DD HH:mm in Tehran timezone
export function formatJalaliDateTime(date: string | Date | number | null | undefined): string {
  if (!date) return "";
  try {
    const m = tehranMoment(date).locale("fa");
    return toPersianDigits(m.format("jYYYY/jMM/jDD HH:mm"));
  } catch {
    return "";
  }
}

// Format date with day name in Tehran timezone: شنبه ۲۸ شهریور ۱۴۰۵
export function formatJalaliLong(date: string | Date | number | null | undefined): string {
  if (!date) return "";
  try {
    const m = tehranMoment(date).locale("fa");
    return toPersianDigits(m.format("dddd jD jMMMM jYYYY"));
  } catch {
    return "";
  }
}

// Relative time from now (e.g., ۳ ساعت پیش) in Tehran
export function formatJalaliFromNow(date: string | Date | number | null | undefined): string {
  if (!date) return "";
  try {
    const m = tehranMoment(date).locale("fa");
    return toPersianDigits(m.fromNow());
  } catch {
    return "";
  }
}

// Persian day name in Tehran timezone
export function getPersianDayName(date: string | Date | number | null | undefined): string {
  if (!date) return "";
  try {
    const m = tehranMoment(date).locale("fa");
    return m.format("dddd");
  } catch {
    return "";
  }
}

// Today in Jalali YYYY/MM/DD in Tehran timezone
export function getJalaliToday(): string {
  return tehranMoment().locale("fa").format("jYYYY/jMM/jDD");
}

// Get current Date in Tehran timezone
export function getTehranNow(): Date {
  return new Date();
}

// Get start of today in Tehran timezone (as UTC Date object)
export function getTehranTodayStart(): Date {
  const m = tehranMoment().startOf("day");
  return m.toDate();
}

// Get end of today in Tehran timezone (as UTC Date object)
export function getTehranTodayEnd(): Date {
  const m = tehranMoment().endOf("day");
  return m.toDate();
}

// Get Tehran current time in "HH:mm" format (e.g. "20:48")
export function getTehranCurrentTime(): string {
  return tehranMoment().format("HH:mm");
}

// Human-readable Persian recurrence description
export function formatRecurrenceText(
  intervalUnit?: string | null,
  intervalValue?: number | null,
  targetTime?: string | null,
  endDate?: string | Date | null
): string {
  const time = targetTime ? toPersianDigits(targetTime) : "";
  let text = "";

  if (intervalUnit === "ONCE") {
    text = `یک‌باره (ساعت ${time})`;
  } else if (intervalUnit === "HOURS") {
    const val = intervalValue || 8;
    text = `هر ${toPersianDigits(val)} ساعت یک‌بار (شروع از ${time})`;
  } else if (intervalUnit === "DAYS") {
    const val = intervalValue || 1;
    if (val === 1) {
      text = `هر روز ساعت ${time}`;
    } else {
      text = `هر ${toPersianDigits(val)} روز یک‌بار ساعت ${time}`;
    }
  } else if (intervalUnit === "WEEKS") {
    const val = intervalValue || 1;
    if (val === 1) {
      text = `هفتگی ساعت ${time}`;
    } else {
      text = `هر ${toPersianDigits(val)} هفته یک‌بار ساعت ${time}`;
    }
  } else {
    text = `روزانه ساعت ${time}`;
  }

  if (endDate) {
    const endStr = formatJalaliDate(endDate);
    text += ` تا ${endStr}`;
  } else {
    text += " (دائمی)";
  }

  return text;
}

