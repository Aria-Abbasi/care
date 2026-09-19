import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const category = (formData.get("category") as string) || "general";
    const noteText = (formData.get("noteText") as string) || "";
    const photo = formData.get("photo") as File | null;

    let photoUrl: string | null = null;

    if (photo && photo.size > 0) {
      const bytes = await photo.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const ext = path.extname(photo.name) || ".jpg";
      const filename = `care_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
      const uploadDir = path.join(process.cwd(), "public", "uploads");

      await mkdir(uploadDir, { recursive: true });
      const filePath = path.join(uploadDir, filename);
      await writeFile(filePath, buffer);

      photoUrl = `/uploads/${filename}`;
    }

    const note = await prisma.clinicalNote.create({
      data: {
        nurseId: user.id,
        category,
        noteText: noteText || (photoUrl ? "ثبت تصویر" : ""),
        photoUrl,
        createdAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, note });
  } catch (error) {
    console.error("Clinical note error:", error);
    return NextResponse.json({ error: "Failed to save note" }, { status: 500 });
  }
}
