import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const timer = await prisma.activeTimer.findFirst({
      where: { timerType: "dvt_care" },
      orderBy: { createdAt: "desc" },
    });

    if (!timer) {
      return NextResponse.json({ active: false, timer: null });
    }

    const elapsedSeconds = Math.max(
      0,
      Math.floor((Date.now() - new Date(timer.startTime).getTime()) / 1000)
    );

    return NextResponse.json({
      active: true,
      timer: {
        id: timer.id,
        timerType: timer.timerType,
        startTime: timer.startTime.toISOString(),
        scheduleId: timer.scheduleId,
        taskTitle: timer.taskTitle,
        nurseId: timer.nurseId,
        elapsedSeconds,
      },
    });
  } catch (error) {
    console.error("GET dvt-timer error:", error);
    return NextResponse.json({ error: "Failed to fetch dvt timer" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, scheduleId, taskTitle } = body;

    if (action === "START") {
      // Clear any prior active DVT timers first
      await prisma.activeTimer.deleteMany({
        where: { timerType: "dvt_care" },
      });

      const cleanScheduleId = scheduleId ? String(scheduleId).split("_")[0] : null;
      const finalTitle = taskTitle || "مراقبت DVT پای راست";

      const newTimer = await prisma.activeTimer.create({
        data: {
          timerType: "dvt_care",
          startTime: new Date(),
          scheduleId: cleanScheduleId,
          taskTitle: finalTitle,
          nurseId: user.id,
        },
      });

      return NextResponse.json({
        success: true,
        active: true,
        timer: {
          id: newTimer.id,
          timerType: newTimer.timerType,
          startTime: newTimer.startTime.toISOString(),
          scheduleId: newTimer.scheduleId,
          taskTitle: newTimer.taskTitle,
          nurseId: newTimer.nurseId,
          elapsedSeconds: 0,
        },
      });
    }

    if (action === "STOP") {
      const timer = await prisma.activeTimer.findFirst({
        where: { timerType: "dvt_care" },
        orderBy: { createdAt: "desc" },
      });

      if (!timer) {
        return NextResponse.json(
          { error: "هیچ تایمر فعالی برای توقف یافت نشد" },
          { status: 400 }
        );
      }

      const elapsedSeconds = Math.max(
        1,
        Math.floor((Date.now() - new Date(timer.startTime).getTime()) / 1000)
      );

      const minutes = Math.floor(elapsedSeconds / 60);
      const seconds = elapsedSeconds % 60;
      const durationStr = minutes > 0 ? `${minutes} دقیقه` : `${seconds} ثانیه`;
      const noteSummary = `مراقبت DVT: ${durationStr} بالا بردن پا`;

      const vital = await prisma.vitalLog.create({
        data: {
          nurseId: user.id,
          recordedAt: new Date(),
          type: "dvt_timer",
          valueNum: elapsedSeconds,
          valueText: durationStr,
        },
      });

      const taskLog = await prisma.taskLog.create({
        data: {
          scheduleId: timer.scheduleId,
          taskTitle: timer.taskTitle || "مراقبت DVT پای راست",
          nurseId: user.id,
          status: "DONE",
          notes: noteSummary,
          completedAt: new Date(),
        },
      });

      await prisma.activeTimer.deleteMany({
        where: { timerType: "dvt_care" },
      });

      return NextResponse.json({
        success: true,
        active: false,
        elapsedSeconds,
        durationStr,
        vital,
        taskLog,
      });
    }

    if (action === "CANCEL") {
      await prisma.activeTimer.deleteMany({
        where: { timerType: "dvt_care" },
      });

      return NextResponse.json({ success: true, active: false });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("POST dvt-timer error:", error);
    return NextResponse.json({ error: "Failed to process dvt timer action" }, { status: 500 });
  }
}
