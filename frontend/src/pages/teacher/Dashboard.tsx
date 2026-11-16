import { useEffect, useState, useRef } from "react";
import "../../styles/dashboard.css";
import { useNavigate } from "react-router-dom";
import RITLogo from "../../assets/RIT_logo.jpeg";
import { API_URL } from "../../config";
import {
  getTeacherProfile,
  startAttendanceSession,
  refreshAttendanceSession,
  stopAttendanceSession,
  getLiveAttendance,
  updateUserPassword,
} from "../../services/supabase";

const departmentSubjects: {
  [department: string]: {
    [year: string]: string[];
  };
} = {
  AIML: {
    "First Year": [
      "Engineering Mathematics",
      "Programming in C",
      "Engineering Physics",
      "Engineering Chemistry",
      "Basic Electronics"
    ],
    "Second Year": [
      "Data Structures",
      "Object Oriented Programming",
      "DBMS",
      "Discrete Mathematics",
      "Computer Organization"
    ],
    "Third Year": [
      "Machine Learning",
      "Operating Systems",
      "Computer Networks",
      "Software Engineering",
      "Theory of Computation"
    ],
    "Final Year": [
      "Deep Learning",
      "Artificial Intelligence",
      "Cloud Computing",
      "Big Data Analytics",
      "Natural Language Processing"
    ]
  },

  CSE: {
    "First Year": [
      "Engineering Mathematics",
      "Programming in C",
      "Physics"
    ],
    "Second Year": [
      "Java",
      "DBMS",
      "Data Structures"
    ],
    "Third Year": [
      "Operating Systems",
      "Computer Networks",
      "Software Engineering"
    ],
    "Final Year": [
      "Cloud Computing",
      "Cyber Security",
      "Big Data"
    ]
  }
};

const theoryTimeSlots = [
  "10:00 AM to 11:00 AM",
  "11:00 AM to 12:00 PM",
  "12:45 PM to 1:45 PM",
  "1:45 PM to 2:45 PM",
  "3:00 PM to 4:00 PM",
  "4:00 PM to 5:00 PM"
];

const labTimeSlots = [
  "10:00 AM to 12:00 PM",
  "12:45 PM to 2:45 PM",
  "3:00 PM to 5:00 PM"
];

export default function Dashboard() {
  const [teacher, setTeacher] = useState<any>(null);

  // Teacher Password & Auth State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [teacherNewPass, setTeacherNewPass] = useState("");
  const [teacherConfirmPass, setTeacherConfirmPass] = useState("");
  const [teacherPassMsg, setTeacherPassMsg] = useState("");
  const [teacherPassLoading, setTeacherPassLoading] = useState(false);

  const [attendanceActive, setAttendanceActive] =
    useState(false);

  const [sessionId, setSessionId] = useState("");
  const [qrToken, setQrToken] = useState("");
  const [classroomPin, setClassroomPin] = useState("");

  const [liveAttendance, setLiveAttendance] =
    useState<any[]>([]);
  const [rosterSearch, setRosterSearch] = useState("");
  const prevCountRef = useRef(0);

  // 🔔 Subtle Faculty Notification Chime when a student marks attendance live
  const playAttendeeChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch {}
  };

  const [sessionInfo, setSessionInfo] =
    useState<any>(null);

  const [selectedDepartment, setSelectedDepartment] =
    useState("");

  const [selectedYear, setSelectedYear] =
    useState("");

  const [selectedSubject, setSelectedSubject] =
    useState("");

  // NEW
  const [sessionType, setSessionType] =
    useState("");

  // NEW
  const [selectedTimeSlot, setSelectedTimeSlot] =
    useState("");

  // 📍 Geofencing Radius (Default 350m: accounts for Laptop Wi-Fi vs Smartphone GPS offset)
  const [geofenceRadius, setGeofenceRadius] = useState<number>(350);

  // 📍 Real-Time Classroom Geolocation & Transmitter State
  const [teacherCoords, setTeacherCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('requesting');
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [locationErrorMsg, setLocationErrorMsg] = useState("");

  // Proactive Teacher Location Acquisition (Dual-tier GPS + Wi-Fi Positioning)
  const acquireTeacherLocation = (isManualClick = false) => {
    if (!navigator.geolocation) {
      setLocationStatus('denied');
      setLocationErrorMsg("Geolocation is not supported by your browser.");
      return;
    }

    setLocationStatus('requesting');
    setLocationErrorMsg("");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setTeacherCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationAccuracy(Math.round(pos.coords.accuracy));
        setLocationStatus('granted');
        setLocationErrorMsg("");
      },
      (err) => {
        console.warn("High-accuracy location error on laptop, retrying Wi-Fi / standard mode:", err);
        navigator.geolocation.getCurrentPosition(
          (fallbackPos) => {
            setTeacherCoords({ lat: fallbackPos.coords.latitude, lng: fallbackPos.coords.longitude });
            setLocationAccuracy(Math.round(fallbackPos.coords.accuracy));
            setLocationStatus('granted');
            setLocationErrorMsg("");
          },
          (fallbackErr) => {
            console.warn("Fallback location error:", fallbackErr);
            setLocationStatus('denied');
            if (fallbackErr.code === 1) {
              setLocationErrorMsg("Location access was blocked. Please click the lock 🔒 icon in the browser address bar to allow location.");
            } else if (fallbackErr.code === 2) {
              setLocationErrorMsg("Location unavailable. If using a Windows laptop, enable 'Location Services' in Windows Settings > Privacy.");
            } else {
              setLocationErrorMsg("Location request timed out. Please try refreshing.");
            }
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
        );
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
    );
  };

  const useCampusPreset = () => {
    // Official Rajarambapu Institute of Technology (RIT), Rajaramnagar Coordinates
    setTeacherCoords({ lat: 16.9798, lng: 74.2882 });
    setLocationAccuracy(20);
    setLocationStatus('granted');
    setLocationErrorMsg("");
  };

  const intervalRef = useRef<any>(null);
  const liveIntervalRef = useRef<any>(null);

  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem("role") !== "teacher") {
      window.location.href = "/";
      return;
    }

    const teacherId =
      localStorage.getItem("teacher_id");

    if (teacherId) {
      getTeacherProfile(teacherId)
        .then((profile) => {
          if (profile) {
            setTeacher(profile);
          } else {
            return fetch(`${API_URL}/teacher/profile/${teacherId}`)
              .then((res) => res.json())
              .then((data) => setTeacher(data));
          }
        })
        .catch((err) => {
          console.error("Failed to load teacher profile:", err);
        });
    }

    // Proactively acquire teacher location upon opening the dashboard
    acquireTeacherLocation(false);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      if (liveIntervalRef.current) {
        clearInterval(liveIntervalRef.current);
      }
    };
  }, []);

  const startSession = async () => {
    if (
      !selectedDepartment ||
      !selectedYear ||
      !selectedSubject ||
      !sessionType ||
      !selectedTimeSlot
    ) {
      alert(
        "⚠ Please select department, year, subject, theory/lab and time slot"
      );
      return;
    }

    let lat = teacherCoords?.lat;
    let lng = teacherCoords?.lng;

    if (lat === undefined || lng === undefined) {
      try {
        setLocationStatus('requesting');
        const pos: any = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 60000,
          });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        setTeacherCoords({ lat, lng });
        setLocationAccuracy(Math.round(pos.coords.accuracy));
        setLocationStatus('granted');
      } catch {
        try {
          const fallbackPos: any = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: false,
              timeout: 6000,
              maximumAge: 300000,
            });
          });
          lat = fallbackPos.coords.latitude;
          lng = fallbackPos.coords.longitude;
          setTeacherCoords({ lat, lng });
          setLocationAccuracy(Math.round(fallbackPos.coords.accuracy));
          setLocationStatus('granted');
        } catch {
          const usePreset = window.confirm(
            "📍 Laptop GPS / Wi-Fi Location not detected (Windows location services may be off or blocked in browser).\n\nWould you like to use the official RIT Campus Lecture Hall coordinates (16.9798° N, 74.2882° E) for classroom proximity verification?"
          );
          if (usePreset) {
            lat = 16.9798;
            lng = 74.2882;
            setTeacherCoords({ lat, lng });
            setLocationAccuracy(25);
            setLocationStatus('granted');
          } else {
            alert("❌ Location permission is required so students in your classroom can be verified.");
            setLocationStatus('denied');
            return;
          }
        }
      }
    }

    try {
      const teacherId =
        localStorage.getItem("teacher_id");

      if (!teacherId) {
        alert(
          "❌ Teacher ID not found. Please login again."
        );
        return;
      }

      let currentSession = "";
      let currentQrToken = "";

      try {
        const result = await startAttendanceSession({
          teacher_id: teacherId,
          department: selectedDepartment,
          year: selectedYear,
          subject: selectedSubject,
          lat,
          lng,
          geofence_radius: geofenceRadius,
        });
        currentSession = result.session_id;
        currentQrToken = result.qr_token;
        if (result.classroom_pin) {
          setClassroomPin(result.classroom_pin);
        }
      } catch (cloudErr) {
        console.warn("Direct Supabase start session fallback to API:", cloudErr);
        const response = await fetch(`${API_URL}/attendance/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teacher_id: teacherId,
            department: selectedDepartment,
            year: selectedYear,
            subject: selectedSubject,
            session_type: sessionType,
            time_slot: selectedTimeSlot,
            lat,
            lng,
          }),
        });
        const result = await response.json();
        if (!result.success) {
          alert(result.message || "Failed to start attendance");
          return;
        }
        currentSession = result.session_id;
        currentQrToken = result.qr_token;
      }

          setSessionId(currentSession);
          setQrToken(currentQrToken);

          setSessionInfo({
            subject: selectedSubject,
            department: selectedDepartment,
            year: selectedYear,
            session_type: sessionType,
            time_slot: selectedTimeSlot,
            start_time: new Date().toLocaleTimeString(),
          });

          intervalRef.current = setInterval(async () => {
            try {
              const data = await refreshAttendanceSession(currentSession);
              if (data && data.qr_token) {
                currentQrToken = data.qr_token;
                setQrToken(data.qr_token);
              }
            } catch (err) {
              try {
                const res = await fetch(`${API_URL}/attendance/refresh`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ session_id: currentSession }),
                });
                const data = await res.json();
                if (data && data.qr_token) {
                  currentQrToken = data.qr_token;
                  setQrToken(data.qr_token);
                }
              } catch (refreshErr) {
                console.error("Refresh Error:", refreshErr);
              }
            }
          }, 8000);

          setAttendanceActive(true);
          setLiveAttendance([]);

          liveIntervalRef.current = setInterval(async () => {
            try {
              const data = await getLiveAttendance(currentSession);
              if (data && data.success) {
                if (data.session) {
                  setSessionInfo(data.session);
                }
                const newStudents = data.students || data.attendance || [];
                if (newStudents.length > prevCountRef.current && prevCountRef.current > 0) {
                  playAttendeeChime();
                }
                prevCountRef.current = newStudents.length;
                setLiveAttendance(newStudents);
              }
            } catch (err) {
              try {
                const res = await fetch(`${API_URL}/attendance/live/${currentSession}`);
                if (res.ok) {
                  const data = await res.json();
                  if (data.success) {
                    setSessionInfo(data.session);
                    const newStudents = data.students || [];
                    if (newStudents.length > prevCountRef.current && prevCountRef.current > 0) {
                      playAttendeeChime();
                    }
                    prevCountRef.current = newStudents.length;
                    setLiveAttendance(newStudents);
                  }
                }
              } catch {}
            }
          }, 2000);
        } catch (err) {
          console.error(err);
          alert("❌ Failed to start attendance");
        }
  };

  const stopSession = async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (liveIntervalRef.current) {
      clearInterval(liveIntervalRef.current);
      liveIntervalRef.current = null;
    }

    try {
      if (sessionId && sessionId !== "SESSION_ENDED") {
        await stopAttendanceSession(sessionId);
      }
    } catch {
      try {
        await fetch(`${API_URL}/attendance/stop`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId })
        });
      } catch (err) {
        console.log(err);
      }
    }

    setLiveAttendance([]);
    setAttendanceActive(false);
    setSessionInfo(null);
    setQrToken("");
    setSessionId("SESSION_ENDED");
  };

  const exportLiveAttendanceCSV = () => {
    if (liveAttendance.length === 0) {
      alert("No attendance records to export yet.");
      return;
    }
    const headers = ["PRN", "Student Name", "Attendance Time", "Status"];
    const rows = liveAttendance.map((s: any) => [
      `"${s.prn || ""}"`,
      `"${s.student_name || ""}"`,
      `"${s.attendance_time || ""}"`,
      `"${s.status || "Present"}"`,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `live_attendance_${selectedSubject || "session"}_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleSession = () => {
    if (!attendanceActive) {
      startSession();
    } else {
      stopSession();
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/";
  };

  const handleTeacherPasswordChange = async () => {
    const teacherId = localStorage.getItem("teacher_id") || teacher?.teacher_id;
    if (!teacherId) return;
    if (!teacherNewPass || teacherNewPass.length < 6) {
      setTeacherPassMsg("❌ Password must be at least 6 characters long.");
      return;
    }
    if (teacherNewPass !== teacherConfirmPass) {
      setTeacherPassMsg("❌ Passwords do not match.");
      return;
    }
    try {
      setTeacherPassLoading(true);
      setTeacherPassMsg("");
      await updateUserPassword("teacher", teacherId, teacherNewPass);
      setTeacherPassMsg("✅ Password updated successfully!");
      setTeacherNewPass("");
      setTeacherConfirmPass("");
      setTimeout(() => setShowPasswordModal(false), 1500);
    } catch (e: any) {
      setTeacherPassMsg("❌ " + (e?.message || "Failed to update password."));
    } finally {
      setTeacherPassLoading(false);
    }
  };

  return (
    <>
      <header
        className="dashboard-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <img src={RITLogo} alt="RIT Logo" className="dashboard-rit-logo" />
          <h1 style={{ margin: 0, fontSize: "20px" }}>
            Proxy-Resistant Smart Attendance System
          </h1>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setShowPasswordModal(true)}
            style={{
              background: "#ffffff",
              color: "#111827",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              padding: "7px 12px",
              fontSize: "12px",
              fontWeight: "700",
              cursor: "pointer",
              width: "auto",
              minHeight: "auto",
              margin: 0,
            }}
          >
            🔒 Change Password
          </button>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              background: "#ef4444",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "7px 12px",
              fontSize: "12px",
              fontWeight: "700",
              cursor: "pointer",
              width: "auto",
              minHeight: "auto",
              margin: 0,
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <div className="container">

        {/* LEFT CARD */}
        <div className="card">

          <h2>
            Welcome,
            <br />
            {teacher?.full_name || "Teacher"}
          </h2>

          <p>{teacher?.designation}</p>

          <p>{teacher?.department}</p>

          {/* DEPARTMENT */}
          <label>Select Department</label>

          <select
            value={selectedDepartment}
            disabled={attendanceActive}
            onChange={(e) => {
              setSelectedDepartment(
                e.target.value
              );

              setSelectedYear("");
              setSelectedSubject("");
            }}
          >
            <option value="">
              Select Department
            </option>

            <option value="AIML">
              AIML
            </option>

            <option value="CSE">
              CSE
            </option>
          </select>

          {/* YEAR */}
          <label>Select Year</label>

          <select
            value={selectedYear}
            disabled={
              !selectedDepartment ||
              attendanceActive
            }
            onChange={(e) => {
              setSelectedYear(
                e.target.value
              );

              setSelectedSubject("");
            }}
          >
            <option value="">
              Select Year
            </option>

            <option value="First Year">
              First Year
            </option>

            <option value="Second Year">
              Second Year
            </option>

            <option value="Third Year">
              Third Year
            </option>

            <option value="Final Year">
              Final Year
            </option>
          </select>

          {/* SUBJECT */}
          <label>Select Subject</label>

          <select
            value={selectedSubject}
            disabled={
              !selectedYear ||
              attendanceActive
            }
            onChange={(e) =>
              setSelectedSubject(
                e.target.value
              )
            }
          >
            <option value="">
              Select Subject
            </option>

            {(
              departmentSubjects[
                selectedDepartment
              ]?.[selectedYear] || []
            ).map((subject) => (
              <option
                key={subject}
                value={subject}
              >
                {subject}
              </option>
            ))}
          </select>

          {/* THEORY / LAB */}
          <label>
            Select Lecture Type
          </label>

          <select
            value={sessionType}
            disabled={attendanceActive}
            onChange={(e) => {
              setSessionType(
                e.target.value
              );

              // Reset time whenever
              // Theory/Lab changes
              setSelectedTimeSlot("");
            }}
          >
            <option value="">
              Select Theory / Lab
            </option>

            <option value="Theory">
              Theory
            </option>

            <option value="Lab">
              Lab
            </option>
          </select>

          {/* TIME SLOT */}
          <label>
            Select Time Slot
          </label>

          <select
            value={selectedTimeSlot}
            disabled={
              !sessionType ||
              attendanceActive
            }
            onChange={(e) =>
              setSelectedTimeSlot(
                e.target.value
              )
            }
          >
            <option value="">
              Select Time Slot
            </option>

            {sessionType === "Theory" &&
              theoryTimeSlots.map(
                (slot) => (
                  <option
                    key={slot}
                    value={slot}
                  >
                    {slot}
                  </option>
                )
              )}

            {sessionType === "Lab" &&
              labTimeSlots.map(
                (slot) => (
                  <option
                    key={slot}
                    value={slot}
                  >
                    {slot}
                  </option>
                )
              )}
          </select>

          {/* 📍 Classroom Geofencing Mode (Default: 350m Laptop & Mobile Sync) */}
          <div style={{ margin: "14px 0 10px 0", textAlign: "left" }}>
            <label style={{ fontSize: "12px", fontWeight: "750", color: "#374151", display: "block", marginBottom: "4px" }}>
              📍 Classroom Geofencing Mode
            </label>
            <select
              value={geofenceRadius}
              onChange={(e) => setGeofenceRadius(Number(e.target.value))}
              disabled={attendanceActive}
              style={{ width: "100%", padding: "9px 10px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "13px", boxSizing: "border-box" }}
            >
              <option value={350}>🏢 Campus Building & Laptop Wi-Fi (350m - Recommended)</option>
              <option value={500}>🏫 Wide Campus & Lecture Hall (500m)</option>
              <option value={100}>🔒 Strict GPS Geofence (100m)</option>
              <option value={0}>🌐 Flexible / Testing Demo Mode (No Distance Limit)</option>
            </select>
            <span style={{ fontSize: "11px", color: "#6b7280", display: "block", marginTop: "3px" }}>
              {geofenceRadius === 0
                ? "Bypasses distance verification for remote testing / demos."
                : `Allows up to ${geofenceRadius}m to bridge laptop Wi-Fi with phone GPS.`}
            </span>
          </div>

          {/* 📍 Classroom Geolocation Transmitter Card */}
          <div
            style={{
              background: locationStatus === "granted" ? "#f0fdf4" : locationStatus === "requesting" ? "#fefce8" : "#fef2f2",
              border: `1px solid ${locationStatus === "granted" ? "#86efac" : locationStatus === "requesting" ? "#fde047" : "#fca5a5"}`,
              borderRadius: "10px",
              padding: "12px 14px",
              margin: "12px 0 16px 0",
              textAlign: "left"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "13px", color: locationStatus === "granted" ? "#166534" : locationStatus === "requesting" ? "#854d0e" : "#991b1b" }}>
                  {locationStatus === "granted"
                    ? "🟢 Classroom GPS Locked & Transmitting"
                    : locationStatus === "requesting"
                    ? "🟡 Requesting Laptop GPS Location..."
                    : "🔴 Location Permission Required on Laptop"}
                </div>
                <div style={{ fontSize: "11px", color: "#4b5563", marginTop: "3px", lineHeight: "1.4" }}>
                  {locationStatus === "granted"
                    ? `Coordinates: ${teacherCoords?.lat.toFixed(4)}° N, ${teacherCoords?.lng.toFixed(4)}° E (Accuracy: ±${locationAccuracy || 20}m). Radius: ${geofenceRadius}m.`
                    : locationErrorMsg || "Allow browser location so students in your room can be validated."}
                </div>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                {locationStatus !== "granted" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => acquireTeacherLocation(true)}
                      style={{
                        background: "#2563eb",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        padding: "6px 12px",
                        fontSize: "12px",
                        fontWeight: 650,
                        cursor: "pointer"
                      }}
                    >
                      📍 Allow / Refresh
                    </button>
                    <button
                      type="button"
                      onClick={useCampusPreset}
                      style={{
                        background: "#10b981",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        padding: "6px 12px",
                        fontSize: "12px",
                        fontWeight: 650,
                        cursor: "pointer"
                      }}
                    >
                      🏫 Use RIT Coords
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => acquireTeacherLocation(true)}
                    style={{
                      background: "#e5e7eb",
                      color: "#374151",
                      border: "none",
                      borderRadius: "6px",
                      padding: "5px 10px",
                      fontSize: "11px",
                      cursor: "pointer"
                    }}
                  >
                    🔄 Refresh GPS
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* START / STOP */}
          <button
            onClick={toggleSession}
          >
            {attendanceActive
              ? "Stop Attendance"
              : "Start Attendance"}
          </button>

          <div className="status-box">
            <p>
              <strong>Status:</strong>{" "}
              {attendanceActive
                ? "Active"
                : "Inactive"}
            </p>
          </div>

          <button
            onClick={() =>
              navigate(
                "/teacher/attendance"
              )
            }
          >
            View Attendance
          </button>
        </div>

        {/* RIGHT CARD */}
        <div className="card center">

          <h2>
            Live Session QR
          </h2>

          {attendanceActive &&
            sessionInfo && (
              <div
                style={{
                  background:
                    "#f8fbff",
                  padding: "12px",
                  borderRadius:
                    "10px",
                  marginBottom:
                    "15px",
                  textAlign:
                    "left"
                }}
              >
                <p>
                  <strong>
                    Subject:
                  </strong>{" "}
                  {sessionInfo.subject}
                </p>

                <p>
                  <strong>
                    Department:
                  </strong>{" "}
                  {
                    sessionInfo.department
                  }
                </p>

                <p>
                  <strong>
                    Year:
                  </strong>{" "}
                  {sessionInfo.year}
                </p>
              </div>
            )}

          <p
            style={{
              fontSize: "12px",
              wordBreak:
                "break-all"
            }}
          >
            {sessionId}
          </p>

          {attendanceActive ? (
            <>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                  JSON.stringify({
                    token: qrToken,
                    pin: classroomPin,
                    session_id: sessionId,
                  })
                )}&t=${Date.now()}`}
                alt="QR Code"
              />

              {/* Classroom Geofencing & Anti-Proxy Protection Badge */}
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1px solid #86efac",
                  borderRadius: "8px",
                  padding: "10px",
                  marginTop: "12px",
                  textAlign: "center",
                }}
              >
                <p style={{ margin: 0, fontSize: "12px", color: "#166534", fontWeight: "750" }}>
                  📍 CLASSROOM GEOFENCE: {geofenceRadius === 0 ? "FLEXIBLE CAMPUS MODE" : `${geofenceRadius}M PERIMETER ACTIVE (PHYSICALLY INSIDE CLASS)`}
                </p>
                <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#15803d", fontWeight: "600" }}>
                  🛡️ Anti-Proxy Protection: Dynamic Rotating QR + GPS Proximity + AI Face Verification
                </p>
              </div>
            </>
          ) : (
            <p
              style={{
                color: "gray"
              }}
            >
              Session not active
            </p>
          )}

          {/* LIVE ATTENDANCE */}
          <div
            style={{
              marginTop: "20px",
              width: "100%"
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center"
              }}
            >
              <h3>
                Live Attendance
              </h3>

              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <strong>
                  Present : {liveAttendance.length}
                </strong>
                {liveAttendance.length > 0 && (
                  <button
                    type="button"
                    onClick={exportLiveAttendanceCSV}
                    style={{
                      padding: "5px 10px",
                      fontSize: "12px",
                      background: "#10b981",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: "600",
                    }}
                  >
                    📥 Export CSV
                  </button>
                )}
              </div>
            </div>

            {/* 🔍 Real-Time Attendee Search & Filter */}
            {liveAttendance.length > 0 && (
              <div style={{ marginTop: "12px", marginBottom: "12px", display: "flex", gap: "10px", alignItems: "center" }}>
                <input
                  type="text"
                  placeholder="🔍 Search attendee by PRN or Name..."
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #d1d5db",
                    fontSize: "13px",
                  }}
                />
                <span style={{ fontSize: "12px", fontWeight: "700", color: "#4b5563", background: "#f3f4f6", padding: "6px 10px", borderRadius: "6px", whiteSpace: "nowrap" }}>
                  {liveAttendance.filter((s: any) => (s.prn || "").toLowerCase().includes(rosterSearch.toLowerCase()) || (s.student_name || "").toLowerCase().includes(rosterSearch.toLowerCase())).length} of {liveAttendance.length}
                </span>
              </div>
            )}

            <table
              style={{
                width: "100%",
                borderCollapse:
                  "collapse",
                fontSize: "14px"
              }}
            >
              <thead>
                <tr>
                  <th>PRN</th>
                  <th>Name</th>
                  <th>Proximity</th>
                  <th>Time</th>
                </tr>
              </thead>

              <tbody>
                {liveAttendance.length === 0 ? (
                  <tr>
                    <td colSpan={4}>Waiting for students...</td>
                  </tr>
                ) : (
                  liveAttendance
                    .filter((s: any) =>
                      (s.prn || "").toLowerCase().includes(rosterSearch.toLowerCase()) ||
                      (s.student_name || "").toLowerCase().includes(rosterSearch.toLowerCase())
                    )
                    .map((student, index) => (
                    <tr key={index}>
                      <td>{student.prn}</td>
                      <td>{student.student_name}</td>
                      <td style={{ color: "#166534", fontWeight: "700" }}>
                        {student.distance_meters !== null && student.distance_meters !== undefined
                          ? `📍 ${student.distance_meters}m`
                          : "📍 Verified Room"}
                      </td>
                      <td>{student.attendance_time}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Password Change Modal for Faculty */}
      {showPasswordModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "16px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "12px",
              maxWidth: "420px",
              width: "100%",
              padding: "24px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
              boxSizing: "border-box",
            }}
          >
            <h3 style={{ margin: "0 0 14px 0", color: "#111827", fontSize: "17px" }}>
              🔒 Change Faculty Password
            </h3>
            <p style={{ margin: "0 0 14px 0", fontSize: "13px", color: "#6b7280" }}>
              Update your account password for secure access to the faculty portal.
            </p>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "12px", color: "#374151", fontWeight: "650", display: "block", marginBottom: "4px" }}>
                New Password
              </label>
              <input
                type="password"
                placeholder="Min 6 characters"
                value={teacherNewPass}
                onChange={(e) => setTeacherNewPass(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  boxSizing: "border-box",
                  fontSize: "14px",
                }}
              />
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "12px", color: "#374151", fontWeight: "650", display: "block", marginBottom: "4px" }}>
                Confirm New Password
              </label>
              <input
                type="password"
                placeholder="Re-enter password"
                value={teacherConfirmPass}
                onChange={(e) => setTeacherConfirmPass(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  boxSizing: "border-box",
                  fontSize: "14px",
                }}
              />
            </div>

            {teacherPassMsg && (
              <p style={{ margin: "8px 0", fontSize: "13px", fontWeight: "650" }}>
                {teacherPassMsg}
              </p>
            )}

            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button
                type="button"
                onClick={handleTeacherPasswordChange}
                disabled={teacherPassLoading}
                style={{
                  flex: 1,
                  background: "#ffca08",
                  color: "#111",
                  border: "none",
                  borderRadius: "7px",
                  padding: "10px",
                  fontWeight: "750",
                  cursor: "pointer",
                }}
              >
                {teacherPassLoading ? "Updating..." : "Update Password"}
              </button>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                style={{
                  flex: 1,
                  background: "#f3f4f6",
                  color: "#374151",
                  border: "1px solid #d1d5db",
                  borderRadius: "7px",
                  padding: "10px",
                  fontWeight: "700",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}