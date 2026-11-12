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

const MEAL_RELATION_FA: Record<string, string> = {
  FASTING: "ناشتا",
  BEFORE_MEAL: "قبل از غذا",
  WITH_MEAL: "همراه غذا",
  AFTER_MEAL: "بعد از غذا",
  BEDTIME: "قبل از خواب",
};

export function mealRelationLabel(rel?: string | null): string {
  return (rel && MEAL_RELATION_FA[rel]) || "";
}

/** Narrative for «ثبت فعالیت دارو» (a new prescription with its dose schedule). */
export function buildPrescriptionNarrative(params: {
  nameFa: string;
  doctorName?: string | null;
  prescribedAt?: Date | string | null;
  replacedPrevious?: boolean;
  schedules: {
    targetTime?: string | null;
    intervalUnit?: string | null;
    intervalValue?: number | null;
    mealRelation?: string | null;
    rulesJson?: string | null;
  }[];
  notes?: string | null;
}): string {
  const dateStr = formatJalaliDate(params.prescribedAt || new Date());
  const doses = params.schedules.map((s) => {
    let cond = mealRelationLabel(s.mealRelation);
    if (!cond && s.rulesJson) {
      try {
        cond = JSON.parse(s.rulesJson)?.label || "";
      } catch {
        // ignore
      }
    }
    const base = formatIntervalNarrative(s.intervalUnit, s.intervalValue, s.targetTime);
    const withTime = base.includes("ساعت") || !s.targetTime ? base : `${base} ساعت ${toPersianDigits(s.targetTime)}`;
    return cond ? `${withTime} (${cond})` : withTime;
  });
  let text = `نسخه جدید برای داروی ${params.nameFa} در تاریخ ${dateStr}`;
  if (params.doctorName && params.doctorName.trim()) text += ` توسط ${params.doctorName.trim()}`;
  text += ` ثبت شد`;
  if (doses.length > 0) text += `: ${doses.join("، ")}`;
  text += ".";
  if (params.replacedPrevious) text += " نسخه قبلی این دارو جایگزین و غیرفعال شد.";
  if (params.notes && params.notes.trim()) text += ` توضیحات نسخه: ${params.notes.trim()}`;
  return text;
}
