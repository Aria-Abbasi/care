import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

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
            targetTime: true,
            intervalUnit: true,
            intervalValue: true,
            startDate: true,
            endDate: true,
            mealRelation: true,
            requiresNote: true,
          },
        },
      },
      orderBy: [{ isActive: "desc" }, { boxNumber: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ medications });
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
    }

    // 3. Create connected schedule automatically if schedule details provided
    let createdSchedule = null;
    if (schedule && schedule.targetTime) {
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
    const { id, stockDelta, schedule, discontinueMedIds, discontinueReason, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: "شناسه دارو الزامی است" }, { status: 400 });
    }

    // Support quick stock increment/decrement
    if (stockDelta !== undefined) {
      const updated = await prisma.medication.update({
        where: { id },
        data: { stockCount: { increment: Number(stockDelta) } },
      });
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

    // If updating/adding schedule
    if (schedule && schedule.targetTime) {
      const scheduleTitle = `${updated.nameFa}${updated.boxNumber ? ` (جعبه ${updated.boxNumber})` : ""}${updated.dosage ? ` - ${updated.dosage}` : ""}`;
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete medication error:", error);
    return NextResponse.json({ error: "Failed to delete medication" }, { status: 500 });
  }
}
