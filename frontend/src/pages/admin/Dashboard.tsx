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
import { getStudentsList, addNewStudent, updateUserPassword, updateStudentByAdmin, deleteStudentByAdmin, getTeachersList, addNewTeacher, deleteTeacherByAdmin } from "../../services/supabase";
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

  // 🎓 Admin Navigation Tabs (Tab 1: Student Directory, Tab 2: Enroll Students, Tab 3: Faculty Management)
  const [adminTab, setAdminTab] = useState<"directory" | "enroll" | "faculty">("directory");
  const [selectedDivision, setSelectedDivision] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

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

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchStudents(selectedYear, selectedDepartment);
        fetchTeachers();
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