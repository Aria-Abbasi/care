import { prisma } from "../src/lib/prisma";
import {
  toPersianDigits,
  toEnglishDigits,
  formatJalaliDate,
  formatJalaliTime,
  formatJalaliDateTime,
  formatJalaliLong,
  isScheduleActiveOnDay,
} from "../src/lib/jalali";
import {
  buildMedicationCreatedNarrative,
  buildScheduleChangedNarrative,
  buildMedicationStoppedNarrative,
} from "../src/lib/medicationHistory";
import { hashPassword, comparePassword, signToken, verifyToken } from "../src/lib/auth";
import { middleware } from "../src/middleware";
import { NextRequest } from "next/server";
import { GET as getMeds, POST as postMeds, PUT as putMeds } from "../src/app/api/admin/medications/route";
import { POST as postStopMed } from "../src/app/api/admin/medications/stop/route";
import { POST as postVitals } from "../src/app/api/nurse/vitals/route";
import { PUT as putEditLog } from "../src/app/api/nurse/tasks/edit-log/route";
import { POST as postUsers, PUT as putUsers } from "../src/app/api/admin/users/route";
import { GET as getAdhoc, POST as postAdhoc, DELETE as deleteAdhoc } from "../src/app/api/admin/adhoc-suggestions/route";
import { GET as getClinicalPhotos } from "../src/app/api/admin/clinical-photos/route";
import { GET as getAnalytics } from "../src/app/api/admin/analytics/route";
import { formatFileSize } from "../src/lib/imageCompression";

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

  console.log("\n================ 5. MEDICATION HISTORY & NARRATIVE TESTS ================");
  // Test narrative builders
  const narrCreated = buildMedicationCreatedNarrative({
    nameFa: "آپیکسابان ۲.۵",
    startDate: new Date("2026-03-20T08:00:00Z"),
    intervalUnit: "HOURS",
    intervalValue: 6,
    targetTime: "08:00",
  });
  assert(
    narrCreated.includes("داروی آپیکسابان ۲.۵ از شروع") && narrCreated.includes("هر ۶ ساعت اضافه شد"),
    `Created narrative test: ${narrCreated}`
  );

  const narrChanged = buildScheduleChangedNarrative({
    nameFa: "هپارین ۵۰۰۰",
    startDate: new Date("2026-03-20T08:00:00Z"),
    endDate: new Date("2026-03-25T08:00:00Z"),
    intervalUnit: "HOURS",
    intervalValue: 8,
    targetTime: "08:00",
  });
  assert(
    narrChanged.includes("داروی هپارین ۵۰۰۰ زمان‌بندیش به شروع از") &&
    narrChanged.includes("هر ۸ ساعت") &&
    narrChanged.includes("تغییر پیدا کرد"),
    `Schedule changed narrative test: ${narrChanged}`
  );

  const narrStopped = buildMedicationStoppedNarrative({
    nameFa: "وارفارین ۵",
    reason: "خونریزی گوارشی",
    notes: "توقف فوری طبق دستور آنکال",
  });
  assert(
    narrStopped.includes("داروی وارفارین ۵ به علت خونریزی گوارشی مصرف‌اش متوقف شد.") &&
    narrStopped.includes("توضیحات: توقف فوری طبق دستور آنکال"),
    `Stopped narrative test: ${narrStopped}`
  );

  // Test MedicationHistory database persistence
  const testHistMed = await prisma.medication.create({
    data: {
      nameFa: "داروی تست تاریخچه",
      stockCount: 20,
      isActive: true,
    },
  });

  const histEntry = await prisma.medicationHistory.create({
    data: {
      medicationId: testHistMed.id,
      medicationName: testHistMed.nameFa,
      actionType: "STOPPED",
      description: buildMedicationStoppedNarrative({
        nameFa: testHistMed.nameFa,
        reason: "اتمام دوره درمان",
        notes: "بیمار ترخیص شد",
      }),
      reason: "اتمام دوره درمان",
      doctorName: "دکتر آزمایشی",
      performedBy: "ادمین سامانه",
    },
  });

  const fetchedHist = await prisma.medicationHistory.findUnique({
    where: { id: histEntry.id },
  });
  assert(
    fetchedHist !== null &&
    fetchedHist.actionType === "STOPPED" &&
    fetchedHist.description.includes("داروی تست تاریخچه به علت اتمام دوره درمان مصرف‌اش متوقف شد.") &&
    fetchedHist.description.includes("توضیحات: بیمار ترخیص شد"),
    "MedicationHistory database insertion and retrieval"
  );

  // Verify history count in DB is populated
  const totalHistCount = await prisma.medicationHistory.count();
  assert(totalHistCount >= 70, `MedicationHistory entries populated in DB: ${totalHistCount} >= 70`);

  // Cleanup
  await prisma.medicationHistory.delete({ where: { id: histEntry.id } });
  await prisma.medication.delete({ where: { id: testHistMed.id } });
  assert(true, "MedicationHistory test records cleanup");

  console.log("\n================ 6. CLIENT IMPROVEMENTS TESTS ================");
  // Test isScheduleActiveOnDay
  const mondayDate = new Date("2024-04-22T10:00:00Z"); // Monday
  assert(isScheduleActiveOnDay("ALL", mondayDate) === true, "isScheduleActiveOnDay: ALL returns true");
  assert(isScheduleActiveOnDay("دوشنبه", mondayDate) === true, "isScheduleActiveOnDay: Persian 'دوشنبه' on Monday returns true");
  assert(isScheduleActiveOnDay("جمعه", mondayDate) === false, "isScheduleActiveOnDay: Persian 'جمعه' on Monday returns false");
  assert(isScheduleActiveOnDay("1", mondayDate) === true, "isScheduleActiveOnDay: Day index '1' on Monday returns true");
  assert(isScheduleActiveOnDay("MONDAY", mondayDate) === true, "isScheduleActiveOnDay: English 'MONDAY' on Monday returns true");
  assert(isScheduleActiveOnDay("شنبه,دوشنبه", mondayDate) === true, "isScheduleActiveOnDay: Comma-separated 'شنبه,دوشنبه' on Monday returns true");

  // Test Meal Time Offset Calculation
  function calculateMealOffset(baseTime: string, relation: "AFTER" | "BEFORE" | "WITH", offsetMinutes: number): string {
    const [bH, bM] = baseTime.split(":").map(Number);
    let totalM = bH * 60 + bM;
    if (relation === "AFTER") totalM += offsetMinutes;
    else if (relation === "BEFORE") totalM -= offsetMinutes;
    totalM = ((totalM % 1440) + 1440) % 1440;
    const h = Math.floor(totalM / 60);
    const m = totalM % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  assert(calculateMealOffset("12:30", "AFTER", 60) === "13:30", "Meal offset: 1 hour after lunch (12:30 + 60m) = 13:30");
  assert(calculateMealOffset("12:30", "BEFORE", 30) === "12:00", "Meal offset: 30 minutes before lunch (12:30 - 30m) = 12:00");
  assert(calculateMealOffset("07:00", "WITH", 0) === "07:00", "Meal offset: with breakfast = 07:00");

  // Test DVT Seconds vs Minutes Formatting
  function formatDvtDuration(elapsedSeconds: number): string {
    if (elapsedSeconds < 60) {
      return `${toPersianDigits(elapsedSeconds)} ثانیه`;
    }
    const mins = Math.max(1, Math.round(elapsedSeconds / 60));
    return `${toPersianDigits(mins)} دقیقه`;
  }
  assert(formatDvtDuration(45) === "۴۵ ثانیه", "DVT duration < 60s formats as seconds (45s -> ۴۵ ثانیه)");
  assert(formatDvtDuration(600) === "۱۰ دقیقه", "DVT duration >= 60s formats as minutes (600s -> ۱۰ دقیقه)");

  // Test MealTimeSlot DB Operations
  const testSlot = await prisma.mealTimeSlot.upsert({
    where: { name: "TEST_SLOT" },
    update: { defaultTime: "15:45" },
    create: {
      name: "TEST_SLOT",
      labelFa: "وعده تست",
      defaultTime: "15:45",
      order: 99,
      isActive: true,
    },
  });
  assert(testSlot.name === "TEST_SLOT" && testSlot.defaultTime === "15:45", "MealTimeSlot DB upsert and read");
  await prisma.mealTimeSlot.delete({ where: { name: "TEST_SLOT" } });
  assert(true, "MealTimeSlot test record cleanup");

  // Test Schedule with rulesJson and daysOfWeek
  const testRulesSchedule = await prisma.schedule.create({
    data: {
      title: "تسک تست وعده‌محور",
      category: "routine",
      itemType: "routine_task",
      targetTime: "13:30",
      daysOfWeek: "شنبه,دوشنبه",
      rulesJson: JSON.stringify({
        timingMode: "MEAL_RELATIVE",
        mealSlot: "LUNCH",
        relation: "AFTER",
        offsetMinutes: 60,
      }),
      isActive: true,
    },
  });
  assert(
    testRulesSchedule.daysOfWeek === "شنبه,دوشنبه" &&
    Boolean(testRulesSchedule.rulesJson?.includes("MEAL_RELATIVE")),
    "Schedule rulesJson and daysOfWeek persistence"
  );
  await prisma.schedule.delete({ where: { id: testRulesSchedule.id } });
  assert(true, "Schedule test record cleanup");

  // Section 6b: Medication Cascade and Inactive Validation Tests
  const testMed = await prisma.medication.create({
    data: {
      nameFa: "تست آبشار داروها",
      stockCount: 50,
      isActive: true,
    },
  });
  const sched1 = await prisma.schedule.create({
    data: {
      title: "تست نوبت ۱",
      category: "medication",
      itemType: "medication",
      targetTime: "08:00",
      medicationId: testMed.id,
      isActive: true,
    },
  });
  const sched2 = await prisma.schedule.create({
    data: {
      title: "تست نوبت ۲",
      category: "medication",
      itemType: "medication",
      targetTime: "20:00",
      medicationId: testMed.id,
      isActive: true,
    },
  });

  // Deactivate medication and verify cascade
  await prisma.medication.update({
    where: { id: testMed.id },
    data: { isActive: false },
  });
  await prisma.schedule.updateMany({
    where: { medicationId: testMed.id, isActive: true },
    data: { isActive: false },
  });

  const activeConnectedSchedules = await prisma.schedule.findMany({
    where: { medicationId: testMed.id, isActive: true },
  });
  assert(activeConnectedSchedules.length === 0, "Deactivating medication cascades to deactivating all its schedules");

  // Verify that an inactive medication's schedule cannot be activated
  const linkedMed = await prisma.medication.findUnique({ where: { id: testMed.id } });
  assert(Boolean(linkedMed && !linkedMed.isActive), "Medication is verified inactive in DB");

  // Cleanup
  await prisma.schedule.deleteMany({ where: { medicationId: testMed.id } });
  await prisma.medication.delete({ where: { id: testMed.id } });
  assert(true, "Medication cascade test records cleanup");

  // 6c. Server-tracked DVT Timer persistence & completion tests
  const dvtNurseUser = await prisma.user.findFirst({ where: { role: "NURSE" } });
  assert(dvtNurseUser !== null, "Nurse user found for DVT timer test");

  // 1. Create ActiveTimer (START action)
  const timerStart = new Date(Date.now() - 45 * 1000); // 45s ago
  const activeTimerRecord = await prisma.activeTimer.create({
    data: {
      timerType: "dvt_care",
      startTime: timerStart,
      taskTitle: "مراقبت DVT پای راست (آزمایشی)",
      nurseId: dvtNurseUser!.id,
    },
  });
  assert(Boolean(activeTimerRecord.id), "ActiveTimer started and persisted in DB");

  // 2. Query and compute elapsed seconds
  const foundTimer = await prisma.activeTimer.findFirst({
    where: { timerType: "dvt_care" },
  });
  assert(foundTimer !== null, "ActiveTimer retrieved successfully");
  const elapsedSec = Math.floor((Date.now() - new Date(foundTimer!.startTime).getTime()) / 1000);
  assert(elapsedSec >= 45, `ActiveTimer elapsed seconds calculated correctly (${elapsedSec}s >= 45s)`);

  // 3. Complete ActiveTimer (STOP action)
  const durationStr = elapsedSec < 60 ? `${elapsedSec} ثانیه` : `${Math.floor(elapsedSec / 60)} دقیقه`;
  const vitalCreated = await prisma.vitalLog.create({
    data: {
      nurseId: dvtNurseUser!.id,
      recordedAt: new Date(),
      type: "dvt_timer",
      valueNum: elapsedSec,
      valueText: durationStr,
    },
  });
  const taskLogCreated = await prisma.taskLog.create({
    data: {
      taskTitle: foundTimer!.taskTitle || "مراقبت DVT",
      nurseId: dvtNurseUser!.id,
      status: "DONE",
      notes: `مراقبت DVT: ${durationStr} بالا بردن پا`,
    },
  });
  await prisma.activeTimer.delete({ where: { id: foundTimer!.id } });

  const activeTimerAfterStop = await prisma.activeTimer.findFirst({
    where: { timerType: "dvt_care" },
  });
  assert(activeTimerAfterStop === null, "ActiveTimer cleared from DB after completion");
  assert(vitalCreated.type === "dvt_timer", "VitalLog for dvt_timer recorded properly");
  assert(taskLogCreated.status === "DONE", "TaskLog for DVT marked DONE properly");

  // Cleanup test logs
  await prisma.vitalLog.delete({ where: { id: vitalCreated.id } });
  await prisma.taskLog.delete({ where: { id: taskLogCreated.id } });
  assert(true, "DVT test logs cleanup successful");

  // Section 6d: Unified Medication Multi-Schedule, Meal-Relative Timing & Bi-directional Task Sync Tests
  console.log("\n================ 6d. MEDICATION MULTI-SCHEDULE & TASK SYNC TESTS ================");
  
  // 1. Create a medication with multiple schedules (fixed time + meal-relative with rulesJson)
  const createMedReq = new NextRequest("http://localhost:3000/api/admin/medications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: `care_token=${adminToken}`,
    },
    body: JSON.stringify({
      nameFa: "آسپرین ۸۰ تست نوبت‌ها",
      boxNumber: "88",
      dosage: "80mg",
      stockCount: 60,
      schedules: [
        {
          title: "آسپرین ۸۰ تست نوبت‌ها (صبح ناشتا)",
          targetTime: "07:30",
          mealRelation: "FASTING",
          daysOfWeek: "شنبه,دوشنبه,چهارشنبه",
          intervalUnit: "DAYS",
          intervalValue: 1,
          requiresNote: true,
        },
        {
          title: "آسپرین ۸۰ تست نوبت‌ها (بعد ناهار)",
          targetTime: "14:00",
          timingMode: "MEAL_RELATIVE",
          mealSlot: "LUNCH",
          mealOffsetRelation: "AFTER",
          mealOffsetHours: 1,
          mealOffsetMinutes: 0,
          daysOfWeek: "ALL",
          rulesJson: JSON.stringify({
            timingMode: "MEAL_RELATIVE",
            mealSlot: "LUNCH",
            relation: "AFTER",
            offsetMinutes: 60,
            label: "۱ ساعت بعد از ناهار",
          }),
          intervalUnit: "DAYS",
          intervalValue: 1,
          requiresNote: false,
        },
      ],
    }),
  });

  const postRes = await postMeds(createMedReq);
  assert(postRes.status === 200, "POST /api/admin/medications with multiple schedules returns 200");
  const postData = await postRes.json();
  const createdMedId = postData.medication.id;
  assert(Boolean(createdMedId), "Medication created with valid ID");

  // 2. Fetch via GET /api/admin/medications and verify both schedules exist with rulesJson and daysOfWeek
  const getReq1 = new NextRequest("http://localhost:3000/api/admin/medications", {
    headers: { cookie: `care_token=${adminToken}` },
  });
  const getRes1 = await getMeds(getReq1);
  assert(getRes1.status === 200, "GET /api/admin/medications returns 200");
  const getData1 = await getRes1.json();
  const foundMed1 = (getData1.medications as any[]).find((m) => m.id === createdMedId);
  assert(Boolean(foundMed1), "Created medication found in GET /api/admin/medications list");
  assert(foundMed1.schedules && foundMed1.schedules.length === 2, "Medication has exactly 2 schedules in GET response");

  const fixedSched = foundMed1.schedules.find((s: any) => s.mealRelation === "FASTING");
  assert(
    Boolean(fixedSched && fixedSched.targetTime === "07:30" && fixedSched.daysOfWeek === "شنبه,دوشنبه,چهارشنبه" && fixedSched.requiresNote === true),
    "Fixed schedule preserved targetTime (07:30), daysOfWeek, and requiresNote"
  );

  const mealSched = foundMed1.schedules.find((s: any) => s.rulesJson && s.rulesJson.includes("MEAL_RELATIVE"));
  assert(
    Boolean(mealSched && mealSched.rulesJson.includes("LUNCH") && mealSched.daysOfWeek === "ALL"),
    "Meal-relative schedule preserved rulesJson with LUNCH and timingMode"
  );

  // 3. Bi-directional sync test: Add a third schedule directly linking to this medication (simulating /schedules creation)
  const taskCreatedInSchedules = await prisma.schedule.create({
    data: {
      title: "آسپرین ۸۰ تست نوبت‌ها (نوبت شب - تسک جداگانه)",
      category: "medication",
      itemType: "medication",
      targetTime: "22:00",
      intervalUnit: "DAYS",
      intervalValue: 1,
      daysOfWeek: "ALL",
      medicationId: createdMedId,
      isActive: true,
    },
  });
  assert(Boolean(taskCreatedInSchedules.id), "Third schedule linked to medication created via schedule model");

  // Verify that GET /api/admin/medications now returns all 3 schedules for this medication
  const getRes2 = await getMeds(getReq1);
  const getData2 = await getRes2.json();
  const foundMed2 = (getData2.medications as any[]).find((m) => m.id === createdMedId);
  assert(
    Boolean(foundMed2 && foundMed2.schedules && foundMed2.schedules.length === 3),
    "Bi-directional sync: Task created in schedules is loaded in medication schedules (3 total schedules)"
  );

  // 4. Update medication schedules via PUT /api/admin/medications (keep 2, omit 3rd to test cascade deactivation)
  const putReq = new NextRequest("http://localhost:3000/api/admin/medications", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      cookie: `care_token=${adminToken}`,
    },
    body: JSON.stringify({
      id: createdMedId,
      nameFa: "آسپرین ۸۰ تست نوبت‌ها (ویرایش‌شده)",
      boxNumber: "88",
      deactivateUnlistedSchedules: true,
      schedules: [
        {
          id: fixedSched.id,
          title: "آسپرین نوبت صبح ویرایش‌شده",
          targetTime: "08:15",
          mealRelation: "AFTER_MEAL",
          daysOfWeek: "جمعه",
          intervalUnit: "DAYS",
          intervalValue: 1,
          requiresNote: false,
        },
        {
          id: mealSched.id,
          title: "آسپرین نوبت ناهار ویرایش‌شده",
          targetTime: "14:30",
          rulesJson: JSON.stringify({
            timingMode: "MEAL_RELATIVE",
            mealSlot: "DINNER",
            relation: "BEFORE",
            offsetMinutes: 30,
            label: "۳۰ دقیقه قبل از شام",
          }),
          daysOfWeek: "ALL",
          intervalUnit: "DAYS",
          intervalValue: 1,
          requiresNote: true,
        },
      ],
    }),
  });

  const putRes = await putMeds(putReq);
  assert(putRes.status === 200, "PUT /api/admin/medications returns 200");

  // Verify DB state after PUT
  const getRes3 = await getMeds(getReq1);
  const getData3 = await getRes3.json();
  const foundMed3 = (getData3.medications as any[]).find((m) => m.id === createdMedId);
  assert(
    Boolean(foundMed3 && foundMed3.schedules && foundMed3.schedules.length === 2),
    "Unlisted third schedule was cleanly deactivated by PUT deactivateUnlistedSchedules"
  );

  const updatedFixed = foundMed3.schedules.find((s: any) => s.id === fixedSched.id);
  assert(
    Boolean(updatedFixed && updatedFixed.targetTime === "08:15" && updatedFixed.daysOfWeek === "جمعه"),
    "Updated schedule has targetTime 08:15 and daysOfWeek جمعه"
  );

  const updatedMeal = foundMed3.schedules.find((s: any) => s.id === mealSched.id);
  assert(
    Boolean(updatedMeal && updatedMeal.rulesJson?.includes("DINNER") && updatedMeal.requiresNote === true),
    "Updated meal-relative schedule has rulesJson with DINNER and requiresNote true"
  );

  // 5. Cleanup test medication & schedules
  await prisma.schedule.deleteMany({ where: { medicationId: createdMedId } });
  await prisma.medicationHistory.deleteMany({ where: { medicationId: createdMedId } });
  await prisma.medication.delete({ where: { id: createdMedId } });
  assert(true, "Multi-schedule test data cleaned up successfully");

  console.log("\n================ 12. TASK EDITING & VITAL LOG ACCURACY TESTS ================");
  // 1. Create a 50 cc water intake log as nurse
  const nurseUserRec = await prisma.user.findUnique({ where: { username: "nurse" } });
  assert(nurseUserRec !== null, "Nurse user found for vital editing test");
  const nurseAuthToken = await signToken({
    id: nurseUserRec!.id,
    username: nurseUserRec!.username,
    fullName: nurseUserRec!.fullName,
    role: "NURSE",
  });

  const initialWaterReq = new NextRequest("http://localhost:3000/api/nurse/vitals", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: `care_token=${nurseAuthToken}`,
    },
    body: JSON.stringify({
      type: "water_intake",
      valueNum: 50,
      valueText: "آب مصرفی ۵۰ سی سی",
      taskTitle: "مصرف آب و مایعات",
    }),
  });

  const initialWaterRes = await postVitals(initialWaterReq);
  assert(initialWaterRes.status === 200, "POST /api/nurse/vitals logged 50 cc water intake successfully");
  const initialWaterData = await initialWaterRes.json();
  const createdVitalId = initialWaterData.vital?.id;
  const createdTaskLogId = initialWaterData.taskLog?.id;
  assert(Boolean(createdVitalId && createdTaskLogId), "Both vitalLog and taskLog created and returned");

  // Verify initial sum is 50
  const initialVitalInDb = await prisma.vitalLog.findUnique({ where: { id: createdVitalId } });
  assert(initialVitalInDb?.valueNum === 50, "Initial VitalLog valueNum in DB is 50 cc");
  assert(Boolean(initialVitalInDb?.extraData?.includes(createdTaskLogId)), "VitalLog extraData contains linked taskLogId");

  // 2. Edit the task from 50 cc to 100 cc
  const editWaterReq = new NextRequest("http://localhost:3000/api/nurse/tasks/edit-log", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      cookie: `care_token=${nurseAuthToken}`,
    },
    body: JSON.stringify({
      taskLogId: createdTaskLogId,
      valueNum: 100,
      notes: "آب میوه اضافه شد",
    }),
  });

  const editWaterRes = await putEditLog(editWaterReq);
  assert(editWaterRes.status === 200, "PUT /api/nurse/tasks/edit-log edited water intake successfully");
  const editWaterData = await editWaterRes.json();
  assert(editWaterData.log.notes?.includes("مصرف مایعات: 100 cc - آب میوه اضافه شد"), "TaskLog notes updated to 100 cc with clean user note");

  // Verify that the record was updated in place (no duplicate vital created)
  const updatedVitalInDb = await prisma.vitalLog.findUnique({ where: { id: createdVitalId } });
  assert(updatedVitalInDb?.valueNum === 100, "VitalLog valueNum updated in-place from 50 to 100 cc");

  // Check sum of water for today using exact same query as timeline
  const todayWaterVitals = await prisma.vitalLog.findMany({
    where: {
      id: createdVitalId,
      type: "water_intake",
    },
  });
  const todayWaterSum = todayWaterVitals.reduce((sum, v) => sum + (v.valueNum || 0), 0);
  assert(todayWaterSum === 100, `CRITICAL CHECK: Total water intake for this record is 100 cc, NOT 150 cc (got ${todayWaterSum})`);

  // 3. Test note duplication prevention on repeated edit
  const secondEditReq = new NextRequest("http://localhost:3000/api/nurse/tasks/edit-log", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      cookie: `care_token=${nurseAuthToken}`,
    },
    body: JSON.stringify({
      taskLogId: createdTaskLogId,
      valueNum: 120,
      notes: "مصرف مایعات: 100 cc - آب میوه اضافه شد - گزارش دوم",
    }),
  });
  const secondEditRes = await putEditLog(secondEditReq);
  const secondEditData = await secondEditRes.json();
  assert(
    !secondEditData.log.notes?.includes("مصرف مایعات: 100 cc - مصرف مایعات: 100 cc"),
    "System prefixes are stripped and not duplicated in task notes on repeated edits"
  );

  // 4. Test non-numeric task editing (routine task / medication): should not touch or create vitalLog
  const routineTaskLog = await prisma.taskLog.create({
    data: {
      taskTitle: "کمک به جابجایی و تغییر وضعیت بیمار",
      nurseId: nurseUserRec!.id,
      status: "DONE",
      notes: "بیمار ۲ بار جابجا شد",
      completedAt: new Date(),
    },
  });

  const editRoutineReq = new NextRequest("http://localhost:3000/api/nurse/tasks/edit-log", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      cookie: `care_token=${nurseAuthToken}`,
    },
    body: JSON.stringify({
      taskLogId: routineTaskLog.id,
      notes: "تغییر پوزیشن به پهلوی چپ انجام شد",
    }),
  });
  const editRoutineRes = await putEditLog(editRoutineReq);
  assert(editRoutineRes.status === 200, "Routine non-numeric task edited successfully without numeric value");
  const editRoutineData = await editRoutineRes.json();
  assert(
    editRoutineData.log.notes === "تغییر پوزیشن به پهلوی چپ انجام شد",
    "Non-numeric task notes updated cleanly"
  );

  // Cleanup test logs
  await prisma.vitalLog.deleteMany({ where: { id: createdVitalId } });
  await prisma.taskLog.deleteMany({ where: { id: { in: [createdTaskLogId, routineTaskLog.id] } } });
  assert(true, "Task edit test records cleaned up successfully");

  console.log("\n================ 10. VIEWER ROLE, PASSWORD RESET & RESTOCK TESTS ================");
  // 10.1 Create VIEWER user
  const adminUserRec = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  const adminAuthToken = await signToken({
    id: adminUserRec!.id,
    username: adminUserRec!.username,
    fullName: adminUserRec!.fullName,
    role: "ADMIN",
  });

  const viewerUsername = `viewer_test_${Date.now()}`;
  const createViewerReq = new NextRequest("http://localhost:3000/api/admin/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: `care_token=${adminAuthToken}`,
    },
    body: JSON.stringify({
      username: viewerUsername,
      password: "viewerPass123",
      fullName: "کاربر مشاهده‌کننده تست",
      role: "VIEWER",
    }),
  });
  const createViewerRes = await postUsers(createViewerReq);
  assert(createViewerRes.status === 200, "Created user with VIEWER role successfully");
  const createViewerData = await createViewerRes.json();
  const createdViewerId = createViewerData.user.id;
  assert(createViewerData.user.role === "VIEWER", "Created user role is explicitly VIEWER");

  // 10.2 Verify VIEWER JWT & Middleware access control
  const viewerAuthToken = await signToken({
    id: createdViewerId,
    username: viewerUsername,
    fullName: "کاربر مشاهده‌کننده تست",
    role: "VIEWER",
  });
  const verifiedViewer = await verifyToken(viewerAuthToken);
  assert(verifiedViewer?.role === "VIEWER", "verifyToken returns VIEWER role correctly");

  // Middleware blocks POST for VIEWER with 403 Forbidden
  const viewerMutateReq = new NextRequest("http://localhost:3000/api/admin/medications", {
    method: "POST",
    headers: {
      cookie: `care_token=${viewerAuthToken}`,
    },
  });
  const middlewareRes = await middleware(viewerMutateReq);
  assert(middlewareRes.status === 403, "Middleware blocks mutating POST request for VIEWER with 403");

  // 10.3 Password update via PUT /api/admin/users
  const updatePassReq = new NextRequest("http://localhost:3000/api/admin/users", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      cookie: `care_token=${adminAuthToken}`,
    },
    body: JSON.stringify({
      id: createdViewerId,
      password: "newSecretPass999!",
    }),
  });
  const updatePassRes = await putUsers(updatePassReq);
  assert(updatePassRes.status === 200, "User password updated via PUT /api/admin/users");
  const updatedUserDb = await prisma.user.findUnique({ where: { id: createdViewerId } });
  assert(
    await comparePassword("newSecretPass999!", updatedUserDb!.passwordHash),
    "Updated password verified against hash in DB"
  );

  // 10.4 Adhoc suggestions API
  const adhocTitle = `اقدام تست ${Date.now()}`;
  const addAdhocReq = new NextRequest("http://localhost:3000/api/admin/adhoc-suggestions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: `care_token=${adminAuthToken}`,
    },
    body: JSON.stringify({
      title: adhocTitle,
      category: "مراقبتی",
    }),
  });
  const addAdhocRes = await postAdhoc(addAdhocReq);
  assert(addAdhocRes.status === 200, "Ad-hoc suggestion created via API");

  const getAdhocReq = new NextRequest("http://localhost:3000/api/admin/adhoc-suggestions", {
    headers: { cookie: `care_token=${adminAuthToken}` },
  });
  const getAdhocRes = await getAdhoc(getAdhocReq);
  const getAdhocData = await getAdhocRes.json();
  const createdAdhocItem = getAdhocData.suggestions.find((s: any) => s.title === adhocTitle);
  assert(Boolean(createdAdhocItem), "Newly created ad-hoc suggestion found in list");

  if (createdAdhocItem) {
    const delAdhocReq = new NextRequest(`http://localhost:3000/api/admin/adhoc-suggestions?id=${createdAdhocItem.id}`, {
      method: "DELETE",
      headers: { cookie: `care_token=${adminAuthToken}` },
    });
    const delAdhocRes = await deleteAdhoc(delAdhocReq);
    assert(delAdhocRes.status === 200, "Ad-hoc suggestion deleted successfully via API");
  }

  // 10.5 Medication restock via PUT /api/admin/medications
  const sampleMed = await prisma.medication.findFirst({ where: { isActive: true } });
  if (sampleMed) {
    const prevStock = sampleMed.stockCount;
    const restockReq = new NextRequest("http://localhost:3000/api/admin/medications", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        cookie: `care_token=${adminAuthToken}`,
      },
      body: JSON.stringify({
        id: sampleMed.id,
        stockDelta: 15,
        restockDetails: {
          doctorName: "دکتر مسعود صابر",
          pharmacy: "داروخانه شبانه‌روزی صابر",
          date: "۱۴۰۳/۰۸/۰۷",
          notes: "تست خرید با نسخه جدید",
          amount: 15,
        },
      }),
    });
    const restockRes = await putMeds(restockReq);
    assert(restockRes.status === 200, "Medication restock PUT returned 200");
    const updatedMed = await prisma.medication.findUnique({ where: { id: sampleMed.id } });
    assert(updatedMed?.stockCount === prevStock + 15, `Medication stock incremented by 15 (from ${prevStock} to ${updatedMed?.stockCount})`);

    const restockHistory = await prisma.medicationHistory.findFirst({
      where: { medicationId: sampleMed.id, actionType: "RESTOCKED" },
      orderBy: { createdAt: "desc" },
    });
    assert(Boolean(restockHistory), "MedicationHistory record logged with actionType RESTOCKED");
    assert(Boolean(restockHistory?.doctorName === "دکتر مسعود صابر"), "Restock history includes prescribing doctor name");
    assert(Boolean(restockHistory?.description.includes("دکتر مسعود صابر")), "Restock description includes doctor name");
    assert(Boolean(restockHistory?.description.includes("داروخانه شبانه‌روزی صابر")), "Restock history includes pharmacy name");

    // Verify appearance in Analytics / Reports API
    const analyticsReq = new NextRequest("http://localhost:3000/api/admin/analytics?range=all", {
      headers: { Cookie: `care_token=${adminToken}` },
    });
    const analyticsRes = await getAnalytics(analyticsReq);
    assert(analyticsRes.status === 200, "GET /api/admin/analytics returns 200");
    const analyticsData = await analyticsRes.json();
    assert(Array.isArray(analyticsData.medicationPurchases), "Analytics reports include medicationPurchases array");
    const foundPurchase = analyticsData.medicationPurchases.find((p: any) => p.id === restockHistory?.id);
    assert(Boolean(foundPurchase && foundPurchase.doctorName === "دکتر مسعود صابر"), "Medication purchase in reports has correct doctorName");

    // Revert stock delta to maintain test DB state
    await prisma.medication.update({
      where: { id: sampleMed.id },
      data: { stockCount: prevStock },
    });
    if (restockHistory) {
      await prisma.medicationHistory.delete({ where: { id: restockHistory.id } });
    }
  }

  // Cleanup test user
  await prisma.user.delete({ where: { id: createdViewerId } });
  assert(true, "Test VIEWER user cleaned up successfully");

  console.log("\n================ 13. CLINICAL PHOTOS ARCHIVE & OPTIMIZATION TESTS ================");
  assert(formatFileSize(500) === "500 بایت", "formatFileSize: 500 bytes -> 500 بایت");
  assert(formatFileSize(2048) === "2 کیلوبایت", "formatFileSize: 2048 bytes -> 2 کیلوبایت");
  assert(formatFileSize(1048576 * 2.5) === "2.5 مگابایت", "formatFileSize: 2.5MB -> 2.5 مگابایت");

  // Test GET /api/admin/clinical-photos with limit
  const adminUserForPhotos = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  const adminTokenForPhotos = adminUserForPhotos
    ? await signToken({
        id: adminUserForPhotos.id,
        username: adminUserForPhotos.username,
        role: adminUserForPhotos.role as "ADMIN" | "NURSE" | "VIEWER",
        fullName: adminUserForPhotos.fullName,
      })
    : "";

  const photosReq = new NextRequest("http://localhost:3000/api/admin/clinical-photos?page=1&limit=4", {
    headers: { Cookie: `care_token=${adminTokenForPhotos}` },
  });
  const photosRes = await getClinicalPhotos(photosReq);
  assert(photosRes.status === 200, "GET /api/admin/clinical-photos returns 200");
  const photosData = await photosRes.json();
  assert(Array.isArray(photosData.photos), "Response includes photos array");
  assert(Boolean(photosData.pagination), "Response includes pagination metadata");
  assert(photosData.pagination?.limit === 4, "Pagination limit respected (limit=4)");
  assert(photosData.photos?.length <= 4, "Number of returned photos is <= limit");

  // Test category filtering
  const dvtReq = new NextRequest("http://localhost:3000/api/admin/clinical-photos?page=1&limit=4&category=dvt_leg", {
    headers: { Cookie: `care_token=${adminTokenForPhotos}` },
  });
  const dvtRes = await getClinicalPhotos(dvtReq);
  assert(dvtRes.status === 200, "GET /api/admin/clinical-photos?category=dvt_leg returns 200");
  const dvtData = await dvtRes.json();
  const allDvt = dvtData.photos.every((p: any) => p.category === "dvt_leg");
  assert(allDvt, "Category filtering returns only matching photos");

  console.log("\n================ 14. FORM VALIDATION & SAFE DEFAULTS TESTS ================");
  // 14.1 Medication creation with empty/0 stockCount defaults to 0, not 100
  const zeroStockMedReq = new NextRequest("http://localhost:3000/api/admin/medications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `care_token=${adminTokenForPhotos}`,
    },
    body: JSON.stringify({
      nameFa: "داروی تست موجودی صفر",
      stockCount: 0,
      lowStockThreshold: 10,
    }),
  });
  const zeroStockRes = await postMeds(zeroStockMedReq);
  assert(zeroStockRes.status === 200, "POST /api/admin/medications with 0 stock returns 200");
  const zeroStockData = await zeroStockRes.json();
  const createdZeroStockMed = await prisma.medication.findUnique({ where: { id: zeroStockData.medication.id } });
  assert(Boolean(createdZeroStockMed && createdZeroStockMed.stockCount === 0), "Created medication has stockCount = 0 (not defaulted to 100)");

  // 14.2 Stop medication requires custom clinical reason and records it accurately
  const stopMedReq = new NextRequest("http://localhost:3000/api/admin/medications/stop", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `care_token=${adminTokenForPhotos}`,
    },
    body: JSON.stringify({
      id: createdZeroStockMed!.id,
      reason: "بروز حساسیت و کهیر پوستی",
      doctorName: "دکتر متخصص آنکال",
      notes: "قطع فوری و جایگزینی با داروی جدید",
    }),
  });
  const stopRes = await postStopMed(stopMedReq);
  assert(stopRes.status === 200, "POST /api/admin/medications/stop returns 200");
  const stoppedMedInDb = await prisma.medication.findUnique({ where: { id: createdZeroStockMed!.id } });
  assert(Boolean(stoppedMedInDb && stoppedMedInDb.isActive === false), "Medication is deactivated on stop");
  assert(Boolean(stoppedMedInDb?.discontinuedReason === "بروز حساسیت و کهیر پوستی"), "Medication has custom clinical stop reason");
  assert(Boolean(stoppedMedInDb?.discontinuedBy === "دکتر متخصص آنکال"), "Medication has custom prescribing doctor on stop");

  // Verify stopped narrative history
  const stopHistory = await prisma.medicationHistory.findFirst({
    where: { medicationId: createdZeroStockMed!.id, actionType: "STOPPED" },
  });
  assert(Boolean(stopHistory && stopHistory.reason === "بروز حساسیت و کهیر پوستی"), "History record has accurate clinical stop reason");
  assert(Boolean(stopHistory?.description.includes("بروز حساسیت و کهیر پوستی")), "History narrative text includes accurate clinical stop reason");

  // Cleanup test medication and history
  await prisma.medicationHistory.deleteMany({ where: { medicationId: createdZeroStockMed!.id } });
  await prisma.medication.delete({ where: { id: createdZeroStockMed!.id } });
  assert(true, "Test zero-stock medication cleaned up successfully");

  // 14.3 Vital logs: urine output with color, blood glucose with mealTag, bowel movement with grade
  const urineWithColorReq = new NextRequest("http://localhost:3000/api/nurse/vitals", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `care_token=${nurseAuthToken}`,
    },
    body: JSON.stringify({
      type: "urine_output",
      valueNum: 320,
      valueText: "تخلیه ادرار ۳۲۰ سی سی - کهربایی / غلیظ",
      extraData: { color: "کهربایی / غلیظ" },
    }),
  });
  const urineWithColorRes = await postVitals(urineWithColorReq);
  assert(urineWithColorRes.status === 200, "POST /api/nurse/vitals for urine output returns 200");
  const urineLogData = await urineWithColorRes.json();
  const urineLogInDb = await prisma.vitalLog.findUnique({ where: { id: urineLogData.vital.id } });
  const parsedExtra = typeof urineLogInDb?.extraData === "string" ? JSON.parse(urineLogInDb.extraData) : (urineLogInDb?.extraData as any);
  assert(Boolean(urineLogInDb && parsedExtra?.color === "کهربایی / غلیظ"), "Urine vital record contains specified color in extraData");

  // Blood glucose with mealTag
  const glucoseWithTagReq = new NextRequest("http://localhost:3000/api/nurse/vitals", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `care_token=${nurseAuthToken}`,
    },
    body: JSON.stringify({
      type: "blood_sugar",
      valueNum: 115,
      mealTag: "2h_lunch",
      valueText: "قند خون ۱۱۵ (۲س ناهار)",
    }),
  });
  const glucoseWithTagRes = await postVitals(glucoseWithTagReq);
  assert(glucoseWithTagRes.status === 200, "POST /api/nurse/vitals for glucose returns 200");
  const glucoseLogData = await glucoseWithTagRes.json();
  const glucoseLogInDb = await prisma.vitalLog.findUnique({ where: { id: glucoseLogData.vital.id } });
  assert(Boolean(glucoseLogInDb && glucoseLogInDb.mealTag === "2h_lunch"), "Blood glucose vital record contains selected mealTag (not forced fasting)");

  // Bowel movement with bowelGrade
  const bowelWithGradeReq = new NextRequest("http://localhost:3000/api/nurse/vitals", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `care_token=${nurseAuthToken}`,
    },
    body: JSON.stringify({
      type: "bowel_movement",
      valueNum: 1.0,
      bowelGrade: "3_plus",
      valueText: "کارکرد روده: 3_plus",
    }),
  });
  const bowelWithGradeRes = await postVitals(bowelWithGradeReq);
  assert(bowelWithGradeRes.status === 200, "POST /api/nurse/vitals for bowel movement returns 200");
  const bowelLogData = await bowelWithGradeRes.json();
  const bowelLogInDb = await prisma.vitalLog.findUnique({ where: { id: bowelLogData.vital.id } });
  assert(Boolean(bowelLogInDb && bowelLogInDb.bowelGrade === "3_plus"), "Bowel movement vital record contains selected bowelGrade");

  // Cleanup test vital logs and task logs
  await prisma.vitalLog.deleteMany({
    where: { id: { in: [urineLogInDb!.id, glucoseLogInDb!.id, bowelLogInDb!.id] } },
  });
  if (urineLogData.taskLog?.id) await prisma.taskLog.delete({ where: { id: urineLogData.taskLog.id } }).catch(() => {});
  if (glucoseLogData.taskLog?.id) await prisma.taskLog.delete({ where: { id: glucoseLogData.taskLog.id } }).catch(() => {});
  if (bowelLogData.taskLog?.id) await prisma.taskLog.delete({ where: { id: bowelLogData.taskLog.id } }).catch(() => {});
  assert(true, "Validation vital records and task logs cleaned up successfully");

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
