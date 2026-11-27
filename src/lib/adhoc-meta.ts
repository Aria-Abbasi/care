import {
  Activity,
  Pill,
  Utensils,
  Clock,
  Heart,
  Stethoscope,
  Droplets,
  Timer,
  Smile,
  Camera,
} from "lucide-react";

export type AdhocCategoryId = "vital" | "medication" | "meal" | "routine";

export type AdhocModalType =
  | "GLUCOSE"
  | "BP"
  | "URINE"
  | "WATER"
  | "DVT"
  | "BOWEL"
  | "NOTE";

export interface AdhocSuggestionItem {
  id: string;
  title: string;
  category?: string | null;
  vitalType?: string | null;
  medicationId?: string | null;
  mealRelation?: string | null;
  requiresNote?: boolean;
  defaultNotes?: string | null;
  isActive?: boolean;
  createdAt?: string;
}

export interface AdhocCategoryDefinition {
  id: AdhocCategoryId;
  label: string;
  shortLabel: string;
  icon: any;
  badgeClass: string;
  softClass: string;
  activeClass: string;
}

export const ADHOC_CATEGORIES: AdhocCategoryDefinition[] = [
  {
    id: "vital",
    label: "سنجش بالینی",
    shortLabel: "سنجش",
    icon: Activity,
    badgeClass:
      "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900",
    softClass:
      "bg-rose-50 text-rose-950 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800",
    activeClass: "bg-rose-600 text-white",
  },
  {
    id: "medication",
    label: "دارویی",
    shortLabel: "دارو",
    icon: Pill,
    badgeClass:
      "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900",
    softClass:
      "bg-emerald-50 text-emerald-950 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800",
    activeClass: "bg-emerald-600 text-white",
  },
  {
    id: "meal",
    label: "غذا و میان‌وعده",
    shortLabel: "غذا",
    icon: Utensils,
    badgeClass:
      "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900",
    softClass:
      "bg-amber-50 text-amber-950 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800",
    activeClass: "bg-amber-600 text-white",
  },
  {
    id: "routine",
    label: "عمومی / سایر",
    shortLabel: "عمومی",
    icon: Clock,
    badgeClass:
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    softClass:
      "bg-slate-50 text-slate-800 border-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700",
    activeClass: "bg-slate-900 text-white",
  },
];

const LEGACY_CATEGORY_MAP: Record<string, AdhocCategoryId> = {
  "مراقبتی": "routine",
  "بهداشتی": "routine",
  "دارویی": "medication",
  "پایش علائم": "vital",
  "فوریت": "routine",
};

export function normalizeAdhocCategory(category?: string | null): AdhocCategoryId {
  if (!category) return "routine";
  if (
    category === "vital" ||
    category === "medication" ||
    category === "meal" ||
    category === "routine"
  ) {
    return category;
  }
  return LEGACY_CATEGORY_MAP[category] || "routine";
}

export function getAdhocCategory(category?: string | null): AdhocCategoryDefinition {
  const id = normalizeAdhocCategory(category);
  return ADHOC_CATEGORIES.find((item) => item.id === id) || ADHOC_CATEGORIES[3];
}

export function getAdhocCategoryLabel(category?: string | null): string {
  return getAdhocCategory(category).label;
}

export interface AdhocVitalTypeDefinition {
  id: string;
  title: string;
  desc: string;
  defaultTitle: string;
  icon: any;
  color: string;
  iconBg: string;
  modal: AdhocModalType;
  bowelMode?: "BOWEL" | "LAXATIVE";
}

export const ADHOC_VITAL_TYPES: AdhocVitalTypeDefinition[] = [
  {
    id: "blood_sugar",
    title: "قند خون",
    desc: "ناشتا / ۲ ساعته / کیپد",
    defaultTitle: "سنجش قند خون",
    icon: Heart,
    color:
      "border-rose-300 bg-rose-50 text-rose-950 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800",
    iconBg: "bg-rose-500 text-white",
    modal: "GLUCOSE",
  },
  {
    id: "blood_pressure",
    title: "فشار خون",
    desc: "سیستول / دیاستول",
    defaultTitle: "سنجش فشار خون",
    icon: Stethoscope,
    color:
      "border-purple-300 bg-purple-50 text-purple-950 dark:bg-purple-950/40 dark:text-purple-200 dark:border-purple-800",
    iconBg: "bg-purple-500 text-white",
    modal: "BP",
  },
  {
    id: "urine_output",
    title: "تخلیه ادرار سوند",
    desc: "سی سی + رنگ",
    defaultTitle: "تخلیه ادرار سوند",
    icon: Activity,
    color:
      "border-amber-300 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800",
    iconBg: "bg-amber-500 text-white",
    modal: "URINE",
  },
  {
    id: "water_intake",
    title: "آب و مایعات",
    desc: "استکان / لیوان / ماگ",
    defaultTitle: "ثبت مصرف آب و مایعات",
    icon: Droplets,
    color:
      "border-sky-300 bg-sky-50 text-sky-950 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-800",
    iconBg: "bg-sky-500 text-white",
    modal: "WATER",
  },
  {
    id: "dvt_care",
    title: "DVT پای راست",
    desc: "تایمر بالا بردن پا",
    defaultTitle: "مراقبت DVT و بالا بردن پای راست",
    icon: Timer,
    color:
      "border-teal-300 bg-teal-50 text-teal-950 dark:bg-teal-950/40 dark:text-teal-200 dark:border-teal-800",
    iconBg: "bg-teal-600 text-white",
    modal: "DVT",
  },
  {
    id: "bowel_movement",
    title: "کارکرد روده (اجابت مزاج)",
    desc: "+۱ / +۲ / نرمال",
    defaultTitle: "کنترل اجابت مزاج / کارکرد روده",
    icon: Smile,
    color:
      "border-orange-300 bg-orange-50 text-orange-950 dark:bg-orange-950/40 dark:text-orange-200 dark:border-orange-800",
    iconBg: "bg-orange-500 text-white",
    modal: "BOWEL",
    bowelMode: "BOWEL",
  },
  {
    id: "laxative",
    title: "مصرف داروی ملین",
    desc: "شیاف / شربت / پیدرولاکس",
    defaultTitle: "تجویز و مصرف داروی ملین",
    icon: Pill,
    color:
      "border-purple-300 bg-purple-50 text-purple-950 dark:bg-purple-950/40 dark:text-purple-200 dark:border-purple-800",
    iconBg: "bg-purple-600 text-white",
    modal: "BOWEL",
    bowelMode: "LAXATIVE",
  },
  {
    id: "clinical_photo",
    title: "ثبت تصویر یا یادداشت بالینی",
    desc: "عکس پا/DVT، قرمزی پوست، رویداد",
    defaultTitle: "بررسی بالینی و ثبت عکس",
    icon: Camera,
    color:
      "border-emerald-300 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800",
    iconBg: "bg-emerald-600 text-white",
    modal: "NOTE",
  },
];

export function getAdhocVitalType(
  vitalType?: string | null
): AdhocVitalTypeDefinition | undefined {
  if (!vitalType) return undefined;
  return ADHOC_VITAL_TYPES.find((item) => item.id === vitalType);
}

export function getAdhocRowIcon(suggestion: AdhocSuggestionItem) {
  const vital = getAdhocVitalType(suggestion.vitalType);
  if (vital) return vital.icon;
  return getAdhocCategory(suggestion.category).icon;
}
