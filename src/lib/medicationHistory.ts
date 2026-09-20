import { toPersianDigits, formatJalaliDate } from "./jalali";

export function formatIntervalNarrative(
  intervalUnit?: string | null,
  intervalValue?: number | null,
  targetTime?: string | null
): string {
  const unit = intervalUnit || "DAYS";
  const val = Number(intervalValue) || 1;

  if (unit === "HOURS") {
    return `هر ${toPersianDigits(val)} ساعت`;
  } else if (unit === "DAYS") {
    if (val === 1) {
      return targetTime ? `روزانه ساعت ${toPersianDigits(targetTime)}` : "روزانه";
    }
    return `هر ${toPersianDigits(val)} روز یک‌بار`;
  } else if (unit === "WEEKS") {
    if (val === 1) {
      return "هفتگی";
    }
    return `هر ${toPersianDigits(val)} هفته یک‌بار`;
  } else if (unit === "ONCE") {
    return targetTime ? `یک‌باره ساعت ${toPersianDigits(targetTime)}` : "یک‌باره";
  }

  return `هر ${toPersianDigits(val)} روز`;
}

export function buildMedicationCreatedNarrative(params: {
  nameFa: string;
  startDate?: Date | string | null;
  intervalUnit?: string | null;
  intervalValue?: number | null;
  targetTime?: string | null;
  notes?: string | null;
}): string {
  const startStr = formatJalaliDate(params.startDate || new Date());
  const intervalStr = formatIntervalNarrative(
    params.intervalUnit,
    params.intervalValue,
    params.targetTime
  );
  let text = `داروی ${params.nameFa} از شروع ${startStr} و ${intervalStr} اضافه شد.`;
  if (params.notes && params.notes.trim()) {
    text += ` توضیحات: ${params.notes.trim()}`;
  }
  return text;
}

export function buildScheduleChangedNarrative(params: {
  nameFa: string;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  intervalUnit?: string | null;
  intervalValue?: number | null;
  targetTime?: string | null;
  notes?: string | null;
}): string {
  const startStr = formatJalaliDate(params.startDate || new Date());
  const intervalStr = formatIntervalNarrative(
    params.intervalUnit,
    params.intervalValue,
    params.targetTime
  );
  const endStr = params.endDate ? ` تا ${formatJalaliDate(params.endDate)}` : "";
  let text = `داروی ${params.nameFa} زمان‌بندیش به شروع از ${startStr} و ${intervalStr}${endStr} تغییر پیدا کرد.`;
  if (params.notes && params.notes.trim()) {
    text += ` توضیحات: ${params.notes.trim()}`;
  }
  return text;
}

export function buildMedicationStoppedNarrative(params: {
  nameFa: string;
  reason?: string | null;
  notes?: string | null;
}): string {
  const reasonText = (params.reason && params.reason.trim()) || "دستور پزشک معالج";
  let text = `داروی ${params.nameFa} به علت ${reasonText} مصرف‌اش متوقف شد.`;
  if (params.notes && params.notes.trim()) {
    text += ` توضیحات: ${params.notes.trim()}`;
  }
  return text;
}
