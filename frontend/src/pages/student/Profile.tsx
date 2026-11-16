import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/profile.css";
import { API_URL } from "../../config";
import {
  getStudentProfile,
  updateStudentProfilePhoto,
  updateStudentEducation,
  updateUserPassword,
  applyStudentLeave,
  getStudentAttendanceHistory,
} from "../../services/supabase";
import {
  getStudentNotificationReceipts,
  type AttendanceNotificationRecord,
} from "../../services/emailService";
import ritLogo from "../../assets/RIT_logo.jpeg";

interface Student {
  full_name: string;
  prn: string;
  email: string;
  phone: string;
  parent_phone?: string;
  blood_group?: string;
  address?: string;
  year: string;
  branch: string;
  division: string;
  gender: string;
  face_folder: string;
  avatar_url?: string;
  education_details?: any;
  resume_headline?: string;
}

export default function Profile() {
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState(false);

  // 📬 Official Email Receipts & Notification State
  const [notificationReceipts, setNotificationReceipts] = useState<AttendanceNotificationRecord[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<AttendanceNotificationRecord | null>(null);

  // 🎓 Educational Record & Resume State
  const [cgpa, setCgpa] = useState("");
  const [tenthPercent, setTenthPercent] = useState("");
  const [twelfthPercent, setTwelfthPercent] = useState("");
  const [skills, setSkills] = useState("");
  const [projects, setProjects] = useState("");
  const [careerObjective, setCareerObjective] = useState("");
  const [savingEducation, setSavingEducation] = useState(false);
  const [eduMsg, setEduMsg] = useState("");
  const [showResumeModal, setShowResumeModal] = useState(false);

  // 🔒 Security & Password Change State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPass, setChangingPass] = useState(false);
  const [passMsg, setPassMsg] = useState("");

  // 📊 Attendance & University Exam Eligibility State
  const [attendanceStats, setAttendanceStats] = useState<{ total: number; present: number; percentage: number } | null>(null);

  // 🏥 Medical / OD Leave Application State
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveType, setLeaveType] = useState("Medical / Sick Leave");
  const [leaveDate, setLeaveDate] = useState(new Date().toISOString().split("T")[0]);
  const [leaveReason, setLeaveReason] = useState("");
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [leaveMsg, setLeaveMsg] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const prn = localStorage.getItem("prn");
        if (!prn) {
          setError("Student PRN not found. Please login again.");
          setLoading(false);
          return;
        }

        let studentData = null;
        try {
          const response = await fetch(`${API_URL}/student/profile/${encodeURIComponent(prn)}`);
          if (response.ok) {
            studentData = await response.json();
          }
        } catch {}

        if (!studentData) {
          studentData = await getStudentProfile(prn);
        }

        if (!studentData) {
          throw new Error("Student profile not found in cloud database.");
        }

        setStudent(studentData);

        // Pre-fill educational details
        if (studentData.education_details) {
          const edu = studentData.education_details;
          setCgpa(edu.cgpa || "");
          setTenthPercent(edu.tenth || "");
          setTwelfthPercent(edu.twelfth || "");
          setSkills(edu.skills || "");
          setProjects(edu.projects || "");
        }
        if (studentData.resume_headline) {
          setCareerObjective(studentData.resume_headline);
        }

        // Fetch Attendance Summary for University Exam Eligibility
        try {
          const history = await getStudentAttendanceHistory(prn);
          if (history && history.summary) {
            setAttendanceStats(history.summary);
          }
        } catch (attErr) {
          console.warn("Attendance summary load warning:", attErr);
        }

        // Fetch Official Attendance Email Receipts & Notification Slips
        try {
          const receipts = await getStudentNotificationReceipts(prn);
          setNotificationReceipts(receipts);
        } catch (rErr) {
          console.debug("Receipts load warning:", rErr);
        }

        setLoading(false);
      } catch (err: any) {
        console.error("Profile error:", err);
        setError(err?.message || "Unable to load student profile.");
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      alert("Please select a JPG, PNG or WEBP image.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Photo size must be less than 5 MB.");
      event.target.value = "";
      return;
    }
    setPhotoFile(file);
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);
  };

  const handleUploadPhoto = async () => {
    if (!photoFile || !student) {
      alert("Please select a photo first.");
      return;
    }

    try {
      setUploading(true);

      const base64Data: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const maxDim = 400;
            let width = img.width;
            let height = img.height;
            if (width > height) {
              if (width > maxDim) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              }
            } else {
              if (height > maxDim) {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              resolve(e.target?.result as string);
              return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL("image/jpeg", 0.85));
          };
          img.onerror = reject;
          img.src = e.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(photoFile);
      });

      await updateStudentProfilePhoto(student.prn, base64Data);

      setStudent((prev) => (prev ? { ...prev, avatar_url: base64Data } : null));
      setPhotoPreview(base64Data);
      setPhotoFile(null);
      alert("✅ Profile photo uploaded & synchronized to Supabase Cloud Database!");
    } catch (err: any) {
      console.error("Photo upload error:", err);
      alert("Failed to upload photo: " + (err.message || "Unknown error"));
    } finally {
      setUploading(false);
    }
  };

  const handleSaveEducation = async () => {
    if (!student) return;
    try {
      setSavingEducation(true);
      setEduMsg("");
      await updateStudentEducation(
        student.prn,
        {
          cgpa: cgpa.trim(),
          tenth: tenthPercent.trim(),
          twelfth: twelfthPercent.trim(),
          skills: skills.trim(),
          projects: projects.trim(),
        },
        careerObjective.trim()
      );
      setEduMsg("✅ Educational portfolio saved to cloud database!");
    } catch (e: any) {
      setEduMsg("❌ Failed to save: " + (e?.message || "Unknown error"));
    } finally {
      setSavingEducation(false);
    }
  };

  const handleChangePassword = async () => {
    if (!student) return;
    if (!newPassword || newPassword.length < 6) {
      setPassMsg("❌ Password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassMsg("❌ Passwords do not match.");
      return;
    }

    try {
      setChangingPass(true);
      setPassMsg("");
      await updateUserPassword("student", student.prn, newPassword);
      setPassMsg("✅ Password updated successfully! Use this for future logins.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      setPassMsg("❌ " + (e?.message || "Password update failed."));
    } finally {
      setChangingPass(false);
    }
  };

  const handleApplyLeave = async () => {
    if (!student || !leaveReason.trim()) {
      alert("Please enter the reason for your leave request.");
      return;
    }
    try {
      setSubmittingLeave(true);
      setLeaveMsg("");
      await applyStudentLeave({
        prn: student.prn,
        leave_type: leaveType,
        leave_date: leaveDate,
        reason: leaveReason.trim(),
      });
      setLeaveMsg("✅ Leave application submitted to faculty for verification!");
      setLeaveReason("");
      setTimeout(() => setShowLeaveModal(false), 2000);
    } catch (e: any) {
      setLeaveMsg("❌ " + (e?.message || "Failed to submit leave application."));
    } finally {
      setSubmittingLeave(false);
    }
  };

  const logout = () => {
    localStorage.clear();
    window.location.href = "/";
  };

  if (loading) {
    return (
      <div className="wrapper" style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "42px",
              height: "42px",
              border: "4px solid #f0e2a5",
              borderTopColor: "#ffca08",
              borderRadius: "50%",
              animation: "spin 0.75s linear infinite",
              margin: "0 auto 14px auto",
            }}
          />
          <h3 style={{ margin: 0, color: "#111" }}>Loading Student Portal...</h3>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="wrapper">
        <div className="card">
          <div className="card-header">
            <div className="profile-header-left">
              <img src={ritLogo} alt="RIT Logo" className="profile-rit-logo" />
              <span>Student Profile</span>
            </div>
          </div>
          <div className="section center" style={{ padding: "40px 20px" }}>
            <h2>Student Profile Not Found</h2>
            <p style={{ color: "#666" }}>{error}</p>
            <button className="btn" onClick={() => (window.location.href = "/")}>
              Login Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const avatarSrc = photoPreview
    ? photoPreview
    : student.avatar_url
    ? student.avatar_url
    : student.face_folder &&
      (student.face_folder.startsWith("data:") || student.face_folder.startsWith("http"))
    ? student.face_folder
    : !photoError
    ? `${API_URL}/student/photo/${encodeURIComponent(student.prn)}?t=${Date.now()}`
    : "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";

  return (
    <div className="wrapper">
      <div className="card" style={{ maxWidth: "680px" }}>
        {/* Top Header */}
        <div className="card-header">
          <div className="profile-header-left">
            <img src={ritLogo} alt="RIT Logo" className="profile-rit-logo" />
            <span>Student Portal</span>
          </div>
          <button
            onClick={logout}
            style={{
              background: "#ffffff",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              padding: "5px 12px",
              fontSize: "12px",
              fontWeight: "700",
              color: "#374151",
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>

        {/* 🎓 Unified Student Portal Navigation Tabs */}
        <div
          style={{
            display: "flex",
            background: "#f1f5f9",
            borderRadius: "12px",
            padding: "5px",
            margin: "16px 20px 14px 20px",
            gap: "8px",
            border: "1.5px solid #e2e8f0",
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <button
            type="button"
            style={{
              flex: 1,
              padding: "11px 16px",
              borderRadius: "9px",
              border: "none",
              fontSize: "14px",
              fontWeight: "800",
              cursor: "pointer",
              transition: "all 0.25s ease",
              background: "#ffca08",
              color: "#000000",
              boxShadow: "0 4px 12px rgba(255,202,8,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <span>👤</span> Student Profile Section
          </button>

          <button
            type="button"
            onClick={() => navigate("/scan")}
            style={{
              flex: 1,
              padding: "11px 16px",
              borderRadius: "9px",
              border: "none",
              fontSize: "14px",
              fontWeight: "800",
              cursor: "pointer",
              transition: "all 0.25s ease",
              background: "transparent",
              color: "#64748b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <span>📷</span> Scan QR Code
          </button>
        </div>

        {/* Profile Banner */}
        <div className="profile-banner">
          <img
            src={avatarSrc}
            className="profile-img"
            alt={student.full_name}
            onError={() => setPhotoError(true)}
          />
          <div className="profile-info">
            <h3>{student.full_name}</h3>
            <p>
              <b>PRN:</b> {student.prn} &nbsp;|&nbsp; <b>Division:</b> {student.division} &nbsp;|&nbsp; <b>Gender:</b> {student.gender || "N/A"}
            </p>
            <p>
              <b>Class:</b> {student.year} &nbsp;|&nbsp; <b>Branch:</b> {student.branch}
            </p>
            <p>
              <b>Email:</b> {student.email} &nbsp;|&nbsp; <b>Mobile:</b> {student.phone || "Not set"}
            </p>
            {(student.parent_phone || student.blood_group) && (
              <p>
                {student.parent_phone && <span><b>Emergency / Parent:</b> {student.parent_phone} &nbsp;|&nbsp; </span>}
                {student.blood_group && <span><b>Blood Group:</b> {student.blood_group}</span>}
              </p>
            )}
            {student.address && (
              <p>
                <b>Address:</b> {student.address}
              </p>
            )}
          </div>
        </div>

        {/* University Exam Eligibility & Defaulter Status */}
        {attendanceStats !== null && (
          <div
            style={{
              margin: "16px 20px 0 20px",
              padding: "12px 16px",
              borderRadius: "10px",
              background: attendanceStats.percentage >= 75 ? "#f0fdf4" : "#fef2f2",
              border: `1px solid ${attendanceStats.percentage >= 75 ? "#86efac" : "#fca5a5"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  fontWeight: "800",
                  color: attendanceStats.percentage >= 75 ? "#166534" : "#991b1b",
                }}
              >
                {attendanceStats.percentage >= 75
                  ? `🎓 University Exam Status: ELIGIBLE (${attendanceStats.percentage}% Attendance)`
                  : `⚠️ University Defaulter Alert: ${attendanceStats.percentage}% (< 75% Requirement)`}
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#4b5563" }}>
                Attended: <b>{attendanceStats.present}</b> / {attendanceStats.total} total lectures
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowLeaveModal(true)}
              style={{
                background: "#ffffff",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: "750",
                color: "#1e3a8a",
                cursor: "pointer",
              }}
            >
              🏥 Apply for Leave / OD
            </button>
          </div>
        )}

        {/* Quick Actions (Scan QR & Attendance) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
            margin: "16px 20px 0 20px",
          }}
        >
          <button
            className="btn"
            onClick={() => navigate("/scan")}
            style={{
              minHeight: "46px",
              fontSize: "14px",
              fontWeight: "750",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            📷 Scan Lecture QR
          </button>
          <button
            className="btn"
            onClick={() => navigate("/student-attendance")}
            style={{
              minHeight: "46px",
              background: "#f3f4f6",
              border: "1px solid #d1d5db",
              color: "#1f2937",
              fontSize: "14px",
              fontWeight: "750",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            📊 View My Attendance
          </button>
        </div>

        {/* Section 1: Update Profile Photo */}
        <div className="section">
          <h4 style={{ margin: "0 0 10px 0", color: "#111827", fontSize: "15px" }}>
            📷 Update Profile Picture
          </h4>
          <input
            id="student-photo-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhotoChange}
            style={{ display: "none" }}
          />
          <label
            htmlFor="student-photo-input"
            className="btn"
            style={{ display: "inline-block", cursor: "pointer", marginRight: "10px" }}
          >
            📁 Choose New Photo
          </label>
          {photoFile && (
            <div style={{ marginTop: "14px", textAlign: "center" }}>
              <p style={{ margin: "0 0 8px 0", fontSize: "13px" }}>
                Selected: <b>{photoFile.name}</b>
              </p>
              {photoPreview && (
                <img
                  src={photoPreview}
                  alt="Preview"
                  style={{
                    width: "100px",
                    height: "100px",
                    objectFit: "cover",
                    borderRadius: "50%",
                    border: "2px solid #ffca08",
                    display: "block",
                    margin: "0 auto 10px auto",
                  }}
                />
              )}
              <button
                className="btn"
                onClick={handleUploadPhoto}
                disabled={uploading}
                style={{ width: "100%", maxWidth: "260px" }}
              >
                {uploading ? "⏳ Uploading..." : "⬆️ Upload & Set Photo"}
              </button>
            </div>
          )}
        </div>

        {/* Section 2: Student Educational Portfolio & Resume Details */}
        <div className="section">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            }}
          >
            <h4 style={{ margin: 0, color: "#111827", fontSize: "15px" }}>
              🎓 Educational Details & Career Profile
            </h4>
            <button
              type="button"
              onClick={() => setShowResumeModal(true)}
              style={{
                background: "#0284c7",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: "750",
                cursor: "pointer",
              }}
            >
              📄 View / Print Resume
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
            <div>
              <label style={{ fontSize: "12px", color: "#374151", fontWeight: "650" }}>
                Current CGPA
              </label>
              <input
                type="text"
                placeholder="e.g. 8.75"
                value={cgpa}
                onChange={(e) => setCgpa(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  marginTop: "4px",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "#374151", fontWeight: "650" }}>
                12th / Diploma %
              </label>
              <input
                type="text"
                placeholder="e.g. 86.4%"
                value={twelfthPercent}
                onChange={(e) => setTwelfthPercent(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  marginTop: "4px",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "#374151", fontWeight: "650" }}>
                10th (SSC) %
              </label>
              <input
                type="text"
                placeholder="e.g. 91.2%"
                value={tenthPercent}
                onChange={(e) => setTenthPercent(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  marginTop: "4px",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          <div style={{ marginTop: "10px" }}>
            <label style={{ fontSize: "12px", color: "#374151", fontWeight: "650" }}>
              Career Objective / Headline
            </label>
            <input
              type="text"
              placeholder="e.g. Aspiring Full-Stack Software Engineer with AI/ML expertise"
              value={careerObjective}
              onChange={(e) => setCareerObjective(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "6px",
                border: "1px solid #d1d5db",
                marginTop: "4px",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginTop: "10px" }}>
            <label style={{ fontSize: "12px", color: "#374151", fontWeight: "650" }}>
              Key Technical Skills (Comma-separated)
            </label>
            <input
              type="text"
              placeholder="e.g. Python, React, TypeScript, Node.js, SQL, OpenCV, Git"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "6px",
                border: "1px solid #d1d5db",
                marginTop: "4px",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginTop: "10px" }}>
            <label style={{ fontSize: "12px", color: "#374151", fontWeight: "650" }}>
              Academic Projects & Experience
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Proxy-Resistant Attendance System using Facial Verification & Rotating QR Codes; Autonomous Drone Obstacle Detection."
              value={projects}
              onChange={(e) => setProjects(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "6px",
                border: "1px solid #d1d5db",
                marginTop: "4px",
                fontFamily: "inherit",
                fontSize: "13px",
                boxSizing: "border-box",
              }}
            />
          </div>

          {eduMsg && (
            <p style={{ margin: "8px 0 0 0", fontSize: "13px", fontWeight: "650" }}>{eduMsg}</p>
          )}

          <button
            type="button"
            className="btn"
            onClick={handleSaveEducation}
            disabled={savingEducation}
            style={{ marginTop: "12px", width: "100%" }}
          >
            {savingEducation ? "⏳ Saving Details..." : "💾 Save Educational Portfolio"}
          </button>
        </div>

        {/* Section 3: Official Attendance Email Receipts & Notification Slips */}
        <div className="section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <h4 style={{ margin: 0, color: "#111827", fontSize: "15px" }}>
              📬 Official Attendance Email Receipts ({notificationReceipts.length})
            </h4>
            <span style={{ fontSize: "12px", color: "#059669", fontWeight: "700" }}>
              ✓ Auto-Dispatched
            </span>
          </div>
          <p style={{ margin: "0 0 12px 0", fontSize: "12.5px", color: "#64748b" }}>
            Every successful lecture attendance generates an immutable cryptographic verification slip dispatched to your college email.
          </p>

          {notificationReceipts.length === 0 ? (
            <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "8px", textAlign: "center", fontSize: "13px", color: "#64748b", border: "1px dashed #cbd5e1" }}>
              No attendance slips recorded yet. As you mark attendance in lectures, official email receipts will be stored here automatically.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "260px", overflowY: "auto" }}>
              {notificationReceipts.slice(0, 10).map((rcpt) => (
                <div
                  key={rcpt.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 12px",
                    background: "#f9fafb",
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                    fontSize: "12.5px",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: "750", color: "#1e3a8a" }}>{rcpt.subject}</div>
                    <div style={{ color: "#6b7280", fontSize: "11.5px" }}>
                      {rcpt.lecture_date} at {rcpt.lecture_time} &nbsp;|&nbsp;
                      {rcpt.distance_meters !== null ? ` 📍 ${rcpt.distance_meters}m` : " 📍 Inside"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedReceipt(rcpt)}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #d1d5db",
                      borderRadius: "6px",
                      padding: "5px 10px",
                      fontSize: "11.5px",
                      fontWeight: "700",
                      color: "#1e3a8a",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    📄 View Slip
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 4: Change Password */}
        <div className="section">
          <h4 style={{ margin: "0 0 10px 0", color: "#111827", fontSize: "15px" }}>
            🔒 Change Portal Password
          </h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div>
              <label style={{ fontSize: "12px", color: "#374151", fontWeight: "650" }}>
                New Password
              </label>
              <input
                type="password"
                placeholder="Min 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  marginTop: "4px",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "#374151", fontWeight: "650" }}>
                Confirm New Password
              </label>
              <input
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  marginTop: "4px",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {passMsg && (
            <p style={{ margin: "8px 0 0 0", fontSize: "13px", fontWeight: "650" }}>{passMsg}</p>
          )}

          <button
            type="button"
            className="btn"
            onClick={handleChangePassword}
            disabled={changingPass}
            style={{ marginTop: "12px", width: "100%" }}
          >
            {changingPass ? "⏳ Updating Password..." : "🔒 Update Password"}
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 📄 OFFICIAL RESUME VIEWER & PRINT MODAL                       */}
      {/* ============================================================ */}
      {showResumeModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "16px",
            boxSizing: "border-box",
          }}
        >
          <div
            id="print-resume-content"
            style={{
              background: "#ffffff",
              borderRadius: "12px",
              maxWidth: "640px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "24px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
              boxSizing: "border-box",
              fontFamily: "'Segoe UI', Arial, sans-serif",
            }}
          >
            {/* College Header */}
            <div
              style={{
                borderBottom: "2px solid #ffca08",
                paddingBottom: "12px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "14px",
              }}
            >
              <img
                src={ritLogo}
                alt="RIT"
                style={{ width: "55px", height: "55px", objectFit: "contain" }}
              />
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: "16px", color: "#1e3a8a", fontWeight: "800" }}>
                  Rajarambapu Institute of Technology, Rajaramnagar
                </h3>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6b7280" }}>
                  An Autonomous Institute | Approved by AICTE | Affiliated to Shivaji University
                </p>
                <p style={{ margin: "2px 0 0 0", fontSize: "13px", fontWeight: "750", color: "#111" }}>
                  OFFICIAL STUDENT ACADEMIC RESUME
                </p>
              </div>
            </div>

            {/* Student Bio */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                marginBottom: "16px",
              }}
            >
              <img
                src={avatarSrc}
                alt={student.full_name}
                style={{
                  width: "75px",
                  height: "75px",
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "2px solid #ffca08",
                }}
              />
              <div>
                <h2 style={{ margin: 0, fontSize: "18px", color: "#111827" }}>
                  {student.full_name}
                </h2>
                <p style={{ margin: "3px 0 0 0", fontSize: "13px", color: "#374151" }}>
                  <b>PRN:</b> {student.prn} &nbsp;|&nbsp; <b>Class:</b> {student.year} (Div {student.division})
                </p>
                <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "#374151" }}>
                  <b>Department:</b> {student.branch}
                </p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6b7280" }}>
                  <b>Email:</b> {student.email} &nbsp;|&nbsp; <b>Phone:</b> {student.phone || "Not Listed"}
                </p>
              </div>
            </div>

            {/* Objective */}
            {careerObjective && (
              <div style={{ marginBottom: "14px" }}>
                <h4 style={{ margin: "0 0 4px 0", fontSize: "13px", color: "#1e3a8a", borderBottom: "1px solid #e5e7eb", paddingBottom: "2px" }}>
                  CAREER OBJECTIVE
                </h4>
                <p style={{ margin: 0, fontSize: "13px", color: "#374151", lineHeight: "1.4" }}>
                  {careerObjective}
                </p>
              </div>
            )}

            {/* Academic Qualifications Table */}
            <div style={{ marginBottom: "14px" }}>
              <h4 style={{ margin: "0 0 6px 0", fontSize: "13px", color: "#1e3a8a", borderBottom: "1px solid #e5e7eb", paddingBottom: "2px" }}>
                ACADEMIC CREDENTIALS
              </h4>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                    <th style={{ padding: "6px 8px", border: "1px solid #e2e8f0" }}>Degree / Certificate</th>
                    <th style={{ padding: "6px 8px", border: "1px solid #e2e8f0" }}>Institution</th>
                    <th style={{ padding: "6px 8px", border: "1px solid #e2e8f0" }}>Performance / Grade</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: "6px 8px", border: "1px solid #e2e8f0" }}>B.Tech - {student.branch}</td>
                    <td style={{ padding: "6px 8px", border: "1px solid #e2e8f0" }}>RIT Rajaramnagar</td>
                    <td style={{ padding: "6px 8px", border: "1px solid #e2e8f0", fontWeight: "700" }}>{cgpa ? `CGPA: ${cgpa}` : "Pursuing"}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "6px 8px", border: "1px solid #e2e8f0" }}>Higher Secondary (12th / Diploma)</td>
                    <td style={{ padding: "6px 8px", border: "1px solid #e2e8f0" }}>State Board / MSBTE</td>
                    <td style={{ padding: "6px 8px", border: "1px solid #e2e8f0", fontWeight: "700" }}>{twelfthPercent || "Completed"}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "6px 8px", border: "1px solid #e2e8f0" }}>Secondary School (10th SSC)</td>
                    <td style={{ padding: "6px 8px", border: "1px solid #e2e8f0" }}>State Board / CBSE</td>
                    <td style={{ padding: "6px 8px", border: "1px solid #e2e8f0", fontWeight: "700" }}>{tenthPercent || "Completed"}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Technical Skills */}
            {skills && (
              <div style={{ marginBottom: "14px" }}>
                <h4 style={{ margin: "0 0 4px 0", fontSize: "13px", color: "#1e3a8a", borderBottom: "1px solid #e5e7eb", paddingBottom: "2px" }}>
                  TECHNICAL SKILLS
                </h4>
                <p style={{ margin: 0, fontSize: "13px", color: "#374151" }}>
                  {skills}
                </p>
              </div>
            )}

            {/* Academic Projects */}
            {projects && (
              <div style={{ marginBottom: "14px" }}>
                <h4 style={{ margin: "0 0 4px 0", fontSize: "13px", color: "#1e3a8a", borderBottom: "1px solid #e5e7eb", paddingBottom: "2px" }}>
                  PROJECTS & PRACTICAL WORK
                </h4>
                <p style={{ margin: 0, fontSize: "13px", color: "#374151", lineHeight: "1.4" }}>
                  {projects}
                </p>
              </div>
            )}

            {/* Attendance Compliance Certification */}
            <div style={{ padding: "8px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "6px", marginBottom: "16px" }}>
              <p style={{ margin: 0, fontSize: "11px", color: "#166534" }}>
                Verified via RIT Proxy-Resistant Smart Attendance System | Supabase Cloud Registry.
              </p>
            </div>

            {/* Modal Action Buttons */}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  background: "#0284c7",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: "700",
                  cursor: "pointer",
                }}
              >
                🖨️ Print / Save PDF
              </button>
              <button
                type="button"
                onClick={() => setShowResumeModal(false)}
                style={{
                  background: "#f3f4f6",
                  color: "#374151",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: "700",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🏥 MEDICAL / DUTY EXEMPTION (OD) LEAVE MODAL */}
      {showLeaveModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.65)",
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
              maxWidth: "480px",
              width: "100%",
              padding: "24px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
              boxSizing: "border-box",
            }}
          >
            <h3 style={{ margin: "0 0 10px 0", color: "#111827", fontSize: "17px" }}>
              🏥 Student Leave / Duty Exemption (OD)
            </h3>
            <p style={{ margin: "0 0 14px 0", fontSize: "13px", color: "#6b7280" }}>
              Submit an official leave request to faculty for attendance exemption.
            </p>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "12px", color: "#374151", fontWeight: "650", display: "block", marginBottom: "4px" }}>
                Select Leave Category
              </label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  boxSizing: "border-box",
                  fontSize: "14px",
                }}
              >
                <option value="Medical / Sick Leave">Medical / Sick Leave</option>
                <option value="Placement Drive OD">Placement Drive OD (Campus Recruitment)</option>
                <option value="College Sports OD">College Sports OD (Inter-College Tournament)</option>
                <option value="Technical Symposium OD">Technical Symposium / Hackathon OD</option>
                <option value="Emergency Personal Leave">Emergency Personal Leave</option>
              </select>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "12px", color: "#374151", fontWeight: "650", display: "block", marginBottom: "4px" }}>
                Date of Absence
              </label>
              <input
                type="date"
                value={leaveDate}
                onChange={(e) => setLeaveDate(e.target.value)}
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
                Reason & Details
              </label>
              <textarea
                rows={3}
                placeholder="Explain the reason for absence (e.g. Attending TCS placement interview, Medical illness with doctor prescription submitted to department)"
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                  fontSize: "13px",
                }}
              />
            </div>

            {leaveMsg && (
              <p style={{ margin: "8px 0", fontSize: "13px", fontWeight: "650" }}>{leaveMsg}</p>
            )}

            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button
                type="button"
                onClick={handleApplyLeave}
                disabled={submittingLeave}
                style={{
                  flex: 1,
                  background: "#0284c7",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "7px",
                  padding: "10px",
                  fontWeight: "750",
                  cursor: "pointer",
                }}
              >
                {submittingLeave ? "Submitting..." : "Submit to Faculty"}
              </button>
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
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

      {/* 📄 Official Email Slip Viewer Modal */}
      {selectedReceipt && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "16px" }}>
          <div style={{ background: "#ffffff", borderRadius: "14px", maxWidth: "500px", width: "100%", overflow: "hidden", boxShadow: "0 20px 40px rgba(0,0,0,0.25)", border: "1px solid #e2e8f0" }}>
            <div style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #0284c7 100%)", padding: "16px 20px", color: "#ffffff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "750" }}>Official Attendance Receipt</h4>
                <p style={{ margin: 0, fontSize: "11.5px", opacity: 0.9 }}>Dispatched to {selectedReceipt.student_email}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                style={{ background: "transparent", border: "none", color: "#ffffff", fontSize: "20px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: "20px" }}>
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "10px 14px", marginBottom: "14px", textAlign: "center" }}>
                <span style={{ color: "#166534", fontWeight: "750", fontSize: "13px" }}>
                  ✅ VERIFIED & LOGGED IN CLOUD DATABASE
                </span>
              </div>
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "14px", fontSize: "13px", lineHeight: "1.7" }}>
                <div><strong>Subject:</strong> {selectedReceipt.subject}</div>
                <div><strong>Class:</strong> {selectedReceipt.department} - {selectedReceipt.year}</div>
                <div><strong>Student:</strong> {selectedReceipt.student_name} (PRN: {selectedReceipt.prn})</div>
                <div><strong>Date & Time:</strong> {selectedReceipt.lecture_date} at {selectedReceipt.lecture_time}</div>
                <div><strong>Faculty In-Charge:</strong> {selectedReceipt.teacher_name}</div>
                <div><strong>Classroom Distance:</strong> <span style={{ color: "#059669", fontWeight: "650" }}>📍 {selectedReceipt.distance_meters !== null ? `${selectedReceipt.distance_meters}m` : "Inside Classroom Perimeter"}</span></div>
                <div><strong>Status:</strong> <span style={{ color: "#2563eb", fontWeight: "600" }}>{selectedReceipt.status} via {selectedReceipt.notification_type}</span></div>
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{ flex: 1, background: "#ffca08", color: "#111827", border: "none", padding: "10px", borderRadius: "6px", fontWeight: "750", cursor: "pointer", fontSize: "13px" }}
                >
                  🖨️ Print Slip
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedReceipt(null)}
                  style={{ flex: 1, background: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1", padding: "10px", borderRadius: "6px", fontWeight: "600", cursor: "pointer", fontSize: "13px" }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @media print {
          body * {
            visibility: hidden;
          }
          #print-resume-content, #print-resume-content * {
            visibility: visible;
          }
          #print-resume-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: 100%;
            box-shadow: none;
            padding: 0;
          }
        }
      `}</style>
    </div>
  );
}
