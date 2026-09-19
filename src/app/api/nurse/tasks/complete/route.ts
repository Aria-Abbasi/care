import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { scheduleId, taskTitle, status = "DONE", notes } = await request.json();

    if (!taskTitle) {
      return NextResponse.json({ error: "عنوان تسک الزامی است" }, { status: 400 });
    }

    const log = await prisma.taskLog.create({
      data: {
        scheduleId: scheduleId || null,
        taskTitle,
        nurseId: user.id,
        status,
        notes: notes || null,
        completedAt: new Date(),
      },
    });

    // If this task was linked to a medication, decrement stock by 1
    if (scheduleId) {
      const schedule = await prisma.schedule.findUnique({
        where: { id: scheduleId },
        select: { medicationId: true },
      });
      if (schedule?.medicationId) {
        await prisma.medication.update({
          where: { id: schedule.medicationId },
          data: { stockCount: { decrement: 1 } },
        });
      }
    }

    return NextResponse.json({ success: true, log });
  } catch (error) {
    console.error("Task completion error:", error);
    return NextResponse.json({ error: "Failed to complete task" }, { status: 500 });
  }
}
