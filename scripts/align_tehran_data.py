import sqlite3
import datetime
import os
import zoneinfo

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data', 'care.db'))
PRISMA_DB = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'prisma', 'care.db'))

tz_tehran = zoneinfo.ZoneInfo("Asia/Tehran")
now_tehran = datetime.datetime.now(tz_tehran)
now_utc = now_tehran.astimezone(datetime.timezone.utc)
now_ms = int(now_utc.timestamp() * 1000)
tehran_time_str = now_tehran.strftime("%H:%M")

print(f"Aligning data for database: {DB_PATH}")
print(f"Current Tehran time: {now_tehran.strftime('%Y-%m-%d %H:%M:%S')} ({tehran_time_str})")
print(f"Current UTC epoch ms: {now_ms}")

def to_ms(val):
    if val is None:
        return None
    if isinstance(val, int):
        return val
    if isinstance(val, str):
        val_clean = val.replace('Z', '').strip()
        try:
            if '.' in val_clean:
                dt = datetime.datetime.fromisoformat(val_clean)
            else:
                dt = datetime.datetime.strptime(val_clean[:19], '%Y-%m-%dT%H:%M:%S')
            dt = dt.replace(tzinfo=datetime.timezone.utc)
            return int(dt.timestamp() * 1000)
        except Exception:
            return None
    return None

def process_db(path):
    if not os.path.exists(path):
        return
    print(f"\nProcessing {path}...")
    conn = sqlite3.connect(path)
    c = conn.cursor()

    # 1. Convert all text dates to integer milliseconds
    for table, cols in [
        ('VitalLog', ['recordedAt', 'createdAt']),
        ('TaskLog', ['completedAt', 'createdAt']),
        ('ClinicalNote', ['createdAt']),
        ('User', ['createdAt', 'updatedAt']),
        ('Medication', ['createdAt', 'updatedAt']),
        ('Schedule', ['createdAt', 'updatedAt']),
        ('DietRecipe', ['createdAt', 'updatedAt']),
        ('SmoothieRecipe', ['createdAt', 'updatedAt']),
        ('PatientProfile', ['updatedAt']),
    ]:
        c.execute(f"SELECT id, {', '.join(cols)} FROM {table}")
        rows = c.fetchall()
        updates = []
        for r in rows:
            row_id = r[0]
            new_vals = [to_ms(v) for v in r[1:]]
            updates.append((*new_vals, row_id))
        
        set_clause = ", ".join([f"{col} = ?" for col in cols])
        c.executemany(f"UPDATE {table} SET {set_clause} WHERE id = ?", updates)
        print(f"  Converted {len(updates)} rows in {table} to integer ms.")

    # 2. Shift historical records so latest record ends at `now_ms`
    c.execute("SELECT MAX(recordedAt) FROM VitalLog")
    max_vital_ms = c.fetchone()[0]
    print(f"  Max historical vital timestamp: {max_vital_ms}")

    if max_vital_ms and max_vital_ms < now_ms:
        delta_ms = now_ms - max_vital_ms
        print(f"  Shifting historical records by +{delta_ms / (1000*3600*24):.1f} days to align with today...")
        c.execute("UPDATE VitalLog SET recordedAt = recordedAt + ?, createdAt = createdAt + ?", (delta_ms, delta_ms))
        c.execute("UPDATE TaskLog SET completedAt = completedAt + ?, createdAt = createdAt + ?", (delta_ms, delta_ms))
        c.execute("UPDATE ClinicalNote SET createdAt = createdAt + ?", (delta_ms,))

    # 3. DELETE anything after now
    print("  Deleting any records after now...")
    c.execute("DELETE FROM VitalLog WHERE recordedAt > ?", (now_ms,))
    deleted_vitals = c.rowcount
    c.execute("DELETE FROM TaskLog WHERE completedAt > ?", (now_ms,))
    deleted_tasks = c.rowcount
    c.execute("DELETE FROM ClinicalNote WHERE createdAt > ?", (now_ms,))
    deleted_notes = c.rowcount
    print(f"  Deleted future records: {deleted_vitals} vitals, {deleted_tasks} tasks, {deleted_notes} notes.")

    # 4. Check everything before now for today as DONE
    print(f"  Marking all today's routine tasks before {tehran_time_str} as DONE...")
    c.execute("SELECT id FROM User WHERE role = 'NURSE' LIMIT 1")
    nurse_id = c.fetchone()[0]

    # Today in Tehran: start of day (00:00:00)
    today_tehran_start = now_tehran.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start_utc_ms = int(today_tehran_start.astimezone(datetime.timezone.utc).timestamp() * 1000)

    c.execute("SELECT id, title, targetTime FROM Schedule WHERE isActive = 1 ORDER BY targetTime ASC")
    schedules = c.fetchall()

    checked_done_count = 0
    import uuid

    for sched_id, title, target_time in schedules:
        if target_time <= tehran_time_str:
            # Check if task log already exists for this schedule today
            c.execute("SELECT COUNT(*) FROM TaskLog WHERE scheduleId = ? AND completedAt >= ?", (sched_id, today_start_utc_ms))
            exists = c.fetchone()[0] > 0
            if not exists:
                # Compute timestamp for this schedule time today in Tehran
                hh, mm = map(int, target_time.split(':'))
                task_dt_tehran = today_tehran_start.replace(hour=hh, minute=mm)
                task_ms = int(task_dt_tehran.astimezone(datetime.timezone.utc).timestamp() * 1000)

                # Ensure task_ms <= now_ms
                if task_ms > now_ms:
                    task_ms = now_ms

                c.execute("""
                INSERT INTO TaskLog (id, scheduleId, taskTitle, nurseId, completedAt, status, notes, createdAt)
                VALUES (?, ?, ?, ?, ?, 'DONE', 'تکمیل روتین پای تخت', ?);
                """, (f"task_{uuid.uuid4().hex[:16]}", sched_id, title, nurse_id, task_ms, task_ms))
                checked_done_count += 1
                print(f"    ✓ Marked as DONE: {target_time} - {title}")
        else:
            print(f"    ⏳ Kept PENDING (after now): {target_time} - {title}")

    print(f"  Marked {checked_done_count} routine tasks before now as DONE.")

    conn.commit()
    conn.close()
    print(f"Finished processing {path}.\n")

process_db(DB_PATH)
process_db(PRISMA_DB)
print("Data alignment and cleanup complete!")
