import moment from "jalali-moment";

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

// Format date to Jalali YYYY/MM/DD
export function formatJalaliDate(date: string | Date | null | undefined): string {
  if (!date) return "";
  try {
    const m = moment(date).locale("fa");
    return toPersianDigits(m.format("jYYYY/jMM/jDD"));
  } catch {
    return "";
  }
}

// Format time HH:mm
export function formatJalaliTime(date: string | Date | null | undefined): string {
  if (!date) return "";
  try {
    const m = moment(date).locale("fa");
    return toPersianDigits(m.format("HH:mm"));
  } catch {
    return "";
  }
}

// Format datetime YYYY/MM/DD HH:mm
export function formatJalaliDateTime(date: string | Date | null | undefined): string {
  if (!date) return "";
  try {
    const m = moment(date).locale("fa");
    return toPersianDigits(m.format("jYYYY/jMM/jDD HH:mm"));
  } catch {
    return "";
  }
}

// Format date with day name: شنبه ۲۱ مهر
export function formatJalaliLong(date: string | Date | null | undefined): string {
  if (!date) return "";
  try {
    const m = moment(date).locale("fa");
    return toPersianDigits(m.format("dddd jD jMMMM jYYYY"));
  } catch {
    return "";
  }
}

// Relative time from now (e.g., ۳ ساعت پیش)
export function formatJalaliFromNow(date: string | Date | null | undefined): string {
  if (!date) return "";
  try {
    const m = moment(date).locale("fa");
    return toPersianDigits(m.fromNow());
  } catch {
    return "";
  }
}

// Persian day name
export function getPersianDayName(date: string | Date | null | undefined): string {
  if (!date) return "";
  try {
    const m = moment(date).locale("fa");
    return m.format("dddd");
  } catch {
    return "";
  }
}

// Today in Jalali YYYY/MM/DD
export function getJalaliToday(): string {
  return moment().locale("fa").format("jYYYY/jMM/jDD");
}

// Convert Jalali string (YYYY/MM/DD) to JS Date (start of day UTC or local)
export function jalaliToDate(jalaliStr: string): Date {
  const eng = toEnglishDigits(jalaliStr).replace(/-/g, "/");
  return moment(eng, "jYYYY/jMM/jDD").toDate();
}
