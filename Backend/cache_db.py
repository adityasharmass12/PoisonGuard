import sqlite3
import json
import time

DB_NAME = "scan_cache.db"

def init_db():
    """Initializes the cache database."""
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS scan_results
                 (file_hash TEXT PRIMARY KEY, filename TEXT, file_size INTEGER, 
                  checked_at REAL, total INTEGER, phishing_count INTEGER, 
                  safe_count INTEGER, results_json TEXT)''')
    conn.commit()
    conn.close()

def get_cached_result(file_hash):
    """Retrieves a result from the cache if it exists."""
    try:
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        c.execute("SELECT * FROM scan_results WHERE file_hash=?", (file_hash,))
        row = c.fetchone()
        conn.close()
        
        if row:
            return {
                'file_hash': row[0],
                'filename': row[1],
                'file_size': row[2],
                'checked_at': row[3],
                'total': row[4],
                'phishing_count': row[5],
                'safe_count': row[6],
                'results': json.loads(row[7])
            }
    except Exception as e:
        print(f"Cache Read Error: {e}")
    return None

def store_cached_result(file_hash, filename, file_size, checked_at, total, p_count, s_count, results):
    """Stores a new scan result in the database."""
    try:
        init_db()  # Ensure table exists
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        c.execute('''INSERT OR REPLACE INTO scan_results 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)''', 
                  (file_hash, filename, file_size, checked_at, total, 
                   p_count, s_count, json.dumps(results)))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Cache Store Error: {e}")

# Initialize the DB when this module is first imported
init_db()