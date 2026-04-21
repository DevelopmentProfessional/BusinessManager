# This script reads an .ics file, adds 2 hours to all DTSTART times (except all-day events), and writes a new .ics file.
import re
from datetime import datetime, timedelta

INPUT_FILE = r"c:\Users\ISDP19659\Downloads\Jamaica 2026_dpinto005@gmail.com.ics"
OUTPUT_FILE = r"c:\Users\ISDP19659\Downloads\Jamaica 2026_dpinto005_shifted.ics"

# Regex for DTSTART/DTEND with time (not all-day)
time_pattern = re.compile(r"^(DTSTART(?:;TZID=[^:]+)?):(\d{8}T\d{4,6})(Z?)$", re.MULTILINE)

def shift_time(match):
    prefix, dtstr, z = match.groups()
    # Parse datetime
    if len(dtstr) == 15:  # DTSTART;TZID=...:YYYYMMDDTHHMMSS
        dt = datetime.strptime(dtstr, "%Y%m%dT%H%M%S")
        new_dt = dt + timedelta(hours=2)
        new_dtstr = new_dt.strftime("%Y%m%dT%H%M%S")
    else:  # DTSTART:YYYYMMDDTHHMMZ or DTSTART:YYYYMMDDTHHMM
        dt = datetime.strptime(dtstr, "%Y%m%dT%H%M%S" if len(dtstr) == 15 else "%Y%m%dT%H%M")
        new_dt = dt + timedelta(hours=2)
        new_dtstr = new_dt.strftime("%Y%m%dT%H%M%S" if len(dtstr) == 15 else "%Y%m%dT%H%M")
    return f"{prefix}:{new_dtstr}{z}"

with open(INPUT_FILE, "r", encoding="utf-8") as f:
    content = f.read()

# Only shift DTSTART/DTEND with time, not all-day events (which have ;VALUE=DATE)
content = time_pattern.sub(shift_time, content)

with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    f.write(content)

print(f"Shifted calendar saved to {OUTPUT_FILE}")
