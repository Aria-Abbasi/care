import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { taskLogId, scheduleId, notes, valueNum, systolic, diastolic, valueText } = await request.json();

    if (!taskLogId && !scheduleId) {
      return NextResponse.json({ error: "شناسه لاگ یا تسک الزامی است" }, { status: 400 });
    }

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

    // 1. Check if there's a related VitalLog to update
    const logTime = new Date(taskLog.completedAt).getTime();
    const minTime = new Date(logTime - 3 * 60 * 1000);
    const maxTime = new Date(logTime + 3 * 60 * 1000);

    const relatedVital = await prisma.vitalLog.findFirst({
      where: {
        nurseId: taskLog.nurseId,
        recordedAt: { gte: minTime, lte: maxTime },
      },
      orderBy: { recordedAt: "desc" },
    });

    let updatedSummary = notes;

    if (relatedVital) {
      const updateData: any = {};
      if (valueNum !== undefined && valueNum !== null) updateData.valueNum = Number(valueNum);
      if (valueText !== undefined) updateData.valueText = valueText;
      if (systolic !== undefined) updateData.systolic = Number(systolic);
      if (diastolic !== undefined) updateData.diastolic = Number(diastolic);

      await prisma.vitalLog.update({
        where: { id: relatedVital.id },
        data: updateData,
      });

      // Update formatted note summary for task card display
      const finalNum = updateData.valueNum ?? relatedVital.valueNum;
      const finalSys = updateData.systolic ?? relatedVital.systolic;
      const finalDia = updateData.diastolic ?? relatedVital.diastolic;

      if (relatedVital.type === "blood_sugar") {
        updatedSummary = `قند خون: ${finalNum} mg/dL${notes ? ` - ${notes}` : ""}`;
      } else if (relatedVital.type === "blood_pressure") {
        updatedSummary = `فشار خون: ${finalSys}/${finalDia} mmHg${notes ? ` - ${notes}` : ""}`;
      } else if (relatedVital.type === "water_intake") {
        updatedSummary = `مصرف مایعات: ${finalNum} cc${notes ? ` - ${notes}` : ""}`;
      } else if (relatedVital.type === "urine_output") {
        updatedSummary = `تخلیه ادرار: ${finalNum} cc${notes ? ` - ${notes}` : ""}`;
      } else if (relatedVital.type === "dvt_timer") {
        updatedSummary = `مراقبت DVT: ${finalNum} دقیقه بالا بردن پا${notes ? ` - ${notes}` : ""}`;
      }
    }

    // 2. Update taskLog notes
    const updatedLog = await prisma.taskLog.update({
      where: { id: taskLog.id },
      data: {
        notes: updatedSummary !== undefined ? updatedSummary : taskLog.notes,
      },
    });

    // 3. Update any clinical note created alongside
    if (notes) {
      await prisma.clinicalNote.updateMany({
        where: {
          nurseId: taskLog.nurseId,
          createdAt: { gte: minTime, lte: maxTime },
          noteText: { contains: taskLog.taskTitle },
        },
        data: {
          noteText: `گزارش تسک: ${taskLog.taskTitle} - توضیحات: ${notes}`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "گزارش تسک با موفقیت به‌روزرسانی شد",
      log: updatedLog,
    });
  } catch (error) {
    console.error("Task edit error:", error);
    return NextResponse.json({ error: "Failed to edit task log" }, { status: 500 });
  }
}
