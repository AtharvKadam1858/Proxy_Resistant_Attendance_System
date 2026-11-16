"""
⚡ Concurrency & Load Stress Test: 100 Concurrent Students Marking Attendance
Rajarambapu Institute of Technology, Rajaramnagar
"""

import urllib.request
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

SUPABASE_URL = "https://ccvuqarrkinazzyxbxqg.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjdnVxYXJya2luYXp6eXhieHFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3MzEwOTMsImV4cCI6MjExMDMwNzA5M30.Sl1nAdh89pRPDpSJLtB8OEqSSizBWnR4N6EPl6LOOJU"

headers = {
    "apikey": ANON_KEY,
    "Authorization": f"Bearer {ANON_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=ignore-duplicates,return=representation"
}

def supabase_request(endpoint, data=None, method="GET"):
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    encoded = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=encoded, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        content = resp.read().decode("utf-8")
        return json.loads(content) if content else {}

def run_test():
    session_id = f"LOADTEST_100_{int(time.time())}"
    print(f"=== STARTING 100 CONCURRENT STUDENT TEST ===")
    print(f"Test Session ID: {session_id}")

    # 1. Create Active Lecture Session
    session_payload = {
        "session_id": session_id,
        "qr_token": "loadtest-token-12345",
        "teacher_id": "TCH001",
        "subject": "Distributed Systems & Cloud Computing",
        "department": "AIML",
        "year": "Final Year",
        "lat": 16.9455,
        "lng": 74.2412,
        "status": "ACTIVE",
        "classroom_pin": "9999"
    }
    supabase_request("attendance_sessions", session_payload, method="POST")
    print("✓ Created active lecture session in Supabase")

    # 2. Simulate 100 students marking attendance concurrently
    def mark_one_student(i):
        prn = f"LOAD_{2467000 + i}"
        record = {
            "session_id": session_id,
            "teacher_id": "TCH001",
            "student_name": f"Student Batch {i}",
            "prn": prn,
            "subject": "Distributed Systems & Cloud Computing",
            "department": "AIML",
            "year": "Final Year",
            "attendance_date": "2026-11-16",
            "attendance_time": "2026-11-16T12:00:00Z",
            "status": "Present",
            "distance_meters": round(2.0 + (i % 20) * 0.5, 2)
        }
        t0 = time.time()
        try:
            supabase_request("attendance", record, method="POST")
            latency = (time.time() - t0) * 1000
            return (True, latency, None)
        except Exception as e:
            latency = (time.time() - t0) * 1000
            return (False, latency, str(e))

    print("🚀 Launching 100 concurrent attendance requests in parallel...")
    start_total = time.time()
    results = []
    with ThreadPoolExecutor(max_workers=50) as executor:
        futures = [executor.submit(mark_one_student, i) for i in range(1, 101)]
        for f in as_completed(futures):
            results.append(f.result())
    total_time = time.time() - start_total

    successes = [r for r in results if r[0]]
    failures = [r for r in results if not r[0]]
    latencies = [r[1] for r in results]
    avg_latency = sum(latencies) / len(latencies)

    print("\n=== TEST RESULTS ===")
    print(f"Total Requests Dispatched: 100")
    print(f"Successful Marks Recorded: {len(successes)} / 100 ({len(successes)}%)")
    print(f"Failures: {len(failures)}")
    print(f"Total Time for 100 Students: {total_time:.2f} seconds")
    print(f"Average Request Latency: {avg_latency:.1f} ms")
    print(f"Throughput: {100 / total_time:.1f} requests/second")

    # 3. Query back from Supabase to verify records persisted
    records = supabase_request(f"attendance?session_id=eq.{session_id}")
    print(f"Cloud DB Verified Row Count: {len(records)} rows in Supabase")

    # Clean up test rows
    print("🧹 Cleaning up load test session rows...")
    supabase_request(f"attendance?session_id=eq.{session_id}", method="DELETE")
    supabase_request(f"attendance_sessions?session_id=eq.{session_id}", method="DELETE")
    print("✓ Cleanup completed successfully")

if __name__ == "__main__":
    run_test()
