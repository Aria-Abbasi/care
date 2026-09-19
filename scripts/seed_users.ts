import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/auth";

async function main() {
  console.log("Seeding / updating user accounts...");

  const adminPass = await hashPassword("Admin@Care2026!");
  const nurse1Pass = await hashPassword("Nurse1@Care2026!");
  const nurse2Pass = await hashPassword("Nurse2@Care2026!");
  const nursePass = await hashPassword("Nurse@Care2026!");

  // 1. Admin
  await prisma.user.upsert({
    where: { username: "admin" },
    update: { passwordHash: adminPass, fullName: "سرپرست خانواده", role: "ADMIN", isActive: true },
    create: { username: "admin", passwordHash: adminPass, fullName: "سرپرست خانواده", role: "ADMIN", isActive: true },
  });

  // 2. Nurse 1
  await prisma.user.upsert({
    where: { username: "nurse1" },
    update: { passwordHash: nurse1Pass, fullName: "پرستار ۱ (شیفت روز)", role: "NURSE", isActive: true },
    create: { username: "nurse1", passwordHash: nurse1Pass, fullName: "پرستار ۱ (شیفت روز)", role: "NURSE", isActive: true },
  });

  // 3. Nurse 2
  await prisma.user.upsert({
    where: { username: "nurse2" },
    update: { passwordHash: nurse2Pass, fullName: "پرستار ۲ (شیفت شب)", role: "NURSE", isActive: true },
    create: { username: "nurse2", passwordHash: nurse2Pass, fullName: "پرستار ۲ (شیفت شب)", role: "NURSE", isActive: true },
  });

  // 4. Default Nurse alias
  await prisma.user.upsert({
    where: { username: "nurse" },
    update: { passwordHash: nursePass, fullName: "پرستار یزدانی", role: "NURSE", isActive: true },
    create: { username: "nurse", passwordHash: nursePass, fullName: "پرستار یزدانی", role: "NURSE", isActive: true },
  });

  const allUsers = await prisma.user.findMany({ select: { username: true, fullName: true, role: true } });
  console.log("Users in DB successfully configured:");
  console.table(allUsers);
}

main().catch(console.error).finally(() => prisma.$disconnect());
