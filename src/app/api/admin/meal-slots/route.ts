import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export const DEFAULT_MEAL_SLOTS = [
  { name: "BREAKFAST", labelFa: "ناشتا / صبحانه", defaultTime: "07:00", order: 1 },
  { name: "MORNING_SNACK", labelFa: "میان‌وعده صبح", defaultTime: "10:00", order: 2 },
  { name: "LUNCH", labelFa: "ناهار", defaultTime: "12:30", order: 3 },
  { name: "AFTERNOON_SNACK", labelFa: "میان‌وعده عصر", defaultTime: "16:00", order: 4 },
  { name: "DINNER", labelFa: "شام", defaultTime: "19:00", order: 5 },
  { name: "BEDTIME", labelFa: "قبل خواب", defaultTime: "20:00", order: 6 },
];

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let slots = await prisma.mealTimeSlot.findMany({
      orderBy: { order: "asc" },
    });

    if (slots.length === 0) {
      // Auto-seed default meal slots
      for (const item of DEFAULT_MEAL_SLOTS) {
        await prisma.mealTimeSlot.upsert({
          where: { name: item.name },
          update: {},
          create: {
            name: item.name,
            labelFa: item.labelFa,
            defaultTime: item.defaultTime,
            order: item.order,
            isActive: true,
          },
        });
      }
      slots = await prisma.mealTimeSlot.findMany({
        orderBy: { order: "asc" },
      });
    }

    return NextResponse.json({ slots });
  } catch (error) {
    console.error("Meal slots GET error:", error);
    return NextResponse.json({ error: "Failed to load meal slots" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, labelFa, defaultTime, order, isActive } = body;

    if (!name || !labelFa || !defaultTime) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const slot = await prisma.mealTimeSlot.upsert({
      where: { name },
      update: {
        labelFa,
        defaultTime,
        order: typeof order === "number" ? order : 0,
        isActive: isActive !== undefined ? isActive : true,
      },
      create: {
        name,
        labelFa,
        defaultTime,
        order: typeof order === "number" ? order : 0,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    return NextResponse.json({ slot });
  } catch (error) {
    console.error("Meal slots POST error:", error);
    return NextResponse.json({ error: "Failed to save meal slot" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    // Support bulk update of array of slots
    if (Array.isArray(body.slots)) {
      for (const item of body.slots) {
        if (item.id) {
          await prisma.mealTimeSlot.update({
            where: { id: item.id },
            data: {
              labelFa: item.labelFa,
              defaultTime: item.defaultTime,
              order: typeof item.order === "number" ? item.order : undefined,
              isActive: typeof item.isActive === "boolean" ? item.isActive : undefined,
            },
          });
        }
      }
      const updated = await prisma.mealTimeSlot.findMany({ orderBy: { order: "asc" } });
      return NextResponse.json({ slots: updated });
    }

    // Single update
    if (body.id) {
      const slot = await prisma.mealTimeSlot.update({
        where: { id: body.id },
        data: {
          labelFa: body.labelFa,
          defaultTime: body.defaultTime,
          order: typeof body.order === "number" ? body.order : undefined,
          isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
        },
      });
      return NextResponse.json({ slot });
    }

    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  } catch (error) {
    console.error("Meal slots PUT error:", error);
    return NextResponse.json({ error: "Failed to update meal slot" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Slot ID is required" }, { status: 400 });
    }

    await prisma.mealTimeSlot.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Meal slots DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete meal slot" }, { status: 500 });
  }
}
