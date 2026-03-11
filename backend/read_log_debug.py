
import os

log_file = r"c:\Users\stannoh\Desktop\myprojects\wrric\wrric system\backend\server_log.txt"

try:
    with open(log_file, "r", encoding="utf-16le") as f:
        content = f.read()
        # Print the last 2000 characters
        print(content[-5000:])
except Exception as e:
    print(f"Error reading file {log_file}: {e}")
    try:
        # Fallback to utf-8 if utf-16le fails
        with open(log_file, "r", encoding="utf-8") as f:
            content = f.read()
            print(content[-5000:])
    except Exception as e2:
        print(f"Error reading file with utf-8: {e2}")
