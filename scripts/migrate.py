import sqlite3
import sys

db_path = sys.argv[1] if len(sys.argv) > 1 else "/home/aria/care-app/data/care.db"
con = sqlite3.connect(db_path)

# Schedule columns
s_cols = [r[1] for r in con.execute("PRAGMA table_info(Schedule)").fetchall()]
if "vitalType" not in s_cols:
    con.execute("ALTER TABLE Schedule ADD COLUMN vitalType TEXT")

# Medication columns
m_cols = [r[1] for r in con.execute("PRAGMA table_info(Medication)").fetchall()]
cols_to_add = [
    ("discontinuedAt", "DATETIME"),
    ("discontinuedReason", "TEXT"),
    ("discontinuedBy", "TEXT"),
    ("replacedById", "TEXT"),
    ("doctorOrderNotes", "TEXT"),
]
for col_name, col_type in cols_to_add:
    if col_name not in m_cols:
        con.execute(f"ALTER TABLE Medication ADD COLUMN {col_name} {col_type}")

# MedicationHistory table
con.execute("""
CREATE TABLE IF NOT EXISTS MedicationHistory (
    id TEXT NOT NULL PRIMARY KEY,
    medicationId TEXT,
    medicationName TEXT NOT NULL,
    actionType TEXT NOT NULL,
    description TEXT NOT NULL,
    reason TEXT,
    doctorName TEXT,
    performedBy TEXT,
    detailsJson TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT MedicationHistory_medicationId_fkey FOREIGN KEY (medicationId) REFERENCES Medication (id) ON DELETE SET NULL ON UPDATE CASCADE
)
""")
con.execute("CREATE INDEX IF NOT EXISTS MedicationHistory_medicationId_idx ON MedicationHistory(medicationId)")
con.execute("CREATE INDEX IF NOT EXISTS MedicationHistory_actionType_idx ON MedicationHistory(actionType)")
con.execute("CREATE INDEX IF NOT EXISTS MedicationHistory_createdAt_idx ON MedicationHistory(createdAt)")

# Backfill if empty
count = con.execute("SELECT COUNT(*) FROM MedicationHistory").fetchone()[0]
if count == 0:
    rows = con.execute("""
        SELECT id, nameFa, doctorName, createdAt, isActive, discontinuedAt, discontinuedReason, discontinuedBy 
        FROM Medication
    """).fetchall()
    for row in rows:
        mid, nameFa, docName, createdAt, isActive, discAt, discReason, discBy = row
        con.execute("""
            INSERT INTO MedicationHistory (id, medicationId, medicationName, actionType, description, doctorName, performedBy, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (f"mh_init_{mid}", mid, nameFa, "CREATED", f"داروی {nameFa} به لیست داروها اضافه شد.", docName, "سرپرست پرونده", createdAt))
        if not isActive or discAt:
            r_text = discReason or "به دستور پزشک معالج"
            d_text = discBy or docName or "پزشک معالج"
            d_date = discAt or createdAt
            con.execute("""
                INSERT INTO MedicationHistory (id, medicationId, medicationName, actionType, description, reason, doctorName, performedBy, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (f"mh_stop_{mid}", mid, nameFa, "STOPPED", f"داروی {nameFa} به علت {r_text} مصرف‌اش متوقف شد.", r_text, d_text, "سرپرست پرونده", d_date))

# MealTimeSlot table
con.execute("""
CREATE TABLE IF NOT EXISTS MealTimeSlot (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    labelFa TEXT NOT NULL,
    defaultTime TEXT NOT NULL,
    isActive BOOLEAN NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)
""")
con.execute("CREATE UNIQUE INDEX IF NOT EXISTS MealTimeSlot_name_key ON MealTimeSlot(name)")

slot_count = con.execute("SELECT COUNT(*) FROM MealTimeSlot").fetchone()[0]
if slot_count == 0:
    default_slots = [
        ("slot_breakfast", "breakfast", "صبحانه", "08:00", 1, 1),
        ("slot_lunch", "lunch", "ناهار", "13:00", 1, 2),
        ("slot_dinner", "dinner", "شام", "20:00", 1, 3),
        ("slot_bedtime", "bedtime", "قبل از خواب", "23:00", 1, 4),
    ]
    for s_id, s_name, s_label, s_time, s_active, s_order in default_slots:
        con.execute("""
            INSERT INTO MealTimeSlot (id, name, labelFa, defaultTime, isActive, "order", createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        """, (s_id, s_name, s_label, s_time, s_active, s_order))

# ActiveTimer table
con.execute("""
CREATE TABLE IF NOT EXISTS ActiveTimer (
    id TEXT NOT NULL PRIMARY KEY,
    timerType TEXT NOT NULL,
    startTime DATETIME NOT NULL,
    scheduleId TEXT,
    taskTitle TEXT DEFAULT 'مراقبت DVT پای راست',
    nurseId TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)
""")

# ---------------------------------------------------------------------------
# Medication restructure: register / activity (prescription) / purchase forms
# ---------------------------------------------------------------------------
import re
import time

FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹"
AR_DIGITS = "٠١٢٣٤٥٦٧٨٩"


def to_en_digits(s):
    s = str(s or "")
    for i, d in enumerate(FA_DIGITS):
        s = s.replace(d, str(i))
    for i, d in enumerate(AR_DIGITS):
        s = s.replace(d, str(i))
    return s


def to_fa_digits(s):
    return "".join(FA_DIGITS[int(c)] if c.isdigit() and c.isascii() else c for c in str(s))


now_ms = int(time.time() * 1000)

# Prescription table
con.execute("""
CREATE TABLE IF NOT EXISTS Prescription (
    id TEXT NOT NULL PRIMARY KEY,
    medicationId TEXT NOT NULL,
    doctorName TEXT,
    prescribedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    isActive BOOLEAN NOT NULL DEFAULT 1,
    endedAt DATETIME,
    endedReason TEXT,
    createdBy TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL,
    CONSTRAINT Prescription_medicationId_fkey FOREIGN KEY (medicationId) REFERENCES Medication (id) ON DELETE CASCADE ON UPDATE CASCADE
)
""")
con.execute("CREATE INDEX IF NOT EXISTS Prescription_medicationId_idx ON Prescription(medicationId)")

# Schedule.prescriptionId
s_cols = [r[1] for r in con.execute("PRAGMA table_info(Schedule)").fetchall()]
if "prescriptionId" not in s_cols:
    con.execute("ALTER TABLE Schedule ADD COLUMN prescriptionId TEXT REFERENCES Prescription(id) ON DELETE SET NULL ON UPDATE CASCADE")

# Backfill medication codes (boxNumber) for medications that have none: sequential max+1,
# active medications first, then by creation date.
existing_codes = [to_en_digits(r[0]).strip() for r in con.execute(
    "SELECT boxNumber FROM Medication WHERE boxNumber IS NOT NULL AND TRIM(boxNumber) != ''"
).fetchall()]
max_code = max([int(c) for c in existing_codes if c.isdigit()] or [0])
uncoded = con.execute(
    "SELECT id FROM Medication WHERE boxNumber IS NULL OR TRIM(boxNumber) = '' ORDER BY isActive DESC, createdAt ASC"
).fetchall()
for (mid,) in uncoded:
    max_code += 1
    con.execute("UPDATE Medication SET boxNumber = ? WHERE id = ?", (str(max_code), mid))
if uncoded:
    print(f"Assigned medication codes to {len(uncoded)} medications.")

# Legacy prescription for every active medication whose active schedules are not linked to a prescription yet.
# The old per-medication doctor + clinical instructions become that prescription's doctor + notes.
legacy_rows = con.execute("""
    SELECT DISTINCT m.id, m.doctorName, m.instructions, m.createdAt
    FROM Medication m
    JOIN Schedule s ON s.medicationId = m.id
    WHERE m.isActive = 1 AND s.isActive = 1 AND s.prescriptionId IS NULL
""").fetchall()
for mid, doc, instr, created in legacy_rows:
    rx_id = f"rx_legacy_{mid}"
    con.execute("""
        INSERT OR IGNORE INTO Prescription (id, medicationId, doctorName, prescribedAt, notes, isActive, createdBy, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
    """, (rx_id, mid, doc, created or now_ms, instr, "انتقال خودکار از نسخه قبلی سیستم", created or now_ms, now_ms))
    con.execute(
        "UPDATE Schedule SET prescriptionId = ? WHERE medicationId = ? AND isActive = 1 AND prescriptionId IS NULL",
        (rx_id, mid),
    )

# Code-first schedule titles: "کد ۱۲ - نام دارو". The linked medication's own "(جعبه X)" is removed and
# prefixed; other medications mentioned in combined titles keep their code as "(کد X)".
BOX_RE = re.compile(r"\s*\(جعبه\s*([0-9۰-۹٠-٩]+)\)")
sched_rows = con.execute("""
    SELECT s.id, s.title, m.boxNumber FROM Schedule s
    JOIN Medication m ON m.id = s.medicationId
    WHERE m.boxNumber IS NOT NULL AND TRIM(m.boxNumber) != ''
""").fetchall()
renamed = 0
for sid, title, code in sched_rows:
    if not title or title.startswith("کد "):
        continue
    own = to_en_digits(code).strip()

    def _sub(match):
        return "" if to_en_digits(match.group(1)) == own else f" (کد {to_fa_digits(to_en_digits(match.group(1)))})"

    new_title = f"کد {to_fa_digits(own)} - {BOX_RE.sub(_sub, title).strip()}"
    con.execute("UPDATE Schedule SET title = ? WHERE id = ?", (new_title, sid))
    renamed += 1
if renamed:
    print(f"Rewrote {renamed} medication schedule titles to code-first format.")

con.commit()
con.close()
print("Database migration completed successfully.")
