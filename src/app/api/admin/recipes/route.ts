import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const diets = await prisma.dietRecipe.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });

    const smoothies = await prisma.smoothieRecipe.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ diets, smoothies });
  } catch (error) {
    console.error("Recipes error:", error);
    return NextResponse.json({ error: "Failed to fetch recipes" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type, title, mealType, ingredients, instructions, description } = body;

    if (type === "smoothie") {
      const smoothie = await prisma.smoothieRecipe.create({
        data: {
          title,
          ingredients: ingredients || "",
          instructions: instructions || null,
        },
      });
      return NextResponse.json({ success: true, item: smoothie });
    } else {
      const diet = await prisma.dietRecipe.create({
        data: {
          mealType: mealType || "LUNCH",
          title,
          description: description || null,
          instructions: instructions || null,
        },
      });
      return NextResponse.json({ success: true, item: diet });
    }
  } catch (error) {
    console.error("Create recipe error:", error);
    return NextResponse.json({ error: "Failed to create recipe" }, { status: 500 });
  }
}
