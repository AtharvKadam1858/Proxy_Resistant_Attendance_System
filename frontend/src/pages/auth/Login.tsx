import { useState, useRef, useEffect } from "react";
import "../../styles/login.css";
import RITLogo from "../../assets/RIT_logo.jpeg";

import {
  loginUserWithSupabase,
  registerStudent,
  registerTeacher,
  registerAdmin,
  resetUserPasswordWithVerification
} from "../../services/supabase";

export default function Login() {
  const [role, setRole] = useState("teacher");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Clear previous session on visit to guarantee clean authentication
  useEffect(() => {
    localStorage.clear();
  }, []);

  // 🔑 Forgot / Reset Password State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotRole, setForgotRole] = useState("student");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotKey, setForgotKey] = useState(""); // PRN for student, Teacher ID, Admin ID
  const [forgotNewPass, setForgotNewPass] = useState("");
  const [forgotConfirmPass, setForgotConfirmPass] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState("");

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMsg("");

    if (!forgotEmail || !forgotKey || !forgotNewPass) {
      setForgotMsg("❌ Please fill in all required fields.");
      return;
    }
    if (forgotNewPass.length < 6) {
      setForgotMsg("❌ Password must be at least 6 characters long.");
      return;
    }
    if (forgotNewPass !== forgotConfirmPass) {
      setForgotMsg("❌ Passwords do not match. Please verify.");
      return;
    }

    setForgotLoading(true);
    try {
      const res = await resetUserPasswordWithVerification(
        forgotRole,
        forgotEmail,
        forgotKey,
        forgotNewPass
      );
      setForgotMsg(`✅ ${res.message}`);
      setTimeout(() => {
        setEmail(forgotEmail);
        setPassword(forgotNewPass);
        setRole(forgotRole);
        setShowForgotModal(false);
        setMsg("✅ Password reset successfully! Click Login to enter your portal.");
      }, 1800);
    } catch (err: any) {
      setForgotMsg(err?.message || "❌ Failed to reset password.");
    } finally {
      setForgotLoading(false);
    }
  };

  // Self-Registration State & Comprehensive Details
  const [isRegistering, setIsRegistering] = useState(false);
  const [regForm, setRegForm] = useState({
    prn: "",
    full_name: "",
    email: "",
    phone: "",
    parent_phone: "",
    blood_group: "A+",
    address: "",
    branch: "AIML",
    year: "Final Year",
    division: "A",
    gender: "Male",
    password: "",
  });
  const [photoPreview, setPhotoPreview] = useState("");
  const [regSuccess, setRegSuccess] = useState(false);

  // 👨‍🏫 Teacher / Faculty Self-Registration State
  const [teacherRegForm, setTeacherRegForm] = useState({
    teacher_id: "",
    full_name: "",
    email: "",
    phone: "",
    department: "AIML",
    designation: "Assistant Professor",
    password: "",
  });

  // 🛡️ Admin Self-Registration State
  const [adminRegForm, setAdminRegForm] = useState({
    admin_id: "",
    full_name: "",
    email: "",
    password: "",
  });

  // Live Camera Snap State for Registration
  const [showRegCamera, setShowRegCamera] = useState(false);
  const regVideoRef = useRef<HTMLVideoElement | null>(null);
  const regStreamRef = useRef<MediaStream | null>(null);

  const startRegCamera = async () => {
    try {
      setShowRegCamera(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
      });
      regStreamRef.current = stream;
      if (regVideoRef.current) {
        regVideoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      alert("Camera error: " + (err?.message || "Please allow camera access."));
      setShowRegCamera(false);
    }
  };

  const stopRegCamera = () => {
    if (regStreamRef.current) {
      regStreamRef.current.getTracks().forEach((t) => t.stop());
      regStreamRef.current = null;
    }
    setShowRegCamera(false);
  };

  const captureRegPhoto = () => {
    if (!regVideoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const vid = regVideoRef.current;
      const minDim = Math.min(vid.videoWidth || 400, vid.videoHeight || 400);
      const sx = ((vid.videoWidth || 400) - minDim) / 2;
      const sy = ((vid.videoHeight || 400) - minDim) / 2;
      ctx.drawImage(vid, sx, sy, minDim, minDim, 0, 0, 400, 400);
      setPhotoPreview(canvas.toDataURL("image/jpeg", 0.85));
    }
    stopRegCamera();
  };

  const login = async () => {
    setMsg("");

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail) {
      setMsg("❌ Please enter your registered college email.");
      return;
    }

    if (!cleanPassword) {
      setMsg("❌ Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      // 100% Strict Database Authentication - Zero bypass!
      const data = await loginUserWithSupabase(cleanEmail, role, cleanPassword);

      if (!data || !data.success) {
        throw new Error("❌ Invalid credentials. Access denied.");
      }

      if (role === "student") {
        const student = data.student;
        if (!student || !student.prn) {
          throw new Error("Student PRN was not returned by server.");
        }

        localStorage.setItem("role", "student");
        localStorage.setItem("prn", student.prn);
        localStorage.setItem("email", student.email);
        localStorage.setItem("full_name", student.full_name);

        console.log("Student logged in:", student.prn);
        window.location.href = "/profile";
        return;
      }

      if (role === "teacher") {
        const teacher = data.teacher;
        if (!teacher || !teacher.teacher_id) {
          throw new Error("Teacher ID was not returned by server.");
        }

        localStorage.setItem("role", "teacher");
        localStorage.setItem("teacher_id", teacher.teacher_id);
        localStorage.setItem("email", teacher.email);
        localStorage.setItem("full_name", teacher.full_name);

        window.location.href = "/teacher";
        return;
      }

      if (role === "admin") {
        const admin = data.admin;
        if (!admin || !admin.admin_id) {
          throw new Error("Admin ID was not returned by server.");
        }

        localStorage.setItem("role", "admin");
        localStorage.setItem("admin_id", admin.admin_id);
        localStorage.setItem("email", admin.email);
        localStorage.setItem("full_name", admin.full_name);

        window.location.href = "/admin";
        return;
      }
    } catch (err: any) {
      console.error("Login authentication rejected:", err);
      setMsg(err?.message || "❌ Login failed. Invalid email or password.");
      setLoading(false);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Photo size must be less than 5 MB.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
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
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          setPhotoPreview(canvas.toDataURL("image/jpeg", 0.85));
        } else {
          setPhotoPreview(event.target?.result as string);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");

    if (!regForm.prn.trim()) {
      setMsg("Please enter your Student PRN.");
      return;
    }
    if (!regForm.full_name.trim()) {
      setMsg("Please enter your Full Name.");
      return;
    }
    if (!regForm.email.trim() || !regForm.email.includes("@")) {
      setMsg("Please enter a valid student email address.");
      return;
    }
    if (!regForm.phone.trim() || !/^\d{10}$/.test(regForm.phone.replace(/[\s-]/g, ""))) {
      setMsg("Student 10-digit mobile number is mandatory for institutional record.");
      return;
    }
    if (!photoPreview) {
      setMsg("Profile photo is strictly required for facial verification. Please snap or upload a clear front-facing face photo.");
      return;
    }
    if (!regForm.password || regForm.password.length < 6) {
      setMsg("Password must be at least 6 characters.");
      return;
    }

    try {
      setLoading(true);

      const result = await registerStudent({
        prn: regForm.prn,
        full_name: regForm.full_name,
        email: regForm.email,
        phone: regForm.phone,
        parent_phone: regForm.parent_phone,
        blood_group: regForm.blood_group,
        address: regForm.address,
        branch: regForm.branch,
        year: regForm.year,
        division: regForm.division,
        gender: regForm.gender,
        password: regForm.password,
        avatar_url: photoPreview,
      });

      setRegSuccess(true);
      setMsg("✅ " + result.message);

      // Auto login
      localStorage.setItem("role", "student");
      localStorage.setItem("prn", result.student.prn);
      localStorage.setItem("email", result.student.email);
      localStorage.setItem("full_name", result.student.full_name);

      setTimeout(() => {
        window.location.href = "/profile";
      }, 1200);
    } catch (err: any) {
      console.error("Registration error:", err);
      setMsg("❌ " + (err?.message || "Registration failed."));
      setLoading(false);
    }
  };

  const handleTeacherRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");

    if (!teacherRegForm.teacher_id.trim()) {
      setMsg("Please enter Teacher ID (e.g. TCH003).");
      return;
    }
    if (!teacherRegForm.full_name.trim()) {
      setMsg("Please enter your Full Name.");
      return;
    }
    if (!teacherRegForm.email.trim() || !teacherRegForm.email.includes("@")) {
      setMsg("Please enter a valid faculty college email address.");
      return;
    }
    if (!teacherRegForm.phone.trim() || !/^\d{10}$/.test(teacherRegForm.phone.replace(/[\s-]/g, ""))) {
      setMsg("Faculty 10-digit mobile number is required.");
      return;
    }
    if (!teacherRegForm.password || teacherRegForm.password.length < 6) {
      setMsg("Password must be at least 6 characters.");
      return;
    }

    try {
      setLoading(true);
      const result = await registerTeacher(teacherRegForm);
      setRegSuccess(true);
      setMsg("✅ " + result.message);

      localStorage.setItem("role", "teacher");
      localStorage.setItem("teacher_id", result.teacher.teacher_id);
      localStorage.setItem("email", result.teacher.email);
      localStorage.setItem("full_name", result.teacher.full_name);

      setTimeout(() => {
        window.location.href = "/teacher";
      }, 1200);
    } catch (err: any) {
      console.error("Teacher registration error:", err);
      setMsg("❌ " + (err?.message || "Faculty registration failed."));
      setLoading(false);
    }
  };

  const handleAdminRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");

    if (!adminRegForm.admin_id.trim()) {
      setMsg("Please enter Administrator ID (e.g. ADM003).");
      return;
    }
    if (!adminRegForm.full_name.trim()) {
      setMsg("Please enter Full Name.");
      return;
    }
    if (!adminRegForm.email.trim() || !adminRegForm.email.includes("@")) {
      setMsg("Please enter a valid administrator email address.");
      return;
    }
    if (!adminRegForm.password || adminRegForm.password.length < 6) {
      setMsg("Password must be at least 6 characters.");
      return;
    }

    try {
      setLoading(true);
      const result = await registerAdmin(adminRegForm);
      setRegSuccess(true);
      setMsg("✅ " + result.message);

      localStorage.setItem("role", "admin");
      localStorage.setItem("admin_id", result.admin.admin_id);
      localStorage.setItem("email", result.admin.email);
      localStorage.setItem("full_name", result.admin.full_name);

      setTimeout(() => {
        window.location.href = "/admin";
      }, 1200);
    } catch (err: any) {
      console.error("Admin registration error:", err);
      setMsg("❌ " + (err?.message || "Admin registration failed."));
      setLoading(false);
    }
  };

  return (
    <div className="login-box">
      <div className="login-header">
        <img
          src={RITLogo}
          alt="RIT Logo"
          className="rit-logo"
        />

        <div>
          <h2>Proxy-Resistant Smart Attendance System</h2>
          <span className="badge-cloud-ready">⚡ Cloud Database Connected</span>
        </div>
      </div>

      {!isRegistering ? (
        <>
          <div className="tabs">
            <button
              type="button"
              className={role === "teacher" ? "active" : ""}
              onClick={() => {
                setRole("teacher");
                setMsg("");
              }}
            >
              Teacher Login
            </button>

            <button
              type="button"
              className={role === "student" ? "active" : ""}
              onClick={() => {
                setRole("student");
                setMsg("");
              }}
            >
              Student Login
            </button>

            <button
              type="button"
              className={role === "admin" ? "active" : ""}
              onClick={() => {
                setRole("admin");
                setMsg("");
              }}
            >
              Admin Login
            </button>
          </div>

          <input
            type="text"
            placeholder={
              role === "student"
                ? "Enter College Email or PRN"
                : role === "teacher"
                ? "Enter Faculty Email or Teacher ID"
                : "Enter Admin Email or Admin ID"
            }
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            autoCapitalize="none"
            autoCorrect="off"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px", marginBottom: "14px" }}>
            <span style={{ fontSize: "11.5px", color: "#6b7280" }}>
              🔒 100% Database Verified
            </span>
            <button
              type="button"
              onClick={() => {
                setShowForgotModal(true);
                setForgotRole(role);
                setForgotEmail(email);
                setForgotMsg("");
              }}
              style={{
                background: "none",
                border: "none",
                color: "#b45309",
                fontWeight: "750",
                fontSize: "12.5px",
                cursor: "pointer",
                padding: "2px 4px",
                textDecoration: "underline"
              }}
            >
              🔑 Forgot Password?
            </button>
          </div>

          <button
            type="button"
            className="login-btn"
            onClick={login}
            disabled={loading}
          >
            {loading ? "Authenticating with Cloud DB..." : `Login as ${role.charAt(0).toUpperCase() + role.slice(1)}`}
          </button>

          <div style={{ marginTop: "18px" }}>
            {role === "student" && (
              <button
                type="button"
                className="toggle-auth-btn"
                onClick={() => {
                  setIsRegistering(true);
                  setMsg("");
                }}
              >
                🎓 New Student? Register yourself here (Instant Enrollment)
              </button>
            )}
            {role === "teacher" && (
              <button
                type="button"
                className="toggle-auth-btn"
                onClick={() => {
                  setIsRegistering(true);
                  setMsg("");
                }}
              >
                👨‍🏫 New Faculty / Teacher? Register yourself here
              </button>
            )}
            {role === "admin" && (
              <button
                type="button"
                className="toggle-auth-btn"
                onClick={() => {
                  setIsRegistering(true);
                  setMsg("");
                }}
              >
                🛡️ New Administrator? Register new admin here
              </button>
            )}
          </div>
        </>
      ) : role === "teacher" ? (
        <form onSubmit={handleTeacherRegisterSubmit}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <h3 style={{ margin: 0, color: "#111827", fontSize: "20px", fontWeight: "700" }}>
              👨‍🏫 Faculty / Teacher Registration
            </h3>
            <button
              type="button"
              className="toggle-auth-btn"
              style={{ marginTop: 0 }}
              onClick={() => {
                setIsRegistering(false);
                setMsg("");
              }}
            >
              ← Back to Login
            </button>
          </div>

          <p style={{ margin: "0 0 16px 0", color: "#6b7280", fontSize: "13px", textAlign: "left" }}>
            Register new faculty member account with official institutional credentials to manage classrooms and attendance.
          </p>

          <div className="register-grid">
            <div className="form-group">
              <label>Teacher ID *</label>
              <input
                type="text"
                placeholder="e.g. TCH003"
                value={teacherRegForm.teacher_id}
                onChange={(e) => setTeacherRegForm({ ...teacherRegForm, teacher_id: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Full Name *</label>
              <input
                type="text"
                placeholder="e.g. Dr. John Doe"
                value={teacherRegForm.full_name}
                onChange={(e) => setTeacherRegForm({ ...teacherRegForm, full_name: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>College Email *</label>
              <input
                type="email"
                placeholder="e.g. faculty@ritindia.edu"
                value={teacherRegForm.email}
                onChange={(e) => setTeacherRegForm({ ...teacherRegForm, email: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Mobile Number *</label>
              <input
                type="tel"
                placeholder="10-digit mobile number"
                value={teacherRegForm.phone}
                onChange={(e) => setTeacherRegForm({ ...teacherRegForm, phone: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Department *</label>
              <select
                value={teacherRegForm.department}
                onChange={(e) => setTeacherRegForm({ ...teacherRegForm, department: e.target.value })}
                disabled={loading}
              >
                <option value="AIML">AIML</option>
                <option value="CSE">CSE</option>
                <option value="Electrical">Electrical</option>
                <option value="Mechanical">Mechanical</option>
                <option value="Civil">Civil</option>
                <option value="ETC">ETC</option>
              </select>
            </div>

            <div className="form-group">
              <label>Designation *</label>
              <select
                value={teacherRegForm.designation}
                onChange={(e) => setTeacherRegForm({ ...teacherRegForm, designation: e.target.value })}
                disabled={loading}
              >
                <option value="Assistant Professor">Assistant Professor</option>
                <option value="Associate Professor">Associate Professor</option>
                <option value="Professor">Professor</option>
                <option value="Head of Department (HOD)">Head of Department (HOD)</option>
                <option value="Visiting Faculty">Visiting Faculty</option>
              </select>
            </div>

            <div className="form-group register-full-width">
              <label>Account Password (min 6 chars) *</label>
              <input
                type="password"
                placeholder="Set secure password"
                value={teacherRegForm.password}
                onChange={(e) => setTeacherRegForm({ ...teacherRegForm, password: e.target.value })}
                required
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            className="login-btn"
            disabled={loading || regSuccess}
            style={{ marginTop: "16px" }}
          >
            {loading ? "Registering Faculty..." : "Complete Registration & Enter Faculty Portal"}
          </button>
        </form>
      ) : role === "admin" ? (
        <form onSubmit={handleAdminRegisterSubmit}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <h3 style={{ margin: 0, color: "#111827", fontSize: "20px", fontWeight: "700" }}>
              🛡️ Administrator Registration
            </h3>
            <button
              type="button"
              className="toggle-auth-btn"
              style={{ marginTop: 0 }}
              onClick={() => {
                setIsRegistering(false);
                setMsg("");
              }}
            >
              ← Back to Login
            </button>
          </div>

          <p style={{ margin: "0 0 16px 0", color: "#6b7280", fontSize: "13px", textAlign: "left" }}>
            Register a new system administrator account with full database management privileges.
          </p>

          <div className="register-grid">
            <div className="form-group">
              <label>Admin ID *</label>
              <input
                type="text"
                placeholder="e.g. ADM003"
                value={adminRegForm.admin_id}
                onChange={(e) => setAdminRegForm({ ...adminRegForm, admin_id: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Full Name *</label>
              <input
                type="text"
                placeholder="e.g. System Administrator"
                value={adminRegForm.full_name}
                onChange={(e) => setAdminRegForm({ ...adminRegForm, full_name: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group register-full-width">
              <label>Official Email *</label>
              <input
                type="email"
                placeholder="e.g. admin@ritindia.edu"
                value={adminRegForm.email}
                onChange={(e) => setAdminRegForm({ ...adminRegForm, email: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group register-full-width">
              <label>Account Password (min 6 chars) *</label>
              <input
                type="password"
                placeholder="Set secure admin password"
                value={adminRegForm.password}
                onChange={(e) => setAdminRegForm({ ...adminRegForm, password: e.target.value })}
                required
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            className="login-btn"
            disabled={loading || regSuccess}
            style={{ marginTop: "16px" }}
          >
            {loading ? "Registering Admin..." : "Complete Registration & Enter Admin Portal"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleRegisterSubmit}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <h3 style={{ margin: 0, color: "#111827", fontSize: "20px", fontWeight: "700" }}>
              🎓 Student Self-Registration
            </h3>
            <button
              type="button"
              className="toggle-auth-btn"
              style={{ marginTop: 0 }}
              onClick={() => {
                setIsRegistering(false);
                setMsg("");
              }}
            >
              ← Back to Login
            </button>
          </div>

          <p style={{ margin: "0 0 16px 0", color: "#6b7280", fontSize: "13px", textAlign: "left" }}>
            Register your student profile to mark attendance instantly. No model retraining required.
          </p>

          <div className="register-grid">
            <div className="form-group">
              <label>Student PRN *</label>
              <input
                type="text"
                placeholder="Enter Student PRN / Roll No"
                value={regForm.prn}
                onChange={(e) => setRegForm({ ...regForm, prn: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Full Name *</label>
              <input
                type="text"
                placeholder="e.g. Student Name"
                value={regForm.full_name}
                onChange={(e) => setRegForm({ ...regForm, full_name: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>College Email *</label>
              <input
                type="email"
                placeholder="e.g. student@ritindia.edu"
                value={regForm.email}
                onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Student Mobile Number *</label>
              <input
                type="tel"
                placeholder="10-digit mobile number"
                value={regForm.phone}
                onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Parent / Guardian Mobile</label>
              <input
                type="tel"
                placeholder="Emergency contact number"
                value={regForm.parent_phone}
                onChange={(e) => setRegForm({ ...regForm, parent_phone: e.target.value })}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Department / Branch *</label>
              <select
                value={regForm.branch}
                onChange={(e) => setRegForm({ ...regForm, branch: e.target.value })}
                disabled={loading}
              >
                <option value="AIML">AIML</option>
                <option value="CSE">CSE</option>
                <option value="Electrical">Electrical</option>
                <option value="Mechanical">Mechanical</option>
                <option value="Civil">Civil</option>
                <option value="ETC">ETC</option>
              </select>
            </div>

            <div className="form-group">
              <label>Class / Year *</label>
              <select
                value={regForm.year}
                onChange={(e) => setRegForm({ ...regForm, year: e.target.value })}
                disabled={loading}
              >
                <option value="First Year">First Year</option>
                <option value="Second Year">Second Year</option>
                <option value="Third Year">Third Year</option>
                <option value="Final Year">Final Year</option>
              </select>
            </div>

            <div className="form-group">
              <label>Division *</label>
              <select
                value={regForm.division}
                onChange={(e) => setRegForm({ ...regForm, division: e.target.value })}
                disabled={loading}
              >
                <option value="A">Division A</option>
                <option value="B">Division B</option>
                <option value="C">Division C</option>
              </select>
            </div>

            <div className="form-group">
              <label>Gender *</label>
              <select
                value={regForm.gender}
                onChange={(e) => setRegForm({ ...regForm, gender: e.target.value })}
                disabled={loading}
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label>Blood Group</label>
              <select
                value={regForm.blood_group}
                onChange={(e) => setRegForm({ ...regForm, blood_group: e.target.value })}
                disabled={loading}
              >
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
              </select>
            </div>

            <div className="form-group">
              <label>Permanent / Hostel Address</label>
              <input
                type="text"
                placeholder="City / Hostel / Town"
                value={regForm.address}
                onChange={(e) => setRegForm({ ...regForm, address: e.target.value })}
                disabled={loading}
              />
            </div>

            <div className="form-group register-full-width">
              <label>Account Password (min 6 chars) *</label>
              <input
                type="password"
                placeholder="Choose a secure password"
                value={regForm.password}
                onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group register-full-width photo-upload-box" style={{ background: "#f8fafc", padding: "16px", borderRadius: "10px", border: "1.5px dashed #cbd5e1" }}>
              <label style={{ marginBottom: "8px", fontWeight: "700", color: "#1e293b", display: "block" }}>
                Face Verification Reference Photo *
              </label>
              <p style={{ margin: "0 0 12px 0", fontSize: "12.5px", color: "#64748b" }}>
                Capture or upload a clear, front-facing facial photo for biometric attendance verification.
              </p>

              {photoPreview && (
                <div style={{ textAlign: "center", marginBottom: "12px" }}>
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="photo-preview-circle"
                    style={{ width: "90px", height: "90px", borderRadius: "50%", objectFit: "cover", border: "3px solid #22c55e", boxShadow: "0 4px 10px rgba(0,0,0,0.1)" }}
                  />
                  <div style={{ color: "#16a34a", fontSize: "12px", fontWeight: "600", marginTop: "4px" }}>
                    ✓ Face Photo Captured & Ready
                  </div>
                </div>
              )}

              {showRegCamera ? (
                <div style={{ textAlign: "center", background: "#000", padding: "12px", borderRadius: "8px", maxWidth: "340px", margin: "0 auto" }}>
                  <video
                    ref={regVideoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ width: "100%", maxHeight: "240px", borderRadius: "6px", objectFit: "cover" }}
                  />
                  <div style={{ marginTop: "10px", display: "flex", gap: "8px", justifyContent: "center" }}>
                    <button
                      type="button"
                      onClick={captureRegPhoto}
                      style={{ background: "#22c55e", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "6px", fontWeight: "700", cursor: "pointer", fontSize: "13px" }}
                    >
                      📸 Snap Photo
                    </button>
                    <button
                      type="button"
                      onClick={stopRegCamera}
                      style={{ background: "#ef4444", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "6px", fontWeight: "600", cursor: "pointer", fontSize: "13px" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={startRegCamera}
                    style={{ background: "#1e3a8a", color: "#ffffff", border: "none", padding: "9px 16px", borderRadius: "6px", fontWeight: "600", fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    📷 Snap with Camera
                  </button>
                  <label
                    style={{ background: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1", padding: "9px 16px", borderRadius: "6px", fontWeight: "600", fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px", marginBottom: 0 }}
                  >
                    📁 Upload from File
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handlePhotoSelect}
                      disabled={loading}
                      style={{ display: "none" }}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="login-btn"
            disabled={loading || regSuccess}
          >
            {loading ? "Registering Profile..." : "Complete Registration & Enter Portal"}
          </button>
        </form>
      )}

      {/* 🔑 FORGOT / RESET PASSWORD MODAL */}
      {showForgotModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.65)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "16px"
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: "16px",
            maxWidth: "440px",
            width: "100%",
            boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
            overflow: "hidden",
            border: "1px solid #e2e8f0"
          }}>
            <div style={{
              background: "linear-gradient(135deg, #1e3a8a 0%, #0284c7 100%)",
              padding: "18px 20px",
              color: "#ffffff",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "750" }}>🔑 Reset Account Password</h3>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", opacity: 0.9 }}>
                  100% Secure Database-Verified Self-Service Recovery
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#ffffff",
                  fontSize: "22px",
                  cursor: "pointer",
                  padding: "0 4px"
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleForgotSubmit} style={{ padding: "20px" }}>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: "700", color: "#374151", marginBottom: "5px" }}>
                  Select Account Role *
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  {(["student", "teacher", "admin"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setForgotRole(r)}
                      style={{
                        flex: 1,
                        padding: "7px 10px",
                        fontSize: "12px",
                        fontWeight: "700",
                        borderRadius: "6px",
                        border: "1px solid",
                        borderColor: forgotRole === r ? "#ffca08" : "#d1d5db",
                        background: forgotRole === r ? "#fffbeb" : "#f9fafb",
                        color: forgotRole === r ? "#92400e" : "#4b5563",
                        cursor: "pointer"
                      }}
                    >
                      {r === "student" ? "Student" : r === "teacher" ? "Teacher" : "Admin"}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: "700", color: "#374151", marginBottom: "5px" }}>
                  Registered College Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. yourname@ritindia.edu"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "7px",
                    border: "1px solid #d1d5db",
                    fontSize: "13px",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: "700", color: "#374151", marginBottom: "5px" }}>
                  {forgotRole === "student" ? "Security Verification: Student PRN *" : forgotRole === "teacher" ? "Security Verification: Teacher ID *" : "Security Verification: Admin ID *"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={forgotRole === "student" ? "Enter your PRN (or registered phone)" : forgotRole === "teacher" ? "Enter Teacher ID (e.g. TCH001)" : "Enter Admin ID (e.g. ADM001)"}
                  value={forgotKey}
                  onChange={(e) => setForgotKey(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "7px",
                    border: "1px solid #d1d5db",
                    fontSize: "13px",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: "700", color: "#374151", marginBottom: "5px" }}>
                  New Password (min 6 characters) *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter new password"
                  value={forgotNewPass}
                  onChange={(e) => setForgotNewPass(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "7px",
                    border: "1px solid #d1d5db",
                    fontSize: "13px",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: "700", color: "#374151", marginBottom: "5px" }}>
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Re-enter new password"
                  value={forgotConfirmPass}
                  onChange={(e) => setForgotConfirmPass(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "7px",
                    border: "1px solid #d1d5db",
                    fontSize: "13px",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              {forgotMsg && (
                <div style={{
                  padding: "10px 12px",
                  borderRadius: "7px",
                  fontSize: "12.5px",
                  fontWeight: "600",
                  marginBottom: "14px",
                  background: forgotMsg.startsWith("✅") ? "#f0fdf4" : "#fef2f2",
                  color: forgotMsg.startsWith("✅") ? "#166534" : "#991b1b",
                  border: `1px solid ${forgotMsg.startsWith("✅") ? "#86efac" : "#fca5a5"}`
                }}>
                  {forgotMsg}
                </div>
              )}

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    background: "#f3f4f6",
                    color: "#374151",
                    fontWeight: "700",
                    fontSize: "13px",
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  style={{
                    flex: 2,
                    padding: "10px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#ffca08",
                    color: "#000000",
                    fontWeight: "800",
                    fontSize: "13px",
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(255,202,8,0.3)"
                  }}
                >
                  {forgotLoading ? "Verifying..." : "Reset & Save Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading && (
        <div className="loading">
          <p>Processing with Cloud Database...</p>
        </div>
      )}

      {msg && (
        <p
          className="login-message"
          style={{
            color: msg.startsWith("✅") ? "#16a34a" : "#d32f2f",
            fontWeight: "600",
            fontSize: "14px",
            marginTop: "14px"
          }}
        >
          {msg}
        </p>
      )}
    </div>
  );
}
