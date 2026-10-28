import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/auth";
import { tehranMoment } from "../src/lib/jalali";

async function main() {
  console.log("🌱 Starting realistic demonstration data seeding...");

  // 1. Users with simple and secure passwords
  const adminPass = await hashPassword("admin123");
  const nursePass = await hashPassword("nurse123");

  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: { passwordHash: adminPass, fullName: "سرپرست خانواده و پزشک ناظر", role: "ADMIN", isActive: true },
    create: { username: "admin", passwordHash: adminPass, fullName: "سرپرست خانواده و پزشک ناظر", role: "ADMIN", isActive: true },
  });

  const nurse = await prisma.user.upsert({
    where: { username: "nurse" },
    update: { passwordHash: nursePass, fullName: "پرستار یزدانی", role: "NURSE", isActive: true },
    create: { username: "nurse", passwordHash: nursePass, fullName: "پرستار یزدانی", role: "NURSE", isActive: true },
  });

  console.log("✓ Users seeded: admin / nurse (passwords: admin123 / nurse123)");

  // 2. Meal Reference Slots
  const defaultMealSlots = [
    { name: "BREAKFAST", labelFa: "ناشتا / صبحانه", defaultTime: "07:00", order: 1 },
    { name: "MORNING_SNACK", labelFa: "میان‌وعده صبح", defaultTime: "10:00", order: 2 },
    { name: "LUNCH", labelFa: "ناهار", defaultTime: "12:30", order: 3 },
    { name: "AFTERNOON_SNACK", labelFa: "میان‌وعده عصر", defaultTime: "16:00", order: 4 },
    { name: "DINNER", labelFa: "شام", defaultTime: "19:00", order: 5 },
    { name: "BEDTIME", labelFa: "قبل خواب", defaultTime: "20:00", order: 6 },
  ];

  for (const slot of defaultMealSlots) {
    await prisma.mealTimeSlot.upsert({
      where: { name: slot.name },
      update: { labelFa: slot.labelFa, defaultTime: slot.defaultTime, order: slot.order, isActive: true },
      create: { name: slot.name, labelFa: slot.labelFa, defaultTime: slot.defaultTime, order: slot.order, isActive: true },
    });
  }
  console.log("✓ Meal slots seeded (6 standard reference slots)");

  // 3. Key Medications
  const medsData = [
    { nameFa: "لووتیروکسین ۱۰۰", nameEn: "Levothyroxine 100mcg", boxNumber: "۱", dosage: "۱ قرص", instructions: "ناشتا با آب ولرم", stockCount: 84 },
    { nameFa: "هپارین ۵۰۰۰", nameEn: "Heparin 5000 IU", boxNumber: "۲", dosage: "۱ ویال", instructions: "تزریق زیرجلدی دور ناف", stockCount: 28 },
    { nameFa: "استامینوفن ۵۰۰", nameEn: "Acetaminophen 500mg", boxNumber: "۳", dosage: "۱ قرص", instructions: "در صورت درد یا تب", stockCount: 45 },
    { nameFa: "متفورمین ۵۰۰", nameEn: "Metformin 500mg", boxNumber: "۴", dosage: "۱ قرص", instructions: "همراه غذا میل شود", stockCount: 60 },
    { nameFa: "آتورواستاتین ۲۰", nameEn: "Atorvastatin 20mg", boxNumber: "۵", dosage: "۱ قرص", instructions: "شب‌ها قبل از خواب", stockCount: 30 },
    { nameFa: "کارودیلول ۶.۲۵", nameEn: "Carvedilol 6.25mg", boxNumber: "۷", dosage: "نصف قرص", instructions: "بعد از ناهار مصرف شود", stockCount: 40 },
    { nameFa: "پنتوپرازول ۴۰", nameEn: "Pantoprazole 40mg", boxNumber: "۸", dosage: "۱ قرص", instructions: "نیم ساعت قبل از ناهار", stockCount: 52 },
    { nameFa: "دومپریدون ۱۰", nameEn: "Domperidone 10mg", boxNumber: "۱۱", dosage: "۱ قرص", instructions: "قبل از غذا جهت تهوع", stockCount: 35 },
    { nameFa: "لاکتولوز شربت", nameEn: "Lactulose Syrup", boxNumber: "۱۵", dosage: "۱۵ سی‌سی", instructions: "در صورت عدم اجابت مزاج", stockCount: 3 },
    { nameFa: "آلپرازولام ۰.۵", nameEn: "Alprazolam 0.5mg", boxNumber: "۱۸", dosage: "نصف قرص", instructions: "شب قبل از خواب در صورت بی‌قراری", stockCount: 20 },
  ];

  const medMap = new Map<string, string>();
  for (const m of medsData) {
    const med = await prisma.medication.upsert({
      where: { id: `med-${m.boxNumber}` },
      update: { ...m, doctorName: "دکتر رضایی", isActive: true },
      create: { id: `med-${m.boxNumber}`, ...m, doctorName: "دکتر رضایی", isActive: true },
    });
    medMap.set(m.boxNumber, med.id);
  }
  console.log("✓ Core medications seeded and stock populated");

  // 4. Clean out old test demo schedules with our prefix
  await prisma.schedule.deleteMany({
    where: { id: { startsWith: "demo-sched-" } }
  });

  const schedulesToCreate = [
    {
      id: "demo-sched-01",
      title: "بیدار شدن، تعویض پوشک و کنترل اولیه",
      itemType: "routine_task",
      category: "routine",
      targetTime: "06:00",
      daysOfWeek: "ALL",
      doneTime: "06:10",
      note: "پوشک تعویض شد، پوست ناحیه ساکروم سالم و بدون راش بود.",
    },
    {
      id: "demo-sched-02",
      title: "لووتیروکسین ۱۰۰ (جعبه ۱) - ناشتا",
      itemType: "medication",
      category: "medication",
      targetTime: "07:00",
      medicationId: medMap.get("۱"),
      daysOfWeek: "ALL",
      doneTime: "07:05",
      note: "دارو با نصف لیوان آب ولرم داده شد.",
    },
    {
      id: "demo-sched-03",
      title: "قند خون ناشتا",
      itemType: "routine_task",
      category: "vital",
      vitalType: "blood_sugar",
      targetTime: "07:15",
      daysOfWeek: "ALL",
      doneTime: "07:18",
      note: "BS: 118 mg/dL - نرمال",
    },
    {
      id: "demo-sched-04",
      title: "صبحانه کامل و انسولین رگولار",
      itemType: "meal",
      category: "meal",
      targetTime: "08:00",
      daysOfWeek: "ALL",
      doneTime: "08:15",
      note: "پوره تخم‌مرغ و چای کم‌رنگ بدون مشکل بلع میل شد.",
    },
    {
      id: "demo-sched-05",
      title: "هپارین ۵۰۰۰ زیرجلدی (جعبه ۲)",
      itemType: "medication",
      category: "medication",
      targetTime: "08:30",
      medicationId: medMap.get("۲"),
      daysOfWeek: "ALL",
      doneTime: "08:35",
      note: "تزریق زیرجلدی سمت راست شکم انجام شد.",
    },
    {
      id: "demo-sched-06",
      title: "میان‌وعده صبح: اسموتی میوه و جو دوسر",
      itemType: "meal",
      category: "meal",
      targetTime: "10:00",
      daysOfWeek: "ALL",
      doneTime: "10:10",
      note: "۲۰۰ سی‌سی اسموتی مصرف شد.",
    },
    {
      id: "demo-sched-07",
      title: "ماساژ اندام تحتانی و تغییر پوزیشن به راست",
      itemType: "routine_task",
      category: "routine",
      targetTime: "11:00",
      daysOfWeek: "ALL",
      doneTime: "11:05",
      note: "پوزیشن بیمار تغییر داده شد، بالش زیر زانو قرار گرفت.",
    },
    {
      id: "demo-sched-08",
      title: "پنتوپرازول ۴۰ (جعبه ۸) - نیم ساعت قبل ناهار",
      itemType: "medication",
      category: "medication",
      targetTime: "12:00",
      medicationId: medMap.get("۸"),
      rulesJson: JSON.stringify({
        timingMode: "MEAL_RELATIVE",
        mealSlot: "LUNCH",
        relation: "BEFORE",
        offsetMinutes: 30,
      }),
      daysOfWeek: "ALL",
      doneTime: "12:02",
      note: "قرص بلعیده شد.",
    },
    {
      id: "demo-sched-09",
      title: "ناهار کامل: سوپ میکس‌شده مرغ و سبزیجات",
      itemType: "meal",
      category: "meal",
      targetTime: "12:30",
      daysOfWeek: "ALL",
      doneTime: "12:45",
      note: "بیمار اشتهای خوبی داشت، سر تخت ۴۵ درجه بالا بود.",
    },
    {
      id: "demo-sched-10",
      title: "کارودیلول ۶.۲۵ (جعبه ۷) - ۱ ساعت بعد ناهار",
      itemType: "medication",
      category: "medication",
      targetTime: "13:30",
      medicationId: medMap.get("۷"),
      rulesJson: JSON.stringify({
        timingMode: "MEAL_RELATIVE",
        mealSlot: "LUNCH",
        relation: "AFTER",
        offsetMinutes: 60,
      }),
      daysOfWeek: "ALL",
      doneTime: "13:35",
      note: "نصف قرص داده شد.",
    },
    {
      id: "demo-sched-11",
      title: "فیزیوتراپی تنفسی و تمرین اسپیرومتری",
      itemType: "routine_task",
      category: "routine",
      targetTime: "15:00",
      daysOfWeek: "ALL",
      doneTime: "15:10",
      note: "۱۰ نوبت تنفس عمیق با دستگاه اسپیرومتر انجام شد.",
    },
    {
      id: "demo-sched-12",
      title: "میان‌وعده عصر: پوره موز و مغز بادام",
      itemType: "meal",
      category: "meal",
      targetTime: "16:00",
      daysOfWeek: "ALL",
      doneTime: "16:05",
      note: "میل شد.",
    },
    // OVERDUE TASKS (ساعت گذشته اما هنوز انجام نشده تا کارت معوقه زرد دیده شود)
    {
      id: "demo-sched-13",
      title: "استامینوفن ۵۰۰ (جعبه ۳) - نوبت عصر",
      itemType: "medication",
      category: "medication",
      targetTime: "16:30",
      medicationId: medMap.get("۳"),
      daysOfWeek: "ALL",
      doneTime: null, // NOT DONE -> OVERDUE
    },
    {
      id: "demo-sched-14",
      title: "کنترل فشار خون و ضربان قلب نوبت عصر",
      itemType: "routine_task",
      category: "vital",
      vitalType: "blood_pressure",
      targetTime: "17:00",
      daysOfWeek: "ALL",
      doneTime: null, // NOT DONE -> OVERDUE
    },
    // ACTIVE / CURRENT TASKS (ساعت نزدیک به حال حاضر - آماده ثبت)
    {
      id: "demo-sched-15",
      title: "تغییر وضعیت به چپ و بررسی زخم فشاری",
      itemType: "routine_task",
      category: "routine",
      targetTime: "17:30",
      daysOfWeek: "ALL",
      doneTime: null, // ACTIVE
    },
    {
      id: "demo-sched-16",
      title: "مراقبت DVT هر دو پا (ماساژ و پوزیشن پنیوماتیک)",
      itemType: "routine_task",
      category: "vital",
      vitalType: "dvt_care",
      targetTime: "18:00",
      daysOfWeek: "ALL",
      doneTime: null, // ACTIVE
    },
    // UPCOMING TASKS (ساعت آینده امروز)
    {
      id: "demo-sched-17",
      title: "متفورمین ۵۰۰ (جعبه ۴) - همراه شام",
      itemType: "medication",
      category: "medication",
      targetTime: "19:00",
      medicationId: medMap.get("۴"),
      rulesJson: JSON.stringify({
        timingMode: "MEAL_RELATIVE",
        mealSlot: "DINNER",
        relation: "WITH",
        offsetMinutes: 0,
      }),
      daysOfWeek: "ALL",
      doneTime: null,
    },
    {
      id: "demo-sched-18",
      title: "شام سبک: کته گشنیز و ماست پروبیوتیک",
      itemType: "meal",
      category: "meal",
      targetTime: "19:00",
      daysOfWeek: "ALL",
      doneTime: null,
    },
    {
      id: "demo-sched-19",
      title: "کنترل تب و درصد اکسیژن خون (SPO2)",
      itemType: "routine_task",
      category: "vital",
      targetTime: "19:30",
      daysOfWeek: "ALL",
      doneTime: null,
    },
    {
      id: "demo-sched-20",
      title: "آتورواستاتین ۲۰ (جعبه ۵) - قبل خواب",
      itemType: "medication",
      category: "medication",
      targetTime: "20:00",
      medicationId: medMap.get("۵"),
      rulesJson: JSON.stringify({
        timingMode: "MEAL_RELATIVE",
        mealSlot: "BEDTIME",
        relation: "BEFORE",
        offsetMinutes: 0,
      }),
      daysOfWeek: "ALL",
      doneTime: null,
    },
    {
      id: "demo-sched-21",
      title: "شستشو، ضدعفونی و تعویض پانسمان ساکروم",
      itemType: "routine_task",
      category: "routine",
      targetTime: "20:30",
      daysOfWeek: "ALL",
      doneTime: null,
    },
    {
      id: "demo-sched-22",
      title: "آلپرازولام ۰.۵ (جعبه ۱۸) - نوبت شب",
      itemType: "medication",
      category: "medication",
      targetTime: "21:30",
      medicationId: medMap.get("۱۸"),
      daysOfWeek: "ALL",
      doneTime: null,
    },
  ];

  // Remove existing today's task logs for demo-sched
  const startOfDay = tehranMoment().startOf("day").toDate();
  const endOfDay = tehranMoment().endOf("day").toDate();
  await prisma.taskLog.deleteMany({
    where: {
      completedAt: { gte: startOfDay, lte: endOfDay },
      scheduleId: { startsWith: "demo-sched-" }
    }
  });

  for (const s of schedulesToCreate) {
    const createdSched = await prisma.schedule.create({
      data: {
        id: s.id,
        title: s.title,
        itemType: s.itemType,
        category: s.category,
        vitalType: s.vitalType || null,
        targetTime: s.targetTime,
        daysOfWeek: s.daysOfWeek,
        rulesJson: s.rulesJson || null,
        medicationId: s.medicationId || null,
        isActive: true,
      }
    });

    if (s.doneTime) {
      const [h, m] = s.doneTime.split(":").map(Number);
      const completedDate = tehranMoment().hour(h).minute(m).second(0).toDate();
      await prisma.taskLog.create({
        data: {
          scheduleId: createdSched.id,
          taskTitle: createdSched.title,
          nurseId: nurse.id,
          completedAt: completedDate,
          status: "DONE",
          notes: s.note || "انجام شد",
        }
      });
    }
  }
  console.log("✓ 22 Realistic schedules created (12 completed today, 2 overdue, 2 active, 6 upcoming)");

  // 5. Add recent Bedside Quick Vitals and TaskLogs
  const quickVitalTime = tehranMoment().hour(16).minute(45).toDate();
  await prisma.vitalLog.create({
    data: {
      nurseId: nurse.id,
      type: "water_intake",
      valueNum: 300,
      valueText: "آب ولرم ۳۰۰ سی‌سی",
      recordedAt: quickVitalTime,
    }
  });
  await prisma.taskLog.create({
    data: {
      taskTitle: "ثبت آب مصرفی (۳۰۰ سی‌سی)",
      nurseId: nurse.id,
      completedAt: quickVitalTime,
      status: "DONE",
      notes: "ثبت سریع پای تخت",
    }
  });

  const quickUrineTime = tehranMoment().hour(17).minute(10).toDate();
  await prisma.vitalLog.create({
    data: {
      nurseId: nurse.id,
      type: "urine_output",
      valueNum: 350,
      valueText: "۳۵۰ سی‌سی - زرد کهربایی شفاف",
      recordedAt: quickUrineTime,
    }
  });
  await prisma.taskLog.create({
    data: {
      taskTitle: "ثبت تخلیه ادرار (۳۵۰ سی‌سی)",
      nurseId: nurse.id,
      completedAt: quickUrineTime,
      status: "DONE",
      notes: "رنگ شفاف و نرمال",
    }
  });

  // 6. Clinical Note
  await prisma.clinicalNote.create({
    data: {
      nurseId: nurse.id,
      category: "general",
      noteText: "گزارش تحویل شیفت عصر: وضعیت عمومی بیمار پایدار است. دفع ادرار و آب دریافتی کافی بوده، قند خون صبح در محدوده هدف کنترل شد. هیچگونه زخم فشاری یا ادم در اندام‌ها مشاهده نشد.",
      createdAt: tehranMoment().hour(17).minute(15).toDate(),
    }
  });

  console.log("✓ Quick actions, vitals and shift summary clinical note created");
  console.log("\n🎉 Fake demonstration database is fully configured and ready!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
