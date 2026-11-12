/**
 * Medication code (کد دارو) helpers.
 *
 * Every medication gets an auto-generated sequential numeric code that is written on the box at home.
 * Caregivers may not be able to read medication names reliably, so the code is always shown BEFORE
 * the medication name, everywhere the name appears (cards, nurse timeline, schedules, reports...).
 *
 * The code is stored in the legacy `Medication.boxNumber` column.
 */

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

function toFa(s: string): string {
  return s.replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

function toEn(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

type MedLike = { nameFa: string; boxNumber?: string | null; dosage?: string | null };

/** "۱۲" for a medication code (Persian digits), or "" if none. */
export function formatMedCode(code?: string | null): string {
  const c = (code || "").trim();
  return c ? toFa(toEn(c)) : "";
}

/** Code-first display name, e.g. "کد ۱۲ - متفورمین ۵۰۰". */
export function formatMedName(med: MedLike, opts: { withDosage?: boolean } = {}): string {
  const code = formatMedCode(med.boxNumber);
  let name = med.nameFa.trim();
  if (opts.withDosage && med.dosage?.trim()) name += ` - ${med.dosage.trim()}`;
  return code ? `کد ${code} - ${name}` : name;
}

/** Next sequential code = highest numeric code + 1 (accepts Persian/English digits in existing data). */
export async function nextMedicationCode(db: {
  medication: { findMany: (args: any) => Promise<{ boxNumber: string | null }[]> };
}): Promise<string> {
  const rows = await db.medication.findMany({
    where: { boxNumber: { not: null } },
    select: { boxNumber: true },
  });
  let max = 0;
  for (const r of rows) {
    const n = parseInt(toEn(r.boxNumber || "").trim(), 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return String(max + 1);
}
