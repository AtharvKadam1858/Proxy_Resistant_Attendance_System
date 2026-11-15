import {
  useEffect,
  useState
} from "react";

import {
  useNavigate
} from "react-router-dom";

import "../../styles/profile.css";

import { API_URL } from "../../config";
import { getStudentProfile, updateStudentProfilePhoto } from "../../services/supabase";
import ritLogo from "../../assets/RIT_logo.jpeg";

import {
  getAuth
} from "firebase/auth";

import {
  initializeApp,
  getApps
} from "firebase/app";


interface Student {
  full_name: string;
  prn: string;
  email: string;
  phone: string;
  year: string;
  branch: string;
  division: string;
  gender: string;
  face_folder: string;
  avatar_url?: string;
}

const firebaseConfig = {
  apiKey:
    "AIzaSyDsJPGm7CwJEE2o2kI",
};

const firebaseApp =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp(firebaseConfig);

export default function Profile() {

  const navigate = useNavigate();
  const [
    student,
    setStudent
  ] = useState<Student | null>(null);
  const [
    loading,
    setLoading
  ] = useState(true);
  const [
    error,
    setError
  ] = useState("");
  const [
    photoFile,
    setPhotoFile
  ] = useState<File | null>(null);
  const [
    photoPreview,
    setPhotoPreview
  ] = useState("");
  const [
    uploading,
    setUploading
  ] = useState(false);
  const [
    photoError,
    setPhotoError
  ] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const prn =
          localStorage.getItem("prn");
        console.log(
          "Logged-in student PRN:",
          prn
        );
        if (!prn) {
          setError(
            "Student PRN not found. Please login again."
          );
          setLoading(false);
          return;
        }
        let studentData = null;
        try {
          const response = await fetch(
            `${API_URL}/student/profile/${encodeURIComponent(prn)}`
          );
          if (response.ok) {
            studentData = await response.json();
          }
        } catch {
          // API not available, proceed to cloud DB fallback
        }

        if (!studentData) {
          studentData = await getStudentProfile(prn);
        }

        if (!studentData) {
          throw new Error("Student profile not found in cloud database.");
        }

        setStudent(studentData);
        setLoading(false);
      } catch (err: any) {
        console.error(
          "Profile error:",
          err
        );
        setError(
          err?.message ||
          "Unable to load student profile."
        );
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  const handlePhotoChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event.target.files?.[0];
    if (!file) {
      return;
    }
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];
    if (!allowedTypes.includes(file.type)) {
      alert(
        "Please select a JPG, PNG or WEBP image."
      );
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert(
        "Photo size must be less than 5 MB."
      );
      event.target.value = "";
      return;
    }
    setPhotoFile(file);
    const previewUrl =
      URL.createObjectURL(file);
    setPhotoPreview(previewUrl);
  };
  const handleUploadPhoto = async () => {
    if (!photoFile) {
      alert("Please select a photo first.");
      return;
    }
    if (!student) {
      alert("Student profile not loaded.");
      return;
    }
    try {
      setUploading(true);

      // Convert file to high-efficiency base64 data URL
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
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              resolve(canvas.toDataURL("image/jpeg", 0.85));
            } else {
              resolve(e.target?.result as string);
            }
          };
          img.onerror = () => resolve(e.target?.result as string);
          img.src = e.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(photoFile);
      });

      // Update directly in Supabase cloud database
      await updateStudentProfilePhoto(student.prn, base64Data);

      // Try background update to Flask backend if available
      try {
        const currentUser = getAuth(firebaseApp).currentUser;
        if (currentUser) {
          const token = await currentUser.getIdToken(true);
          const formData = new FormData();
          formData.append("photo", photoFile);
          formData.append("prn", student.prn);
          await fetch(`${API_URL}/student/profile/photo`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });
        }
      } catch {}

      setStudent({
        ...student,
        avatar_url: base64Data,
        face_folder: base64Data,
      });
      setPhotoError(false);
      setPhotoFile(null);
      setPhotoPreview(base64Data);

      alert("✅ Profile photo updated successfully!");
    } catch (err: any) {
      console.error("Photo upload error:", err);
      alert(err?.message || "Unable to upload profile photo.");
    } finally {
      setUploading(false);
    }
  };
  const openScanner = () => {
    navigate("/scan");
  };
  const logout = () => {
    localStorage.removeItem("role");
    localStorage.removeItem("prn");
    localStorage.removeItem("email");
    localStorage.removeItem("full_name");
    window.location.href = "/";
  };
  if (loading) {
    return (
      <div className="wrapper">
        <h2>
          Loading Profile...
        </h2>
      </div>
    );
  }
  if (!student) {
    return (
      <div className="wrapper">
        <div className="card">
          <div className="card-header">
            <div className="profile-header-left">
              <img
                src={ritLogo}
                alt="RIT Logo"
                className="profile-rit-logo"
              />
              <span>
                Student Profile
              </span>
            </div>
          </div>
          <div className="section center">
            <h2>
              Student Profile Not Found
            </h2>
            <p>
              {error}
            </p>
            <button
              className="btn"
              onClick={() =>
                window.location.href = "/"
              }
            >
              Login Again
            </button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="wrapper">
      <div className="card">
        <div className="card-header">
          <div className="profile-header-left">
            <img
              src={ritLogo}
              alt="RIT Logo"
              className="profile-rit-logo"
            />
            <span>
              Student Profile
            </span>
          </div>
        </div>
        <div className="profile-banner">
          <img
            src={
              photoPreview
                ? photoPreview
                : student.avatar_url
                  ? student.avatar_url
                  : student.face_folder && (student.face_folder.startsWith("data:") || student.face_folder.startsWith("http"))
                    ? student.face_folder
                    : !photoError
                      ? `${API_URL}/student/photo/${encodeURIComponent(student.prn)}?t=${Date.now()}`
                      : "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
            }
            className="profile-img"
            alt={student.full_name}
            onError={() =>
              setPhotoError(true)
            }
          />
          <div className="profile-info">
            <h3>
              {student.full_name}
            </h3>
            <p>
              <b>PRN:</b>{" "}
              {student.prn}
            </p>
            <p>
              <b>Year:</b>{" "}
              {student.year}
            </p>
            <p>
              <b>Branch:</b>{" "}
              {student.branch}
            </p>
            <p>
              <b>Division:</b>{" "}
              {student.division}
            </p>
          </div>
        </div>
        <div className="section center">
          <button
            className="btn"
            onClick={openScanner}
          >
            📷 Scan QR for Attendance
          </button>
        </div>
        <div className="section">
          <button
            className="btn"
            onClick={() =>
              navigate(
                "/student-attendance"
              )
            }
          >
            📊 View Attendance
          </button>
        </div>
        <div className="section">
          <h4>
            Update Profile Photo
          </h4>
          <input
            id="student-photo-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhotoChange}
            style={{
              display: "none"
            }}
          />
          <label
            htmlFor="student-photo-input"
            className="btn"
            style={{
              display: "inline-block",
              cursor: "pointer"
            }}
          >
            📷 Choose Photo
          </label>
          {photoFile && (
            <div
              style={{
                marginTop: "15px"
              }}
            >
              <p>
                Selected:
                {" "}
                <b>
                  {photoFile.name}
                </b>
              </p>
              {photoPreview && (
                <img
                  src={photoPreview}
                  alt="Photo Preview"
                  style={{
                    width: "120px",
                    height: "120px",
                    objectFit: "cover",
                    borderRadius: "50%",
                    display: "block",
                    margin: "10px auto"
                  }}
                />

              )}
              <button
                className="btn"
                onClick={handleUploadPhoto}
                disabled={uploading}
              >
                {uploading
                  ? "Uploading..."
                  : "⬆️ Upload & Set Profile Photo"}
              </button>
            </div>
          )}
        </div>
        <div className="section">
          <button
            className="btn"
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}