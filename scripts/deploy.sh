#!/bin/bash
set -e

SERVER="nova"
REMOTE_DIR="/home/aria/care-app"
OLD_DIR="/home/aria/care-task-management"

echo "=== 1. Tearing down old application on $SERVER ==="
ssh $SERVER "if [ -d $OLD_DIR ]; then cd $OLD_DIR && docker compose down || true; fi"

echo "=== 2. Creating remote application directories and DB backup ==="
ssh $SERVER "mkdir -p $REMOTE_DIR/data $REMOTE_DIR/uploads && if [ -f $REMOTE_DIR/data/care.db ]; then cp $REMOTE_DIR/data/care.db $REMOTE_DIR/data/care.db.bak_\$(date +%Y%m%d_%H%M%S); fi"

echo "=== 3. Syncing application codebase to $SERVER ==="
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  --exclude 'data' \
  --exclude 'uploads' \
  ./ $SERVER:$REMOTE_DIR/

# Ensure database exists in data/care.db on server and permissions are open for container
ssh $SERVER "if [ ! -f $REMOTE_DIR/data/care.db ] && [ -f $REMOTE_DIR/prisma/care.db ]; then cp $REMOTE_DIR/prisma/care.db $REMOTE_DIR/data/care.db; fi"
ssh $SERVER "python3 -c \"import sqlite3; con=sqlite3.connect('$REMOTE_DIR/data/care.db'); \
s_cols=[r[1] for r in con.execute('PRAGMA table_info(Schedule)').fetchall()]; \
('vitalType' in s_cols) or con.execute('ALTER TABLE Schedule ADD COLUMN vitalType TEXT'); \
m_cols=[r[1] for r in con.execute('PRAGMA table_info(Medication)').fetchall()]; \
('discontinuedAt' in m_cols) or con.execute('ALTER TABLE Medication ADD COLUMN discontinuedAt DATETIME'); \
('discontinuedReason' in m_cols) or con.execute('ALTER TABLE Medication ADD COLUMN discontinuedReason TEXT'); \
('discontinuedBy' in m_cols) or con.execute('ALTER TABLE Medication ADD COLUMN discontinuedBy TEXT'); \
('replacedById' in m_cols) or con.execute('ALTER TABLE Medication ADD COLUMN replacedById TEXT'); \
('doctorOrderNotes' in m_cols) or con.execute('ALTER TABLE Medication ADD COLUMN doctorOrderNotes TEXT'); \
con.execute('''CREATE TABLE IF NOT EXISTS MedicationHistory ( \
    id TEXT NOT NULL PRIMARY KEY, \
    medicationId TEXT, \
    medicationName TEXT NOT NULL, \
    actionType TEXT NOT NULL, \
    description TEXT NOT NULL, \
    reason TEXT, \
    doctorName TEXT, \
    performedBy TEXT, \
    detailsJson TEXT, \
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, \
    CONSTRAINT MedicationHistory_medicationId_fkey FOREIGN KEY (medicationId) REFERENCES Medication (id) ON DELETE SET NULL ON UPDATE CASCADE \
)'''); \
con.execute('CREATE INDEX IF NOT EXISTS MedicationHistory_medicationId_idx ON MedicationHistory(medicationId)'); \
con.execute('CREATE INDEX IF NOT EXISTS MedicationHistory_actionType_idx ON MedicationHistory(actionType)'); \
con.execute('CREATE INDEX IF NOT EXISTS MedicationHistory_createdAt_idx ON MedicationHistory(createdAt)'); \
if con.execute('SELECT COUNT(*) FROM MedicationHistory').fetchone()[0] == 0: \
    for row in con.execute('SELECT id, nameFa, doctorName, createdAt, isActive, discontinuedAt, discontinuedReason, discontinuedBy FROM Medication').fetchall(): \
        mid, nameFa, docName, createdAt, isActive, discAt, discReason, discBy = row; \
        con.execute('INSERT INTO MedicationHistory (id, medicationId, medicationName, actionType, description, doctorName, performedBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ('mh_init_' + mid, mid, nameFa, 'CREATED', 'داروی ' + nameFa + ' به لیست داروها اضافه شد.', docName, 'سرپرست پرونده', createdAt)); \
        if (not isActive) or discAt: \
            rText = discReason or 'به دستور پزشک معالج'; \
            dText = discBy or docName or 'پزشک معالج'; \
            dDate = discAt or createdAt; \
            con.execute('INSERT INTO MedicationHistory (id, medicationId, medicationName, actionType, description, reason, doctorName, performedBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', ('mh_stop_' + mid, mid, nameFa, 'STOPPED', 'داروی ' + nameFa + ' به علت ' + rText + ' مصرف‌اش متوقف شد.', rText, dText, 'سرپرست پرونده', dDate)); \
con.commit()\""
ssh $SERVER "sudo chmod -R 777 $REMOTE_DIR/data $REMOTE_DIR/uploads"

echo "=== 4. Updating Nginx configuration for care.kori.rest ==="
ssh $SERVER "sudo cp $REMOTE_DIR/deploy/care.kori.rest.conf /etc/nginx/sites-available/care.kori.rest"
ssh $SERVER "sudo ln -sf /etc/nginx/sites-available/care.kori.rest /etc/nginx/sites-enabled/care.kori.rest"
ssh $SERVER "sudo nginx -t && sudo systemctl reload nginx"

echo "=== 5. Building and deploying Docker containers on $SERVER ==="
ssh $SERVER "cd $REMOTE_DIR && docker compose down || true && docker compose up -d --build"

echo "=== 6. Waiting for application health check ==="
sleep 15
ssh $SERVER "docker compose -f $REMOTE_DIR/docker-compose.yml ps"
ssh $SERVER "curl -s -f http://127.0.0.1:8080/api/health || exit 1"

echo "=== Deployment to $SERVER completed successfully! ==="
