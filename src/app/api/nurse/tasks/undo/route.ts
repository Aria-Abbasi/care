import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { taskLogId, scheduleId } = await request.json();

    if (!taskLogId && !scheduleId) {
      return NextResponse.json({ error: "شناسه لاگ یا تسک الزامی است" }, { status: 400 });
    }

    // Find the task log to undo
    let taskLog = null;
    if (taskLogId) {
      taskLog = await prisma.taskLog.findUnique({
        where: { id: taskLogId },
        include: { schedule: true },
      });
    } else if (scheduleId) {
      const cleanScheduleId = String(scheduleId).split("_")[0];
      taskLog = await prisma.taskLog.findFirst({
        where: { scheduleId: cleanScheduleId },
        orderBy: { completedAt: "desc" },
        include: { schedule: true },
      });
    }

    if (!taskLog) {
      return NextResponse.json({ error: "لاگ مورد نظر یافت نشد" }, { status: 404 });
    }

    // 1. If it was linked to a medication, restore 1 unit back to stock
    if (taskLog.schedule?.medicationId) {
      await prisma.medication.update({
        where: { id: taskLog.schedule.medicationId },
        data: { stockCount: { increment: 1 } },
      });
    }

    const logTime = new Date(taskLog.completedAt).getTime();
    const minTime = new Date(logTime - 15 * 60 * 1000);
    const maxTime = new Date(logTime + 15 * 60 * 1000);

    // 2. Check if a VitalLog was linked to this taskLog
    let relatedVital = await prisma.vitalLog.findFirst({
      where: {
        extraData: { contains: taskLog.id },
      },
    });

    if (!relatedVital) {
      let detectedVitalType: string | null = taskLog.schedule?.vitalType || null;
      const taskTitle = taskLog.taskTitle || "";
      if (!detectedVitalType) {
        if (taskTitle.includes("قند خون") || taskTitle.includes("blood_sugar")) detectedVitalType = "blood_sugar";
        else if (taskTitle.includes("فشار خون") || taskTitle.includes("blood_pressure")) detectedVitalType = "blood_pressure";
        else if (taskTitle.includes("مصرف مایعات") || taskTitle.includes("آب") || taskTitle.includes("water_intake")) detectedVitalType = "water_intake";
        else if (taskTitle.includes("تخلیه ادرار") || taskTitle.includes("ادرار") || taskTitle.includes("urine_output")) detectedVitalType = "urine_output";
        else if (taskTitle.includes("DVT") || taskTitle.includes("بالا بردن پا") || taskTitle.includes("dvt_timer")) detectedVitalType = "dvt_timer";
      }

      if (detectedVitalType) {
        relatedVital = await prisma.vitalLog.findFirst({
          where: {
            nurseId: taskLog.nurseId,
            type: detectedVitalType,
            recordedAt: { gte: minTime, lte: maxTime },
          },
          orderBy: { recordedAt: "desc" },
        });
      }
    }

    if (relatedVital) {
      await prisma.vitalLog.delete({
        where: { id: relatedVital.id },
      });
    }

    // 3. Delete any clinical note created specifically for this task completion
    await prisma.clinicalNote.deleteMany({
      where: {
        nurseId: taskLog.nurseId,
        createdAt: { gte: minTime, lte: maxTime },
        noteText: { contains: taskLog.taskTitle },
      },
    });

    // 4. Delete the task log itself
    await prisma.taskLog.delete({
      where: { id: taskLog.id },
    });

    return NextResponse.json({
      success: true,
      message: "تسک با موفقیت لغو شد و به وضعیت در انتظار بازگشت",
    });
  } catch (error) {
    console.error("Task undo error:", error);
    return NextResponse.json({ error: "Failed to undo task" }, { status: 500 });
  }
}
