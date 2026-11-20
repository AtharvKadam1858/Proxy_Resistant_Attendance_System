import { useState, useRef, useEffect } from "react";
import "../../styles/login.css";
import RITLogo from "../../assets/RIT_logo.jpeg";

import {
  loginUserWithSupabase,
  registerStudent,
  validateAccountForPasswordReset,
  commitPasswordResetWithOtp,
} from "../../services/supabase";
import {
  sendPasswordResetOtpEmail,
  playSuccessChime,
  triggerHapticFeedback,
} from "../../services/emailService";

export default function Login() {
  const [role, setRole] = useState("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Clear previous session on visit to guarantee clean authentication
  useEffect(() => {
    localStorage.clear();
  }, []);

  // 🔑 Forgot / Reset Password State with Two-Step Numerical Email OTP Verification
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [otpStep, setOtpStep] = useState<1 | 2>(1);
  const [forgotRole, setForgotRole] = useState("student");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotKey, setForgotKey] = useState(""); // PRN for student, Teacher ID, Admin ID
  const [candidateName, setCandidateName] = useState("");
  const [verifiedIdentifier, setVerifiedIdentifier] = useState("");
  const [activeOtp, setActiveOtp] = useState("");
  const [otpTimestamp, setOtpTimestamp] = useState<number>(0);
  const [enteredOtp, setEnteredOtp] = useState("");
  const [forgotNewPass, setForgotNewPass] = useState("");
  const [forgotConfirmPass, setForgotConfirmPass] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  // Timer cooldown for OTP resend
  useEffect(() => {
    let interval: any = null;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Generate unique strictly numerical 6-digit OTP
  const generateNumericOtp = (excludeOtp?: string): string => {
    let code = "";
    do {
      code = Math.floor(100000 + Math.random() * 900000).toString();
    } while (excludeOtp && code === excludeOtp);
    return code;
  };

  // Step 1: Validate Account & Dispatch Numerical OTP to Registered Email
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMsg("");

    const cleanEmail = forgotEmail.trim();
    const cleanKey = forgotKey.trim();

    if (!cleanEmail || !cleanKey) {
      setForgotMsg("❌ Please enter both your registered college email and security verification ID.");
      return;
    }

    setForgotLoading(true);
    try {
      // 1. Verify that this role, email, and ID exist in Supabase
      const account = await validateAccountForPasswordReset(forgotRole, cleanEmail, cleanKey);
      setCandidateName(account.name);
      setVerifiedIdentifier(account.identifier);

      // 2. Generate unique 6-digit numerical OTP
      const newOtp = generateNumericOtp(activeOtp);
      setActiveOtp(newOtp);
      setOtpTimestamp(Date.now());

      // 3. Dispatch OTP via Email Service
      await sendPasswordResetOtpEmail({
        email: account.email,
        role: forgotRole,
        candidateName: account.name,
        identifier: account.identifier,
        otp: newOtp,
      });

      // 4. Advance to Step 2
      setOtpStep(2);
      setResendTimer(30);
      setEnteredOtp("");
      setForgotMsg(`✅ 6-Digit OTP dispatched to ${account.email}. Please check your inbox or spam folder.`);
    } catch (err: any) {
      setForgotMsg(err?.message || "❌ Verification failed. Please ensure the email and ID match registered records.");
    } finally {
      setForgotLoading(false);
    }
  };

  // Resend OTP: Generates a new unique 6-digit numerical OTP and dispatches fresh email
  const handleResendOtp = async () => {
    if (resendTimer > 0 || forgotLoading) return;
    setForgotLoading(true);
    setForgotMsg("");
    try {
      const newOtp = generateNumericOtp(activeOtp);
      setActiveOtp(newOtp);
      setOtpTimestamp(Date.now());

      await sendPasswordResetOtpEmail({
        email: forgotEmail.trim(),
        role: forgotRole,
        candidateName: candidateName,
        identifier: verifiedIdentifier || forgotKey.trim(),
        otp: newOtp,
      });

      setResendTimer(30);
      setEnteredOtp("");
      setForgotMsg(`🔄 Brand new 6-digit numerical OTP sent to ${forgotEmail.trim()}! Check your email.`);
    } catch (err: any) {
      setForgotMsg(err?.message || "❌ Failed to resend OTP. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  // Step 2: Verify Entered Numerical OTP & Update Password in Cloud Database
  const handleVerifyOtpAndResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMsg("");

    const cleanOtp = enteredOtp.trim();
    if (!cleanOtp || cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setForgotMsg("❌ Please enter the exact 6-digit numerical OTP received on your registered email.");
      return;
    }

    // Expiration check (10 minutes)
    if (Date.now() - otpTimestamp > 10 * 60 * 1000) {
      setForgotMsg("❌ OTP has expired (valid for 10 minutes). Click '🔄 Resend New OTP' below to generate a new code.");
      return;
    }

    // Strict numerical OTP match
    if (cleanOtp !== activeOtp) {
      setForgotMsg("❌ Incorrect OTP! The code entered does not match the numerical OTP dispatched to your email.");
      return;
    }

    if (!forgotNewPass || forgotNewPass.length < 6) {
      setForgotMsg("❌ New password must be at least 6 characters long.");
      return;
    }

    if (forgotNewPass !== forgotConfirmPass) {
      setForgotMsg("❌ Passwords do not match. Please verify.");
      return;
    }

    setForgotLoading(true);
    try {
      const res = await commitPasswordResetWithOtp(
        forgotRole,
        verifiedIdentifier || forgotKey.trim(),
        forgotNewPass
      );
      setForgotSuccess(true);
      setForgotMsg(`🎉 ${res.message}`);
      playSuccessChime();
      triggerHapticFeedback();

      setTimeout(() => {
        setEmail(forgotEmail.trim());
        setPassword(forgotNewPass);
        setRole(forgotRole);
        setShowForgotModal(false);
        // Reset modal state
        setOtpStep(1);
        setEnteredOtp("");
        setActiveOtp("");
        setForgotNewPass("");
        setForgotConfirmPass("");
        setForgotSuccess(false);
        setMsg("✅ Password reset successfully! Click Login to enter your portal with your new password.");
      }, 2000);
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
              className={role === "student" ? "active" : ""}
              onClick={() => {
                setRole("student");
                setMsg("");
              }}
            >
              🎓 Student Login
            </button>

            <button
              type="button"
              className={role === "teacher" ? "active" : ""}
              onClick={() => {
                setRole("teacher");
                setIsRegistering(false);
                setMsg("");
              }}
            >
              👨‍🏫 Teacher Login
            </button>

            <button
              type="button"
              className={role === "admin" ? "active" : ""}
              onClick={() => {
                setRole("admin");
                setIsRegistering(false);
                setMsg("");
              }}
            >
              🛡️ Admin Login
            </button>
          </div>

          <input
            type="email"
            placeholder={role === "student" ? "Student College Email (e.g. student@ritindia.edu)" : role === "teacher" ? "Faculty Email (e.g. teacher@ritindia.edu)" : "Administrator Email (e.g. admin@ritindia.edu)"}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
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
                setOtpStep(1);
                setForgotRole(role);
                setForgotEmail(email);
                setForgotKey("");
                setEnteredOtp("");
                setActiveOtp("");
                setForgotNewPass("");
                setForgotConfirmPass("");
                setForgotMsg("");
                setForgotSuccess(false);
                setShowForgotModal(true);
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

          {/* Student-Only Self-Enrollment Button */}
          {role === "student" && (
            <div style={{ marginTop: "18px" }}>
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
            </div>
          )}

          {/* Teacher Security Notice (No Self-Registration Allowed) */}
          {role === "teacher" && (
            <div style={{ marginTop: "18px", padding: "14px 16px", background: "#f8fafc", borderRadius: "10px", border: "1.5px solid #cbd5e1", textAlign: "center" }}>
              <div style={{ fontSize: "13.5px", fontWeight: "800", color: "#0f172a", marginBottom: "4px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                <span>🔒</span> Faculty Self-Registration Restricted
              </div>
              <p style={{ margin: 0, fontSize: "12px", color: "#64748b", lineHeight: "1.5" }}>
                Teachers cannot self-register. New faculty accounts are added exclusively by the System Administrator inside the Admin Portal.
              </p>
            </div>
          )}

          {/* Admin Security Notice (No Self-Registration Allowed) */}
          {role === "admin" && (
            <div style={{ marginTop: "18px", padding: "14px 16px", background: "#f8fafc", borderRadius: "10px", border: "1.5px solid #cbd5e1", textAlign: "center" }}>
              <div style={{ fontSize: "13.5px", fontWeight: "800", color: "#0f172a", marginBottom: "4px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                <span>🛡️</span> Restricted Administrator Portal
              </div>
              <p style={{ margin: 0, fontSize: "12px", color: "#64748b", lineHeight: "1.5" }}>
                Admin accounts cannot be self-registered. Exclusive login for Master Administrator (<strong style={{ color: "#0284c7" }}>admin@ritindia.edu</strong>).
              </p>
            </div>
          )}
        </>
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
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "750" }}>🔐 Secure Numerical Email OTP Reset</h3>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px" }}>
                  <span style={{
                    fontSize: "11px",
                    fontWeight: "750",
                    padding: "2px 8px",
                    borderRadius: "10px",
                    background: otpStep === 1 ? "#ffca08" : "rgba(255,255,255,0.25)",
                    color: otpStep === 1 ? "#000000" : "#ffffff"
                  }}>
                    1. Account Check
                  </span>
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>➔</span>
                  <span style={{
                    fontSize: "11px",
                    fontWeight: "750",
                    padding: "2px 8px",
                    borderRadius: "10px",
                    background: otpStep === 2 ? "#ffca08" : "rgba(255,255,255,0.25)",
                    color: otpStep === 2 ? "#000000" : "#ffffff"
                  }}>
                    2. 6-Digit Email OTP
                  </span>
                </div>
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

            {forgotSuccess ? (
              <div style={{ padding: "34px 24px", textAlign: "center" }}>
                <div style={{ fontSize: "52px", marginBottom: "14px" }}>🎉</div>
                <h3 style={{ margin: "0 0 8px 0", color: "#166534", fontSize: "19px", fontWeight: "800" }}>
                  Password Changed Successfully!
                </h3>
                <p style={{ margin: "0 0 16px 0", color: "#4b5563", fontSize: "13px", lineHeight: "1.5" }}>
                  Your new credentials have been safely committed to the RIT cloud database.
                </p>
                <div style={{
                  display: "inline-block",
                  padding: "8px 18px",
                  background: "#f0fdf4",
                  borderRadius: "20px",
                  color: "#15803d",
                  fontSize: "12.5px",
                  fontWeight: "750",
                  border: "1px solid #bbf7d0"
                }}>
                  ✅ Redirecting to login portal...
                </div>
              </div>
            ) : (
              <>
                {/* STEP 1: Account Identification & Numerical OTP Dispatch */}
                {otpStep === 1 && (
              <form onSubmit={handleRequestOtp} style={{ padding: "20px" }}>
                <div style={{
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  marginBottom: "14px",
                  fontSize: "12px",
                  color: "#1e40af",
                  lineHeight: "1.45"
                }}>
                  🛡️ <strong>Anti-Tamper Security:</strong> To prevent unauthorized password modifications by others, a unique 6-digit numerical OTP will be sent to the candidate's registered college email.
                </div>

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
                    placeholder="e.g. candidate@ritindia.edu"
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

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: "700", color: "#374151", marginBottom: "5px" }}>
                    {forgotRole === "student"
                      ? "Security Verification: Student PRN *"
                      : forgotRole === "teacher"
                      ? "Security Verification: Teacher ID *"
                      : "Security Verification: Admin ID *"}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={
                      forgotRole === "student"
                        ? "Enter your registered PRN"
                        : forgotRole === "teacher"
                        ? "Enter Teacher ID (e.g. TCH001)"
                        : "Enter Admin ID (e.g. ADM001)"
                    }
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
                      cursor: forgotLoading ? "not-allowed" : "pointer",
                      boxShadow: "0 2px 8px rgba(255,202,8,0.3)"
                    }}
                  >
                    {forgotLoading ? "Verifying & Sending OTP..." : "📨 Send 6-Digit OTP to Email"}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: Numerical OTP Verification & Password Reset */}
            {otpStep === 2 && (
              <form onSubmit={handleVerifyOtpAndResetPassword} style={{ padding: "20px" }}>
                <div style={{
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  marginBottom: "14px",
                  fontSize: "12.5px",
                  color: "#166534"
                }}>
                  <div style={{ fontWeight: "750", display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                    <span>📧</span> OTP Sent to: <span style={{ color: "#0f766e" }}>{forgotEmail}</span>
                  </div>
                  <div style={{ fontSize: "11.5px", color: "#374151" }}>
                    Candidate: <strong>{candidateName}</strong> ({forgotRole.toUpperCase()}: {verifiedIdentifier || forgotKey})
                  </div>
                  <div style={{ fontSize: "11px", color: "#dc2626", marginTop: "3px", fontWeight: "600" }}>
                    ⏱️ Code expires in 10 minutes • Strictly 6 numerical digits
                  </div>
                </div>

                <div style={{ marginBottom: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                    <label style={{ fontSize: "12.5px", fontWeight: "750", color: "#1f2937" }}>
                      Enter 6-Digit Numerical OTP *
                    </label>
                    <button
                      type="button"
                      disabled={resendTimer > 0 || forgotLoading}
                      onClick={handleResendOtp}
                      style={{
                        background: "none",
                        border: "none",
                        color: resendTimer > 0 ? "#9ca3af" : "#2563eb",
                        fontWeight: "750",
                        fontSize: "12px",
                        cursor: resendTimer > 0 ? "not-allowed" : "pointer",
                        padding: "0 2px",
                        textDecoration: resendTimer > 0 ? "none" : "underline"
                      }}
                    >
                      {resendTimer > 0 ? `🔄 Resend in ${resendTimer}s` : "🔄 Resend New OTP"}
                    </button>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    placeholder="••••••"
                    value={enteredOtp}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      setEnteredOtp(val);
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      border: "2px solid #3b82f6",
                      background: "#f8fafc",
                      fontSize: "24px",
                      fontWeight: "900",
                      letterSpacing: "8px",
                      textAlign: "center",
                      color: "#1e3a8a",
                      fontFamily: "monospace",
                      boxSizing: "border-box"
                    }}
                  />
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", textAlign: "center" }}>
                    Check your Inbox and Spam folder for code from RIT Security.
                  </div>
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
                    background: forgotMsg.startsWith("✅") || forgotMsg.startsWith("🎉") ? "#f0fdf4" : "#fef2f2",
                    color: forgotMsg.startsWith("✅") || forgotMsg.startsWith("🎉") ? "#166534" : "#991b1b",
                    border: `1px solid ${forgotMsg.startsWith("✅") || forgotMsg.startsWith("🎉") ? "#86efac" : "#fca5a5"}`
                  }}>
                    {forgotMsg}
                  </div>
                )}

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    disabled={forgotLoading}
                    onClick={() => {
                      setOtpStep(1);
                      setForgotMsg("");
                    }}
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
                    ← Back
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
                      cursor: forgotLoading ? "not-allowed" : "pointer",
                      boxShadow: "0 2px 8px rgba(255,202,8,0.3)"
                    }}
                  >
                    {forgotLoading ? "Verifying..." : "🔒 Verify OTP & Reset"}
                  </button>
                </div>
              </form>
            )}
              </>
            )}
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
