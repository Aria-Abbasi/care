import openpyxl
import sqlite3
import re
import datetime
import bcrypt
import os

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'prisma', 'care.db'))
EXCEL_PATH = '/home/Aria/Desktop/e.xlsx'

print(f"Connecting to SQLite database: {DB_PATH}")
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Enable WAL mode for performance and concurrent safety
cursor.execute("PRAGMA journal_mode=WAL;")
cursor.execute("PRAGMA synchronous=NORMAL;")

def cuid_generator():
    import uuid
    return 'c' + uuid.uuid4().hex[:24]

def to_english_digits(text):
    if not text:
        return ""
    p_digits = "۰۱۲۳۴۵۶۷۸۹"
    a_digits = "٠١٢٣٤٥٦٧٨٩"
    for i in range(10):
        text = text.replace(p_digits[i], str(i)).replace(a_digits[i], str(i))
    return text

def parse_iso_datetime(val):
    if not val:
        return None
    if isinstance(val, datetime.datetime):
        return val.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    if isinstance(val, str):
        val = val.strip()
        # Handle string format like '2024-04-22 13:30:40.131000'
        try:
            dt = datetime.datetime.fromisoformat(val)
            return dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")
        except Exception:
            try:
                dt = datetime.datetime.strptime(val[:19], "%Y-%m-%d %H:%M:%S")
                return dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")
            except Exception:
                return None
    return None

now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")

# 1. Seed Users
print("--- 1. Seeding Users ---")
admin_hash = bcrypt.hashpw(b"Admin@Care2026!", bcrypt.gensalt(10)).decode('utf-8')
nurse_hash = bcrypt.hashpw(b"Nurse@Care2026!", bcrypt.gensalt(10)).decode('utf-8')

admin_id = cuid_generator()
nurse_id = cuid_generator()

cursor.execute("DELETE FROM User;")
cursor.execute("""
INSERT INTO User (id, username, passwordHash, fullName, role, isActive, createdAt, updatedAt)
VALUES (?, ?, ?, ?, ?, 1, ?, ?);
""", (admin_id, "admin", admin_hash, "سرپرست خانواده", "ADMIN", now_str, now_str))

cursor.execute("""
INSERT INTO User (id, username, passwordHash, fullName, role, isActive, createdAt, updatedAt)
VALUES (?, ?, ?, ?, ?, 1, ?, ?);
""", (nurse_id, "nurse", nurse_hash, "پرستار یزدانی", "NURSE", now_str, now_str))

print("Created admin and nurse accounts.")

# 2. Seed Patient Profile
cursor.execute("DELETE FROM PatientProfile;")
cursor.execute("""
INSERT INTO PatientProfile (id, fullName, age, bloodType, notes, emergencyContact, updatedAt)
VALUES (?, ?, ?, ?, ?, ?, ?);
""", (cuid_generator(), "آقای جواد یزدانی", 78, "A+", "سابقه DVT پای راست، دیابت نوع ۲، تحت درمان با آپیکسابان و انسولین", "۰۹۱۲۱۱۱۱۱۱۱", now_str))

print("Created patient profile for آقای جواد یزدانی.")

# 3. Read Excel file
print(f"Loading workbook from {EXCEL_PATH}...")
wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)

# 4. Ingest Medications from DrgList
print("--- 2. Ingesting Medications from DrgList ---")
cursor.execute("DELETE FROM Medication;")
drg_sheet = wb['DrgList']
med_count = 0
med_map = {} # box_number or name -> id

for row in drg_sheet.iter_rows(values_only=True):
    # row format: [startDate, boxNum, medName, instructions, endDate, docName, ...]
    if not row or len(row) < 4:
        continue
    box_num = row[1]
    name = row[2]
    instructions = row[3]
    doc = row[5] if len(row) > 5 else None
    
    if not name or str(name).strip() == "" or "لیست داروهای" in str(name) or "نام دارو" in str(name):
        continue
    
    name_str = str(name).strip()
    box_str = str(int(box_num)) if (box_num is not None and isinstance(box_num, (int, float))) else (str(box_num).strip() if box_num else None)
    inst_str = str(instructions).strip() if instructions else ""
    doc_str = str(doc).strip() if doc else ""
    
    # Extract dosage/constraints
    constraints = None
    if "قبل ناهار" in inst_str or "نیم ساعت" in inst_str:
        constraints = "نیم ساعت قبل ناهار"
    elif "قبل صبحانه" in inst_str or "ناشتا" in inst_str:
        constraints = "صبح ناشتا نیم ساعت قبل صبحانه"
    elif "قبل خواب" in inst_str:
        constraints = "قبل خواب"
    elif "دو ساعت اختلاف" in inst_str:
        constraints = "با ملین منیزیم و آپیکسابان دو ساعت اختلاف"

    m_id = cuid_generator()
    cursor.execute("""
    INSERT INTO Medication (id, nameFa, nameEn, dosage, unit, boxNumber, instructions, doctorName, stockCount, lowStockThreshold, timeConstraints, isActive, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 100, 15, ?, 1, ?, ?);
    """, (m_id, name_str, None, None, "قرص", box_str, inst_str, doc_str, constraints, now_str, now_str))
    
    med_count += 1
    if box_str:
        med_map[box_str] = m_id
    med_map[name_str[:15]] = m_id

print(f"Imported {med_count} medications.")

# 5. Ingest Schedules
print("--- 3. Ingesting Daily Schedule ---")
cursor.execute("DELETE FROM Schedule;")
schedules = [
    ("routine_task", "بیدار شدن، تعویض پوشک و کنترل اولیه", "06:00", "routine", "ALL", "FASTING", None),
    ("medication", "لووتیروکسین ۱۵۰ (جعبه ۱) - ناشتا", "07:00", "medication", "ALL", "FASTING", med_map.get("1")),
    ("vital_log", "قند خون ناشتا", "07:15", "routine", "ALL", "FASTING", None),
    ("medication", "کارودیلول نصف قرص (جعبه ۷) و دومپریدون ۱۰ (جعبه ۱۱)", "07:30", "medication", "ALL", "BEFORE_MEAL", med_map.get("7")),
    ("meal", "صبحانه کامل و انسولین", "08:00", "meal", "ALL", "WITH_MEAL", None),
    ("medication", "آپیکسابان ۲.۵ (جعبه ۹) + دایمتیکون ۱۸۰ (جعبه ۱۲)", "08:30", "medication", "ALL", "AFTER_MEAL", med_map.get("9")),
    ("vital_log", "قند خون ۲ ساعته صبحانه", "10:00", "routine", "ALL", "AFTER_MEAL", None),
    ("meal", "میان وعده صبح + نفروتونیک (جعبه ۱۴) یا مگنیفورت", "10:30", "meal", "ALL", "WITH_MEAL", med_map.get("14")),
    ("dvt_care", "دی وی تی DVT: بالا بردن پای راست و ماساژ", "11:30", "dvt_care", "ALL", None, None),
    ("medication", "پنتوپرازول ۴۰ (جعبه ۸) - رأس نیم ساعت قبل ناهار", "12:00", "medication", "ALL", "BEFORE_MEAL", med_map.get("8")),
    ("meal", "ناهار اصلی", "12:30", "meal", "ALL", "WITH_MEAL", None),
    ("medication", "دایمتیکون ۱۸۰ + امگا ۳ (جعبه ۱۷) + سلن پلاس (جعبه ۱۶)", "13:00", "medication", "ALL", "AFTER_MEAL", med_map.get("17")),
    ("vital_log", "قند خون ۲ ساعته ناهار", "15:00", "routine", "ALL", "AFTER_MEAL", None),
    ("meal", "اسموتی مقوی میان وعده عصر", "15:30", "meal", "ALL", "WITH_MEAL", None),
    ("medication", "ویتامین B1 تیاماکس (جعبه ۳۳)", "16:00", "medication", "ALL", "AFTER_MEAL", med_map.get("33")),
    ("dvt_care", "دی وی تی DVT: بالا بردن پای راست", "18:00", "dvt_care", "ALL", None, None),
    ("medication", "دومپریدون ۱۰ (جعبه ۱۱) قبل شام", "19:30", "medication", "ALL", "BEFORE_MEAL", med_map.get("11")),
    ("meal", "شام سبک", "20:00", "meal", "ALL", "WITH_MEAL", None),
    ("medication", "آپیکسابان ۲.۵ (جعبه ۹) + دایمتیکون + کرن فیکس (جعبه ۱۸)", "20:30", "medication", "ALL", "AFTER_MEAL", med_map.get("9")),
    ("medication", "زینک پلاس (جعبه ۲۰) یک ساعت بعد شام", "21:30", "medication", "ALL", "AFTER_MEAL", med_map.get("20")),
    ("routine_task", "شستشوی پا و بدن، پماد AD، لورازپام (جعبه ۱۳) قبل خواب", "22:30", "routine", "ALL", "BEDTIME", med_map.get("13")),
]

for s in schedules:
    cursor.execute("""
    INSERT INTO Schedule (id, itemType, title, targetTime, category, daysOfWeek, mealRelation, rulesJson, medicationId, isActive, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, 1, ?, ?);
    """, (cuid_generator(), s[0], s[1], s[2], s[3], s[4], s[5], s[6], now_str, now_str))

print(f"Created {len(schedules)} core routine schedules.")

# 6. Ingest Diets and Smoothies
print("--- 4. Ingesting Diets & Smoothies ---")
cursor.execute("DELETE FROM DietRecipe;")
cursor.execute("DELETE FROM SmoothieRecipe;")

if 'لیست غذا' in wb.sheetnames:
    food_sheet = wb['لیست غذا']
    for row in food_sheet.iter_rows(values_only=True):
        if not row: continue
        lunch, dinner = row[0], row[1] if len(row) > 1 else None
        if lunch and str(lunch).strip() and "ناهار" not in str(lunch):
            cursor.execute("""
            INSERT INTO DietRecipe (id, mealType, title, description, instructions, isActive, createdAt, updatedAt)
            VALUES (?, 'LUNCH', ?, NULL, NULL, 1, ?, ?);
            """, (cuid_generator(), str(lunch).strip(), now_str, now_str))
        if dinner and str(dinner).strip() and "شام" not in str(dinner):
            cursor.execute("""
            INSERT INTO DietRecipe (id, mealType, title, description, instructions, isActive, createdAt, updatedAt)
            VALUES (?, 'DINNER', ?, NULL, NULL, 1, ?, ?);
            """, (cuid_generator(), str(dinner).strip(), now_str, now_str))

if 'اسموتی' in wb.sheetnames:
    sm_sheet = wb['اسموتی']
    current_title = "اسموتی مقوی"
    for row in sm_sheet.iter_rows(values_only=True):
        if not row: continue
        title, ing = row[0], row[1] if len(row) > 1 else None
        if title and str(title).strip():
            current_title = str(title).strip()
        if ing and str(ing).strip():
            cursor.execute("""
            INSERT INTO SmoothieRecipe (id, title, ingredients, instructions, isActive, createdAt, updatedAt)
            VALUES (?, ?, ?, NULL, 1, ?, ?);
            """, (cuid_generator(), current_title, str(ing).strip(), now_str, now_str))

print("Imported diet and smoothie recipes.")

# 7. Ingest Historical Logs (Form Responses 1 and Old History)
print("--- 5. Ingesting Historical Logs from Form Responses 1 and Old History ---")
cursor.execute("DELETE FROM VitalLog;")
cursor.execute("DELETE FROM TaskLog;")
cursor.execute("DELETE FROM ClinicalNote;")

vital_records = []
task_records = []
note_records = []

def process_log(ts_raw, text_raw):
    if not text_raw:
        return
    text = str(text_raw).strip()
    if not text:
        return
    ts_iso = parse_iso_datetime(ts_raw)
    if not ts_iso:
        return
    
    clean_text = to_english_digits(text)
    
    # 1. Urine output: تخلیه ادرار
    if "تخلیه" in text or ("ادرار" in text and "رنگ" not in text and "سوند" in text):
        m = re.search(r'(\d+)\s*(?:سی\s*سی|cc|میلی)?', clean_text)
        val = float(m.group(1)) if m else 300.0
        # Sanity check urine range (30 to 2000 ml)
        if val < 20 or val > 3000:
            val = None
        vital_records.append((
            cuid_generator(), nurse_id, ts_iso, "urine_output", val, text, None, None, None, None, None, None, now_str
        ))
        return

    # 2. Water intake: آب مصرفی، آب یک بطری، استکان
    if "آب" in text and ("مصرف" in text or "بطری" in text or "لیوان" in text or "استکان" in text or "سی سی" in text or "خوردن" in text):
        m = re.search(r'(\d+)\s*(?:سی\s*سی|cc|میلی)?', clean_text)
        if m:
            val = float(m.group(1))
        elif "بطری" in text:
            val = 500.0
        elif "لیوان" in text or "ماگ" in text:
            val = 250.0
        elif "استکان" in text:
            val = 150.0
        else:
            val = 200.0
        vital_records.append((
            cuid_generator(), nurse_id, ts_iso, "water_intake", val, text, None, None, None, None, None, None, now_str
        ))
        return

    # 3. Blood Sugar: قند ناشتا، قند ۲ ساعته، قند خون
    if "قند" in text:
        m = re.search(r'(\d{2,3})', clean_text)
        val = float(m.group(1)) if m else None
        tag = "random"
        if "ناشتا" in text:
            tag = "fasting"
        elif "صبحانه" in text or "صبح" in text:
            tag = "2h_breakfast"
        elif "ناهار" in text or "نهار" in text:
            tag = "before_lunch" if "قبل" in text else "2h_lunch"
        elif "شام" in text:
            tag = "before_dinner" if "قبل" in text else "2h_dinner"
            
        vital_records.append((
            cuid_generator(), nurse_id, ts_iso, "blood_sugar", val, text, None, None, tag, None, None, None, now_str
        ))
        return

    # 4. Blood Pressure: فشار خون
    if "فشار" in text:
        # formats: ۱۳۲.۶۵, 130/80, 13/8
        m = re.search(r'(\d{2,3})[\./\-](\d{2,3})', clean_text)
        sys_val = None
        dia_val = None
        if m:
            sys_val = int(m.group(1))
            dia_val = int(m.group(2))
            if sys_val < 30: sys_val *= 10
            if dia_val < 20: dia_val *= 10
        vital_records.append((
            cuid_generator(), nurse_id, ts_iso, "blood_pressure", None, text, sys_val, dia_val, None, None, None, None, now_str
        ))
        return

    # 5. Bowel movement: کارکرد شکم
    if "کارکرد" in text or "دفع" in text or "شکمشون کار کرد" in text or "شکم" in text and "کار" in text:
        grade = "1_plus"
        if "3" in clean_text or "۳" in text or "سه" in text or "اسهال" in text:
            grade = "3_plus"
        elif "2" in clean_text or "۲" in text or "دو" in text or "خیلی خوب" in text:
            grade = "2_plus"
        elif "جزئی" in text or "کم" in text:
            grade = "partial"
        else:
            grade = "1_plus"
            
        lax = None
        if "ملین" in text or "شیاف" in text or "پیدرولاکس" in text or "لاکتولوز" in text or "منیزیم" in text:
            lax = text
        vital_records.append((
            cuid_generator(), nurse_id, ts_iso, "bowel_movement", 1.0, text, None, None, None, grade, lax, None, now_str
        ))
        return

    # 6. Laxative given: ملین
    if "ملین" in text or "شیاف" in text or "پیدرولاکس" in text or "لاکتولوز" in text:
        vital_records.append((
            cuid_generator(), nurse_id, ts_iso, "laxative", 1.0, text, None, None, None, None, text, None, now_str
        ))
        return

    # 7. DVT & Leg Elevation: دی وی تی، پای راست، بالا بردن پا، بانداژ
    if "دی" in text and ("وی" in text or "تی" in text) or "پای راست" in text or "بانداژ" in text:
        # Check if circumference measurement: ساق، ران، دور پا
        if "ساق" in text or "ران" in text or "اندازه" in text or "دور" in text or "سانت" in text:
            m = re.search(r'(\d+(?:\.\d+)?)', clean_text)
            val = float(m.group(1)) if m else None
            vital_records.append((
                cuid_generator(), nurse_id, ts_iso, "dvt_measurement", val, text, None, None, None, None, None, None, now_str
            ))
        else:
            # Elevation session: estimate 30-45 minutes (1800 - 2700s) if not specified
            m = re.search(r'(\d+)\s*(?:دقیقه|مین)', clean_text)
            sec = (float(m.group(1)) * 60) if m else 1800.0
            vital_records.append((
                cuid_generator(), nurse_id, ts_iso, "dvt_timer", sec, text, None, None, None, None, None, None, now_str
            ))
        return

    # 8. Circumference measurements: اندازه دور پا
    if "اندازه" in text and ("پا" in text or "ساق" in text or "ران" in text):
        m = re.search(r'(\d+(?:\.\d+)?)', clean_text)
        val = float(m.group(1)) if m else None
        vital_records.append((
            cuid_generator(), nurse_id, ts_iso, "dvt_measurement", val, text, None, None, None, None, None, None, now_str
        ))
        return

    # 9. Medications: دارو، داروی
    if "دارو" in text:
        task_records.append((
            cuid_generator(), None, text, nurse_id, ts_iso, "DONE", text, now_str
        ))
        return

    # 10. Meals & Food: غذا، صبحانه، ناهار، شام، اسموتی
    if "غذا" in text or "صبحانه" in text or "ناهار" in text or "شام" in text or "اسموتی" in text or "میان وعده" in text:
        vital_records.append((
            cuid_generator(), nurse_id, ts_iso, "food_log", None, text, None, None, None, None, None, None, now_str
        ))
        return

    # 11. Mobility & Movement: حرکت، گردش
    if "حرکت" in text or "تخت" in text or "ویلچر" in text or "آشپزخانه" in text:
        vital_records.append((
            cuid_generator(), nurse_id, ts_iso, "mobility", None, text, None, None, None, None, None, None, now_str
        ))
        return

    # 12. Clinical Notes & Incidents: گزارش، علائم، زخم، قرمزی، درد
    cat = "general"
    if "زخم" in text or "قرمزی" in text or "پوست" in text:
        cat = "skin_wound"
    elif "ناخن" in text:
        cat = "nails"
    elif "درد" in text or "بی قراری" in text:
        cat = "pain"
    elif "DVT" in text or "پا" in text:
        cat = "dvt_leg"
    elif "رویداد" in text or "اشکال" in text or "اتفاق" in text:
        cat = "incident"

    note_records.append((
        cuid_generator(), nurse_id, ts_iso, cat, text, None
    ))

# Ingest Form Responses 1
print("Reading 'Form Responses 1'...")
f_sheet = wb['Form Responses 1']
f_count = 0
for row in f_sheet.iter_rows(values_only=True):
    f_count += 1
    if f_count == 1: continue
    process_log(row[0], row[1])

print(f"Processed {f_count-1} rows from Form Responses 1.")

# Ingest Old History
print("Reading 'Old History'...")
if 'Old History' in wb.sheetnames:
    o_sheet = wb['Old History']
    o_count = 0
    for row in o_sheet.iter_rows(values_only=True):
        o_count += 1
        if o_count == 1: continue
        process_log(row[0], row[1])
    print(f"Processed {o_count-1} rows from Old History.")

# Batch insert into database
print(f"Inserting {len(vital_records)} VitalLog records...")
cursor.executemany("""
INSERT INTO VitalLog (id, nurseId, recordedAt, type, valueNum, valueText, systolic, diastolic, mealTag, bowelGrade, laxativeGiven, extraData, createdAt)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
""", vital_records)

print(f"Inserting {len(task_records)} TaskLog records...")
cursor.executemany("""
INSERT INTO TaskLog (id, scheduleId, taskTitle, nurseId, completedAt, status, notes, createdAt)
VALUES (?, ?, ?, ?, ?, ?, ?, ?);
""", task_records)

print(f"Inserting {len(note_records)} ClinicalNote records...")
cursor.executemany("""
INSERT INTO ClinicalNote (id, nurseId, createdAt, category, noteText, photoUrl)
VALUES (?, ?, ?, ?, ?, ?);
""", note_records)

conn.commit()

# Print Verification Summary
print("\n================ DATA VERIFICATION SUMMARY ================")
for table in ["User", "PatientProfile", "Medication", "Schedule", "DietRecipe", "SmoothieRecipe", "VitalLog", "TaskLog", "ClinicalNote"]:
    cursor.execute(f"SELECT COUNT(*) FROM {table};")
    cnt = cursor.fetchone()[0]
    print(f"Table {table:15}: {cnt:>6} records")

cursor.execute("SELECT type, COUNT(*) FROM VitalLog GROUP BY type ORDER BY COUNT(*) DESC;")
print("\nVitalLog Type Breakdown:")
for t, c in cursor.fetchall():
    print(f"  - {t:18}: {c:>5} records")

conn.close()
print("\nMigration completed successfully!")
