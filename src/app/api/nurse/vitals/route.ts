import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      type,
      valueNum,
      valueText,
      systolic,
      diastolic,
      mealTag,
      bowelGrade,
      laxativeGiven,
      extraData,
    } = body;

    if (!type) {
      return NextResponse.json({ error: "نوع ثبت الزامی است" }, { status: 400 });
    }

    const vital = await prisma.vitalLog.create({
      data: {
        nurseId: user.id,
        recordedAt: new Date(),
        type,
        valueNum: valueNum !== undefined && valueNum !== null ? Number(valueNum) : null,
        valueText: valueText || null,
        systolic: systolic ? Number(systolic) : null,
        diastolic: diastolic ? Number(diastolic) : null,
        mealTag: mealTag || null,
        bowelGrade: bowelGrade || null,
        laxativeGiven: laxativeGiven || null,
        extraData: extraData ? JSON.stringify(extraData) : null,
      },
    });

    return NextResponse.json({ success: true, vital });
  } catch (error) {
    console.error("Vital log error:", error);
    return NextResponse.json({ error: "Failed to log vitals" }, { status: 500 });
  }
}
