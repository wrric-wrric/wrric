import sqlite3

def inspect_all_tables(db_path):
    print(f"\n📂 Inspecting database: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Get all table names
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()

    if not tables:
        print("⚠️ No tables found.")
        return

    for table_name in tables:
        table_name = table_name[0]
        print(f"\n🧱 Schema for table '{table_name}':")
        cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name=?;", (table_name,))
        schema = cursor.fetchone()
        print(schema[0] if schema else "⚠️ Schema not found.")

        print(f"📦 Content of '{table_name}':")
        cursor.execute(f"SELECT * FROM {table_name};")
        rows = cursor.fetchall()

        if not rows:
            print("   (No rows found)")
        else:
            # Print column names
            column_names = [description[0] for description in cursor.description]
            print("   | " + " | ".join(column_names) + " |")
            for row in rows:
                print("   | " + " | ".join(str(cell) for cell in row) + " |")

    conn.close()

# Use raw strings for Windows paths to avoid escape issues
inspect_all_tables(r"C:\Users\Daniel\Documents\UaiAgent\latest_UI\data\scraper.db")
inspect_all_tables(r"C:\Users\Daniel\Documents\UaiAgent\latest_UI\data\crawler.db")
