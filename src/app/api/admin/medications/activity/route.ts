import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { buildPrescriptionNarrative, buildMedicationStoppedNarrative } from "@/lib/medicationHistory";
import { formatMedName } from "@/lib/medicationCode";

/**
 * ثبت فعالیت دارو (ثبت نسخه و زمان‌بندی دارو)
 *
 * This route creates a Prescription for a Medication and its associated active Schedules.
 * It also supports:
 * - Ending/replacing previous prescriptions of this medication
 * - Discontinuing other medications (drug replacement)
 */

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const medicationId = searchParams.get("medicationId");

    const where: any = {};
    if (medicationId) {
      where.medicationId = medicationId;
    }

    const prescriptions = await prisma.prescription.findMany({
      where,
      include: {
        medication: {
          select: {
            id: true,
            nameFa: true,
            boxNumber: true,
            dosage: true,
          },
        },
        schedules: {
          select: {
            id: true,
            title: true,
            targetTime: true,
            mealRelation: true,
            intervalUnit: true,
            intervalValue: true,
            daysOfWeek: true,
            rulesJson: true,
            requiresNote: true,
            isActive: true,
          },
        },
      },
      orderBy: { prescribedAt: "desc" },
    });

    return NextResponse.json({ prescriptions });
  } catch (error) {
    console.error("Prescriptions fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch prescriptions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      medicationId,
      doctorName,
      prescribedAt,
      notes, // توضیحات نسخه / نکات بالینی
      schedules = [],
      replacePreviousPrescription = false,
      discontinueMedIds = [],
      discontinueReason,
    } = body;

    if (!medicationId) {
      return NextResponse.json({ error: "شناسه دارو الزامی است" }, { status: 400 });
    }

    const medication = await prisma.medication.findUnique({
      where: { id: medicationId },
    });

    if (!medication) {
      return NextResponse.json({ error: "دارو یافت نشد" }, { status: 404 });
    }

    const rxDate = prescribedAt ? new Date(prescribedAt) : new Date();
    const docName = doctorName ? String(doctorName).trim() : null;
    const notesText = notes ? String(notes).trim() : null;

    // 1. If replacing previous prescription of THIS medication:
    // Deactivate previous active prescriptions and their active schedules
    if (replacePreviousPrescription) {
      const activeRxList = await prisma.prescription.findMany({
        where: { medicationId, isActive: true },
        select: { id: true },
      });

      if (activeRxList.length > 0) {
        const rxIds = activeRxList.map((r) => r.id);
        await prisma.prescription.updateMany({
          where: { id: { in: rxIds } },
          data: {
            isActive: false,
            endedAt: rxDate,
            endedReason: "جایگزینی با نسخه جدید",
          },
        });

        await prisma.schedule.updateMany({
          where: {
            prescriptionId: { in: rxIds },
            isActive: true,
          },
          data: { isActive: false },
        });
      }

      // Also deactivate any legacy active schedules for this med that weren't assigned a prescription
      await prisma.schedule.updateMany({
        where: {
          medicationId,
          isActive: true,
          prescriptionId: null,
        },
        data: { isActive: false },
      });
    }

    // 2. Create the new Prescription record
    const prescription = await prisma.prescription.create({
      data: {
        medicationId,
        doctorName: docName,
        prescribedAt: rxDate,
        notes: notesText,
        isActive: true,
        createdBy: user.fullName || "سرپرست پرونده",
      },
    });

    // 3. Create active schedules for this prescription
    const createdSchedules: any[] = [];
    const baseScheduleTitle = formatMedName(medication, { withDosage: true });

    if (Array.isArray(schedules) && schedules.length > 0) {
      for (const s of schedules) {
        if (!s.targetTime) continue;
        const cr = await prisma.schedule.create({
          data: {
            itemType: "medication",
            category: "medication",
            title: s.title ? String(s.title).trim() : baseScheduleTitle,
            targetTime: String(s.targetTime).trim(),
            mealRelation: s.mealRelation === "NONE" ? null : (s.mealRelation || null),
            startDate: s.startDate ? new Date(s.startDate) : rxDate,
            endDate: s.endDate ? new Date(s.endDate) : null,
            intervalUnit: s.intervalUnit || "DAYS",
            intervalValue: Number(s.intervalValue) || 1,
            daysOfWeek: s.daysOfWeek || "ALL",
            rulesJson: s.rulesJson || null,
            requiresNote: Boolean(s.requiresNote),
            medicationId: medication.id,
            prescriptionId: prescription.id,
            isActive: true,
          },
        });
        createdSchedules.push(cr);
      }
    }

    // 4. Handle discontinuation of other medications if requested
    if (Array.isArray(discontinueMedIds) && discontinueMedIds.length > 0) {
      const reasonText =
        discontinueReason || `به دستور پزشک متوقف و داروی ${formatMedName(medication)} جایگزین شد`;

      const discMeds = await prisma.medication.findMany({
        where: { id: { in: discontinueMedIds } },
      });

      await prisma.medication.updateMany({
        where: { id: { in: discontinueMedIds } },
        data: {
          isActive: false,
          discontinuedAt: rxDate,
          discontinuedReason: reasonText,
          discontinuedBy: docName || user.fullName,
          replacedById: medication.id,
        },
      });

      await prisma.prescription.updateMany({
        where: {
          medicationId: { in: discontinueMedIds },
          isActive: true,
        },
        data: {
          isActive: false,
          endedAt: rxDate,
          endedReason: reasonText,
        },
      });

      await prisma.schedule.updateMany({
        where: {
          medicationId: { in: discontinueMedIds },
          isActive: true,
        },
        data: { isActive: false },
      });

      for (const dm of discMeds) {
        await prisma.medicationHistory.create({
          data: {
            medicationId: dm.id,
            medicationName: formatMedName(dm),
            actionType: "STOPPED",
            description: buildMedicationStoppedNarrative({
              nameFa: formatMedName(dm),
              reason: reasonText,
            }),
            reason: reasonText,
            doctorName: docName || null,
            performedBy: user.fullName || "سرپرست پرونده",
            createdAt: rxDate,
          },
        });
      }
    }

    // 5. Create narrative in MedicationHistory for the new prescription
    const narrative = buildPrescriptionNarrative({
      nameFa: formatMedName(medication),
      doctorName: docName,
      prescribedAt: rxDate,
      replacedPrevious: Boolean(replacePreviousPrescription),
      schedules: createdSchedules,
      notes: notesText,
    });

    await prisma.medicationHistory.create({
      data: {
        medicationId: medication.id,
        medicationName: formatMedName(medication),
        actionType: "SCHEDULE_CHANGED",
        description: narrative,
        doctorName: docName || null,
        performedBy: user.fullName || "سرپرست پرونده",
        detailsJson: JSON.stringify({
          prescriptionId: prescription.id,
          schedulesCount: createdSchedules.length,
        }),
        createdAt: rxDate,
      },
    });

    return NextResponse.json({
      success: true,
      prescription,
      schedules: createdSchedules,
    });
  } catch (error) {
    console.error("Prescription create error:", error);
    return NextResponse.json({ error: "Failed to record medication activity" }, { status: 500 });
  }
}
