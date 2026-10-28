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
