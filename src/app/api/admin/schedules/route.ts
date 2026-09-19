import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { getTehranTodayStart, getTehranTodayEnd, formatRecurrenceText, tehranMoment } from "@/lib/jalali";

// GET /api/admin/schedules
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const todayStart = getTehranTodayStart();
    const todayEnd = getTehranTodayEnd();

    const schedules = await prisma.schedule.findMany({
      include: {
        medication: {
          select: {
            id: true,
            nameFa: true,
            nameEn: true,
            boxNumber: true,
            dosage: true,
            stockCount: true,
          },
        },
        taskLogs: {
          where: {
            completedAt: {
              gte: todayStart,
              lte: todayEnd,
            },
          },
          select: {
            id: true,
            status: true,
            completedAt: true,
          },
        },
      },
      orderBy: [{ isActive: "desc" }, { targetTime: "asc" }],
    });

    const enriched = schedules.map((s) => {
      const isExpired = s.endDate ? new Date(s.endDate).getTime() < todayStart.getTime() : false;
      let status: "ACTIVE" | "INACTIVE" | "EXPIRED" = "ACTIVE";
      if (!s.isActive) status = "INACTIVE";
      else if (isExpired) status = "EXPIRED";

      const recurrenceText = formatRecurrenceText(
        s.intervalUnit,
        s.intervalValue,
        s.targetTime,
        s.endDate
      );

      return {
        id: s.id,
        title: s.title,
        targetTime: s.targetTime,
        category: s.category,
        itemType: s.itemType,
        mealRelation: s.mealRelation,
        startDate: s.startDate,
        intervalUnit: s.intervalUnit || "DAYS",
        intervalValue: s.intervalValue || 1,
        endDate: s.endDate,
        requiresNote: s.requiresNote || false,
        isActive: s.isActive,
        status,
        recurrenceText,
        medication: s.medication,
        completedTodayCount: s.taskLogs.length,
        isCompletedToday: s.taskLogs.some((l) => l.status === "DONE"),
        createdAt: s.createdAt,
      };
    });

    const stats = {
      total: enriched.length,
      active: enriched.filter((s) => s.status === "ACTIVE").length,
      inactive: enriched.filter((s) => s.status === "INACTIVE").length,
      expired: enriched.filter((s) => s.status === "EXPIRED").length,
    };

    return NextResponse.json({ schedules: enriched, stats });
  } catch (error) {
    console.error("GET schedules error:", error);
    return NextResponse.json({ error: "Failed to load schedules" }, { status: 500 });
  }
}

// POST /api/admin/schedules
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      category,
      itemType,
      targetTime,
      startDate,
      intervalUnit = "DAYS",
      intervalValue = 1,
      endDate,
      requiresNote = false,
      mealRelation,
      medicationId,
      rulesJson,
    } = body;

    if (!title || !targetTime || !category) {
      return NextResponse.json(
        { error: "عنوان، دسته‌بندی و ساعت انجام الزامی هستند." },
        { status: 400 }
      );
    }

    // Determine start date
    let parsedStartDate = startDate ? new Date(startDate) : new Date();
    if (isNaN(parsedStartDate.getTime())) {
      parsedStartDate = new Date();
    }

    // Determine end date
    let parsedEndDate: Date | null = null;
    if (endDate) {
      const d = new Date(endDate);
      if (!isNaN(d.getTime())) {
        parsedEndDate = d;
      }
    }

    const schedule = await prisma.schedule.create({
      data: {
        title: title.trim(),
        category,
        itemType: itemType || (category === "medication" ? "medication" : "routine_task"),
        targetTime: targetTime.trim(),
        startDate: parsedStartDate,
        intervalUnit,
        intervalValue: parseInt(String(intervalValue), 10) || 1,
        endDate: parsedEndDate,
        requiresNote: Boolean(requiresNote),
        mealRelation: mealRelation || null,
        medicationId: medicationId || null,
        rulesJson: rulesJson || null,
        isActive: true,
      },
      include: {
        medication: true,
      },
    });

    return NextResponse.json({ success: true, schedule });
  } catch (error) {
    console.error("POST schedule error:", error);
    return NextResponse.json({ error: "Failed to create schedule" }, { status: 500 });
  }
}

// PATCH /api/admin/schedules
export async function PATCH(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: "شناسه تسک الزامی است." }, { status: 400 });
    }

    // If startDate/endDate passed, parse safely
    if ("startDate" in updateData && updateData.startDate) {
      updateData.startDate = new Date(updateData.startDate);
    }
    if ("endDate" in updateData) {
      updateData.endDate = updateData.endDate ? new Date(updateData.endDate) : null;
    }
    if ("intervalValue" in updateData && updateData.intervalValue) {
      updateData.intervalValue = parseInt(String(updateData.intervalValue), 10) || 1;
    }
    if ("requiresNote" in updateData) {
      updateData.requiresNote = Boolean(updateData.requiresNote);
    }

    const updated = await prisma.schedule.update({
      where: { id },
      data: updateData,
      include: { medication: true },
    });

    return NextResponse.json({ success: true, schedule: updated });
  } catch (error) {
    console.error("PATCH schedule error:", error);
    return NextResponse.json({ error: "Failed to update schedule" }, { status: 500 });
  }
}

// DELETE /api/admin/schedules
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "شناسه تسک الزامی است." }, { status: 400 });
    }

    await prisma.schedule.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE schedule error:", error);
    return NextResponse.json({ error: "Failed to delete schedule" }, { status: 500 });
  }
}
