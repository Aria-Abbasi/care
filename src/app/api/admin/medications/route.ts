import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import {
  buildMedicationCreatedNarrative,
  buildScheduleChangedNarrative,
  buildMedicationStoppedNarrative,
} from "@/lib/medicationHistory";

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
            isActive: true,
          },
          orderBy: { targetTime: "asc" },
        },
      },
      orderBy: [{ isActive: "desc" }, { boxNumber: "asc" }, { createdAt: "desc" }],
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

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      nameFa,
      nameEn,
      dosage,
      unit = "قرص",
      boxNumber,
      instructions,
      doctorName,
      doctorOrderNotes,
      stockCount = 100,
      lowStockThreshold = 15,
      timeConstraints,
      schedule,
      discontinueMedIds,
      discontinueReason,
    } = body;

    if (!nameFa) {
      return NextResponse.json({ error: "نام دارو الزامی است" }, { status: 400 });
    }

    // 1. Create the Medication
    const medication = await prisma.medication.create({
      data: {
        nameFa,
        nameEn: nameEn || null,
        dosage: dosage || null,
        unit,
        boxNumber: boxNumber ? String(boxNumber) : null,
        instructions: instructions || null,
        doctorName: doctorName || null,
        doctorOrderNotes: doctorOrderNotes || null,
        stockCount: Number(stockCount) || 100,
        lowStockThreshold: Number(lowStockThreshold) || 15,
        timeConstraints: timeConstraints || null,
        isActive: true,
      },
    });

    // 2. If discontinuing other medications as ordered by the doctor
    if (Array.isArray(discontinueMedIds) && discontinueMedIds.length > 0) {
      const reasonText = discontinueReason || `به دستور پزشک متوقف و داروی ${nameFa} جایگزین شد`;
      
      const discMeds = await prisma.medication.findMany({
        where: { id: { in: discontinueMedIds } },
      });

      await prisma.medication.updateMany({
        where: { id: { in: discontinueMedIds } },
        data: {
          isActive: false,
          discontinuedAt: new Date(),
          discontinuedReason: reasonText,
          discontinuedBy: doctorName || user.fullName,
          replacedById: medication.id,
        },
      });

      // Also deactivate all their active schedules so nurse timeline stays clean
      await prisma.schedule.updateMany({
        where: {
          medicationId: { in: discontinueMedIds },
          isActive: true,
        },
        data: { isActive: false },
      });

      // Log history entries for discontinued meds
      for (const dm of discMeds) {
        await prisma.medicationHistory.create({
          data: {
            medicationId: dm.id,
            medicationName: dm.nameFa,
            actionType: "STOPPED",
            description: buildMedicationStoppedNarrative({
              nameFa: dm.nameFa,
              reason: reasonText,
            }),
            reason: reasonText,
            doctorName: doctorName || null,
            performedBy: user.fullName || "سرپرست پرونده",
            createdAt: new Date(),
          },
        });
      }
    }

    // 3. Create connected schedule automatically if schedule details provided
    let createdSchedule = null;
    if (Array.isArray(body.schedules) && body.schedules.length > 0) {
      const scheduleTitle = `${nameFa}${boxNumber ? ` (جعبه ${boxNumber})` : ""}${dosage ? ` - ${dosage}` : ""}`;
      for (const s of body.schedules) {
        if (!s.targetTime) continue;
        const cr = await prisma.schedule.create({
          data: {
            itemType: "medication",
            category: "medication",
            title: s.title || scheduleTitle,
            targetTime: s.targetTime.trim(),
            mealRelation: s.mealRelation === "NONE" ? null : (s.mealRelation || null),
            startDate: s.startDate ? new Date(s.startDate) : new Date(),
            endDate: s.endDate ? new Date(s.endDate) : null,
            intervalUnit: s.intervalUnit || "DAYS",
            intervalValue: Number(s.intervalValue) || 1,
            daysOfWeek: s.daysOfWeek || "ALL",
            rulesJson: s.rulesJson || null,
            requiresNote: Boolean(s.requiresNote),
            medicationId: medication.id,
            isActive: true,
          },
        });
        if (!createdSchedule) createdSchedule = cr;
      }
    } else if (schedule && schedule.targetTime) {
      const scheduleTitle = `${nameFa}${boxNumber ? ` (جعبه ${boxNumber})` : ""}${dosage ? ` - ${dosage}` : ""}`;
      createdSchedule = await prisma.schedule.create({
        data: {
          itemType: "medication",
          category: "medication",
          title: scheduleTitle,
          targetTime: schedule.targetTime || "08:00",
          mealRelation: schedule.mealRelation || null,
          startDate: schedule.startDate ? new Date(schedule.startDate) : new Date(),
          endDate: schedule.endDate ? new Date(schedule.endDate) : null,
          intervalUnit: schedule.intervalUnit || "DAYS",
          intervalValue: Number(schedule.intervalValue) || 1,
          requiresNote: Boolean(schedule.requiresNote),
          medicationId: medication.id,
          isActive: true,
        },
      });
    }

    // 4. Log Medication Created History entry
    const createdNarrative = buildMedicationCreatedNarrative({
      nameFa: medication.nameFa,
      startDate: schedule?.startDate,
      intervalUnit: schedule?.intervalUnit,
      intervalValue: schedule?.intervalValue,
      targetTime: schedule?.targetTime,
      notes: medication.doctorOrderNotes || medication.instructions,
    });

    await prisma.medicationHistory.create({
      data: {
        medicationId: medication.id,
        medicationName: medication.nameFa,
        actionType: "CREATED",
        description: createdNarrative,
        doctorName: doctorName || null,
        performedBy: user.fullName || "سرپرست پرونده",
        detailsJson: JSON.stringify({ schedule: createdSchedule }),
        createdAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, medication, schedule: createdSchedule });
  } catch (error) {
    console.error("Create medication error:", error);
    return NextResponse.json({ error: "Failed to create medication" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, stockDelta, schedule, schedules, deactivateUnlistedSchedules, discontinueMedIds, discontinueReason, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: "شناسه دارو الزامی است" }, { status: 400 });
    }

    // Support quick stock increment/decrement and purchase restock logging
    if (stockDelta !== undefined) {
      const deltaNum = Number(stockDelta);
      const updated = await prisma.medication.update({
        where: { id },
        data: { stockCount: { increment: deltaNum } },
      });

      // Log purchase / restock in MedicationHistory if restockDetails provided
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
            medicationName: updated.nameFa,
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

    const updated = await prisma.medication.update({
      where: { id },
      data: {
        nameFa: data.nameFa,
        nameEn: data.nameEn,
        dosage: data.dosage,
        unit: data.unit,
        boxNumber: data.boxNumber ? String(data.boxNumber) : null,
        instructions: data.instructions,
        doctorName: data.doctorName,
        doctorOrderNotes: data.doctorOrderNotes,
        stockCount: data.stockCount !== undefined ? Number(data.stockCount) : undefined,
        lowStockThreshold: data.lowStockThreshold !== undefined ? Number(data.lowStockThreshold) : undefined,
        timeConstraints: data.timeConstraints,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : undefined,
        discontinuedReason: data.discontinuedReason,
        discontinuedBy: data.discontinuedBy,
        discontinuedAt: data.discontinuedAt ? new Date(data.discontinuedAt) : undefined,
      },
    });

    // If medication is deactivated, cascade deactivate all associated schedules!
    if (data.isActive === false) {
      await prisma.schedule.updateMany({
        where: { medicationId: id, isActive: true },
        data: { isActive: false },
      });
    }

    const scheduleTitle = `${updated.nameFa}${updated.boxNumber ? ` (جعبه ${updated.boxNumber})` : ""}${updated.dosage ? ` - ${updated.dosage}` : ""}`;

    // Handle multiple schedules array
    if (Array.isArray(schedules) && updated.isActive) {
      const keptIds: string[] = [];
      for (const s of schedules) {
        if (!s.targetTime) continue;
        if (s.id) {
          const upd = await prisma.schedule.update({
            where: { id: s.id },
            data: {
              title: s.title || scheduleTitle,
              targetTime: s.targetTime.trim(),
              mealRelation: s.mealRelation === "NONE" ? null : (s.mealRelation || null),
              startDate: s.startDate ? new Date(s.startDate) : undefined,
              endDate: s.endDate ? new Date(s.endDate) : null,
              intervalUnit: s.intervalUnit || "DAYS",
              intervalValue: Number(s.intervalValue) || 1,
              daysOfWeek: s.daysOfWeek || "ALL",
              rulesJson: s.rulesJson || null,
              requiresNote: Boolean(s.requiresNote),
              isActive: true,
            },
          });
          keptIds.push(upd.id);
        } else {
          const created = await prisma.schedule.create({
            data: {
              itemType: "medication",
              category: "medication",
              title: s.title || scheduleTitle,
              targetTime: s.targetTime.trim(),
              mealRelation: s.mealRelation === "NONE" ? null : (s.mealRelation || null),
              startDate: s.startDate ? new Date(s.startDate) : new Date(),
              endDate: s.endDate ? new Date(s.endDate) : null,
              intervalUnit: s.intervalUnit || "DAYS",
              intervalValue: Number(s.intervalValue) || 1,
              daysOfWeek: s.daysOfWeek || "ALL",
              rulesJson: s.rulesJson || null,
              requiresNote: Boolean(s.requiresNote),
              medicationId: id,
              isActive: true,
            },
          });
          keptIds.push(created.id);
        }
      }

      if (deactivateUnlistedSchedules) {
        await prisma.schedule.updateMany({
          where: {
            medicationId: id,
            isActive: true,
            id: { notIn: keptIds },
          },
          data: { isActive: false },
        });
      }
    } else if (schedule && schedule.targetTime && updated.isActive) {
      const existingSchedule = await prisma.schedule.findFirst({
        where: { medicationId: id, isActive: true },
      });

      if (existingSchedule) {
        await prisma.schedule.update({
          where: { id: existingSchedule.id },
          data: {
            title: scheduleTitle,
            targetTime: schedule.targetTime,
            mealRelation: schedule.mealRelation || null,
            startDate: schedule.startDate ? new Date(schedule.startDate) : existingSchedule.startDate,
            endDate: schedule.endDate ? new Date(schedule.endDate) : null,
            intervalUnit: schedule.intervalUnit || "DAYS",
            intervalValue: Number(schedule.intervalValue) || 1,
            requiresNote: Boolean(schedule.requiresNote),
          },
        });
      } else {
        await prisma.schedule.create({
          data: {
            itemType: "medication",
            category: "medication",
            title: scheduleTitle,
            targetTime: schedule.targetTime || "08:00",
            mealRelation: schedule.mealRelation || null,
            startDate: schedule.startDate ? new Date(schedule.startDate) : new Date(),
            endDate: schedule.endDate ? new Date(schedule.endDate) : null,
            intervalUnit: schedule.intervalUnit || "DAYS",
            intervalValue: Number(schedule.intervalValue) || 1,
            requiresNote: Boolean(schedule.requiresNote),
            medicationId: id,
            isActive: true,
          },
        });
      }

      // Log SCHEDULE_CHANGED in MedicationHistory
      const changeNarrative = buildScheduleChangedNarrative({
        nameFa: updated.nameFa,
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        intervalUnit: schedule.intervalUnit,
        intervalValue: schedule.intervalValue,
        targetTime: schedule.targetTime,
        notes: updated.doctorOrderNotes || updated.instructions,
      });

      await prisma.medicationHistory.create({
        data: {
          medicationId: updated.id,
          medicationName: updated.nameFa,
          actionType: "SCHEDULE_CHANGED",
          description: changeNarrative,
          doctorName: updated.doctorName || null,
          performedBy: user.fullName || "سرپرست پرونده",
          detailsJson: JSON.stringify({ schedule }),
          createdAt: new Date(),
        },
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

    // Deactivate its schedules
    await prisma.schedule.updateMany({
      where: { medicationId: id, isActive: true },
      data: { isActive: false },
    });

    // Log STOPPED history
    await prisma.medicationHistory.create({
      data: {
        medicationId: id,
        medicationName: med.nameFa,
        actionType: "STOPPED",
        description: buildMedicationStoppedNarrative({
          nameFa: med.nameFa,
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
