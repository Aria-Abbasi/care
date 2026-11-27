import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

const DEFAULT_SUGGESTIONS = [
  { title: "تعویض پانسمان موضعی", category: "مراقبتی" },
  { title: "پانسمان زخم پای راست (DVT)", category: "مراقبتی" },
  { title: "ماساژ اضافه و چرب کردن ساق پا", category: "مراقبتی" },
  { title: "تعویض ملحفه و نظافت فوری", category: "بهداشتی" },
  { title: "کنترل دمای بدن و تب", category: "پایش علائم" },
  { title: "تنظیم سرم / آنژیوکت", category: "مراقبتی" },
  { title: "کمک به جابجایی / ویلچر", category: "مراقبتی" },
  { title: "دادن میان‌وعده اضافه", category: "بهداشتی" },
];

const VALID_VITAL_TYPES = new Set([
  "blood_sugar",
  "blood_pressure",
  "urine_output",
  "water_intake",
  "dvt_care",
  "bowel_movement",
  "laxative",
  "clinical_photo",
]);

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function hasField(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

async function validateMedication(medicationId: string | null) {
  if (!medicationId) return true;
  const medication = await prisma.medication.findUnique({
    where: { id: medicationId },
    select: { id: true },
  });
  return Boolean(medication);
}

// GET /api/admin/adhoc-suggestions[?active=1]
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let suggestions = await prisma.adhocSuggestion.findMany({
      orderBy: { createdAt: "asc" },
    });

    // Seed default suggestions only when the table is completely empty.
    if (suggestions.length === 0) {
      for (const def of DEFAULT_SUGGESTIONS) {
        await prisma.adhocSuggestion.upsert({
          where: { title: def.title },
          update: {},
          create: def,
        });
      }
      suggestions = await prisma.adhocSuggestion.findMany({
        orderBy: { createdAt: "asc" },
      });
    }

    const { searchParams } = new URL(request.url);
    if (searchParams.get("active") === "1") {
      suggestions = suggestions.filter((item) => item.isActive);
    }

    // Attach medication display data without introducing a hard FK so legacy rows stay intact.
    const medicationIds = Array.from(
      new Set(suggestions.map((item) => item.medicationId).filter((id): id is string => Boolean(id)))
    );
    const medications = medicationIds.length
      ? await prisma.medication.findMany({
          where: { id: { in: medicationIds } },
          select: { id: true, nameFa: true, boxNumber: true, dosage: true },
        })
      : [];
    const medicationMap = new Map(medications.map((med) => [med.id, med]));

    return NextResponse.json({
      suggestions: suggestions.map((item) => ({
        ...item,
        medication: item.medicationId ? medicationMap.get(item.medicationId) || null : null,
      })),
    });
  } catch (error) {
    console.error("GET adhoc suggestions error:", error);
    return NextResponse.json({ error: "Failed to load suggestions" }, { status: 500 });
  }
}

// POST /api/admin/adhoc-suggestions
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const title = cleanString(body.title);

    if (!title) {
      return NextResponse.json({ error: "عنوان فعالیت پرتکرار الزامی است." }, { status: 400 });
    }

    const existing = await prisma.adhocSuggestion.findUnique({
      where: { title },
    });

    if (existing) {
      return NextResponse.json(
        { error: "این عنوان از قبل در لیست فعالیت‌های پرتکرار وجود دارد." },
        { status: 400 }
      );
    }

    const category = cleanString(body.category) || "مراقبتی";
    const vitalType = category === "vital" ? cleanString(body.vitalType) : null;
    const medicationId = category === "medication" ? cleanString(body.medicationId) : null;
    const mealRelation = category === "meal" ? cleanString(body.mealRelation) : null;

    if (vitalType && !VALID_VITAL_TYPES.has(vitalType)) {
      return NextResponse.json({ error: "نوع پارامتر بالینی معتبر نیست." }, { status: 400 });
    }

    if (category === "medication" && !(await validateMedication(medicationId))) {
      return NextResponse.json({ error: "داروی انتخاب‌شده معتبر نیست." }, { status: 400 });
    }

    const suggestion = await prisma.adhocSuggestion.create({
      data: {
        title,
        category,
        vitalType,
        medicationId,
        mealRelation,
        requiresNote: Boolean(body.requiresNote),
        defaultNotes: cleanString(body.defaultNotes),
        isActive: hasField(body, "isActive") ? Boolean(body.isActive) : true,
      },
    });

    return NextResponse.json({ success: true, suggestion });
  } catch (error) {
    console.error("POST adhoc suggestion error:", error);
    return NextResponse.json({ error: "Failed to create suggestion" }, { status: 500 });
  }
}

// PUT /api/admin/adhoc-suggestions (full update / active toggle)
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const { searchParams } = new URL(request.url);
    const id = cleanString(body.id) || searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "شناسه فعالیت پرتکرار الزامی است." }, { status: 400 });
    }

    const existing = await prisma.adhocSuggestion.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "فعالیت پرتکرار یافت نشد." }, { status: 404 });
    }

    const mergedTitle = hasField(body, "title")
      ? cleanString(body.title) || ""
      : existing.title;
    if (!mergedTitle) {
      return NextResponse.json({ error: "عنوان فعالیت پرتکرار الزامی است." }, { status: 400 });
    }

    const category = hasField(body, "category")
      ? cleanString(body.category) || existing.category || "مراقبتی"
      : existing.category || "مراقبتی";
    const vitalType = category === "vital"
      ? hasField(body, "vitalType")
        ? cleanString(body.vitalType)
        : existing.vitalType
      : null;
    const medicationId = category === "medication"
      ? hasField(body, "medicationId")
        ? cleanString(body.medicationId)
        : existing.medicationId
      : null;
    const mealRelation = category === "meal"
      ? hasField(body, "mealRelation")
        ? cleanString(body.mealRelation)
        : existing.mealRelation
      : null;

    if (vitalType && !VALID_VITAL_TYPES.has(vitalType)) {
      return NextResponse.json({ error: "نوع پارامتر بالینی معتبر نیست." }, { status: 400 });
    }

    const shouldValidateMedication =
      category === "medication" &&
      (hasField(body, "category") || hasField(body, "medicationId"));
    if (shouldValidateMedication && !(await validateMedication(medicationId))) {
      return NextResponse.json({ error: "داروی انتخاب‌شده معتبر نیست." }, { status: 400 });
    }

    const duplicate = await prisma.adhocSuggestion.findFirst({
      where: { title: mergedTitle, NOT: { id } },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "این عنوان از قبل در لیست فعالیت‌های پرتکرار وجود دارد." },
        { status: 400 }
      );
    }

    const suggestion = await prisma.adhocSuggestion.update({
      where: { id },
      data: {
        title: mergedTitle,
        category,
        vitalType,
        medicationId,
        mealRelation,
        requiresNote: hasField(body, "requiresNote")
          ? Boolean(body.requiresNote)
          : existing.requiresNote,
        defaultNotes: hasField(body, "defaultNotes")
          ? cleanString(body.defaultNotes)
          : existing.defaultNotes,
        isActive: hasField(body, "isActive") ? Boolean(body.isActive) : existing.isActive,
      },
    });

    return NextResponse.json({ success: true, suggestion });
  } catch (error) {
    console.error("PUT adhoc suggestion error:", error);
    return NextResponse.json({ error: "Failed to update suggestion" }, { status: 500 });
  }
}

// DELETE /api/admin/adhoc-suggestions
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "شناسه فعالیت پرتکرار الزامی است." }, { status: 400 });
    }

    await prisma.adhocSuggestion.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE adhoc suggestion error:", error);
    return NextResponse.json({ error: "Failed to delete suggestion" }, { status: 500 });
  }
}
