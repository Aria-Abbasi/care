import { prisma } from "../src/lib/prisma";
import {
  toPersianDigits,
  toEnglishDigits,
  formatJalaliDate,
  formatJalaliTime,
  formatJalaliDateTime,
  formatJalaliLong
} from "../src/lib/jalali";
import { hashPassword, comparePassword, signToken, verifyToken } from "../src/lib/auth";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

async function runTests() {
  console.log("\n================ 1. JALALI & LOCALIZATION TESTS ================");
  assert(toPersianDigits(12345) === "۱۲۳۴۵", "Persian digits conversion: 12345 -> ۱۲۳۴۵");
  assert(toEnglishDigits("۱۲۳۴۵") === "12345", "English digits conversion: ۱۲۳۴۵ -> 12345");
  
  const testDate = new Date("2024-04-22T10:30:00Z");
  const jDate = formatJalaliDate(testDate);
  assert(jDate.includes("۱۴۰۳/۰۲/۰۳"), `Jalali date formatting: expected 1403/02/03, got ${jDate}`);

  const jLong = formatJalaliLong(testDate);
  assert(jLong.includes("دوشنبه") && jLong.includes("اردیبهشت"), `Jalali long formatting: ${jLong}`);

  console.log("\n================ 2. AUTH & JWT TESTS ================");
  const pass = "Test@Pass123";
  const hash = await hashPassword(pass);
  assert(await comparePassword(pass, hash), "Password hashing and comparison");
  assert(!(await comparePassword("WrongPass", hash)), "Rejection of wrong password");

  const testUser = {
    id: "test_user_id_123",
    username: "nurse_test",
    fullName: "پرستار تست",
    role: "NURSE" as const,
  };
  const token = await signToken(testUser);
  assert(typeof token === "string" && token.length > 20, "JWT token generation");

  const verified = await verifyToken(token);
  assert(verified !== null && verified.username === "nurse_test" && verified.role === "NURSE", "JWT token verification");

  console.log("\n================ 3. DATABASE INTEGRITY TESTS ================");
  const adminUser = await prisma.user.findUnique({ where: { username: "admin" } });
  assert(adminUser !== null && adminUser.role === "ADMIN", "Admin user exists in DB with role ADMIN");

  const nurseUser = await prisma.user.findUnique({ where: { username: "nurse" } });
  assert(nurseUser !== null && nurseUser.role === "NURSE", "Nurse user exists in DB with role NURSE");

  const medCount = await prisma.medication.count();
  assert(medCount >= 50, `Medications count in DB: ${medCount} >= 50`);

  const box1Med = await prisma.medication.findFirst({ where: { boxNumber: "1" } });
  assert(box1Med !== null && box1Med.nameFa.includes("Levothyroxine"), "Box 1 medication is Levothyroxine");

  const scheduleCount = await prisma.schedule.count();
  assert(scheduleCount >= 15, `Schedule count in DB: ${scheduleCount} >= 15`);

  const vitalsCount = await prisma.vitalLog.count();
  assert(vitalsCount >= 9000, `VitalLog count in DB: ${vitalsCount} >= 9000`);

  const taskLogsCount = await prisma.taskLog.count();
  assert(taskLogsCount >= 1500, `TaskLog count in DB: ${taskLogsCount} >= 1500`);

  const clinicalNotesCount = await prisma.clinicalNote.count();
  assert(clinicalNotesCount >= 2000, `ClinicalNote count in DB: ${clinicalNotesCount} >= 2000`);

  console.log("\n================ 4. NURSE & ADMIN BUSINESS LOGIC TESTS ================");
  // Test completing a task
  const sampleSchedule = await prisma.schedule.findFirst();
  if (sampleSchedule && nurseUser) {
    const taskLog = await prisma.taskLog.create({
      data: {
        scheduleId: sampleSchedule.id,
        taskTitle: sampleSchedule.title,
        nurseId: nurseUser.id,
        status: "DONE",
      },
    });
    assert(taskLog.status === "DONE", "Nurse 1-tap task completion log creation");

    // Clean up test log
    await prisma.taskLog.delete({ where: { id: taskLog.id } });
  }

  // Test logging vitals
  if (nurseUser) {
    const testVital = await prisma.vitalLog.create({
      data: {
        nurseId: nurseUser.id,
        type: "urine_output",
        valueNum: 350,
        valueText: "تست تخلیه ۳۵۰ سی سی",
      },
    });
    assert(testVital.valueNum === 350, "Nurse vitals entry creation (350cc urine output)");

    // Clean up
    await prisma.vitalLog.delete({ where: { id: testVital.id } });
  }

  // 5. Check Schedule requiresNote column support
  const scheduleWithRequiresNote = await prisma.schedule.findFirst({
    select: { id: true, title: true, requiresNote: true },
  });
  assert(scheduleWithRequiresNote !== null && typeof scheduleWithRequiresNote.requiresNote === "boolean", "Schedule table supports requiresNote field");

  // 6. Test AdhocSuggestion model
  const testSuggestion = await prisma.adhocSuggestion.create({
    data: {
      title: "تست بررسی عملکرد پانسمان",
      category: "مراقبتی",
    },
  });
  assert(testSuggestion.title === "تست بررسی عملکرد پانسمان", "AdhocSuggestion creation test");

  const foundSuggestion = await prisma.adhocSuggestion.findUnique({
    where: { id: testSuggestion.id },
  });
  assert(foundSuggestion?.title === "تست بررسی عملکرد پانسمان", "AdhocSuggestion read test");

  await prisma.adhocSuggestion.delete({
    where: { id: testSuggestion.id },
  });
  assert(true, "AdhocSuggestion deletion test");

  console.log("\n================ TEST SUMMARY ================");
  console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests()
  .catch((err) => {
    console.error("Test runner error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
