import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Lazy-loaded route chunks for lightning-fast mobile loading
const Login = lazy(() => import("./pages/auth/Login"));
const Dashboard = lazy(() => import("./pages/teacher/Dashboard"));
const TeacherAttendance = lazy(() => import("./pages/teacher/TeacherAttendance"));
const ScanQR = lazy(() => import("./pages/student/ScanQR"));
const Profile = lazy(() => import("./pages/student/Profile"));
const StudentAttendance = lazy(() => import("./pages/student/StudentAttendance"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));

// High-speed lightweight loader
const PageLoader = () => (
  <div
    style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#fffdf2",
      fontFamily: "'Segoe UI', Arial, sans-serif",
      color: "#111111",
    }}
  >
    <div
      style={{
        width: "42px",
        height: "42px",
        border: "4px solid #f0e2a5",
        borderTopColor: "#ffca08",
        borderRadius: "50%",
        animation: "app-spin 0.75s linear infinite",
        marginBottom: "14px",
      }}
    />
    <style>{`
      @keyframes app-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
    <p style={{ margin: 0, fontWeight: 650, fontSize: "14px", color: "#666666" }}>
      Loading portal...
    </p>
  </div>
);

/* 🔐 Route Protection */
const PrivateRoute = ({ children, role }: any) => {
  const userRole = localStorage.getItem("role");

  // User is not logged in
  if (!userRole) {
    return <Navigate to="/" replace />;
  }

  // User does not have permission
  if (role && userRole !== role) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* ================= LOGIN ================= */}
          <Route path="/" element={<Login />} />

          {/* ================= TEACHER ================= */}
          <Route
            path="/teacher"
            element={
              <PrivateRoute role="teacher">
                <Dashboard />
              </PrivateRoute>
            }
          />

          <Route
            path="/teacher/attendance"
            element={
              <PrivateRoute role="teacher">
                <TeacherAttendance />
              </PrivateRoute>
            }
          />

          {/* ================= STUDENT ================= */}
          <Route
            path="/profile"
            element={
              <PrivateRoute role="student">
                <Profile />
              </PrivateRoute>
            }
          />

          <Route
            path="/scan"
            element={
              <PrivateRoute role="student">
                <ScanQR />
              </PrivateRoute>
            }
          />

          <Route
            path="/student-attendance"
            element={
              <PrivateRoute role="student">
                <StudentAttendance />
              </PrivateRoute>
            }
          />

          {/* ================= ADMIN ================= */}
          <Route
            path="/admin"
            element={
              <PrivateRoute role="admin">
                <AdminDashboard />
              </PrivateRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
