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
import { getStudentsList, addNewStudent, updateUserPassword } from "../../services/supabase";
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

  const [excelFile, setExcelFile] =
    useState<File | null>(null);

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

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchStudents(selectedYear, selectedDepartment);
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
        <section className="admin-card">
          <h2>
            Welcome,
          </h2>

          <h2 className="admin-name">
            {adminName}
          </h2>

          <div className="admin-title">
            Add New Student
          </div>

          <form
            onSubmit={
              handleAddStudent
            }
          >
            <div className="admin-field">
              <label>
                PRN
                <span>*</span>
              </label>

              <input
                type="text"
                name="prn"
                value={
                  formData.prn
                }
                onChange={
                  handleChange
                }
                placeholder="Enter PRN"
                required
                disabled={loading}
              />
            </div>

            <div className="admin-field">
              <label>
                Full Name
                <span>*</span>
              </label>

              <input
                type="text"
                name="full_name"
                value={
                  formData.full_name
                }
                onChange={
                  handleChange
                }
                placeholder="Enter student name"
                required
                disabled={loading}
              />
            </div>

            <div className="admin-field">
              <label>
                Email
                <span>*</span>
              </label>

              <input
                type="email"
                name="email"
                value={
                  formData.email
                }
                onChange={
                  handleChange
                }
                placeholder="student@gmail.com"
                required
                disabled={loading}
              />
            </div>

            <div className="admin-field">
              <label>
                Student Password
                <span>*</span>
              </label>

              <input
                type="password"
                name="password"
                value={
                  formData.password
                }
                onChange={
                  handleChange
                }
                placeholder="Minimum 6 characters"
                required
                disabled={loading}
              />
            </div>

            <div className="admin-field">
              <label>
                Phone
                <span>*</span>
              </label>

              <input
                type="tel"
                name="phone"
                value={
                  formData.phone
                }
                onChange={
                  handleChange
                }
                placeholder="Enter phone number"
                required
                disabled={loading}
              />
            </div>

            <div className="admin-field">
              <label>
                Select Year
                <span>*</span>
              </label>

              <select
                name="year"
                value={
                  formData.year
                }
                onChange={
                  handleChange
                }
                required
                disabled={loading}
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
            </div>

            <div className="admin-field">
              <label>
                Select Department
                <span>*</span>
              </label>

              <select
                name="branch"
                value={
                  formData.branch
                }
                onChange={
                  handleChange
                }
                required
                disabled={loading}
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

                <option value="ENTC">
                  ENTC
                </option>

                <option value="Mechanical">
                  Mechanical
                </option>

                <option value="Civil">
                  Civil
                </option>
              </select>
            </div>

            <div className="admin-field">
              <label>
                Select Division
                <span>*</span>
              </label>

              <select
                name="division"
                value={
                  formData.division
                }
                onChange={
                  handleChange
                }
                required
                disabled={loading}
              >
                <option value="">
                  Select Division
                </option>

                <option value="A">
                  A
                </option>

                <option value="B">
                  B
                </option>

                <option value="C">
                  C
                </option>

                <option value="D">
                  D
                </option>
              </select>
            </div>

            <div className="admin-field">
              <label>
                Gender
              </label>

              <select
                name="gender"
                value={
                  formData.gender
                }
                onChange={
                  handleChange
                }
                disabled={loading}
              >
                <option value="">
                  Select Gender
                </option>

                <option value="Male">
                  Male
                </option>

                <option value="Female">
                  Female
                </option>

                <option value="Other">
                  Other
                </option>
              </select>
            </div>

            <div className="admin-field">
              <label>
                Student Photo
                <span>*</span>
              </label>

              <input
                type="file"
                accept="image/*"
                onChange={
                  handlePhotoChange
                }
                disabled={loading}
                required
              />

              {photo && (
                <p className="selected-photo">
                  Selected: {photo.name}
                </p>
              )}
            </div>

            {message && (
              <div className="admin-message">
                {message}
              </div>
            )}

            <button
              type="submit"
              className="admin-add-btn"
              disabled={loading}
            >
              {
                loading
                  ? "Adding Student..."
                  : "Add Student"
              }
            </button>
          </form>

          <div className="bulk-upload-section">

            <div className="admin-title">
              Bulk Student Registration
            </div>

            <p className="bulk-description">
              Upload the Excel file and a ZIP file containing
              student photos. Each photo must be named using
              the student's PRN.
            </p>

            <div className="excel-format-box">
              <strong>
                Excel columns required:
              </strong>

              <div className="excel-columns">
                PRN, Full Name, Email, Password,
                Phone, Year, Branch, Division, Gender
              </div>

              <strong>
                Photo ZIP format:
              </strong>

              <div className="excel-columns">
                Photos must be named using the student's PRN.
                Example: 2023001.jpg
              </div>
            </div>

            <button
              type="button"
              className="download-template-btn"
              onClick={() => {
                window.open(
                  "/student_bulk_upload_template.xlsx",
                  "_blank"
                );
              }}
            >
              Download Excel Template
            </button>

            <div className="admin-field">
              <label>
                Upload Excel File
                <span>*</span>
              </label>

              <input
                id="student-excel"
                type="file"
                accept=".xlsx,.xls"
                onChange={
                  handleExcelChange
                }
                disabled={bulkLoading}
              />

              {excelFile && (
                <p className="selected-photo">
                  Selected: {excelFile.name}
                </p>
              )}
            </div>

            <div className="admin-field">
              <label>
                Upload Student Photos ZIP
                <span>*</span>
              </label>

              <input
                id="student-photos-zip"
                type="file"
                accept=".zip"
                onChange={
                  handlePhotosZipChange
                }
                disabled={bulkLoading}
              />

              {photosZip && (
                <p className="selected-photo">
                  Selected: {photosZip.name}
                </p>
              )}
            </div>

            {bulkMessage && (
              <div
                className={`admin-message ${
                  bulkResult
                    ? "bulk-success"
                    : "bulk-error"
                }`}
              >
                {bulkMessage}
              </div>
            )}

            {bulkResult && (
              <div className="bulk-result">

                <div>
                  <strong>
                    Total Rows:
                  </strong>{" "}
                  {bulkResult.total || 0}
                </div>

                <div>
                  <strong>
                    Registered:
                  </strong>{" "}
                  {bulkResult.successful || 0}
                </div>

                <div>
                  <strong>
                    Failed:
                  </strong>{" "}
                  {bulkResult.failed || 0}
                </div>

              </div>
            )}

            {bulkResult?.errors?.length > 0 && (
              <div className="bulk-errors">

                <h4>
                  Failed Students
                </h4>

                {bulkResult.errors.map(
                  (
                    error: any,
                    index: number
                  ) => (
                    <div
                      key={index}
                      className="bulk-error-row"
                    >
                      Row {error.row}:{" "}
                      {error.prn || "Unknown PRN"} —{" "}
                      {error.message}
                    </div>
                  )
                )}

              </div>
            )}

            <button
              type="button"
              className="admin-add-btn bulk-upload-btn"
              onClick={
                handleBulkStudentUpload
              }
              disabled={
                bulkLoading ||
                !excelFile ||
                !photosZip
              }
            >
              {bulkLoading
                ? "Registering Students..."
                : "Upload Excel & Register Students"}
            </button>

          </div>

          <div className="student-list-section">
            <div className="admin-title">
              Student List
            </div>

            <div className="student-filters">
              <div className="admin-field">
                <label>
                  Select Year
                </label>

                <select
                  value={selectedYear}
                  onChange={(e) =>
                    setSelectedYear(
                      e.target.value
                    )
                  }
                  disabled={
                    studentsLoading
                  }
                >
                  <option value="">
                    All Years
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
              </div>

              <div className="admin-field">
                <label>
                  Select Department
                </label>

                <select
                  value={
                    selectedDepartment
                  }
                  onChange={(e) =>
                    setSelectedDepartment(
                      e.target.value
                    )
                  }
                  disabled={
                    studentsLoading
                  }
                >
                  <option value="">
                    All Departments
                  </option>

                  <option value="AIML">
                    AIML
                  </option>

                  <option value="CSE">
                    CSE
                  </option>

                  <option value="ENTC">
                    ENTC
                  </option>

                  <option value="Mechanical">
                    Mechanical
                  </option>

                  <option value="Civil">
                    Civil
                  </option>
                </select>
              </div>
            </div>

            <div className="student-count">
              {
                studentsLoading
                  ? "Loading students..."
                  : `${students.length} student${
                      students.length !== 1
                        ? "s"
                        : ""
                    } found`
              }
            </div>

            {studentListError && (
              <div className="student-list-message" style={{ color: "#ef4444" }}>
                {studentListError}
              </div>
            )}

            {studentsLoading ? (
              <div className="student-list-message">
                Loading students...
              </div>
            ) : students.length === 0 ? (
              <div className="student-list-message">
                No students found.
              </div>
            ) : (
              <div className="student-table-container">
                <table className="student-table">
                  <thead>
                    <tr>
                      <th>PRN</th>
                      <th>Full Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Year</th>
                      <th>Department</th>
                      <th>Division</th>
                      <th>Gender</th>
                    </tr>
                  </thead>

                  <tbody>
                    {students.map(
                      (student) => (
                        <tr
                          key={
                            student.prn
                          }
                        >
                          <td>
                            {student.prn}
                          </td>

                          <td>
                            {
                              student.full_name
                            }
                          </td>

                          <td>
                            {
                              student.email
                            }
                          </td>

                          <td>
                            {
                              student.phone
                            }
                          </td>

                          <td>
                            {
                              student.year
                            }
                          </td>

                          <td>
                            {
                              student.branch
                            }
                          </td>

                          <td>
                            {
                              student.division
                            }
                          </td>

                          <td>
                            {
                              student.gender ||
                              "-"
                            }
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <button
            className="admin-logout-btn"
            onClick={logout}
            disabled={loading}
          >
            Logout
          </button>
        </section>
      </main>

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