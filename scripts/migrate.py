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

con.commit()
con.close()
print("Database migration completed successfully.")
