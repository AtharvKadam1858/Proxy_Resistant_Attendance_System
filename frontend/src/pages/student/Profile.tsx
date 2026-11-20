import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/profile.css";
import { API_URL } from "../../config";
import {
  getStudentProfile,
  updateStudentProfilePhoto,
  updateUserPassword,
  submitStudentLeaveWithDocument,
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

  // 🔒 Security & Password Change State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPass, setChangingPass] = useState(false);
  const [passMsg, setPassMsg] = useState("");

  // 📊 Attendance & University Exam Eligibility State
  const [attendanceStats, setAttendanceStats] = useState<{ total: number; present: number; percentage: number } | null>(null);
  const [showCertificateModal, setShowCertificateModal] = useState(false);

  // 🏥 Medical / OD Leave & Certificate Application State
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveType, setLeaveType] = useState("Medical / Sick Leave");
  const [leaveDate, setLeaveDate] = useState(new Date().toISOString().split("T")[0]);
  const [leaveSubject, setLeaveSubject] = useState("Machine Learning & Deep Learning");
  const [leaveTimeSlot, setLeaveTimeSlot] = useState("10:15 AM - 11:15 AM");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveDocument, setLeaveDocument] = useState<{
    name: string;
    type: string;
    base64: string;
    sizeBytes: number;
  } | null>(null);
  const [leaveDocPreview, setLeaveDocPreview] = useState<string | null>(null);
  const [leaveDocError, setLeaveDocError] = useState("");
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

  const handleLeaveFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLeaveDocError("");
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 12 * 1024 * 1024) {
      setLeaveDocError("❌ File size must be under 12MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      setLeaveDocument({
        name: file.name,
        type: file.type || (isPdf ? "application/pdf" : "image/jpeg"),
        base64: base64,
        sizeBytes: file.size,
      });
      if (file.type.startsWith("image/") && !isPdf) {
        setLeaveDocPreview(base64);
      } else {
        setLeaveDocPreview(null);
      }
    };
    reader.onerror = () => {
      setLeaveDocError("❌ Failed to process selected file.");
    };
    reader.readAsDataURL(file);
  };

  const handleApplyLeave = async () => {
    if (!student) return;
    if (!leaveReason.trim()) {
      alert("Please enter the reason for your leave/certificate request.");
      return;
    }
    try {
      setSubmittingLeave(true);
      setLeaveMsg("");
      await submitStudentLeaveWithDocument({
        prn: student.prn,
        leave_type: leaveType,
        leave_date: leaveDate,
        subject: leaveSubject,
        lecture_time: leaveTimeSlot,
        reason: leaveReason.trim(),
        document: leaveDocument,
      });
      setLeaveMsg("✅ Official leave application & certificate uploaded successfully for Admin verification!");
      setTimeout(() => {
        setLeaveReason("");
        setLeaveDocument(null);
        setLeaveDocPreview(null);
        setShowLeaveModal(false);
        setLeaveMsg("");
      }, 2500);
      try {
        const receipts = await getStudentNotificationReceipts(student.prn);
        setNotificationReceipts(receipts);
      } catch {}
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

        {/* 📈 75% Attendance Projection & Official Certificate Trigger */}
        {attendanceStats !== null && (
          <div
            style={{
              margin: "10px 20px 0 20px",
              padding: "10px 14px",
              background: "#f8fafc",
              border: "1px dashed #cbd5e1",
              borderRadius: "8px",
              fontSize: "12.5px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            {attendanceStats.percentage >= 75 ? (
              <div style={{ color: "#166534" }}>
                <strong>🎉 75% Safe Margin: </strong>
                <span>
                  You can safely miss up to <b>{Math.max(0, Math.floor(attendanceStats.present / 0.75) - attendanceStats.total)}</b> more classes and still maintain university exam eligibility.
                </span>
              </div>
            ) : (
              <div style={{ color: "#991b1b" }}>
                <strong>🎯 Exam Clearance Target: </strong>
                <span>
                  You need to attend the next <b>{Math.max(1, Math.ceil((0.75 * attendanceStats.total - attendanceStats.present) / 0.25))}</b> consecutive lectures to recover 75% eligibility.
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowCertificateModal(true)}
              style={{
                padding: "5px 12px",
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: "6px",
                color: "#1d4ed8",
                fontWeight: "750",
                fontSize: "12px",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              🖨️ Official Certificate
            </button>
          </div>
        )}

        {/* Quick Action: View My Attendance Records (Scan QR is exclusively on Tab 2 above) */}
        <div
          style={{
            margin: "16px 20px 0 20px",
          }}
        >
          <button
            type="button"
            className="btn"
            onClick={() => navigate("/student-attendance")}
            style={{
              width: "100%",
              minHeight: "46px",
              background: "#f8fafc",
              border: "1.5px solid #cbd5e1",
              color: "#0f172a",
              fontSize: "14px",
              fontWeight: "800",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              borderRadius: "10px",
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
              transition: "all 0.2s ease",
            }}
          >
            📊 View My Attendance & Subject-Wise Records
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

        {/* Section 2: Official Attendance Email Receipts & Notification Slips */}
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

      {/* 🏥 MEDICAL / DUTY EXEMPTION (OD) & CERTIFICATE LEAVE MODAL */}
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
              borderRadius: "14px",
              maxWidth: "540px",
              width: "100%",
              maxHeight: "92vh",
              overflowY: "auto",
              padding: "24px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h3 style={{ margin: 0, color: "#111827", fontSize: "18px", fontWeight: "800" }}>
                📑 Submit Leave & Official Certificate
              </h3>
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "18px",
                  cursor: "pointer",
                  color: "#6b7280",
                }}
              >
                ✕
              </button>
            </div>
            <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#6b7280" }}>
              Submit your medical certificate, duty exemption letter (OD), or sports document to the Administration for attendance validation and defaulter exemption.
            </p>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "12px", color: "#374151", fontWeight: "700", display: "block", marginBottom: "4px" }}>
                Select Leave Category <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "7px",
                  border: "1.5px solid #d1d5db",
                  boxSizing: "border-box",
                  fontSize: "13.5px",
                }}
              >
                <option value="Medical / Sick Leave">🏥 Medical / Sick Leave (Doctor Certificate Attached)</option>
                <option value="Placement Drive OD">💼 Campus Placement / Interview Drive OD</option>
                <option value="College Sports OD">🏆 University / College Sports Tournament OD</option>
                <option value="Technical Symposium OD">💻 Technical Symposium / Hackathon OD</option>
                <option value="Official Institutional Certificate">📜 Official Institutional Certificate Exemption</option>
                <option value="Emergency Personal Leave">⚠️ Emergency Personal Leave</option>
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
              <div>
                <label style={{ fontSize: "12px", color: "#374151", fontWeight: "700", display: "block", marginBottom: "4px" }}>
                  Date of Absence <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="date"
                  value={leaveDate}
                  onChange={(e) => setLeaveDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "7px",
                    border: "1.5px solid #d1d5db",
                    boxSizing: "border-box",
                    fontSize: "13.5px",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", color: "#374151", fontWeight: "700", display: "block", marginBottom: "4px" }}>
                  Lecture Timing Slot <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select
                  value={leaveTimeSlot}
                  onChange={(e) => setLeaveTimeSlot(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "7px",
                    border: "1.5px solid #d1d5db",
                    boxSizing: "border-box",
                    fontSize: "13.5px",
                  }}
                >
                  <option value="09:15 AM - 10:15 AM">09:15 AM - 10:15 AM</option>
                  <option value="10:15 AM - 11:15 AM">10:15 AM - 11:15 AM</option>
                  <option value="11:30 AM - 12:30 PM">11:30 AM - 12:30 PM</option>
                  <option value="01:30 PM - 02:30 PM">01:30 PM - 02:30 PM</option>
                  <option value="02:30 PM - 03:30 PM">02:30 PM - 03:30 PM</option>
                  <option value="03:30 PM - 04:30 PM">03:30 PM - 04:30 PM</option>
                  <option value="Full Day (All Lectures)">Full Day (All Lectures)</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "12px", color: "#374151", fontWeight: "700", display: "block", marginBottom: "4px" }}>
                Subject / Course Name <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                value={leaveSubject}
                onChange={(e) => setLeaveSubject(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "7px",
                  border: "1.5px solid #d1d5db",
                  boxSizing: "border-box",
                  fontSize: "13.5px",
                }}
              >
                <option value="Machine Learning & Deep Learning">Machine Learning & Deep Learning</option>
                <option value="Artificial Intelligence & Expert Systems">Artificial Intelligence & Expert Systems</option>
                <option value="Cloud Computing & DevOps">Cloud Computing & DevOps</option>
                <option value="Cyber Security & Forensics">Cyber Security & Forensics</option>
                <option value="Database Management Systems">Database Management Systems</option>
                <option value="Computer Networks">Computer Networks</option>
                <option value="Full Day Exemption (All Subjects)">Full Day Exemption (All Subjects)</option>
              </select>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "12px", color: "#374151", fontWeight: "700", display: "block", marginBottom: "4px" }}>
                Reason & Official Justification <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Detail your reason for absence (e.g. Attending off-campus technical placement round, hospitalized due to viral fever with medical certificate attached below)"
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "7px",
                  border: "1.5px solid #d1d5db",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                  fontSize: "13px",
                }}
              />
            </div>

            {/* Document Upload Area (Image or PDF) */}
            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "12px", color: "#374151", fontWeight: "700", display: "block", marginBottom: "4px" }}>
                📎 Attach Certificate / Medical Letter (Image or PDF)
              </label>
              <div
                style={{
                  border: "2px dashed #94a3b8",
                  borderRadius: "8px",
                  padding: "14px",
                  textAlign: "center",
                  background: "#f8fafc",
                  cursor: "pointer",
                  position: "relative",
                }}
              >
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleLeaveFileChange}
                  style={{
                    position: "absolute",
                    inset: 0,
                    opacity: 0,
                    cursor: "pointer",
                    width: "100%",
                    height: "100%",
                  }}
                />
                {!leaveDocument ? (
                  <div>
                    <div style={{ fontSize: "24px", marginBottom: "4px" }}>📄 / 🖼️</div>
                    <div style={{ fontSize: "13px", fontWeight: "700", color: "#1e293b" }}>
                      Click or Drag & Drop to Attach Letter / Certificate
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                      Supports Image (.png, .jpg, .jpeg, .webp) & PDF documents (Up to 12MB)
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      {leaveDocPreview ? (
                        <img
                          src={leaveDocPreview}
                          alt="Document Preview"
                          style={{ width: "44px", height: "44px", objectFit: "cover", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "44px",
                            height: "44px",
                            borderRadius: "6px",
                            background: "#fee2e2",
                            color: "#b91c1c",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "20px",
                            fontWeight: "800",
                          }}
                        >
                          PDF
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: "750", color: "#0f172a" }}>
                          {leaveDocument.name}
                        </div>
                        <div style={{ fontSize: "11px", color: "#64748b" }}>
                          {(leaveDocument.sizeBytes / 1024).toFixed(1)} KB • {leaveDocument.type}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLeaveDocument(null);
                        setLeaveDocPreview(null);
                      }}
                      style={{
                        padding: "4px 8px",
                        background: "#fee2e2",
                        color: "#ef4444",
                        border: "none",
                        borderRadius: "5px",
                        fontSize: "12px",
                        cursor: "pointer",
                        fontWeight: "700",
                        position: "relative",
                        zIndex: 2,
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
              {leaveDocError && (
                <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px", fontWeight: "600" }}>
                  {leaveDocError}
                </div>
              )}
            </div>

            {leaveMsg && (
              <p
                style={{
                  margin: "10px 0",
                  padding: "10px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: "700",
                  background: leaveMsg.startsWith("✅") ? "#f0fdf4" : "#fef2f2",
                  color: leaveMsg.startsWith("✅") ? "#166534" : "#991b1b",
                  border: `1px solid ${leaveMsg.startsWith("✅") ? "#bbf7d0" : "#fecaca"}`,
                }}
              >
                {leaveMsg}
              </p>
            )}

            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button
                type="button"
                onClick={handleApplyLeave}
                disabled={submittingLeave}
                style={{
                  flex: 1,
                  background: "linear-gradient(135deg, #0284c7, #0369a1)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "12px",
                  fontWeight: "800",
                  fontSize: "14px",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(2,132,199,0.3)",
                }}
              >
                {submittingLeave ? "⏳ Uploading & Submitting..." : "📤 Submit for Admin Verification"}
              </button>
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                style={{
                  padding: "12px 18px",
                  background: "#f1f5f9",
                  color: "#475569",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  fontWeight: "700",
                  fontSize: "13.5px",
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

      {/* 🖨️ OFFICIAL PRINTABLE ATTENDANCE CERTIFICATE & EXAMINATION CLEARANCE MODAL */}
      {showCertificateModal && student && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.75)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "16px"
        }}>
          <div
            id="print-certificate-content"
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              maxWidth: "600px",
              width: "100%",
              overflow: "hidden",
              boxShadow: "0 25px 50px rgba(0,0,0,0.3)",
              border: "2px solid #ffca08"
            }}>
            {/* Institute Crest Header */}
            <div style={{
              background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
              color: "#ffffff",
              padding: "20px 24px",
              textAlign: "center",
              position: "relative"
            }}>
              <button
                type="button"
                onClick={() => setShowCertificateModal(false)}
                style={{
                  position: "absolute",
                  top: "14px",
                  right: "16px",
                  background: "transparent",
                  border: "none",
                  color: "#ffffff",
                  fontSize: "22px",
                  cursor: "pointer"
                }}
              >
                ✕
              </button>
              <img src={ritLogo} alt="RIT Crest" style={{ width: "48px", height: "48px", objectFit: "contain", marginBottom: "6px" }} />
              <h3 style={{ margin: "0 0 2px 0", fontSize: "17px", fontWeight: "800", letterSpacing: "0.5px" }}>
                Rajarambapu Institute of Technology, Rajaramnagar
              </h3>
              <p style={{ margin: 0, fontSize: "11px", opacity: 0.85 }}>
                An Autonomous Institute | Approved by AICTE | Affiliated to Shivaji University, Kolhapur
              </p>
              <div style={{ marginTop: "8px", display: "inline-block", background: "#ffca08", color: "#000", fontWeight: "800", fontSize: "11px", padding: "2px 10px", borderRadius: "12px" }}>
                OFFICIAL ATTENDANCE CERTIFICATE & EXAMINATION CLEARANCE
              </div>
            </div>

            {/* Certificate Body */}
            <div style={{ padding: "24px", fontSize: "13px", lineHeight: "1.6" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", background: "#f8fafc", padding: "14px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "16px" }}>
                <div><strong>Student Name:</strong> {student.full_name}</div>
                <div><strong>PRN / Roll No:</strong> {student.prn}</div>
                <div><strong>Department:</strong> {student.branch}</div>
                <div><strong>Academic Year / Div:</strong> {student.year} (Div {student.division})</div>
                <div><strong>College Email:</strong> {student.email}</div>
                <div><strong>Date of Issue:</strong> {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
              </div>

              {/* Metrics Table */}
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "16px", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                    <th style={{ padding: "8px 12px", border: "1px solid #cbd5e1" }}>Metric</th>
                    <th style={{ padding: "8px 12px", border: "1px solid #cbd5e1" }}>Record</th>
                    <th style={{ padding: "8px 12px", border: "1px solid #cbd5e1" }}>Requirement</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: "8px 12px", border: "1px solid #cbd5e1" }}>Total Academic Lectures</td>
                    <td style={{ padding: "8px 12px", border: "1px solid #cbd5e1", fontWeight: "700" }}>{attendanceStats?.total || 0}</td>
                    <td style={{ padding: "8px 12px", border: "1px solid #cbd5e1" }}>Mandatory Minimum</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "8px 12px", border: "1px solid #cbd5e1" }}>Lectures Attended (Verified)</td>
                    <td style={{ padding: "8px 12px", border: "1px solid #cbd5e1", fontWeight: "700", color: "#166534" }}>{attendanceStats?.present || 0}</td>
                    <td style={{ padding: "8px 12px", border: "1px solid #cbd5e1" }}>Biometric QR & Face Verified</td>
                  </tr>
                  <tr style={{ background: (attendanceStats?.percentage || 0) >= 75 ? "#f0fdf4" : "#fef2f2" }}>
                    <td style={{ padding: "8px 12px", border: "1px solid #cbd5e1", fontWeight: "750" }}>Attendance Percentage</td>
                    <td style={{ padding: "8px 12px", border: "1px solid #cbd5e1", fontWeight: "800", color: (attendanceStats?.percentage || 0) >= 75 ? "#166534" : "#991b1b" }}>
                      {attendanceStats?.percentage || 0}%
                    </td>
                    <td style={{ padding: "8px 12px", border: "1px solid #cbd5e1", fontWeight: "700" }}>
                      {(attendanceStats?.percentage || 0) >= 75 ? "✅ 75% Criteria Satisfied" : "❌ Defaulter Threshold (<75%)"}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Clearance Seal */}
              <div style={{
                padding: "12px 16px",
                borderRadius: "8px",
                background: (attendanceStats?.percentage || 0) >= 75 ? "#f0fdf4" : "#fef2f2",
                border: `1.5px solid ${(attendanceStats?.percentage || 0) >= 75 ? "#86efac" : "#fca5a5"}`,
                textAlign: "center",
                marginBottom: "20px"
              }}>
                <span style={{ fontSize: "13.5px", fontWeight: "800", color: (attendanceStats?.percentage || 0) >= 75 ? "#166534" : "#991b1b" }}>
                  {(attendanceStats?.percentage || 0) >= 75
                    ? "🎓 CERTIFIED: ELIGIBLE TO APPEAR FOR UNIVERSITY END-SEMESTER EXAMINATIONS"
                    : "⚠️ ATTENTION: ATTENDANCE SHORTAGE DETECTED. CONTACT HOD OFFICE FOR REMEDIAL SESSIONS"}
                </span>
              </div>

              {/* Signatures */}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "20px", paddingTop: "12px", borderTop: "1px dashed #cbd5e1", fontSize: "12px" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontWeight: "750", color: "#1e3a8a" }}>Digitally Verified System Seal</div>
                  <div style={{ color: "#64748b", fontSize: "11px" }}>RIT Cloud Examination Cell</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontWeight: "750", color: "#1e3a8a" }}>Academic Dean & HOD</div>
                  <div style={{ color: "#64748b", fontSize: "11px" }}>Rajarambapu Institute of Technology</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "10px", marginTop: "18px" }}>
                <button
                  type="button"
                  onClick={() => setShowCertificateModal(false)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    background: "#f3f4f6",
                    color: "#374151",
                    fontWeight: "700",
                    cursor: "pointer"
                  }}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{
                    flex: 2,
                    padding: "10px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#ffca08",
                    color: "#000000",
                    fontWeight: "800",
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(255,202,8,0.3)"
                  }}
                >
                  🖨️ Print / Save as PDF
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
          #print-certificate-content, #print-certificate-content * {
            visibility: visible;
          }
          #print-certificate-content {
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
