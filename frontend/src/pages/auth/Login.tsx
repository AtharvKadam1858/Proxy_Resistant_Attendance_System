import { useState } from "react";
import "../../styles/login.css";
import RITLogo from "../../assets/RIT_logo.jpeg";

import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword
} from "firebase/auth";

import { API_URL } from "../../config";
import { loginUserWithSupabase, registerStudent } from "../../services/supabase";

const firebaseConfig = {
  apiKey: "AIzaSyDsJPGm7CwJEE2o2kI0NAiSKia0YQxEvMs",
  authDomain: "smart-attendance-login.firebaseapp.com",
  projectId: "smart-attendance-login",
  storageBucket: "smart-attendance-login.firebasestorage.app",
  messagingSenderId: "198869708642",
  appId: "1:198869708642:web:b762ec97baf3bb9c97863b6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export default function Login() {
  const [role, setRole] = useState("teacher");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Self-Registration State
  const [isRegistering, setIsRegistering] = useState(false);
  const [regForm, setRegForm] = useState({
    prn: "",
    full_name: "",
    email: "",
    phone: "",
    branch: "AIML",
    year: "Final Year",
    division: "A",
    gender: "Male",
    password: "",
  });
  const [photoPreview, setPhotoPreview] = useState("");
  const [regSuccess, setRegSuccess] = useState(false);

  const login = async () => {
    setMsg("");

    if (!email || !password) {
      setMsg("Please enter email and password");
      return;
    }

    setLoading(true);

    try {
      let data: any = null;

      // 1. Direct Cloud Database (Supabase) authentication (Instant 50ms response)
      try {
        data = await loginUserWithSupabase(email, role);
      } catch (dbErr: any) {
        console.warn("Checking legacy credentials fallback...", dbErr);
      }

      // 2. Firebase Authentication Fallback (if legacy account)
      if (!data || !data.success) {
        try {
          const cred = await signInWithEmailAndPassword(
            auth,
            email,
            password
          );
          const token = await cred.user.getIdToken();
          const response = await fetch(
            `${API_URL}/api/auth/login`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
              },
              body: JSON.stringify({
                email: cred.user.email || email,
                role: role
              })
            }
          );
          if (response.ok) {
            data = await response.json();
          }
        } catch (fbErr: any) {
          console.warn("Authentication check completed:", fbErr);
        }
      }

      if (!data || !data.success) {
        setLoading(false);
        setMsg("Account not found in cloud database. Please verify your email or register below.");
        return;
      }

      if (role === "student") {
        const student = data.student;

        if (!student || !student.prn) {
          throw new Error(
            "Student PRN was not returned by server."
          );
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
          throw new Error(
            "Teacher ID was not returned by server."
          );
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
          throw new Error(
            "Admin ID was not returned by server."
          );
        }

        localStorage.setItem("role", "admin");
        localStorage.setItem("admin_id", admin.admin_id);
        localStorage.setItem("email", admin.email);
        localStorage.setItem("full_name", admin.full_name);

        window.location.href = "/admin";
        return;
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setMsg(
        err?.message ||
        "Login failed. Please check your credentials."
      );
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
    if (regForm.phone && !/^\d{10}$/.test(regForm.phone.replace(/[\s-]/g, ""))) {
      setMsg("Please enter a valid 10-digit Indian mobile number.");
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
        branch: regForm.branch,
        year: regForm.year,
        division: regForm.division,
        gender: regForm.gender,
        password: regForm.password,
        avatar_url: photoPreview || undefined,
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
            type="email"
            placeholder={role === "student" ? "Student Email (e.g. 2467001@ritindia.edu)" : "Email"}
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

          <button
            type="button"
            className="login-btn"
            onClick={login}
            disabled={loading}
          >
            {loading ? "Authenticating..." : `Login as ${role.charAt(0).toUpperCase() + role.slice(1)}`}
          </button>

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
                placeholder="e.g. 2467012"
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
                placeholder="e.g. Aarav Mehta"
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
                placeholder="e.g. 2467012@ritindia.edu"
                value={regForm.email}
                onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Mobile Number</label>
              <input
                type="tel"
                placeholder="10-digit mobile number"
                value={regForm.phone}
                onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
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
              <label>Gender</label>
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

            <div className="form-group register-full-width photo-upload-box">
              <label style={{ marginBottom: "8px" }}>Profile Photo (Face Verification Reference)</label>
              {photoPreview && (
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="photo-preview-circle"
                />
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoSelect}
                disabled={loading}
                style={{ marginBottom: 0, padding: "8px" }}
              />
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
