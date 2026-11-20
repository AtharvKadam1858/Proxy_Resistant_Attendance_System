import { useEffect, useState } from "react";
import "../../styles/admin.css";

import {
  getAuth,
  onAuthStateChanged
} from "firebase/auth";

import {
  initializeApp,
  getApps
} from "firebase/app";

import { API_URL } from "../../config";
import {
  getStudentsList,
  addNewStudent,
  updateUserPassword,
  updateStudentByAdmin,
  deleteStudentByAdmin,
  getTeachersList,
  addNewTeacher,
  deleteTeacherByAdmin,
  getStudentLeaveApplications,
  updateLeaveApplicationDecision,
  type StudentLeaveApplicationRecord,
} from "../../services/supabase";
import ritLogo from "../../assets/RIT_logo.jpeg";

const firebaseConfig = {
  apiKey:
    "AIzaSyDsJPGm7CwJEE2o2kI0NAiSKia0YQxEvMs",
  authDomain:
    "smart-attendance-login.firebaseapp.com",
  projectId:
    "smart-attendance-login",
  storageBucket:
    "smart-attendance-login.firebasestorage.app",
  messagingSenderId:
    "198869708642",
  appId:
    "1:198869708642:web:b762ec97baf3bb9c97863b6"
};

const app =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp(firebaseConfig);

const auth = getAuth(app);

const isValidIndianMobile = (
  phone: string
): boolean => {
  const cleanedPhone =
    phone.replace(/\s+/g, "");

  // Must contain exactly 10 digits
  if (!/^[6-9]\d{9}$/.test(cleanedPhone)) {
    return false;
  }

  // Reject repeated digits
  if (/^(\d)\1{9}$/.test(cleanedPhone)) {
    return false;
  }

  // Reject obvious sequential numbers
  if (
    cleanedPhone === "0123456789" ||
    cleanedPhone === "1234567890" ||
    cleanedPhone === "9876543210"
  ) {
    return false;
  }

  return true;
};

export default function AdminDashboard() {
  const adminName =
    localStorage.getItem("full_name") || "Admin";

  const [formData, setFormData] =
    useState({
      prn: "",
      full_name: "",
      email: "",
      password: "",
      phone: "",
      year: "",
      branch: "",
      division: "",
      gender: "",
      face_folder: ""
    });

  const [photo, setPhoto] =
    useState<File | null>(null);

  // Admin Password Change State
  const [showAdminPassModal, setShowAdminPassModal] = useState(false);
  const [adminNewPass, setAdminNewPass] = useState("");
  const [adminConfirmPass, setAdminConfirmPass] = useState("");
  const [adminPassMsg, setAdminPassMsg] = useState("");
  const [adminPassLoading, setAdminPassLoading] = useState(false);

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [students, setStudents] =
    useState<any[]>([]);

  const [selectedYear, setSelectedYear] =
    useState("");

  const [studentListError, setStudentListError] =
    useState("");

  const [selectedDepartment, setSelectedDepartment] =
    useState("");

  const [studentsLoading, setStudentsLoading] =
    useState(false);

  // 🎓 Admin Navigation Tabs (Tab 1: Student Directory, Tab 2: Enroll Students, Tab 3: Faculty Management, Tab 4: Leaves & Certificates)
  const [adminTab, setAdminTab] = useState<"directory" | "enroll" | "faculty" | "leaves">("directory");
  const [selectedDivision, setSelectedDivision] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // 📑 Leave & Certificate Verification Desk State
  const [leaveApplications, setLeaveApplications] = useState<StudentLeaveApplicationRecord[]>([]);
  const [leavesLoading, setLeavesLoading] = useState(false);
  const [selectedLeaveApp, setSelectedLeaveApp] = useState<StudentLeaveApplicationRecord | null>(null);
  const [leaveFilterStatus, setLeaveFilterStatus] = useState<"All" | "Pending" | "Approved" | "Rejected">("All");
  const [leaveSearchQuery, setLeaveSearchQuery] = useState("");
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionMsg, setDecisionMsg] = useState("");

  const fetchLeaveApplications = async () => {
    try {
      setLeavesLoading(true);
      const apps = await getStudentLeaveApplications();
      setLeaveApplications(apps || []);
    } catch (err: any) {
      console.error("Failed to load leave applications:", err);
    } finally {
      setLeavesLoading(false);
    }
  };

  const handleLeaveDecision = async (decision: "Approved" | "Rejected") => {
    if (!selectedLeaveApp) return;
    try {
      setDecisionLoading(true);
      setDecisionMsg("");
      const details = selectedLeaveApp.parsed_details;
      const res = await updateLeaveApplicationDecision({
        applicationId: selectedLeaveApp.id,
        sessionId: selectedLeaveApp.session_id,
        prn: selectedLeaveApp.prn,
        studentName: selectedLeaveApp.student_name,
        studentEmail: selectedLeaveApp.student_email,
        subject: details?.subject || selectedLeaveApp.subject,
        department: selectedLeaveApp.department,
        year: selectedLeaveApp.year,
        lectureDate: details?.lecture_date || selectedLeaveApp.lecture_date,
        lectureTime: details?.lecture_time || selectedLeaveApp.lecture_time,
        decision: decision,
        adminName: "Admin (admin@ritindia.edu)",
        leaveType: details?.leave_type,
        reason: details?.reason,
      });

      setDecisionMsg(res.message);
      const updatedList = await getStudentLeaveApplications();
      setLeaveApplications(updatedList || []);
      const updatedCurrent = (updatedList || []).find((a) => a.id === selectedLeaveApp.id);
      if (updatedCurrent) {
        setSelectedLeaveApp(updatedCurrent);
      }
    } catch (e: any) {
      setDecisionMsg("❌ " + (e?.message || "Failed to submit verification decision"));
    } finally {
      setDecisionLoading(false);
    }
  };

  // 👨‍🏫 Faculty / Teachers Management State
  const [teachers, setTeachers] = useState<any[]>([]);
  const [teacherLoading, setTeacherLoading] = useState(false);
  const [teacherMsg, setTeacherMsg] = useState("");
  const [teacherForm, setTeacherForm] = useState({
    teacher_id: "",
    full_name: "",
    email: "",
    phone: "",
    department: "AIML",
    designation: "Assistant Professor",
    password: "",
  });

  const fetchTeachers = async () => {
    try {
      setTeacherLoading(true);
      const data = await getTeachersList();
      setTeachers(data || []);
    } catch (e: any) {
      console.error("Failed to fetch teachers:", e);
    } finally {
      setTeacherLoading(false);
    }
  };

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeacherMsg("");
    if (!teacherForm.teacher_id.trim() || !teacherForm.full_name.trim() || !teacherForm.email.trim()) {
      setTeacherMsg("❌ Teacher ID, Full Name, and Institutional Email are required.");
      return;
    }
    try {
      setTeacherLoading(true);
      const res = await addNewTeacher(teacherForm);
      setTeacherMsg("✅ " + res.message);
      setTeacherForm({
        teacher_id: "",
        full_name: "",
        email: "",
        phone: "",
        department: "AIML",
        designation: "Assistant Professor",
        password: "",
      });
      fetchTeachers();
    } catch (err: any) {
      setTeacherMsg("❌ " + (err?.message || "Failed to add faculty member."));
    } finally {
      setTeacherLoading(false);
    }
  };

  const handleDeleteTeacher = async (teacherId: string, teacherName: string) => {
    if (!window.confirm(`Are you sure you want to remove faculty member ${teacherName} (${teacherId})?`)) return;
    try {
      setTeacherLoading(true);
      await deleteTeacherByAdmin(teacherId);
      alert(`Faculty member ${teacherName} removed.`);
      fetchTeachers();
    } catch (err: any) {
      alert("Error deleting teacher: " + (err?.message || "Failed"));
    } finally {
      setTeacherLoading(false);
    }
  };

  // 📝 Student Record View & Edit State
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editPhotoPreview, setEditPhotoPreview] = useState<string>("");
  const [editLoading, setEditLoading] = useState<boolean>(false);
  const [editMsg, setEditMsg] = useState<string>("");

  const openStudentEditor = (student: any) => {
    setEditingStudent(student);
    setEditForm({
      prn: student.prn || "",
      full_name: student.full_name || "",
      email: student.email || "",
      phone: student.phone || "",
      parent_phone: student.parent_phone || "",
      blood_group: student.blood_group || "A+",
      year: student.year || "Final Year",
      branch: student.branch || "AIML",
      division: student.division || "A",
      gender: student.gender || "Male",
      address: student.address || "",
      password: "",
    });
    setEditPhotoPreview(student.avatar_url || student.face_folder || "");
    setEditMsg("");
  };

  const handleEditPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        setEditPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveStudentChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setEditLoading(true);
    setEditMsg("");

    try {
      const payload: any = {
        full_name: editForm.full_name.trim(),
        email: editForm.email.trim().toLowerCase(),
        phone: editForm.phone.trim(),
        parent_phone: editForm.parent_phone?.trim() || null,
        blood_group: editForm.blood_group?.trim() || null,
        year: editForm.year,
        branch: editForm.branch,
        division: editForm.division,
        gender: editForm.gender,
        address: editForm.address?.trim() || null,
      };

      if (editForm.password && editForm.password.trim().length >= 6) {
        payload.password_hash = editForm.password.trim();
      }

      if (editPhotoPreview && editPhotoPreview.startsWith("data:")) {
        payload.avatar_url = editPhotoPreview;
        payload.face_folder = editPhotoPreview;
      }

      await updateStudentByAdmin(editingStudent.prn, payload);
      setEditMsg("✅ Student record successfully updated in cloud database!");
      await fetchStudents(selectedYear, selectedDepartment);
      setTimeout(() => {
        setEditingStudent(null);
      }, 1400);
    } catch (err: any) {
      setEditMsg("❌ " + (err?.message || "Failed to update student details."));
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteStudent = async (prn: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete student ${name} (PRN: ${prn}) from the cloud database?`)) {
      return;
    }
    setEditLoading(true);
    try {
      await deleteStudentByAdmin(prn);
      alert(`✅ Student ${name} (${prn}) was removed from the database.`);
      setEditingStudent(null);
      await fetchStudents(selectedYear, selectedDepartment);
    } catch (err: any) {
      alert("❌ " + (err?.message || "Failed to delete student."));
    } finally {
      setEditLoading(false);
    }
  };

  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [photosZip, setPhotosZip] =
    useState<File | null>(null);

  const [bulkLoading, setBulkLoading] =
    useState(false);

  const [bulkMessage, setBulkMessage] =
    useState("");

  const [bulkResult, setBulkResult] =
    useState<any>(null);

  const fetchStudents = async (
    year = selectedYear,
    branch = selectedDepartment
  ) => {
    try {
      setStudentsLoading(true);
      setStudentListError("");

      let studentList: any[] = [];
      const currentUser = auth.currentUser;

      if (currentUser) {
        try {
          const token = await currentUser.getIdToken(true);
          const params = new URLSearchParams();
          if (year) params.append("year", year);
          if (branch) params.append("branch", branch);

          const response = await fetch(
            `${API_URL}/api/students?${params.toString()}`,
            {
              method: "GET",
              headers: { Authorization: `Bearer ${token}` }
            }
          );
          if (response.ok) {
            const data = await response.json();
            studentList = data.students || data;
          }
        } catch {}
      }

      if (studentList.length === 0) {
        studentList = await getStudentsList(branch, year);
      }

      setStudents(studentList || []);
      setStudentListError("");
    } catch (error: any) {
      console.error(
        "Fetch students error:",
        error
      );

      setStudents([]);

      setStudentListError(
        error?.message ||
        "Unable to fetch students."
      );
    } finally {
      setStudentsLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch in case of Supabase login or direct session
    fetchStudents(selectedYear, selectedDepartment);
    fetchTeachers();
    fetchLeaveApplications();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchStudents(selectedYear, selectedDepartment);
        fetchTeachers();
        fetchLeaveApplications();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [selectedYear, selectedDepartment]);

  const handlePhotoChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      e.target.files?.[0] || null;

    setPhoto(file);
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement |
      HTMLSelectElement
    >
  ) => {
    setFormData({
      ...formData,
      [e.target.name]:
        e.target.value
    });
  };

  const handleExcelChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      e.target.files?.[0] || null;

    setExcelFile(file);
    setBulkMessage("");
    setBulkResult(null);
  };

  const handlePhotosZipChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      e.target.files?.[0] || null;

    setPhotosZip(file);
    setBulkMessage("");
    setBulkResult(null);
  };

  const handleBulkStudentUpload = async () => {
    setBulkMessage("");
    setBulkResult(null);

    if (!excelFile) {
      setBulkMessage(
        "Please select an Excel file."
      );
      return;
    }

    if (!photosZip) {
      setBulkMessage(
        "Please select the student photos ZIP file."
      );
      return;
    }

    // Validate Excel file
    const allowedExtensions = [
      ".xlsx",
      ".xls"
    ];

    const excelFileName =
      excelFile.name.toLowerCase();

    if (
      !allowedExtensions.some(
        (extension) =>
          excelFileName.endsWith(extension)
      )
    ) {
      setBulkMessage(
        "Please upload a valid Excel file (.xlsx or .xls)."
      );
      return;
    }

    // Validate ZIP file
    const zipFileName =
      photosZip.name.toLowerCase();

    if (!zipFileName.endsWith(".zip")) {
      setBulkMessage(
        "Please upload a valid ZIP file containing student photos."
      );
      return;
    }

    try {
      setBulkLoading(true);

      const currentUser =
        auth.currentUser;

      if (!currentUser) {
        throw new Error(
          "Admin is not logged in."
        );
      }

      const token =
        await currentUser.getIdToken(true);

      const formData =
        new FormData();

      // Excel file
      formData.append(
        "file",
        excelFile
      );

      // Student photos ZIP
      formData.append(
        "photos_zip",
        photosZip
      );

      const response =
        await fetch(
          `${API_URL}/api/students/bulk-upload`,
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${token}`
            },
            body: formData
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
          "Bulk student registration failed."
        );
      }

      setBulkResult(data);

      setBulkMessage(
        data.message ||
        "Students registered successfully."
      );

      // Clear Excel file
      setExcelFile(null);

      const fileInput =
        document.getElementById(
          "student-excel"
        ) as HTMLInputElement;

      if (fileInput) {
        fileInput.value = "";
      }

      // Clear ZIP file
      setPhotosZip(null);

      const zipInput =
        document.getElementById(
          "student-photos-zip"
        ) as HTMLInputElement;

      if (zipInput) {
        zipInput.value = "";
      }

      // Refresh student list
      await fetchStudents(
        selectedYear,
        selectedDepartment
      );

    } catch (error: any) {
      console.error(
        "Bulk upload error:",
        error
      );

      setBulkMessage(
        error?.message ||
        "Unable to upload Excel and photos ZIP."
      );
    } finally {
      setBulkLoading(false);
    }
  };

  const handleAddStudent = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    setMessage("");

    if (
      !formData.prn ||
      !formData.full_name ||
      !formData.email ||
      !formData.password ||
      !formData.phone ||
      !formData.year ||
      !formData.branch ||
      !formData.division ||
      !photo
    ) {
      setMessage(
        "Please fill all required fields and select a student photo."
      );
      return;
    }
    if (!isValidIndianMobile(formData.phone)) {
      setMessage(
        "Please enter a valid 10-digit Indian mobile number."
      );
      return;
    }
    if (
      formData.password.length < 6
    ) {
      setMessage(
        "Password must contain at least 6 characters."
      );
      return;
    }

    try {
      setLoading(true);
      let success = false;

      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken(true);
          const formDataToSend = new FormData();
          formDataToSend.append("prn", formData.prn);
          formDataToSend.append("full_name", formData.full_name);
          formDataToSend.append("email", formData.email);
          formDataToSend.append("password", formData.password);
          formDataToSend.append("phone", formData.phone);
          formDataToSend.append("year", formData.year);
          formDataToSend.append("branch", formData.branch);
          formDataToSend.append("division", formData.division);
          formDataToSend.append("gender", formData.gender);
          if (photo) formDataToSend.append("photo", photo);

          const response = await fetch(`${API_URL}/api/students`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formDataToSend
          });
          if (response.ok) {
            success = true;
          }
        } catch {}
      }

      if (!success) {
        await addNewStudent({
          prn: formData.prn,
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
          year: formData.year,
          branch: formData.branch,
          division: formData.division,
          gender: formData.gender,
        });
        success = true;
      }

      setMessage("Student added successfully!");
      fetchStudents(selectedYear, selectedDepartment);
      setFormData({
        prn: "",
        full_name: "",
        email: "",
        password: "",
        phone: "",
        year: "",
        branch: "",
        division: "",
        gender: "",
        face_folder: ""
      });
      setPhoto(null);
    } catch (error: any) {
      console.error("Add student error:", error);
      setMessage(error?.message || "Failed to add student.");
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error("Logout error:", error);
    }
    localStorage.clear();
    window.location.href = "/";
  };

  const handleAdminPasswordChange = async () => {
    const adminId = localStorage.getItem("admin_id") || "admin";
    if (!adminNewPass || adminNewPass.length < 6) {
      setAdminPassMsg("❌ Password must be at least 6 characters long.");
      return;
    }
    if (adminNewPass !== adminConfirmPass) {
      setAdminPassMsg("❌ Passwords do not match.");
      return;
    }
    try {
      setAdminPassLoading(true);
      setAdminPassMsg("");
      await updateUserPassword("admin", adminId, adminNewPass);
      setAdminPassMsg("✅ Admin password updated successfully!");
      setAdminNewPass("");
      setAdminConfirmPass("");
      setTimeout(() => setShowAdminPassModal(false), 1500);
    } catch (e: any) {
      setAdminPassMsg("❌ " + (e?.message || "Failed to update password."));
    } finally {
      setAdminPassLoading(false);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", padding: "12px 20px" }}>
        <div className="admin-header-content" style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <img
            src={ritLogo}
            alt="RIT Logo"
            className="admin-rit-logo"
          />

          <h1 style={{ margin: 0, fontSize: "20px" }}>
            Proxy-Resistant Smart Attendance System
          </h1>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setShowAdminPassModal(true)}
            style={{
              background: "#ffffff",
              color: "#111827",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              padding: "7px 12px",
              fontSize: "12px",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            🔒 Password
          </button>
          <button
            type="button"
            onClick={logout}
            style={{
              background: "#ef4444",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "7px 12px",
              fontSize: "12px",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <main className="admin-container">
        <section className="admin-card" style={{ maxWidth: "1050px", margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "22px", color: "#111827" }}>
                Welcome, <span className="admin-name" style={{ color: "#d97706" }}>{adminName}</span>
              </h2>
              <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "#6b7280" }}>
                Academic Administration & Student Cloud Database Control Portal
              </p>
            </div>
            <span style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46", padding: "5px 12px", borderRadius: "12px", fontSize: "12px", fontWeight: "750" }}>
              ● Supabase Cloud Active
            </span>
          </div>

          {/* 🎓 ADMIN 2-TAB NAVIGATION BAR */}
          <div style={{
            display: "flex",
            background: "#f1f5f9",
            borderRadius: "12px",
            padding: "5px",
            marginBottom: "20px",
            gap: "8px",
            border: "1.5px solid #e2e8f0"
          }}>
            <button
              type="button"
              onClick={() => setAdminTab("directory")}
              style={{
                flex: 1,
                padding: "12px 18px",
                borderRadius: "9px",
                border: "none",
                fontSize: "14px",
                fontWeight: "800",
                cursor: "pointer",
                transition: "all 0.25s ease",
                background: adminTab === "directory" ? "#ffca08" : "transparent",
                color: adminTab === "directory" ? "#000000" : "#64748b",
                boxShadow: adminTab === "directory" ? "0 4px 12px rgba(255,202,8,0.35)" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <span>👥</span> Student Directory & Class Batch Records
            </button>

            <button
              type="button"
              onClick={() => setAdminTab("enroll")}
              style={{
                flex: 1,
                padding: "12px 18px",
                borderRadius: "9px",
                border: "none",
                fontSize: "14px",
                fontWeight: "800",
                cursor: "pointer",
                transition: "all 0.25s ease",
                background: adminTab === "enroll" ? "#ffca08" : "transparent",
                color: adminTab === "enroll" ? "#000000" : "#64748b",
                boxShadow: adminTab === "enroll" ? "0 4px 12px rgba(255,202,8,0.35)" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <span>➕</span> Enroll & Add Students (Manual / Bulk)
            </button>

            <button
              type="button"
              onClick={() => {
                setAdminTab("faculty");
                fetchTeachers();
              }}
              style={{
                flex: 1,
                padding: "12px 18px",
                borderRadius: "9px",
                border: "none",
                fontSize: "14px",
                fontWeight: "800",
                cursor: "pointer",
                transition: "all 0.25s ease",
                background: adminTab === "faculty" ? "#ffca08" : "transparent",
                color: adminTab === "faculty" ? "#000000" : "#64748b",
                boxShadow: adminTab === "faculty" ? "0 4px 12px rgba(255,202,8,0.35)" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <span>👨‍🏫</span> Faculty / Teacher Management
            </button>

            <button
              type="button"
              onClick={() => {
                setAdminTab("leaves");
                fetchLeaveApplications();
              }}
              style={{
                flex: 1,
                padding: "12px 18px",
                borderRadius: "9px",
                border: "none",
                fontSize: "14px",
                fontWeight: "800",
                cursor: "pointer",
                transition: "all 0.25s ease",
                background: adminTab === "leaves" ? "#ffca08" : "transparent",
                color: adminTab === "leaves" ? "#000000" : "#64748b",
                boxShadow: adminTab === "leaves" ? "0 4px 12px rgba(255,202,8,0.35)" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <span>📑</span> Leave & Certificate Verification
              {leaveApplications.filter((a) => a.status === "Pending").length > 0 && (
                <span
                  style={{
                    background: "#ef4444",
                    color: "#ffffff",
                    fontSize: "11px",
                    fontWeight: "900",
                    padding: "2px 7px",
                    borderRadius: "10px",
                  }}
                >
                  {leaveApplications.filter((a) => a.status === "Pending").length}
                </span>
              )}
            </button>
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: ENROLL & ADD STUDENTS (MANUAL & BULK EXCEL/ZIP)                    */}
          {/* ========================================================================= */}
          {adminTab === "enroll" && (
            <div>
              <div className="admin-title">
                ➕ Add New Student
              </div>

              <form onSubmit={handleAddStudent}>
                <div className="admin-field">
                  <label>PRN <span>*</span></label>
                  <input
                    type="text"
                    name="prn"
                    value={formData.prn}
                    onChange={handleChange}
                    placeholder="Enter PRN"
                    required
                    disabled={loading}
                  />
                </div>

                <div className="admin-field">
                  <label>Full Name <span>*</span></label>
                  <input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    placeholder="Enter student name"
                    required
                    disabled={loading}
                  />
                </div>

                <div className="admin-field">
                  <label>Email <span>*</span></label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="student@ritindia.edu"
                    required
                    disabled={loading}
                  />
                </div>

                <div className="admin-field">
                  <label>Student Password <span>*</span></label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Minimum 6 characters"
                    required
                    disabled={loading}
                  />
                </div>

                <div className="admin-field">
                  <label>Phone <span>*</span></label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="Enter 10-digit mobile number"
                    required
                    disabled={loading}
                  />
                </div>

                <div className="admin-field">
                  <label>Select Year <span>*</span></label>
                  <select name="year" value={formData.year} onChange={handleChange} required disabled={loading}>
                    <option value="">Select Year</option>
                    <option value="First Year">First Year</option>
                    <option value="Second Year">Second Year</option>
                    <option value="Third Year">Third Year</option>
                    <option value="Final Year">Final Year</option>
                  </select>
                </div>

                <div className="admin-field">
                  <label>Select Department <span>*</span></label>
                  <select name="branch" value={formData.branch} onChange={handleChange} required disabled={loading}>
                    <option value="">Select Department</option>
                    <option value="AIML">AIML</option>
                    <option value="CSE">CSE</option>
                    <option value="ENTC">ENTC</option>
                    <option value="Mechanical">Mechanical</option>
                    <option value="Civil">Civil</option>
                  </select>
                </div>

                <div className="admin-field">
                  <label>Select Division <span>*</span></label>
                  <select name="division" value={formData.division} onChange={handleChange} required disabled={loading}>
                    <option value="">Select Division</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                </div>

                <div className="admin-field">
                  <label>Gender</label>
                  <select name="gender" value={formData.gender} onChange={handleChange} disabled={loading}>
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="admin-field">
                  <label>Student Photo <span>*</span></label>
                  <input type="file" accept="image/*" onChange={handlePhotoChange} disabled={loading} required />
                  {photo && <p className="selected-photo">Selected: {photo.name}</p>}
                </div>

                {message && <div className="admin-message">{message}</div>}

                <button type="submit" className="admin-add-btn" disabled={loading}>
                  {loading ? "Adding Student..." : "Add Student"}
                </button>
              </form>

              {/* Bulk Upload Section */}
              <div className="bulk-upload-section" style={{ marginTop: "30px" }}>
                <div className="admin-title">📦 Bulk Student Registration (Excel & ZIP)</div>
                <p className="bulk-description">
                  Upload an Excel spreadsheet with student details and a ZIP archive containing reference photos named with each student's PRN.
                </p>

                <button
                  type="button"
                  className="download-template-btn"
                  onClick={() => window.open("/student_bulk_upload_template.xlsx", "_blank")}
                >
                  📥 Download Excel Template
                </button>

                <div className="admin-field">
                  <label>Upload Excel File <span>*</span></label>
                  <input id="student-excel" type="file" accept=".xlsx,.xls" onChange={handleExcelChange} disabled={bulkLoading} />
                  {excelFile && <p className="selected-photo">Selected: {excelFile.name}</p>}
                </div>

                <div className="admin-field">
                  <label>Upload Student Photos ZIP <span>*</span></label>
                  <input id="student-photos-zip" type="file" accept=".zip" onChange={handlePhotosZipChange} disabled={bulkLoading} />
                  {photosZip && <p className="selected-photo">Selected: {photosZip.name}</p>}
                </div>

                {bulkMessage && (
                  <div className={`admin-message ${bulkResult ? "bulk-success" : "bulk-error"}`}>
                    {bulkMessage}
                  </div>
                )}

                <button
                  type="button"
                  className="admin-add-btn bulk-upload-btn"
                  onClick={handleBulkStudentUpload}
                  disabled={bulkLoading || !excelFile || !photosZip}
                >
                  {bulkLoading ? "Registering Students..." : "Upload Excel & Register Students"}
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: STUDENT DIRECTORY & BATCH RECORDS (INTERACTIVE FILTER & EDITOR)   */}
          {/* ========================================================================= */}
          {adminTab === "directory" && (
            <div className="student-list-section" style={{ marginTop: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
                <div className="admin-title" style={{ margin: 0 }}>
                  👥 Student Directory & Batch Records
                </div>
                <button
                  type="button"
                  onClick={() => fetchStudents(selectedYear, selectedDepartment)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    background: "#f3f4f6",
                    border: "1px solid #d1d5db",
                    fontSize: "12px",
                    fontWeight: "700",
                    cursor: "pointer",
                    color: "#374151"
                  }}
                >
                  🔄 Refresh Directory
                </button>
              </div>

              {/* Class, Department & Division Filter Bar */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "16px", background: "#f8fafc", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "750", color: "#374151", marginBottom: "4px" }}>
                    Select Class / Year:
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    disabled={studentsLoading}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                  >
                    <option value="">All Years (Entire College)</option>
                    <option value="First Year">First Year</option>
                    <option value="Second Year">Second Year</option>
                    <option value="Third Year">Third Year</option>
                    <option value="Final Year">Final Year</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "750", color: "#374151", marginBottom: "4px" }}>
                    Select Department:
                  </label>
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    disabled={studentsLoading}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                  >
                    <option value="">All Departments</option>
                    <option value="AIML">AIML</option>
                    <option value="CSE">CSE</option>
                    <option value="ENTC">ENTC</option>
                    <option value="Mechanical">Mechanical</option>
                    <option value="Civil">Civil</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "750", color: "#374151", marginBottom: "4px" }}>
                    Select Division:
                  </label>
                  <select
                    value={selectedDivision}
                    onChange={(e) => setSelectedDivision(e.target.value)}
                    disabled={studentsLoading}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                  >
                    <option value="">All Divisions</option>
                    <option value="A">Division A</option>
                    <option value="B">Division B</option>
                    <option value="C">Division C</option>
                    <option value="D">Division D</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "750", color: "#374151", marginBottom: "4px" }}>
                    Search Students:
                  </label>
                  <input
                    type="text"
                    placeholder="🔍 PRN, Name, or Email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              {/* Student Count Badge */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <span style={{ fontSize: "13px", fontWeight: "750", color: "#1e3a8a" }}>
                  {studentsLoading ? "Loading student records..." : `Showing ${
                    students.filter((s: any) => {
                      const matchesDiv = !selectedDivision || (s.division || "").toLowerCase() === selectedDivision.toLowerCase();
                      const q = searchQuery.trim().toLowerCase();
                      const matchesSearch = !q || (s.full_name || "").toLowerCase().includes(q) || (s.prn || "").toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q) || (s.phone || "").includes(q);
                      return matchesDiv && matchesSearch;
                    }).length
                  } of ${students.length} students`}
                </span>
                <span style={{ fontSize: "12px", color: "#6b7280" }}>
                  Click on any student row or card to inspect and edit details.
                </span>
              </div>

              {studentListError && (
                <div className="student-list-message" style={{ color: "#ef4444" }}>
                  {studentListError}
                </div>
              )}

              {studentsLoading ? (
                <div className="student-list-message">
                  Loading students from cloud database...
                </div>
              ) : students.length === 0 ? (
                <div className="student-list-message">
                  No students found matching the selected filters.
                </div>
              ) : (
                <div className="student-table-container">
                  <table className="student-table">
                    <thead>
                      <tr>
                        <th>Photo</th>
                        <th>PRN</th>
                        <th>Full Name</th>
                        <th>Class & Branch</th>
                        <th>Div</th>
                        <th>College Email</th>
                        <th>Mobile</th>
                        <th>Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {students
                        .filter((s: any) => {
                          const matchesDiv = !selectedDivision || (s.division || "").toLowerCase() === selectedDivision.toLowerCase();
                          const q = searchQuery.trim().toLowerCase();
                          const matchesSearch = !q || (s.full_name || "").toLowerCase().includes(q) || (s.prn || "").toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q) || (s.phone || "").includes(q);
                          return matchesDiv && matchesSearch;
                        })
                        .map((student) => {
                          const imgSrc = student.avatar_url || (student.face_folder && (student.face_folder.startsWith("data:") || student.face_folder.startsWith("http")) ? student.face_folder : null);
                          return (
                            <tr key={student.prn} style={{ cursor: "pointer" }} onClick={() => openStudentEditor(student)}>
                              <td>
                                {imgSrc ? (
                                  <img
                                    src={imgSrc}
                                    alt={student.full_name}
                                    style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover", border: "1.5px solid #ffca08" }}
                                  />
                                ) : (
                                  <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "700", color: "#64748b" }}>
                                    {(student.full_name || "S").charAt(0)}
                                  </div>
                                )}
                              </td>
                              <td><strong>{student.prn}</strong></td>
                              <td>{student.full_name}</td>
                              <td>{student.year} - {student.branch}</td>
                              <td><span style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px", fontWeight: "700" }}>{student.division}</span></td>
                              <td>{student.email}</td>
                              <td>{student.phone || "Not set"}</td>
                              <td>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openStudentEditor(student);
                                  }}
                                  style={{
                                    padding: "5px 10px",
                                    background: "#ffca08",
                                    color: "#000000",
                                    border: "none",
                                    borderRadius: "6px",
                                    fontWeight: "750",
                                    fontSize: "12px",
                                    cursor: "pointer",
                                    boxShadow: "0 1px 4px rgba(255,202,8,0.3)"
                                  }}
                                >
                                  👁️ View / Edit
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: STUDENT LEAVE & OFFICIAL CERTIFICATE VERIFICATION DESK             */}
          {/* ========================================================================= */}
          {adminTab === "leaves" && (
            <div>
              <div className="admin-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: "#1e293b" }}>
                    📑 Student Leave & Official Certificate Verification Desk
                  </h2>
                  <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
                    Review student medical letters, duty exemptions (OD), and sports certificates. Click on any student's PRN to inspect their attached letter/PDF and mark attendance.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchLeaveApplications}
                  disabled={leavesLoading}
                  style={{
                    padding: "9px 18px",
                    background: "#0284c7",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: "750",
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    boxShadow: "0 2px 8px rgba(2,132,199,0.35)",
                  }}
                >
                  <span>🔄</span> {leavesLoading ? "Refreshing..." : "Refresh Applications"}
                </button>
              </div>

              {/* Analytics Metric Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px", margin: "18px 0" }}>
                <div style={{ background: "#ffffff", borderRadius: "10px", padding: "14px 18px", border: "1.5px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                  <div style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Total Requests</div>
                  <div style={{ fontSize: "26px", fontWeight: "900", color: "#1e293b", marginTop: "4px" }}>
                    {leaveApplications.length}
                  </div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>All submitted leave & OD records</div>
                </div>

                <div style={{ background: "#fffbeb", borderRadius: "10px", padding: "14px 18px", border: "1.5px solid #fde68a", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                  <div style={{ fontSize: "12px", fontWeight: "700", color: "#b45309", textTransform: "uppercase" }}>⏳ Pending Review</div>
                  <div style={{ fontSize: "26px", fontWeight: "900", color: "#d97706", marginTop: "4px" }}>
                    {leaveApplications.filter((a) => a.status === "Pending").length}
                  </div>
                  <div style={{ fontSize: "11px", color: "#b45309", marginTop: "2px" }}>Awaiting Admin attendance verification</div>
                </div>

                <div style={{ background: "#f0fdf4", borderRadius: "10px", padding: "14px 18px", border: "1.5px solid #bbf7d0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                  <div style={{ fontSize: "12px", fontWeight: "700", color: "#15803d", textTransform: "uppercase" }}>✅ Accepted (Present)</div>
                  <div style={{ fontSize: "26px", fontWeight: "900", color: "#16a34a", marginTop: "4px" }}>
                    {leaveApplications.filter((a) => a.status === "Approved").length}
                  </div>
                  <div style={{ fontSize: "11px", color: "#15803d", marginTop: "2px" }}>Marked PRESENT in attendance database</div>
                </div>

                <div style={{ background: "#fef2f2", borderRadius: "10px", padding: "14px 18px", border: "1.5px solid #fecaca", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                  <div style={{ fontSize: "12px", fontWeight: "700", color: "#b91c1c", textTransform: "uppercase" }}>❌ Rejected (Absent)</div>
                  <div style={{ fontSize: "26px", fontWeight: "900", color: "#dc2626", marginTop: "4px" }}>
                    {leaveApplications.filter((a) => a.status === "Rejected").length}
                  </div>
                  <div style={{ fontSize: "11px", color: "#b91c1c", marginTop: "2px" }}>Marked ABSENT in defaulter list</div>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div style={{ background: "#ffffff", borderRadius: "12px", padding: "16px", border: "1.5px solid #e2e8f0", marginBottom: "18px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ flex: "1 1 320px" }}>
                    <input
                      type="text"
                      placeholder="🔍 Search by Student PRN, Full Name, Course Subject, or Reason..."
                      value={leaveSearchQuery}
                      onChange={(e) => setLeaveSearchQuery(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1.5px solid #cbd5e1",
                        fontSize: "13.5px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {(["All", "Pending", "Approved", "Rejected"] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setLeaveFilterStatus(st)}
                        style={{
                          padding: "8px 14px",
                          borderRadius: "7px",
                          border: leaveFilterStatus === st ? "1.5px solid #0284c7" : "1px solid #cbd5e1",
                          background: leaveFilterStatus === st ? "#0284c7" : "#f8fafc",
                          color: leaveFilterStatus === st ? "#ffffff" : "#475569",
                          fontSize: "12.5px",
                          fontWeight: "750",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                        }}
                      >
                        {st === "All" && `All (${leaveApplications.length})`}
                        {st === "Pending" && `⏳ Pending (${leaveApplications.filter((a) => a.status === "Pending").length})`}
                        {st === "Approved" && `✅ Approved (${leaveApplications.filter((a) => a.status === "Approved").length})`}
                        {st === "Rejected" && `❌ Rejected (${leaveApplications.filter((a) => a.status === "Rejected").length})`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Leave Applications Table */}
              <div style={{ background: "#ffffff", borderRadius: "12px", border: "1.5px solid #e2e8f0", overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ margin: 0, fontSize: "14.5px", fontWeight: "800", color: "#1e293b" }}>
                    📋 Submitted Applications ({leaveApplications.filter((app) => {
                      if (leaveFilterStatus !== "All" && app.status !== leaveFilterStatus) return false;
                      if (!leaveSearchQuery.trim()) return true;
                      const q = leaveSearchQuery.toLowerCase();
                      return (
                        app.prn?.toLowerCase().includes(q) ||
                        app.student_name?.toLowerCase().includes(q) ||
                        app.student_email?.toLowerCase().includes(q) ||
                        app.subject?.toLowerCase().includes(q) ||
                        app.parsed_details?.reason?.toLowerCase().includes(q)
                      );
                    }).length} Matching Records)
                  </h3>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    Tip: Click on any <b>PRN</b> to view the uploaded letter/PDF
                  </span>
                </div>

                {leavesLoading ? (
                  <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                    <div style={{ fontSize: "28px", marginBottom: "8px" }}>⏳</div>
                    <div>Loading student leave & certificate submissions...</div>
                  </div>
                ) : leaveApplications.filter((app) => {
                    if (leaveFilterStatus !== "All" && app.status !== leaveFilterStatus) return false;
                    if (!leaveSearchQuery.trim()) return true;
                    const q = leaveSearchQuery.toLowerCase();
                    return (
                      app.prn?.toLowerCase().includes(q) ||
                      app.student_name?.toLowerCase().includes(q) ||
                      app.student_email?.toLowerCase().includes(q) ||
                      app.subject?.toLowerCase().includes(q) ||
                      app.parsed_details?.reason?.toLowerCase().includes(q)
                    );
                  }).length === 0 ? (
                  <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                    <div style={{ fontSize: "28px", marginBottom: "8px" }}>📭</div>
                    <div style={{ fontWeight: "700", color: "#334155" }}>No leave or certificate records found</div>
                    <div style={{ fontSize: "12px", marginTop: "4px" }}>
                      {leaveFilterStatus !== "All"
                        ? `No applications with status "${leaveFilterStatus}".`
                        : "No students have submitted leave or certificate requests yet."}
                    </div>
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                      <thead>
                        <tr style={{ background: "#f8fafc", borderBottom: "1.5px solid #e2e8f0", textAlign: "left" }}>
                          <th style={{ padding: "12px 14px", fontWeight: "800", color: "#334155" }}>Student PRN</th>
                          <th style={{ padding: "12px 14px", fontWeight: "800", color: "#334155" }}>Candidate Name & Email</th>
                          <th style={{ padding: "12px 14px", fontWeight: "800", color: "#334155" }}>Class / Dept</th>
                          <th style={{ padding: "12px 14px", fontWeight: "800", color: "#334155" }}>Course Subject & Timing</th>
                          <th style={{ padding: "12px 14px", fontWeight: "800", color: "#334155" }}>Absence Date</th>
                          <th style={{ padding: "12px 14px", fontWeight: "800", color: "#334155" }}>Category</th>
                          <th style={{ padding: "12px 14px", fontWeight: "800", color: "#334155" }}>Attachment</th>
                          <th style={{ padding: "12px 14px", fontWeight: "800", color: "#334155" }}>Status</th>
                          <th style={{ padding: "12px 14px", fontWeight: "800", color: "#334155", textAlign: "center" }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaveApplications
                          .filter((app) => {
                            if (leaveFilterStatus !== "All" && app.status !== leaveFilterStatus) return false;
                            if (!leaveSearchQuery.trim()) return true;
                            const q = leaveSearchQuery.toLowerCase();
                            return (
                              app.prn?.toLowerCase().includes(q) ||
                              app.student_name?.toLowerCase().includes(q) ||
                              app.student_email?.toLowerCase().includes(q) ||
                              app.subject?.toLowerCase().includes(q) ||
                              app.parsed_details?.reason?.toLowerCase().includes(q)
                            );
                          })
                          .map((app) => {
                            const details = app.parsed_details;
                            const hasDoc = Boolean(details?.document_data);
                            const isPdf = details?.document_type?.includes("pdf") || details?.document_name?.toLowerCase().endsWith(".pdf");

                            return (
                              <tr
                                key={app.id}
                                style={{
                                  borderBottom: "1px solid #f1f5f9",
                                  transition: "background 0.15s ease",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                              >
                                {/* PRN CLICKABLE BUTTON */}
                                <td style={{ padding: "12px 14px" }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedLeaveApp(app);
                                      setDecisionMsg("");
                                    }}
                                    title="Click to inspect student's attached letter/PDF and mark attendance"
                                    style={{
                                      background: "#fef3c7",
                                      color: "#b45309",
                                      border: "1.5px solid #fcd34d",
                                      padding: "6px 11px",
                                      borderRadius: "6px",
                                      fontWeight: "800",
                                      fontSize: "13px",
                                      cursor: "pointer",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "5px",
                                      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                                    }}
                                  >
                                    <span>🔍</span> {app.prn}
                                  </button>
                                </td>

                                <td style={{ padding: "12px 14px" }}>
                                  <div style={{ fontWeight: "750", color: "#0f172a" }}>{app.student_name}</div>
                                  <div style={{ fontSize: "11.5px", color: "#64748b" }}>{app.student_email}</div>
                                </td>

                                <td style={{ padding: "12px 14px", color: "#475569" }}>
                                  <span style={{ fontWeight: "700" }}>{app.year || "TY"}</span> • {app.department || "AIML"}
                                </td>

                                <td style={{ padding: "12px 14px" }}>
                                  <div style={{ fontWeight: "650", color: "#1e293b" }}>
                                    {details?.subject || app.subject}
                                  </div>
                                  <div style={{ fontSize: "11px", color: "#64748b" }}>
                                    ⏰ {details?.lecture_time || app.lecture_time || "Full Day"}
                                  </div>
                                </td>

                                <td style={{ padding: "12px 14px", fontWeight: "650", color: "#334155" }}>
                                  {details?.lecture_date || app.lecture_date}
                                </td>

                                <td style={{ padding: "12px 14px" }}>
                                  <span
                                    style={{
                                      display: "inline-block",
                                      padding: "3px 9px",
                                      borderRadius: "6px",
                                      fontSize: "11.5px",
                                      fontWeight: "700",
                                      background: "#eff6ff",
                                      color: "#1d4ed8",
                                      border: "1px solid #bfdbfe",
                                    }}
                                  >
                                    {details?.leave_type || "Leave / OD"}
                                  </span>
                                </td>

                                <td style={{ padding: "12px 14px" }}>
                                  {hasDoc ? (
                                    <span
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px",
                                        padding: "3px 8px",
                                        borderRadius: "6px",
                                        fontSize: "11.5px",
                                        fontWeight: "750",
                                        background: isPdf ? "#fee2e2" : "#ecfdf5",
                                        color: isPdf ? "#b91c1c" : "#047857",
                                        border: `1px solid ${isPdf ? "#fecaca" : "#a7f3d0"}`,
                                      }}
                                    >
                                      {isPdf ? "📄 PDF Document" : "🖼️ Image Document"}
                                    </span>
                                  ) : (
                                    <span style={{ color: "#94a3b8", fontSize: "12px" }}>— Text Only</span>
                                  )}
                                </td>

                                <td style={{ padding: "12px 14px" }}>
                                  {app.status === "Approved" ? (
                                    <span
                                      style={{
                                        display: "inline-block",
                                        padding: "4px 9px",
                                        borderRadius: "6px",
                                        fontSize: "12px",
                                        fontWeight: "800",
                                        background: "#dcfce7",
                                        color: "#15803d",
                                        border: "1px solid #86efac",
                                      }}
                                    >
                                      ✅ Approved (Present)
                                    </span>
                                  ) : app.status === "Rejected" ? (
                                    <span
                                      style={{
                                        display: "inline-block",
                                        padding: "4px 9px",
                                        borderRadius: "6px",
                                        fontSize: "12px",
                                        fontWeight: "800",
                                        background: "#fee2e2",
                                        color: "#b91c1c",
                                        border: "1px solid #fca5a5",
                                      }}
                                    >
                                      ❌ Rejected (Absent)
                                    </span>
                                  ) : (
                                    <span
                                      style={{
                                        display: "inline-block",
                                        padding: "4px 9px",
                                        borderRadius: "6px",
                                        fontSize: "12px",
                                        fontWeight: "800",
                                        background: "#fef3c7",
                                        color: "#b45309",
                                        border: "1px solid #fde68a",
                                      }}
                                    >
                                      ⏳ Pending Review
                                    </span>
                                  )}
                                </td>

                                <td style={{ padding: "12px 14px", textAlign: "center" }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedLeaveApp(app);
                                      setDecisionMsg("");
                                    }}
                                    style={{
                                      padding: "6px 13px",
                                      background: "#ffca08",
                                      color: "#000000",
                                      border: "none",
                                      borderRadius: "6px",
                                      fontSize: "12px",
                                      fontWeight: "800",
                                      cursor: "pointer",
                                      boxShadow: "0 1px 4px rgba(255,202,8,0.4)",
                                    }}
                                  >
                                    👁️ Inspect & Verify
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: FACULTY / TEACHER MANAGEMENT (ADMIN PRIVILEGED ONLY)               */}
          {/* ========================================================================= */}
          {adminTab === "faculty" && (
            <div style={{ animation: "fadeIn 0.3s ease-in-out" }}>
              <div className="admin-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>👨‍🏫 Faculty / Teacher Management</span>
                <span style={{ fontSize: "12px", background: "#fee2e2", color: "#dc2626", padding: "4px 10px", borderRadius: "12px", fontWeight: "700" }}>
                  🔒 Admin Exclusive Authority
                </span>
              </div>

              {teacherMsg && (
                <div style={{
                  padding: "12px 16px",
                  borderRadius: "8px",
                  marginBottom: "16px",
                  fontWeight: "600",
                  fontSize: "13px",
                  background: teacherMsg.startsWith("✅") ? "#ecfdf5" : "#fef2f2",
                  color: teacherMsg.startsWith("✅") ? "#065f46" : "#991b1b",
                  border: `1px solid ${teacherMsg.startsWith("✅") ? "#a7f3d0" : "#fecaca"}`
                }}>
                  {teacherMsg}
                </div>
              )}

              {/* Add Teacher Form */}
              <div style={{
                background: "#f8fafc",
                padding: "18px 20px",
                borderRadius: "12px",
                border: "1.5px solid #e2e8f0",
                marginBottom: "24px"
              }}>
                <h3 style={{ margin: "0 0 14px 0", fontSize: "15px", fontWeight: "800", color: "#1e293b", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>➕</span> Add New Faculty Member
                </h3>
                <form onSubmit={handleAddTeacher}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#475569", marginBottom: "4px" }}>
                        Faculty ID / Employee Code <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. TCH001 or EMP102"
                        value={teacherForm.teacher_id}
                        onChange={(e) => setTeacherForm({ ...teacherForm, teacher_id: e.target.value })}
                        required
                        style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#475569", marginBottom: "4px" }}>
                        Full Name <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Dr. A. P. Sharma"
                        value={teacherForm.full_name}
                        onChange={(e) => setTeacherForm({ ...teacherForm, full_name: e.target.value })}
                        required
                        style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#475569", marginBottom: "4px" }}>
                        Institutional Email <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <input
                        type="email"
                        placeholder="faculty@ritindia.edu"
                        value={teacherForm.email}
                        onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
                        required
                        style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#475569", marginBottom: "4px" }}>
                        Department <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <select
                        value={teacherForm.department}
                        onChange={(e) => setTeacherForm({ ...teacherForm, department: e.target.value })}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      >
                        <option value="AIML">Artificial Intelligence & Machine Learning</option>
                        <option value="CSE">Computer Science & Engineering</option>
                        <option value="IT">Information Technology</option>
                        <option value="AIDS">AI & Data Science</option>
                        <option value="ECE">Electronics & Telecommunication</option>
                        <option value="MECH">Mechanical Engineering</option>
                        <option value="CIVIL">Civil Engineering</option>
                        <option value="EE">Electrical Engineering</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#475569", marginBottom: "4px" }}>
                        Designation
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Assistant Professor / HOD"
                        value={teacherForm.designation}
                        onChange={(e) => setTeacherForm({ ...teacherForm, designation: e.target.value })}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#475569", marginBottom: "4px" }}>
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        placeholder="+91 98765 43210"
                        value={teacherForm.phone}
                        onChange={(e) => setTeacherForm({ ...teacherForm, phone: e.target.value })}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#475569", marginBottom: "4px" }}>
                        Login Password
                      </label>
                      <input
                        type="password"
                        placeholder="Default: Teacher@123"
                        value={teacherForm.password}
                        onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: "14px", display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="submit"
                      disabled={teacherLoading}
                      style={{
                        padding: "10px 22px",
                        background: "#ffca08",
                        color: "#000000",
                        border: "none",
                        borderRadius: "8px",
                        fontWeight: "800",
                        fontSize: "13px",
                        cursor: "pointer",
                        boxShadow: "0 2px 8px rgba(255,202,8,0.4)"
                      }}
                    >
                      {teacherLoading ? "Adding Faculty..." : "➕ Register & Authorize Faculty"}
                    </button>
                  </div>
                </form>
              </div>

              {/* Faculty Directory Table */}
              <div style={{ background: "#ffffff", borderRadius: "12px", border: "1.5px solid #e2e8f0", overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "#1e293b" }}>
                    📋 Authorized Faculty Directory ({teachers.length} Members)
                  </h3>
                  <button
                    type="button"
                    onClick={fetchTeachers}
                    disabled={teacherLoading}
                    style={{
                      padding: "6px 12px",
                      background: "#f1f5f9",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "700",
                      cursor: "pointer"
                    }}
                  >
                    🔄 Refresh List
                  </button>
                </div>

                {teachers.length === 0 ? (
                  <div style={{ padding: "30px", textAlign: "center", color: "#64748b", fontSize: "14px" }}>
                    {teacherLoading ? "Loading faculty records..." : "No faculty accounts registered yet. Use the form above to enroll teachers."}
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                      <thead>
                        <tr style={{ background: "#f8fafc", color: "#475569", borderBottom: "1.5px solid #e2e8f0" }}>
                          <th style={{ padding: "10px 14px", fontWeight: "700" }}>Faculty ID</th>
                          <th style={{ padding: "10px 14px", fontWeight: "700" }}>Full Name</th>
                          <th style={{ padding: "10px 14px", fontWeight: "700" }}>Email</th>
                          <th style={{ padding: "10px 14px", fontWeight: "700" }}>Dept & Designation</th>
                          <th style={{ padding: "10px 14px", fontWeight: "700" }}>Phone</th>
                          <th style={{ padding: "10px 14px", fontWeight: "700", textAlign: "center" }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teachers.map((tch, idx) => (
                          <tr key={tch.teacher_id || idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "10px 14px", fontWeight: "700", color: "#0284c7" }}>
                              {tch.teacher_id}
                            </td>
                            <td style={{ padding: "10px 14px", fontWeight: "600", color: "#0f172a" }}>
                              {tch.full_name}
                            </td>
                            <td style={{ padding: "10px 14px", color: "#334155" }}>
                              {tch.email}
                            </td>
                            <td style={{ padding: "10px 14px", color: "#475569" }}>
                              <span style={{ fontWeight: "700", color: "#0f172a" }}>{tch.department || "AIML"}</span>
                              {tch.designation ? ` • ${tch.designation}` : ""}
                            </td>
                            <td style={{ padding: "10px 14px", color: "#64748b" }}>
                              {tch.phone || "—"}
                            </td>
                            <td style={{ padding: "10px 14px", textAlign: "center" }}>
                              <button
                                type="button"
                                onClick={() => handleDeleteTeacher(tch.teacher_id, tch.full_name)}
                                style={{
                                  padding: "5px 12px",
                                  background: "#fee2e2",
                                  color: "#b91c1c",
                                  border: "1px solid #fecaca",
                                  borderRadius: "6px",
                                  fontSize: "12px",
                                  fontWeight: "750",
                                  cursor: "pointer"
                                }}
                              >
                                🗑️ Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            className="admin-logout-btn"
            onClick={logout}
            disabled={loading}
            style={{ marginTop: "20px" }}
          >
            Logout from Admin Portal
          </button>
        </section>
      </main>

      {/* ========================================================================= */}
      {/* 📝 ADMIN STUDENT RECORD VIEWER & EDITOR MODAL                             */}
      {/* ========================================================================= */}
      {editingStudent && (
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
          <div style={{
            background: "#ffffff",
            borderRadius: "16px",
            maxWidth: "650px",
            width: "100%",
            maxHeight: "90vh",
            overflowY: "auto",
            boxShadow: "0 25px 50px rgba(0,0,0,0.35)",
            border: "2px solid #ffca08"
          }}>
            {/* Modal Header */}
            <div style={{
              background: "linear-gradient(135deg, #1e3a8a 0%, #0284c7 100%)",
              padding: "18px 24px",
              color: "#ffffff",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "800" }}>
                  👤 Student Profile & Cloud Database Record
                </h3>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", opacity: 0.9 }}>
                  PRN: {editingStudent.prn} | {editingStudent.full_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                style={{ background: "transparent", border: "none", color: "#ffffff", fontSize: "22px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body / Editor Form */}
            <form onSubmit={handleSaveStudentChanges} style={{ padding: "20px 24px" }}>
              {/* Photo & Quick Overview */}
              <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "18px", background: "#f8fafc", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <div style={{ position: "relative" }}>
                  <img
                    src={editPhotoPreview || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"}
                    alt={editingStudent.full_name}
                    style={{ width: "80px", height: "80px", borderRadius: "50%", objectFit: "cover", border: "2.5px solid #ffca08" }}
                  />
                  <label
                    htmlFor="edit-photo-input"
                    style={{
                      position: "absolute",
                      bottom: 0,
                      right: 0,
                      background: "#ffca08",
                      borderRadius: "50%",
                      width: "26px",
                      height: "26px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      fontSize: "13px",
                      boxShadow: "0 2px 5px rgba(0,0,0,0.2)"
                    }}
                    title="Change Photo"
                  >
                    📷
                  </label>
                  <input
                    id="edit-photo-input"
                    type="file"
                    accept="image/*"
                    onChange={handleEditPhotoSelect}
                    style={{ display: "none" }}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: "0 0 4px 0", fontSize: "16px", color: "#111827" }}>{editingStudent.full_name}</h4>
                  <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "#4b5563" }}>
                    <b>PRN:</b> {editingStudent.prn} &nbsp;|&nbsp; <b>Batch:</b> {editingStudent.year} ({editingStudent.branch} - Div {editingStudent.division})
                  </p>
                  <p style={{ margin: 0, fontSize: "11.5px", color: "#6b7280" }}>
                    Click the camera icon to upload a new facial verification reference photo.
                  </p>
                </div>
              </div>

              {/* Editable Fields Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#374151", marginBottom: "4px" }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.full_name}
                    onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#374151", marginBottom: "4px" }}>
                    Student PRN (Primary ID - Fixed)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={editForm.prn}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#f1f5f9", color: "#64748b", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#374151", marginBottom: "4px" }}>
                    College Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#374151", marginBottom: "4px" }}>
                    Reset Account Password (leave blank to keep current)
                  </label>
                  <input
                    type="text"
                    placeholder="Enter new password (optional)"
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#374151", marginBottom: "4px" }}>
                    Student Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#374151", marginBottom: "4px" }}>
                    Parent / Emergency Phone
                  </label>
                  <input
                    type="tel"
                    value={editForm.parent_phone}
                    onChange={(e) => setEditForm({ ...editForm, parent_phone: e.target.value })}
                    placeholder="Emergency mobile"
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#374151", marginBottom: "4px" }}>
                    Class / Year *
                  </label>
                  <select
                    value={editForm.year}
                    onChange={(e) => setEditForm({ ...editForm, year: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                  >
                    <option value="First Year">First Year</option>
                    <option value="Second Year">Second Year</option>
                    <option value="Third Year">Third Year</option>
                    <option value="Final Year">Final Year</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#374151", marginBottom: "4px" }}>
                    Branch / Department *
                  </label>
                  <select
                    value={editForm.branch}
                    onChange={(e) => setEditForm({ ...editForm, branch: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                  >
                    <option value="AIML">AIML</option>
                    <option value="CSE">CSE</option>
                    <option value="ENTC">ENTC</option>
                    <option value="Mechanical">Mechanical</option>
                    <option value="Civil">Civil</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#374151", marginBottom: "4px" }}>
                    Division *
                  </label>
                  <select
                    value={editForm.division}
                    onChange={(e) => setEditForm({ ...editForm, division: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                  >
                    <option value="A">Division A</option>
                    <option value="B">Division B</option>
                    <option value="C">Division C</option>
                    <option value="D">Division D</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#374151", marginBottom: "4px" }}>
                    Blood Group
                  </label>
                  <select
                    value={editForm.blood_group}
                    onChange={(e) => setEditForm({ ...editForm, blood_group: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
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
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#374151", marginBottom: "4px" }}>
                  Residential Address
                </label>
                <textarea
                  rows={2}
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  placeholder="Student permanent / hostel address"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", boxSizing: "border-box" }}
                />
              </div>

              {editMsg && (
                <div style={{
                  padding: "10px 12px",
                  borderRadius: "7px",
                  fontSize: "12.5px",
                  fontWeight: "600",
                  marginBottom: "16px",
                  background: editMsg.startsWith("✅") ? "#f0fdf4" : "#fef2f2",
                  color: editMsg.startsWith("✅") ? "#166534" : "#991b1b",
                  border: `1px solid ${editMsg.startsWith("✅") ? "#86efac" : "#fca5a5"}`
                }}>
                  {editMsg}
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => handleDeleteStudent(editingStudent.prn, editingStudent.full_name)}
                  disabled={editLoading}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#fee2e2",
                    color: "#dc2626",
                    fontWeight: "750",
                    fontSize: "13px",
                    cursor: "pointer"
                  }}
                >
                  🗑️ Delete Student
                </button>

                <div style={{ flex: 1 }} />

                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  style={{
                    padding: "10px 16px",
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
                  disabled={editLoading}
                  style={{
                    padding: "10px 22px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#ffca08",
                    color: "#000000",
                    fontWeight: "800",
                    fontSize: "13.5px",
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(255,202,8,0.3)"
                  }}
                >
                  {editLoading ? "Saving to Cloud DB..." : "💾 Save Changes to Database"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Password Change Modal */}
      {/* ========================================================================= */}
      {/* 📑 STUDENT LEAVE & CERTIFICATE INSPECTION & ATTENDANCE MARKING MODAL       */}
      {/* ========================================================================= */}
      {selectedLeaveApp && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
            padding: "16px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              maxWidth: "800px",
              width: "100%",
              maxHeight: "94vh",
              overflowY: "auto",
              boxShadow: "0 25px 60px rgba(0,0,0,0.35)",
              boxSizing: "border-box",
              padding: "24px",
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1.5px solid #e2e8f0", paddingBottom: "14px", marginBottom: "16px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "22px" }}>📑</span>
                  <h2 style={{ margin: 0, fontSize: "19px", fontWeight: "800", color: "#0f172a" }}>
                    Student Leave & Certificate Verification
                  </h2>
                </div>
                <div style={{ fontSize: "13px", color: "#475569", marginTop: "4px" }}>
                  Candidate: <b style={{ color: "#0284c7" }}>{selectedLeaveApp.student_name}</b> (PRN: <b style={{ color: "#b45309" }}>{selectedLeaveApp.prn}</b>) • {selectedLeaveApp.year || "TY"} {selectedLeaveApp.department || "AIML"} • {selectedLeaveApp.student_email}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedLeaveApp(null);
                  setDecisionMsg("");
                }}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: "50%",
                  width: "34px",
                  height: "34px",
                  fontSize: "16px",
                  cursor: "pointer",
                  color: "#64748b",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "800",
                }}
              >
                ✕
              </button>
            </div>

            {/* Quick Metadata Info Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px", marginBottom: "16px" }}>
              <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "11px", fontWeight: "750", color: "#64748b", textTransform: "uppercase" }}>📅 Absence Date</div>
                <div style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", marginTop: "2px" }}>
                  {selectedLeaveApp.parsed_details?.lecture_date || selectedLeaveApp.lecture_date}
                </div>
              </div>

              <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "11px", fontWeight: "750", color: "#64748b", textTransform: "uppercase" }}>⏰ Lecture Slot</div>
                <div style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", marginTop: "2px" }}>
                  {selectedLeaveApp.parsed_details?.lecture_time || selectedLeaveApp.lecture_time || "All Lectures"}
                </div>
              </div>

              <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "11px", fontWeight: "750", color: "#64748b", textTransform: "uppercase" }}>📚 Subject / Course</div>
                <div style={{ fontSize: "13.5px", fontWeight: "800", color: "#0284c7", marginTop: "2px" }}>
                  {selectedLeaveApp.parsed_details?.subject || selectedLeaveApp.subject}
                </div>
              </div>

              <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "11px", fontWeight: "750", color: "#64748b", textTransform: "uppercase" }}>🏷️ Leave Category</div>
                <div style={{ fontSize: "13.5px", fontWeight: "800", color: "#d97706", marginTop: "2px" }}>
                  {selectedLeaveApp.parsed_details?.leave_type || "Medical / OD"}
                </div>
              </div>
            </div>

            {/* Student's Reason & Justification */}
            <div style={{ background: "#f1f5f9", borderRadius: "10px", padding: "12px 16px", marginBottom: "18px", border: "1px solid #cbd5e1" }}>
              <div style={{ fontSize: "12px", fontWeight: "800", color: "#334155", marginBottom: "4px" }}>
                💬 Candidate's Stated Reason & Explanation:
              </div>
              <div style={{ fontSize: "13.5px", color: "#0f172a", lineHeight: "1.5" }}>
                {selectedLeaveApp.parsed_details?.reason || selectedLeaveApp.email_content || "No explanation provided."}
              </div>
            </div>

            {/* ATTACHED DOCUMENT VIEWER (IMAGE OR PDF) */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <label style={{ fontSize: "13px", fontWeight: "800", color: "#1e293b" }}>
                  📎 Attached Official Certificate / Medical Letter / Proof:
                </label>
                {selectedLeaveApp.parsed_details?.document_data && (
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    File: <b>{selectedLeaveApp.parsed_details.document_name || "Document"}</b> ({((selectedLeaveApp.parsed_details.document_size || 0) / 1024).toFixed(1)} KB)
                  </span>
                )}
              </div>

              {selectedLeaveApp.parsed_details?.document_data ? (
                <div>
                  {selectedLeaveApp.parsed_details.document_type?.includes("pdf") ||
                  selectedLeaveApp.parsed_details.document_name?.toLowerCase().endsWith(".pdf") ? (
                    <div>
                      <iframe
                        src={selectedLeaveApp.parsed_details.document_data}
                        title="Attached PDF Document Preview"
                        style={{
                          width: "100%",
                          height: "440px",
                          border: "1.5px solid #cbd5e1",
                          borderRadius: "8px",
                          background: "#f8fafc",
                          boxSizing: "border-box",
                        }}
                      />
                      <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                        <a
                          href={selectedLeaveApp.parsed_details.document_data}
                          download={selectedLeaveApp.parsed_details.document_name || `${selectedLeaveApp.prn}_certificate.pdf`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "7px 14px",
                            background: "#fee2e2",
                            color: "#b91c1c",
                            border: "1px solid #fecaca",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "750",
                            textDecoration: "none",
                          }}
                        >
                          📥 Download Attached PDF
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            const w = window.open("");
                            if (w && selectedLeaveApp.parsed_details?.document_data) {
                              w.document.write(
                                `<iframe src="${selectedLeaveApp.parsed_details.document_data}" style="border:0; position:fixed; top:0; left:0; width:100%; height:100%;" allowfullscreen></iframe>`
                              );
                            }
                          }}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "7px 14px",
                            background: "#f1f5f9",
                            color: "#334155",
                            border: "1px solid #cbd5e1",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "750",
                            cursor: "pointer",
                          }}
                        >
                          ↗️ Open Full Screen in New Tab
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div
                        style={{
                          border: "1.5px solid #cbd5e1",
                          borderRadius: "8px",
                          padding: "10px",
                          background: "#0f172a",
                          textAlign: "center",
                        }}
                      >
                        <img
                          src={selectedLeaveApp.parsed_details.document_data}
                          alt="Student Certificate / Letter"
                          style={{
                            maxWidth: "100%",
                            maxHeight: "450px",
                            objectFit: "contain",
                            borderRadius: "4px",
                            display: "inline-block",
                          }}
                        />
                      </div>
                      <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                        <a
                          href={selectedLeaveApp.parsed_details.document_data}
                          download={selectedLeaveApp.parsed_details.document_name || `${selectedLeaveApp.prn}_certificate.png`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "7px 14px",
                            background: "#ecfdf5",
                            color: "#047857",
                            border: "1px solid #a7f3d0",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "750",
                            textDecoration: "none",
                          }}
                        >
                          📥 Download Original Image
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            const w = window.open("");
                            if (w && selectedLeaveApp.parsed_details?.document_data) {
                              w.document.write(
                                `<div style="background:#0f172a; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px;"><img src="${selectedLeaveApp.parsed_details.document_data}" style="max-width:100%; max-height:95vh; object-fit:contain;" /></div>`
                              );
                            }
                          }}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "7px 14px",
                            background: "#f1f5f9",
                            color: "#334155",
                            border: "1px solid #cbd5e1",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "750",
                            cursor: "pointer",
                          }}
                        >
                          ↗️ Open Full Image in New Tab
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ background: "#f8fafc", padding: "24px", borderRadius: "8px", border: "1.5px dashed #cbd5e1", textAlign: "center", color: "#64748b" }}>
                  <div style={{ fontSize: "28px", marginBottom: "4px" }}>ℹ️</div>
                  <div style={{ fontWeight: "700", color: "#334155", fontSize: "14px" }}>
                    No File Attachment Uploaded
                  </div>
                  <div style={{ fontSize: "12px", marginTop: "2px" }}>
                    The candidate submitted a text explanation without attaching an image or PDF. Review using their stated reason above.
                  </div>
                </div>
              )}
            </div>

            {/* Current Decision Pill */}
            <div style={{ marginBottom: "14px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
              <div style={{ fontSize: "13px", fontWeight: "750", color: "#334155" }}>
                Current Verification Status:
              </div>
              <div>
                {selectedLeaveApp.status === "Approved" ? (
                  <span style={{ padding: "5px 12px", borderRadius: "7px", fontSize: "12.5px", fontWeight: "800", background: "#dcfce7", color: "#15803d", border: "1px solid #86efac" }}>
                    ✅ ACCEPTED & MARKED PRESENT ({selectedLeaveApp.teacher_name || "Admin"})
                  </span>
                ) : selectedLeaveApp.status === "Rejected" ? (
                  <span style={{ padding: "5px 12px", borderRadius: "7px", fontSize: "12.5px", fontWeight: "800", background: "#fee2e2", color: "#b91c1c", border: "1px solid #fca5a5" }}>
                    ❌ REJECTED & MARKED ABSENT ({selectedLeaveApp.teacher_name || "Admin"})
                  </span>
                ) : (
                  <span style={{ padding: "5px 12px", borderRadius: "7px", fontSize: "12.5px", fontWeight: "800", background: "#fef3c7", color: "#b45309", border: "1px solid #fde68a" }}>
                    ⏳ PENDING ADMINISTRATIVE REVIEW
                  </span>
                )}
              </div>
            </div>

            {/* Decision Status Message Banner */}
            {decisionMsg && (
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "750",
                  marginBottom: "16px",
                  background: decisionMsg.startsWith("❌") ? "#fef2f2" : "#f0fdf4",
                  color: decisionMsg.startsWith("❌") ? "#991b1b" : "#166534",
                  border: `1.5px solid ${decisionMsg.startsWith("❌") ? "#fca5a5" : "#86efac"}`,
                }}
              >
                {decisionMsg}
              </div>
            )}

            {/* ACTION BUTTONS DIRECTLY BELOW THE LETTER: ACCEPT & MARK PRESENT or REJECT & MARK ABSENT */}
            <div
              style={{
                background: "#f8fafc",
                padding: "18px 20px",
                borderRadius: "12px",
                border: "1.5px solid #e2e8f0",
                boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
              }}
            >
              <div style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", marginBottom: "4px" }}>
                ⚖️ Admin Verification Decision for Attendance Database:
              </div>
              <p style={{ margin: "0 0 14px 0", fontSize: "12.5px", color: "#64748b" }}>
                Clicking an action below immediately writes to the official institutional attendance records for this lecture date & subject, updates the defaulter calculations, and sends an email receipt to <b>{selectedLeaveApp.student_email}</b>.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                {/* 1. ACCEPT & MARK PRESENT */}
                <button
                  type="button"
                  onClick={() => handleLeaveDecision("Approved")}
                  disabled={decisionLoading}
                  style={{
                    background: "linear-gradient(135deg, #10b981, #047857)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "10px",
                    padding: "14px 18px",
                    cursor: "pointer",
                    textAlign: "left",
                    boxShadow: "0 4px 14px rgba(16,185,129,0.35)",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div style={{ fontSize: "15px", fontWeight: "800", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>✅</span> Accept & Mark Present
                  </div>
                  <div style={{ fontSize: "11.5px", color: "#d1fae5", marginTop: "4px", lineHeight: "1.4" }}>
                    Marks student as <b>PRESENT</b> for this lecture. Increments attendance % and exempts from defaulter list.
                  </div>
                </button>

                {/* 2. REJECT & MARK ABSENT */}
                <button
                  type="button"
                  onClick={() => handleLeaveDecision("Rejected")}
                  disabled={decisionLoading}
                  style={{
                    background: "linear-gradient(135deg, #ef4444, #b91c1c)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "10px",
                    padding: "14px 18px",
                    cursor: "pointer",
                    textAlign: "left",
                    boxShadow: "0 4px 14px rgba(239,68,68,0.35)",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div style={{ fontSize: "15px", fontWeight: "800", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>❌</span> Reject & Mark Absent
                  </div>
                  <div style={{ fontSize: "11.5px", color: "#fee2e2", marginTop: "4px", lineHeight: "1.4" }}>
                    Marks student as <b>ABSENT</b> for this lecture. Defaulter list reflects this absence.
                  </div>
                </button>
              </div>

              <div style={{ marginTop: "14px", display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLeaveApp(null);
                    setDecisionMsg("");
                  }}
                  style={{
                    padding: "9px 20px",
                    background: "#ffffff",
                    color: "#475569",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    fontWeight: "750",
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Close Inspection Window
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🔐 ADMIN PASSWORD CHANGE MODAL                                            */}
      {/* ========================================================================= */}
      {showAdminPassModal && (
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
              🔒 Change Administrator Password
            </h3>
            <p style={{ margin: "0 0 14px 0", fontSize: "13px", color: "#6b7280" }}>
              Update the master administrator credentials for institution management.
            </p>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "12px", color: "#374151", fontWeight: "650", display: "block", marginBottom: "4px" }}>
                New Password
              </label>
              <input
                type="password"
                placeholder="Min 6 characters"
                value={adminNewPass}
                onChange={(e) => setAdminNewPass(e.target.value)}
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
                value={adminConfirmPass}
                onChange={(e) => setAdminConfirmPass(e.target.value)}
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

            {adminPassMsg && (
              <p style={{ margin: "8px 0", fontSize: "13px", fontWeight: "650" }}>
                {adminPassMsg}
              </p>
            )}

            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button
                type="button"
                onClick={handleAdminPasswordChange}
                disabled={adminPassLoading}
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
                {adminPassLoading ? "Updating..." : "Update Password"}
              </button>
              <button
                type="button"
                onClick={() => setShowAdminPassModal(false)}
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
    </div>
  );
}