import sqlite3
import os

db_path = 'data/ipl.db'
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE predictions ADD COLUMN is_featured BOOLEAN DEFAULT 0;")
        conn.commit()
        print("Database migrated: is_featured column added.")
    except sqlite3.OperationalError:
        print("Column is_featured already exists.")
    finally:
        conn.close()
else:
    print("Database file doesn't exist yet. It will be created with the new schema.")
