import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { buildMedicationStoppedNarrative } from "@/lib/medicationHistory";
import { formatMedName, nextMedicationCode } from "@/lib/medicationCode";

/**
 * Medication master data («ثبت داروی جدید»).
 *
 * This route only introduces / edits a medication in the system and handles purchases (stockDelta).
 * Prescriptions and dose schedules («ثبت فعالیت دارو») live in ./activity/route.ts.
 */

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const medications = await prisma.medication.findMany({
      include: {
        schedules: {
          where: { isActive: true },
          select: {
            id: true,
            title: true,
            targetTime: true,
            category: true,
            itemType: true,
            intervalUnit: true,
            intervalValue: true,
            startDate: true,
            endDate: true,
            mealRelation: true,
            requiresNote: true,
            daysOfWeek: true,
            rulesJson: true,
            prescriptionId: true,
            isActive: true,
          },
          orderBy: { targetTime: "asc" },
        },
        prescriptions: {
          orderBy: { prescribedAt: "desc" },
          select: {
            id: true,
            doctorName: true,
            prescribedAt: true,
            notes: true,
            isActive: true,
            endedAt: true,
            endedReason: true,
            createdBy: true,
          },
        },
      },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    });

    // Sort by numeric code (stored as text) so کد ۲ comes before کد ۱۰
    medications.sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      const na = parseInt(a.boxNumber || "", 10);
      const nb = parseInt(b.boxNumber || "", 10);
      if (isNaN(na) && isNaN(nb)) return 0;
      if (isNaN(na)) return 1;
      if (isNaN(nb)) return -1;
      return na - nb;
    });

    const history = await prisma.medicationHistory.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ medications, history });
  } catch (error) {
    console.error("Medications error:", error);
    return NextResponse.json({ error: "Failed to fetch medications" }, { status: 500 });
  }
}

/** ثبت داروی جدید — introduce a medication. Code is auto-generated; stock always starts at 0. */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { nameFa, nameEn, dosage, unit = "قرص", lowStockThreshold = 15, timeConstraints, doctorOrderNotes } = body;

    if (!nameFa || !String(nameFa).trim()) {
      return NextResponse.json({ error: "نام دارو الزامی است" }, { status: 400 });
    }

    const code = await nextMedicationCode(prisma);
    const medication = await prisma.medication.create({
      data: {
        nameFa: String(nameFa).trim(),
        nameEn: nameEn || null,
        dosage: dosage || null,
        unit,
        boxNumber: code,
        stockCount: 0, // stock is only added through the purchase form
        lowStockThreshold: Number(lowStockThreshold) || 15,
        timeConstraints: timeConstraints ? String(timeConstraints).trim() : null, // تداخل دارویی
        doctorOrderNotes: doctorOrderNotes ? String(doctorOrderNotes).trim() : null, // توضیحات اختصاصی دارو
        isActive: true,
      },
    });

    const displayName = formatMedName(medication);
    await prisma.medicationHistory.create({
      data: {
        medicationId: medication.id,
        medicationName: displayName,
        actionType: "CREATED",
        description: `داروی ${displayName} به سیستم معرفی شد.`,
        performedBy: user.fullName || "سرپرست پرونده",
        createdAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, medication });
  } catch (error) {
    console.error("Create medication error:", error);
    return NextResponse.json({ error: "Failed to create medication" }, { status: 500 });
  }
}

/**
 * Edit medication master data, or register a purchase when `stockDelta` is provided.
 * The medication code is never changed here.
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, stockDelta, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: "شناسه دارو الزامی است" }, { status: 400 });
    }

    // Purchase / restock (فرم خرید دارو)
    if (stockDelta !== undefined) {
      const deltaNum = Number(stockDelta);
      const updated = await prisma.medication.update({
        where: { id },
        data: { stockCount: { increment: deltaNum } },
      });

      const details = body.restockDetails;
      if (details) {
        const descParts = [`خرید و شارژ موجودی دارو به میزان ${deltaNum} عدد`];
        if (details.doctorName) descParts.push(`پزشک: ${details.doctorName}`);
        if (details.pharmacy) descParts.push(`داروخانه: ${details.pharmacy}`);
        if (details.date) descParts.push(`تاریخ: ${details.date}`);
        if (details.notes) descParts.push(`یادداشت: ${details.notes}`);

        await prisma.medicationHistory.create({
          data: {
            medicationId: updated.id,
            medicationName: formatMedName(updated),
            actionType: "RESTOCKED",
            description: descParts.join(" - "),
            doctorName: details.doctorName ? String(details.doctorName).trim() : null,
            performedBy: user.fullName || "سرپرست پرونده",
            detailsJson: JSON.stringify(details),
            createdAt: new Date(),
          },
        });
      }

      return NextResponse.json({ success: true, medication: updated });
    }

    const existing = await prisma.medication.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "دارو یافت نشد" }, { status: 404 });
    }

    // Legacy rows without a code get one the first time they are edited
    const code = existing.boxNumber?.trim() ? undefined : await nextMedicationCode(prisma);

    const updated = await prisma.medication.update({
      where: { id },
      data: {
        nameFa: data.nameFa !== undefined ? String(data.nameFa).trim() : undefined,
        nameEn: data.nameEn,
        dosage: data.dosage,
        unit: data.unit,
        boxNumber: code,
        lowStockThreshold: data.lowStockThreshold !== undefined ? Number(data.lowStockThreshold) : undefined,
        timeConstraints: data.timeConstraints !== undefined ? data.timeConstraints || null : undefined,
        doctorOrderNotes: data.doctorOrderNotes !== undefined ? data.doctorOrderNotes || null : undefined,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : undefined,
        discontinuedReason: data.discontinuedReason,
        discontinuedBy: data.discontinuedBy,
        discontinuedAt: data.discontinuedAt ? new Date(data.discontinuedAt) : undefined,
      },
    });

    // If medication is deactivated, cascade deactivate all associated schedules and prescriptions
    if (data.isActive === false) {
      await prisma.schedule.updateMany({
        where: { medicationId: id, isActive: true },
        data: { isActive: false },
      });
      await prisma.prescription.updateMany({
        where: { medicationId: id, isActive: true },
        data: { isActive: false, endedAt: new Date(), endedReason: data.discontinuedReason || "توقف دارو" },
      });
    }

    // Keep the code-first title of auto-titled schedules in sync when the name changes
    if (updated.nameFa !== existing.nameFa || code) {
      const oldTitle = formatMedName(existing);
      const newTitle = formatMedName(updated);
      await prisma.schedule.updateMany({
        where: { medicationId: id, title: { in: [oldTitle, existing.nameFa] } },
        data: { title: newTitle },
      });
    }

    return NextResponse.json({ success: true, medication: updated });
  } catch (error) {
    console.error("Update medication error:", error);
    return NextResponse.json({ error: "Failed to update medication" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const reason = searchParams.get("reason") || "توقف دارو توسط سرپرست";

    if (!id) {
      return NextResponse.json({ error: "شناسه دارو الزامی است" }, { status: 400 });
    }

    const med = await prisma.medication.findUnique({ where: { id } });
    if (!med) {
      return NextResponse.json({ error: "دارو یافت نشد" }, { status: 404 });
    }

    await prisma.medication.update({
      where: { id },
      data: {
        isActive: false,
        discontinuedAt: new Date(),
        discontinuedReason: reason,
        discontinuedBy: user.fullName,
      },
    });

    // Deactivate its schedules and prescriptions
    await prisma.schedule.updateMany({
      where: { medicationId: id, isActive: true },
      data: { isActive: false },
    });
    await prisma.prescription.updateMany({
      where: { medicationId: id, isActive: true },
      data: { isActive: false, endedAt: new Date(), endedReason: reason },
    });

    const displayName = formatMedName(med);
    await prisma.medicationHistory.create({
      data: {
        medicationId: id,
        medicationName: displayName,
        actionType: "STOPPED",
        description: buildMedicationStoppedNarrative({
          nameFa: displayName,
          reason,
        }),
        reason,
        doctorName: med.doctorName,
        performedBy: user.fullName || "سرپرست پرونده",
        createdAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete medication error:", error);
    return NextResponse.json({ error: "Failed to delete medication" }, { status: 500 });
  }
}
