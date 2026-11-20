// =====================================================================
// SUPABASE REAL-TIME CLOUD DATABASE CLIENT & SERVICE LAYER
// =====================================================================

export const SUPABASE_URL = "https://ccvuqarrkinazzyxbxqg.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjdnVxYXJya2luYXp6eXhieHFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3MzEwOTMsImV4cCI6MjExMDMwNzA5M30.Sl1nAdh89pRPDpSJLtB8OEqSSizBWnR4N6EPl6LOOJU";

const defaultHeaders = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
};

/**
 * Generic REST request helper to Supabase PostgREST API
 */
export async function supabaseQuery(endpoint: string, options: RequestInit = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || `Supabase error (${response.status})`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

// ---------------------------------------------------------------------
// 1. AUTHENTICATION & PROFILE
// ---------------------------------------------------------------------

export async function loginUserWithSupabase(email: string, role: string, password?: string) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPass = (password || "").trim();

  if (!cleanEmail) {
    throw new Error("❌ Please enter your registered college email.");
  }

  if (!cleanPass) {
    throw new Error("❌ Please enter your account password.");
  }

  if (role === "student") {
    const data = await supabaseQuery(
      `students?email=ilike.${encodeURIComponent(cleanEmail)}&limit=1`
    );
    if (!data || data.length === 0) {
      throw new Error(`❌ No student account registered with email: ${cleanEmail}. Please verify your email or register below.`);
    }
    const student = data[0];
    if (!student.password_hash) {
      throw new Error("❌ Account password not set. Please use 'Forgot Password?' below to set your password.");
    }
    if (student.password_hash.trim() !== cleanPass) {
      throw new Error("❌ Incorrect password! Please enter the correct password for this account.");
    }
    return {
      success: true,
      role: "student",
      prn: student.prn,
      student: student,
    };
  }

  if (role === "teacher") {
    const data = await supabaseQuery(
      `teachers?email=ilike.${encodeURIComponent(cleanEmail)}&limit=1`
    );
    if (!data || data.length === 0) {
      throw new Error(`❌ No faculty account registered with email: ${cleanEmail}. Please check the Teacher Login tab or contact admin.`);
    }
    const teacher = data[0];
    if (!teacher.password_hash) {
      throw new Error("❌ Faculty password not set. Please use 'Forgot Password?' below to set your password.");
    }
    if (teacher.password_hash.trim() !== cleanPass) {
      throw new Error("❌ Incorrect password! Please enter the correct faculty password.");
    }
    return {
      success: true,
      role: "teacher",
      teacher_id: teacher.teacher_id,
      teacher: teacher,
    };
  }

  if (role === "admin") {
    const data = await supabaseQuery(
      `admins?email=ilike.${encodeURIComponent(cleanEmail)}&limit=1`
    );
    if (!data || data.length === 0) {
      throw new Error(`❌ No administrator account registered with email: ${cleanEmail}.`);
    }
    const admin = data[0];
    if (!admin.password_hash) {
      throw new Error("❌ Admin password not set. Please use 'Forgot Password?' below to set your password.");
    }
    if (admin.password_hash.trim() !== cleanPass) {
      throw new Error("❌ Incorrect password! Please enter the correct administrator password.");
    }
    return {
      success: true,
      role: "admin",
      admin_id: admin.admin_id,
      admin: admin,
    };
  }

  throw new Error("❌ Invalid role selected.");
}

export async function resetUserPasswordWithVerification(
  role: string,
  email: string,
  verificationKey: string,
  newPassword: string
) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanKey = verificationKey.trim();
  const cleanPass = newPassword.trim();

  if (!cleanEmail) throw new Error("❌ Registered college email is required.");
  if (!cleanKey) throw new Error("❌ Security verification ID (PRN / Teacher ID / Admin ID) is required.");
  if (!cleanPass || cleanPass.length < 6) throw new Error("❌ New password must be at least 6 characters long.");

  if (role === "student") {
    const data = await supabaseQuery(
      `students?email=ilike.${encodeURIComponent(cleanEmail)}&limit=1`
    );
    if (!data || data.length === 0) {
      throw new Error(`❌ No student account found with email: ${cleanEmail}`);
    }
    const student = data[0];
    const keyMatch =
      student.prn.toLowerCase() === cleanKey.toLowerCase() ||
      (student.phone && student.phone.trim() === cleanKey);
    if (!keyMatch) {
      throw new Error("❌ Verification failed: PRN or Phone number does not match this student's registered record.");
    }
    await supabaseQuery(`students?prn=eq.${encodeURIComponent(student.prn)}`, {
      method: "PATCH",
      body: JSON.stringify({ password_hash: cleanPass }),
    });
    return { success: true, message: "Student password reset successfully! You can now log in." };
  }

  if (role === "teacher") {
    const data = await supabaseQuery(
      `teachers?email=ilike.${encodeURIComponent(cleanEmail)}&limit=1`
    );
    if (!data || data.length === 0) {
      throw new Error(`❌ No faculty account found with email: ${cleanEmail}`);
    }
    const teacher = data[0];
    const keyMatch =
      teacher.teacher_id.toLowerCase() === cleanKey.toLowerCase() ||
      (teacher.phone && teacher.phone.trim() === cleanKey);
    if (!keyMatch) {
      throw new Error("❌ Verification failed: Teacher ID or Phone number does not match this faculty record.");
    }
    await supabaseQuery(`teachers?teacher_id=eq.${encodeURIComponent(teacher.teacher_id)}`, {
      method: "PATCH",
      body: JSON.stringify({ password_hash: cleanPass }),
    });
    return { success: true, message: "Faculty password reset successfully! You can now log in." };
  }

  if (role === "admin") {
    const data = await supabaseQuery(
      `admins?email=ilike.${encodeURIComponent(cleanEmail)}&limit=1`
    );
    if (!data || data.length === 0) {
      throw new Error(`❌ No administrator account found with email: ${cleanEmail}`);
    }
    const admin = data[0];
    const keyMatch = admin.admin_id.toLowerCase() === cleanKey.toLowerCase();
    if (!keyMatch) {
      throw new Error("❌ Verification failed: Admin ID does not match this record.");
    }
    await supabaseQuery(`admins?admin_id=eq.${encodeURIComponent(admin.admin_id)}`, {
      method: "PATCH",
      body: JSON.stringify({ password_hash: cleanPass }),
    });
    return { success: true, message: "Administrator password reset successfully! You can now log in." };
  }

  throw new Error("❌ Invalid role selected.");
}

export async function updateUserPassword(role: string, identifier: string, newPassword: string) {
  const cleanId = identifier.trim();
  const cleanPass = newPassword.trim();
  if (!cleanPass || cleanPass.length < 6) {
    throw new Error("Password must be at least 6 characters long.");
  }

  if (role === "student") {
    await supabaseQuery(
      `students?or=(prn.eq.${encodeURIComponent(cleanId)},email.ilike.${encodeURIComponent(cleanId)})`,
      {
        method: "PATCH",
        body: JSON.stringify({ password_hash: cleanPass }),
      }
    );
    return { success: true, message: "Student password updated successfully!" };
  }

  if (role === "teacher") {
    await supabaseQuery(
      `teachers?or=(teacher_id.eq.${encodeURIComponent(cleanId)},email.ilike.${encodeURIComponent(cleanId)})`,
      {
        method: "PATCH",
        body: JSON.stringify({ password_hash: cleanPass }),
      }
    );
    return { success: true, message: "Teacher password updated successfully!" };
  }

  if (role === "admin") {
    await supabaseQuery(
      `admins?or=(admin_id.eq.${encodeURIComponent(cleanId)},email.ilike.${encodeURIComponent(cleanId)})`,
      {
        method: "PATCH",
        body: JSON.stringify({ password_hash: cleanPass }),
      }
    );
    return { success: true, message: "Admin password updated successfully!" };
  }

  throw new Error("Invalid user role.");
}

export async function updateStudentEducation(prn: string, educationData: any, headline?: string) {
  const cleanPrn = prn.trim();
  const payload: any = {
    education_details: educationData,
  };
  if (headline !== undefined) {
    payload.resume_headline = headline;
  }

  await supabaseQuery(`students?prn=eq.${encodeURIComponent(cleanPrn)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return { success: true, message: "Educational portfolio updated successfully!" };
}

export async function getStudentProfile(prnOrEmail: string) {
  const clean = prnOrEmail.trim();
  const data = await supabaseQuery(
    `students?or=(prn.eq.${encodeURIComponent(clean)},email.ilike.${encodeURIComponent(clean)})&limit=1`
  );
  if (!data || data.length === 0) return null;
  return data[0];
}

export async function getTeacherProfile(teacherIdOrEmail: string) {
  const clean = teacherIdOrEmail.trim();
  const data = await supabaseQuery(
    `teachers?or=(teacher_id.eq.${encodeURIComponent(clean)},email.ilike.${encodeURIComponent(clean)})&limit=1`
  );
  if (!data || data.length === 0) return null;
  return data[0];
}

export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// ---------------------------------------------------------------------
// 2. TEACHER ATTENDANCE SESSION MANAGEMENT
// ---------------------------------------------------------------------

export async function startAttendanceSession(params: {
  teacher_id: string;
  department: string;
  year: string;
  subject: string;
  lat?: number;
  lng?: number;
  geofence_radius?: number;
}) {
  const sessionId = crypto.randomUUID();
  const qrToken = crypto.randomUUID();
  const classroomPin = Math.floor(1000 + Math.random() * 9000).toString();
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const timeStr = now.toTimeString().split(" ")[0];
  const radius = params.geofence_radius !== undefined ? params.geofence_radius : 350;

  const payload: any = {
    session_id: sessionId,
    qr_token: qrToken,
    classroom_pin: classroomPin,
    teacher_id: params.teacher_id,
    subject: params.subject,
    department: params.department,
    year: params.year,
    lecture_date: todayStr,
    start_time: timeStr,
    lat: params.lat || null,
    lng: params.lng || null,
    geofence_radius: radius,
    status: "ACTIVE",
  };

  await supabaseQuery("attendance_sessions", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });

  return {
    success: true,
    session_id: sessionId,
    qr_token: qrToken,
    classroom_pin: classroomPin,
  };
}

export async function refreshAttendanceSession(sessionId: string) {
  const newQrToken = crypto.randomUUID();

  await supabaseQuery(`attendance_sessions?session_id=eq.${sessionId}`, {
    method: "PATCH",
    body: JSON.stringify({ qr_token: newQrToken }),
  });

  return {
    success: true,
    session_id: sessionId,
    qr_token: newQrToken,
  };
}

export async function stopAttendanceSession(sessionId: string) {
  const nowTime = new Date().toTimeString().split(" ")[0];

  await supabaseQuery(`attendance_sessions?session_id=eq.${sessionId}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "CLOSED",
      end_time: nowTime,
    }),
  });

  return { success: true };
}

export async function getLiveAttendance(sessionId: string) {
  const sessionData = await supabaseQuery(
    `attendance_sessions?session_id=eq.${sessionId}&limit=1`
  );
  const attendanceList = await supabaseQuery(
    `attendance?session_id=eq.${sessionId}&order=attendance_time.asc`
  );

  const formatted = (attendanceList || []).map((item: any) => ({
    ...item,
    attendance_time: item.attendance_time ? new Date(item.attendance_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : "Just now"
  }));

  return {
    success: true,
    session: sessionData && sessionData[0] ? sessionData[0] : null,
    students: formatted,
    attendance: formatted,
    present_count: formatted.filter((r: any) => r.status === "Present").length,
  };
}

export async function getTeacherSessions(teacherId: string) {
  const sessions = await supabaseQuery(
    `attendance_sessions?teacher_id=eq.${encodeURIComponent(
      teacherId
    )}&order=lecture_date.desc,start_time.desc`
  );
  return sessions || [];
}

export async function markStudentPresent(sessionId: string, prn: string, teacherId: string) {
  // Fetch session details
  const session = await supabaseQuery(
    `attendance_sessions?session_id=eq.${sessionId}&limit=1`
  );
  const student = await supabaseQuery(`students?prn=eq.${prn}&limit=1`);

  if (!session || !session[0] || !student || !student[0]) {
    throw new Error("Session or Student not found");
  }

  const payload = {
    session_id: sessionId,
    teacher_id: teacherId,
    student_name: student[0].full_name,
    prn: prn,
    subject: session[0].subject,
    department: session[0].department,
    year: session[0].year,
    status: "Present",
    attendance_date: session[0].lecture_date,
    attendance_time: new Date().toISOString(),
  };

  // Upsert into attendance
  await supabaseQuery("attendance", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(payload),
  });

  return { success: true };
}

// ---------------------------------------------------------------------
// 3. STUDENT QR VERIFICATION & ATTENDANCE
// ---------------------------------------------------------------------

export async function verifySessionQR(
  rawQrInput: string,
  studentLat?: number,
  studentLng?: number,
  enteredPin?: string
) {
  let token = rawQrInput.trim();
  let payloadPin: string | null = null;

  // Check if QR code is JSON containing token & pin
  try {
    if (token.startsWith("{") && token.endsWith("}")) {
      const parsed = JSON.parse(token);
      if (parsed.token) token = parsed.token;
      if (parsed.pin) payloadPin = parsed.pin;
    }
  } catch {}

  // 1. Find active session matching qr_token
  const sessions = await supabaseQuery(
    `attendance_sessions?qr_token=eq.${encodeURIComponent(
      token
    )}&status=eq.ACTIVE&limit=1`
  );

  if (!sessions || sessions.length === 0) {
    return {
      success: false,
      message: "Invalid or expired QR code. Please scan the current code.",
    };
  }

  const session = sessions[0];

  // 2. Adaptive Campus Building & Device Geofencing (Default: 350m, bridges Laptop Wi-Fi vs Phone GPS offset)
  let distanceMeters: number | null = null;
  const allowedRadius = session.geofence_radius !== null && session.geofence_radius !== undefined
    ? Number(session.geofence_radius)
    : 350;

  if (
    allowedRadius > 0 &&
    session.lat !== null &&
    session.lng !== null &&
    studentLat !== undefined &&
    studentLng !== undefined &&
    !isNaN(studentLat) &&
    !isNaN(studentLng)
  ) {
    distanceMeters = calculateHaversineDistanceMeters(
      Number(session.lat),
      Number(session.lng),
      Number(studentLat),
      Number(studentLng)
    );

    if (distanceMeters > allowedRadius) {
      return {
        success: false,
        message: `❌ Classroom Proximity Violation: You are ${distanceMeters}m away from the classroom (Allowed limit: ${allowedRadius}m). You must be physically inside the class perimeter.`,
        distance: distanceMeters,
      };
    }
  }

  // 3. Physical Classroom Eye-Contact PIN Verification (Prevents cross-floor cheating)
  if (session.classroom_pin) {
    const candidatePin = payloadPin || enteredPin?.trim();
    if (!candidatePin) {
      return {
        success: false,
        require_pin: true,
        session_id: session.session_id,
        session: session,
        message: "Please enter the 4-digit Classroom PIN displayed on the Professor's projector screen.",
      };
    }
    if (candidatePin !== session.classroom_pin) {
      return {
        success: false,
        require_pin: true,
        session_id: session.session_id,
        session: session,
        message: "❌ Incorrect Classroom PIN. Enter the current PIN displayed on the blackboard/projector.",
      };
    }
  }

  return {
    success: true,
    session_id: session.session_id,
    session: session,
    distance_meters: distanceMeters,
  };
}

import { dispatchAttendanceEmailNotification } from "./emailService";

export async function markAttendanceForStudent(
  sessionId: string,
  prn: string,
  distanceMeters?: number | null
) {
  const sessions = await supabaseQuery(
    `attendance_sessions?session_id=eq.${sessionId}&limit=1`
  );
  if (!sessions || sessions.length === 0 || sessions[0].status !== "ACTIVE") {
    throw new Error("Attendance session is not active.");
  }
  const session = sessions[0];

  const students = await supabaseQuery(`students?prn=eq.${prn}&limit=1`);
  if (!students || students.length === 0) {
    throw new Error("Student record not found in system.");
  }
  const student = students[0];

  // Verify department and year match
  if (student.branch.trim().toLowerCase() !== session.department.trim().toLowerCase()) {
    throw new Error("Student does not belong to this department.");
  }
  if (student.year.trim().toLowerCase() !== session.year.trim().toLowerCase()) {
    throw new Error("Student does not belong to this class/year.");
  }

  // Check if already marked
  const existing = await supabaseQuery(
    `attendance?session_id=eq.${sessionId}&prn=eq.${prn}&limit=1`
  );
  if (existing && existing.length > 0) {
    return {
      success: true,
      already_marked: true,
      message: "Attendance has already been recorded for this lecture.",
      prn,
      name: student.full_name,
      email: student.email,
      subject: session.subject,
      lecture_date: session.lecture_date,
      distance_meters: distanceMeters,
    };
  }

  // Record attendance with physical distance telemetry and resolution=ignore-duplicates for 100+ concurrent students
  const record = {
    session_id: sessionId,
    teacher_id: session.teacher_id,
    student_name: student.full_name,
    prn: prn,
    subject: session.subject,
    department: session.department,
    year: session.year,
    attendance_date: session.lecture_date,
    attendance_time: new Date().toISOString(),
    status: "Present",
    distance_meters: distanceMeters ?? null,
  };

  try {
    await supabaseQuery("attendance", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify(record),
    });
  } catch (insertErr: any) {
    // If a concurrent request already marked it, treat gracefully
    if (insertErr?.message?.includes("uq_session_prn") || insertErr?.message?.includes("duplicate")) {
      return {
        success: true,
        already_marked: true,
        message: "Attendance recorded concurrently.",
        prn,
        name: student.full_name,
        email: student.email,
        subject: session.subject,
        lecture_date: session.lecture_date,
      };
    }
    throw insertErr;
  }

  // 📧 Trigger Automated Real-Time Email Notification Slip
  let notifReceipt = null;
  try {
    notifReceipt = await dispatchAttendanceEmailNotification({
      sessionId,
      prn,
      studentName: student.full_name,
      studentEmail: student.email,
      subject: session.subject,
      department: session.department,
      year: session.year,
      lectureDate: session.lecture_date,
      teacherName: session.teacher_id,
      distanceMeters: distanceMeters ?? null,
    });
  } catch (emailErr) {
    console.warn("Email dispatch error (non-blocking):", emailErr);
  }

  return {
    success: true,
    already_marked: false,
    message: `Attendance marked successfully! Email notification dispatched to ${student.email}`,
    prn,
    name: student.full_name,
    email: student.email,
    subject: session.subject,
    lecture_date: session.lecture_date,
    distance_meters: distanceMeters,
    notification_receipt: notifReceipt,
  };
}

export async function applyStudentLeave(params: {
  prn: string;
  leave_type: string;
  leave_date: string;
  reason: string;
}) {
  const students = await supabaseQuery(`students?prn=eq.${encodeURIComponent(params.prn)}&limit=1`);
  if (!students || students.length === 0) {
    throw new Error("Student not found.");
  }
  const student = students[0];

  const payload = {
    session_id: `LEAVE_${params.prn}_${Date.now()}`,
    prn: params.prn,
    student_name: student.full_name,
    department: student.branch,
    year: student.year,
    subject: "Leave / Duty Exemption",
    attendance_date: params.leave_date,
    attendance_time: new Date().toISOString(),
    status: "Leave",
    leave_type: params.leave_type,
    leave_comment: params.reason,
    leave_verified: 0,
  };

  await supabaseQuery("attendance", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return { success: true, message: "Leave application submitted to faculty for verification!" };
}

export async function getStudentAttendanceHistory(prn: string) {
  const records = await supabaseQuery(
    `attendance?prn=eq.${encodeURIComponent(
      prn
    )}&order=attendance_date.desc,attendance_time.desc`
  );
  const formatted = (records || []).map((r: any) => ({
    ...r,
    date: r.attendance_date,
    start_time: r.attendance_time ? new Date(r.attendance_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "",
    end_time: "",
  }));
  const presentCount = formatted.filter((r: any) => r.status === "Present").length;
  const totalLectures = formatted.length;
  const percent = totalLectures > 0 ? ((presentCount / totalLectures) * 100).toFixed(1) : "0.0";

  return {
    success: true,
    attendance: formatted,
    summary: {
      total: totalLectures,
      present: presentCount,
      absent: totalLectures - presentCount,
      percentage: Number(percent),
    },
    total_lectures: totalLectures,
    present_count: presentCount,
    percentage: percent,
  };
}

// ---------------------------------------------------------------------
// 4. ADMIN STUDENT MASTER MANAGEMENT
// ---------------------------------------------------------------------

export async function getStudentsList(branch?: string, year?: string, search?: string) {
  let query = "students?select=*&order=full_name.asc";
  if (branch) query += `&branch=eq.${encodeURIComponent(branch)}`;
  if (year) query += `&year=eq.${encodeURIComponent(year)}`;
  if (search) query += `&or=(full_name.ilike.*${encodeURIComponent(search)}*,prn.ilike.*${encodeURIComponent(search)}*)`;

  const students = await supabaseQuery(query);
  return students || [];
}

export async function addNewStudent(studentData: {
  prn: string;
  full_name: string;
  email: string;
  phone?: string;
  year: string;
  branch: string;
  division: string;
  gender?: string;
}) {
  await supabaseQuery("students", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(studentData),
  });
  return { success: true, message: "Student added successfully to database." };
}

export async function registerStudent(studentData: {
  prn: string;
  full_name: string;
  email: string;
  phone: string;
  parent_phone?: string;
  blood_group?: string;
  address?: string;
  year: string;
  branch: string;
  division: string;
  gender?: string;
  password?: string;
  avatar_url?: string;
}) {
  const cleanPrn = studentData.prn.trim();
  const cleanEmail = studentData.email.trim().toLowerCase();

  // Check if PRN or Email already exists
  const existing = await supabaseQuery(
    `students?or=(prn.eq.${encodeURIComponent(cleanPrn)},email.ilike.${encodeURIComponent(cleanEmail)})&limit=1`
  );
  if (existing && existing.length > 0) {
    if (existing[0].prn === cleanPrn) {
      throw new Error(`Student with PRN ${cleanPrn} is already registered.`);
    }
    throw new Error(`Student with email ${cleanEmail} is already registered.`);
  }

  const payload: any = {
    prn: cleanPrn,
    full_name: studentData.full_name.trim(),
    email: cleanEmail,
    phone: studentData.phone.trim(),
    parent_phone: studentData.parent_phone?.trim() || null,
    blood_group: studentData.blood_group?.trim() || null,
    address: studentData.address?.trim() || null,
    year: studentData.year.trim(),
    branch: studentData.branch.trim(),
    division: studentData.division.trim(),
    gender: studentData.gender || "Not Specified",
    avatar_url: studentData.avatar_url || null,
    face_folder: studentData.avatar_url || null,
    password_hash: studentData.password || null,
  };

  const inserted = await supabaseQuery("students", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });

  return {
    success: true,
    message: "Registration successful! You can now log in.",
    student: inserted && inserted.length > 0 ? inserted[0] : payload,
  };
}

export async function updateStudentProfilePhoto(prn: string, avatarUrl: string) {
  const cleanPrn = prn.trim();
  await supabaseQuery(`students?prn=eq.${encodeURIComponent(cleanPrn)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      avatar_url: avatarUrl,
      face_folder: avatarUrl,
    }),
  });
  return { success: true };
}

export async function updateStudentByAdmin(prn: string, updatedFields: Record<string, any>) {
  const cleanPrn = prn.trim();
  const res = await supabaseQuery(`students?prn=eq.${encodeURIComponent(cleanPrn)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(updatedFields),
  });
  return { success: true, message: "Student record updated successfully!", data: res };
}

export async function deleteStudentByAdmin(prn: string) {
  const cleanPrn = prn.trim();
  await supabaseQuery(`students?prn=eq.${encodeURIComponent(cleanPrn)}`, {
    method: "DELETE",
  });
  return { success: true, message: `Student ${cleanPrn} removed from database.` };
}
