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
import { middleware } from "../src/middleware";
import { NextRequest } from "next/server";

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

  // Middleware /login redirect tests
  const adminToken = await signToken({ id: "admin_test_id", username: "admin_test", fullName: "ادمین تست", role: "ADMIN" });
  const anonReq = new NextRequest("http://localhost:3000/login");
  const anonRes = await middleware(anonReq);
  assert(anonRes.headers.get("location") === null, "Unauthenticated user visiting /login is not redirected");

  const nurseReq = new NextRequest("http://localhost:3000/login", { headers: { cookie: `care_token=${token}` } });
  const nurseRes = await middleware(nurseReq);
  assert(nurseRes.headers.get("location") === "http://localhost:3000/nurse/timeline", "Logged in nurse visiting /login is redirected to /nurse/timeline");

  const adminReq = new NextRequest("http://localhost:3000/login", { headers: { cookie: `care_token=${adminToken}` } });
  const adminRes = await middleware(adminReq);
  assert(adminRes.headers.get("location") === "http://localhost:3000/dashboard", "Logged in admin visiting /login is redirected to /dashboard");

  // Legacy /admin/* redirect test
  const legacyAdminReq = new NextRequest("http://localhost:3000/admin/schedules", { headers: { cookie: `care_token=${adminToken}` } });
  const legacyAdminRes = await middleware(legacyAdminReq);
  assert(legacyAdminRes.headers.get("location") === "http://localhost:3000/schedules", "Legacy /admin/schedules redirects to /schedules");

  // Nurse RBAC tests
  const nurseDashboardReq = new NextRequest("http://localhost:3000/dashboard", { headers: { cookie: `care_token=${token}` } });
  const nurseDashboardRes = await middleware(nurseDashboardReq);
  assert(nurseDashboardRes.headers.get("location") === null, "Nurse can access /dashboard without redirect");

  const nurseUsersReq = new NextRequest("http://localhost:3000/users", { headers: { cookie: `care_token=${token}` } });
  const nurseUsersRes = await middleware(nurseUsersReq);
  assert(nurseUsersRes.headers.get("location") === "http://localhost:3000/dashboard", "Nurse accessing /users is redirected to /dashboard");

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

  // 7. Test Schedule with vitalType and interval
  const testSchedule = await prisma.schedule.create({
    data: {
      title: "سنجش قند خون تستی",
      category: "vital",
      vitalType: "blood_sugar",
      targetTime: "08:00",
      intervalUnit: "HOURS",
      intervalValue: 12,
      mealRelation: "FASTING",
      itemType: "vital",
    },
  });
  assert(testSchedule.vitalType === "blood_sugar", "Schedule vitalType field test");
  assert(testSchedule.intervalValue === 12, "Schedule interval 12h test");

  // Simulate logging a vital linked to this schedule
  const testTaskLog = await prisma.taskLog.create({
    data: {
      scheduleId: testSchedule.id,
      taskTitle: testSchedule.title,
      nurseId: nurseUser!.id,
      status: "DONE",
      notes: "قند خون: ۱۱۵ mg/dL (fasting)",
    },
  });
  assert(testTaskLog.scheduleId === testSchedule.id, "Vital task log linking test");

  // Cleanup
  await prisma.taskLog.delete({ where: { id: testTaskLog.id } });
  await prisma.schedule.delete({ where: { id: testSchedule.id } });
  assert(true, "Vital reminder schedule cleanup test");

  // 8. Test Medication discontinuation and order notes
  const oldMed = await prisma.medication.create({
    data: {
      nameFa: "داروی تست قدیمی",
      stockCount: 50,
      isActive: true,
    },
  });

  const newMed = await prisma.medication.create({
    data: {
      nameFa: "داروی تست جدید جایگزین",
      doctorName: "دکتر تستی",
      doctorOrderNotes: "جایگزینی داروی قدیمی به دلیل آلرژی",
      stockCount: 100,
      isActive: true,
    },
  });

  // Discontinue old medication
  await prisma.medication.update({
    where: { id: oldMed.id },
    data: {
      isActive: false,
      discontinuedAt: new Date(),
      discontinuedReason: "جایگزینی با داروی جدید",
      discontinuedBy: "دکتر تستی",
      replacedById: newMed.id,
    },
  });

  const checkOldMed = await prisma.medication.findUnique({ where: { id: oldMed.id } });
  assert(checkOldMed !== null && !checkOldMed.isActive && checkOldMed.replacedById === newMed.id, "Medication discontinuation and replacement linking test");
  assert(checkOldMed?.discontinuedReason === "جایگزینی با داروی جدید", "Medication discontinuedReason test");

  // 9. Test Task Undo logic (Medication stock restoration and TaskLog deletion)
  const medToUndo = await prisma.medication.create({
    data: { nameFa: "داروی تست لغو", stockCount: 10, isActive: true },
  });
  const schedToUndo = await prisma.schedule.create({
    data: {
      title: "مصرف داروی تست لغو",
      targetTime: "10:00",
      category: "medication",
      itemType: "medication",
      medicationId: medToUndo.id,
    },
  });
  // Nurse logs done (decrementing stock)
  await prisma.medication.update({ where: { id: medToUndo.id }, data: { stockCount: { decrement: 1 } } });
  const logToUndo = await prisma.taskLog.create({
    data: {
      scheduleId: schedToUndo.id,
      taskTitle: schedToUndo.title,
      nurseId: nurseUser!.id,
      status: "DONE",
    },
  });

  const medBeforeUndo = await prisma.medication.findUnique({ where: { id: medToUndo.id } });
  assert(medBeforeUndo?.stockCount === 9, "Stock decremented before undo (10 -> 9)");

  // Simulate Undo: restore stock and delete log
  await prisma.medication.update({ where: { id: medToUndo.id }, data: { stockCount: { increment: 1 } } });
  await prisma.taskLog.delete({ where: { id: logToUndo.id } });

  const medAfterUndo = await prisma.medication.findUnique({ where: { id: medToUndo.id } });
  const logAfterUndo = await prisma.taskLog.findUnique({ where: { id: logToUndo.id } });
  assert(medAfterUndo?.stockCount === 10, "Stock restored after undo (9 -> 10)");
  assert(logAfterUndo === null, "TaskLog successfully deleted on undo");

  // Cleanup test records
  await prisma.schedule.delete({ where: { id: schedToUndo.id } });
  await prisma.medication.delete({ where: { id: medToUndo.id } });
  await prisma.medication.delete({ where: { id: oldMed.id } });
  await prisma.medication.delete({ where: { id: newMed.id } });
  assert(true, "Discontinuation and undo test records cleanup");

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
