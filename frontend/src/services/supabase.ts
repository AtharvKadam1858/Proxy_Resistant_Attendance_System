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

export async function validateAccountForPasswordReset(
  role: string,
  email: string,
  verificationKey: string
): Promise<{ found: boolean; name: string; identifier: string; email: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanKey = verificationKey.trim();

  if (!cleanEmail) throw new Error("❌ Registered college email is required.");
  if (!cleanKey) throw new Error("❌ Security verification ID (PRN / Teacher ID / Admin ID) is required.");

  if (role === "student") {
    const data = await supabaseQuery(
      `students?email=ilike.${encodeURIComponent(cleanEmail)}&limit=1`
    );
    if (!data || data.length === 0) {
      throw new Error(`❌ No student account registered with email: ${cleanEmail}`);
    }
    const student = data[0];
    const keyMatch =
      student.prn.toLowerCase() === cleanKey.toLowerCase() ||
      (student.phone && student.phone.trim() === cleanKey);
    if (!keyMatch) {
      throw new Error("❌ Security check failed: PRN does not match the registered record for this email.");
    }
    return {
      found: true,
      name: student.full_name || "Student",
      identifier: student.prn,
      email: student.email,
    };
  }

  if (role === "teacher") {
    const data = await supabaseQuery(
      `teachers?email=ilike.${encodeURIComponent(cleanEmail)}&limit=1`
    );
    if (!data || data.length === 0) {
      throw new Error(`❌ No faculty account registered with email: ${cleanEmail}`);
    }
    const teacher = data[0];
    const keyMatch =
      teacher.teacher_id.toLowerCase() === cleanKey.toLowerCase() ||
      (teacher.phone && teacher.phone.trim() === cleanKey);
    if (!keyMatch) {
      throw new Error("❌ Security check failed: Teacher ID does not match faculty records.");
    }
    return {
      found: true,
      name: teacher.full_name || "Faculty",
      identifier: teacher.teacher_id,
      email: teacher.email,
    };
  }

  if (role === "admin") {
    const data = await supabaseQuery(
      `admins?email=ilike.${encodeURIComponent(cleanEmail)}&limit=1`
    );
    if (!data || data.length === 0) {
      throw new Error(`❌ No administrator account registered with email: ${cleanEmail}`);
    }
    const admin = data[0];
    const keyMatch = admin.admin_id.toLowerCase() === cleanKey.toLowerCase();
    if (!keyMatch) {
      throw new Error("❌ Security check failed: Admin ID does not match administrator records.");
    }
    return {
      found: true,
      name: admin.full_name || "Administrator",
      identifier: admin.admin_id,
      email: admin.email,
    };
  }

  throw new Error("❌ Invalid role selected.");
}

export async function commitPasswordResetWithOtp(
  role: string,
  identifier: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  const cleanId = identifier.trim();
  const cleanPass = newPassword.trim();

  if (!cleanPass || cleanPass.length < 6) {
    throw new Error("❌ New password must be at least 6 characters long.");
  }

  if (role === "student") {
    await supabaseQuery(`students?prn=eq.${encodeURIComponent(cleanId)}`, {
      method: "PATCH",
      body: JSON.stringify({ password_hash: cleanPass }),
    });
    return { success: true, message: "Student password updated successfully! You can now log in." };
  }

  if (role === "teacher") {
    await supabaseQuery(`teachers?teacher_id=eq.${encodeURIComponent(cleanId)}`, {
      method: "PATCH",
      body: JSON.stringify({ password_hash: cleanPass }),
    });
    return { success: true, message: "Faculty password updated successfully! You can now log in." };
  }

  if (role === "admin") {
    await supabaseQuery(`admins?admin_id=eq.${encodeURIComponent(cleanId)}`, {
      method: "PATCH",
      body: JSON.stringify({ password_hash: cleanPass }),
    });
    return { success: true, message: "Administrator password updated successfully! You can now log in." };
  }

  throw new Error("❌ Invalid user role.");
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

import { dispatchAttendanceEmailNotification, dispatchLeaveDecisionEmailNotification } from "./emailService";

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

export interface StudentLeaveApplicationPayload {
  prn: string;
  leave_type: string;
  leave_date: string; // YYYY-MM-DD
  subject?: string;
  lecture_time?: string;
  reason: string;
  document?: {
    name: string;
    type: string; // "image/png" | "image/jpeg" | "application/pdf"
    base64: string;
    sizeBytes?: number;
  } | null;
}

export interface StudentLeaveApplicationRecord {
  id: number;
  session_id: string;
  prn: string;
  student_name: string;
  student_email: string;
  subject: string;
  department: string;
  year: string;
  lecture_date: string;
  lecture_time: string;
  teacher_name: string;
  status: string; // "Pending" | "Approved" | "Rejected"
  notification_type: string;
  email_subject: string;
  email_content: string;
  created_at: string;
  parsed_details?: {
    reason: string;
    leave_type: string;
    subject: string;
    lecture_date: string;
    lecture_time: string;
    document_name: string | null;
    document_type: string | null;
    document_data: string | null;
    document_size: number;
    submitted_at: string;
  };
}

/**
 * 📝 Submit student leave / duty exemption or official certificate with image/PDF attachment
 * Stored under student's PRN, name, and registered email in Supabase
 */
export async function submitStudentLeaveWithDocument(payload: StudentLeaveApplicationPayload) {
  const cleanPrn = (payload.prn || "").trim();
  if (!cleanPrn) throw new Error("Student PRN is required.");
  if (!payload.leave_date) throw new Error("Date of absence is required.");
  if (!payload.reason || !payload.reason.trim()) throw new Error("Reason for leave/certificate is required.");

  const students = await supabaseQuery(`students?prn=eq.${encodeURIComponent(cleanPrn)}&limit=1`);
  if (!students || students.length === 0) {
    throw new Error(`Student with PRN ${cleanPrn} was not found in the student database.`);
  }
  const student = students[0];

  const subName = (payload.subject || "Full Day / All Lectures").trim();
  const timeSlot = (payload.lecture_time || "All Scheduled Lectures").trim();
  const cat = (payload.leave_type || "Medical / Sick Leave").trim();
  const sessionId = `LEAVE_REQ_${cleanPrn}_${Date.now()}`;
  const nowIso = new Date().toISOString();

  // Document metadata + base64 data
  const docMeta = {
    reason: payload.reason.trim(),
    leave_type: cat,
    subject: subName,
    lecture_date: payload.leave_date,
    lecture_time: timeSlot,
    document_name: payload.document?.name || null,
    document_type: payload.document?.type || null,
    document_data: payload.document?.base64 || null,
    document_size: payload.document?.sizeBytes || 0,
    submitted_at: nowIso,
  };

  // 1. Store the official submission record in attendance_notifications
  await supabaseQuery("attendance_notifications", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      session_id: sessionId,
      prn: cleanPrn,
      student_name: student.full_name,
      student_email: student.email,
      subject: subName,
      department: student.branch || "AIML",
      year: student.year || "TY",
      lecture_date: payload.leave_date,
      lecture_time: timeSlot,
      teacher_name: "Admin Verification Desk",
      status: "Pending",
      notification_type: "Leave / Certificate Application",
      email_subject: `📑 [Pending Review] ${cat} - ${student.full_name} (${cleanPrn})`,
      email_content: JSON.stringify(docMeta),
    }),
  });

  // 2. Also register initial record in attendance table
  try {
    await supabaseQuery("attendance", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify({
        session_id: sessionId,
        teacher_id: "ADMIN",
        student_name: student.full_name,
        teacher_name: "College Administration",
        prn: cleanPrn,
        subject: subName,
        department: student.branch || "AIML",
        year: student.year || "TY",
        attendance_date: payload.leave_date,
        attendance_time: nowIso,
        status: "Leave",
        leave_type: cat,
        leave_comment: payload.reason.trim(),
        leave_verified: 0,
      }),
    });
  } catch (attErr) {
    console.debug("Attendance initial record created/handled:", attErr);
  }

  return {
    success: true,
    message: "✅ Official leave application & certificate uploaded successfully for Admin verification!",
    session_id: sessionId,
  };
}

/**
 * Backwards compatibility wrapper for applyStudentLeave
 */
export async function applyStudentLeave(params: {
  prn: string;
  leave_type: string;
  leave_date: string;
  reason: string;
  subject?: string;
  lecture_time?: string;
  document?: {
    name: string;
    type: string;
    base64: string;
    sizeBytes?: number;
  } | null;
}) {
  return submitStudentLeaveWithDocument(params);
}

/**
 * 📥 Admin: Fetch all submitted student leave and certificate applications
 */
export async function getStudentLeaveApplications(): Promise<StudentLeaveApplicationRecord[]> {
  const data = await supabaseQuery(
    "attendance_notifications?notification_type=eq.Leave%20%2F%20Certificate%20Application&order=created_at.desc"
  );
  if (!data || !Array.isArray(data)) return [];

  return data.map((item: any) => {
    let parsed: any = null;
    try {
      if (item.email_content && item.email_content.startsWith("{")) {
        parsed = JSON.parse(item.email_content);
      }
    } catch {}

    return {
      ...item,
      parsed_details: parsed || {
        reason: item.email_content || "",
        leave_type: item.subject || "Leave / Exemption",
        subject: item.subject,
        lecture_date: item.lecture_date,
        lecture_time: item.lecture_time,
        document_name: null,
        document_type: null,
        document_data: null,
        document_size: 0,
        submitted_at: item.created_at,
      },
    };
  });
}

/**
 * ⚖️ Admin: Accept & Mark Present or Reject & Mark Absent
 * Updates attendance database, updates status, and sends student confirmation/rejection email
 */
export async function updateLeaveApplicationDecision(params: {
  applicationId: number;
  sessionId: string;
  prn: string;
  studentName: string;
  studentEmail: string;
  subject: string;
  department: string;
  year: string;
  lectureDate: string;
  lectureTime?: string;
  decision: "Approved" | "Rejected";
  adminName?: string;
  leaveType?: string;
  reason?: string;
}) {
  const isApproved = params.decision === "Approved";
  const newStatus = isApproved ? "Approved" : "Rejected";
  const attendanceStatus = isApproved ? "Present" : "Absent";
  const verifiedCode = isApproved ? 1 : -1;
  const adminLabel = params.adminName || "Admin (admin@ritindia.edu)";
  const nowIso = new Date().toISOString();

  // 1. Update status in attendance_notifications
  await supabaseQuery(`attendance_notifications?id=eq.${params.applicationId}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: newStatus,
      teacher_name: adminLabel,
    }),
  });

  // 2. Update attendance record
  // Check if existing record exists by session_id
  const existingAtt = await supabaseQuery(
    `attendance?session_id=eq.${encodeURIComponent(params.sessionId)}&limit=1`
  );

  if (existingAtt && existingAtt.length > 0) {
    await supabaseQuery(`attendance?session_id=eq.${encodeURIComponent(params.sessionId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: attendanceStatus,
        leave_verified: verifiedCode,
        leave_marked_by: adminLabel,
        leave_marked_at: nowIso,
      }),
    });
  } else {
    // Check if an attendance record for this student and date already exists
    const byDateSub = await supabaseQuery(
      `attendance?prn=eq.${encodeURIComponent(params.prn)}&attendance_date=eq.${encodeURIComponent(
        params.lectureDate
      )}&limit=1`
    );

    if (byDateSub && byDateSub.length > 0) {
      await supabaseQuery(`attendance?attendance_id=eq.${byDateSub[0].attendance_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: attendanceStatus,
          leave_verified: verifiedCode,
          leave_marked_by: adminLabel,
          leave_marked_at: nowIso,
        }),
      });
    } else {
      // Create new record
      await supabaseQuery("attendance", {
        method: "POST",
        body: JSON.stringify({
          session_id: params.sessionId,
          teacher_id: "ADMIN",
          student_name: params.studentName,
          teacher_name: adminLabel,
          prn: params.prn,
          subject: params.subject,
          department: params.department,
          year: params.year,
          attendance_date: params.lectureDate,
          attendance_time: nowIso,
          status: attendanceStatus,
          leave_type: params.leaveType || "Leave / Certificate",
          leave_comment: params.reason || `Official Verification Decision: ${params.decision}`,
          leave_verified: verifiedCode,
          leave_marked_by: adminLabel,
          leave_marked_at: nowIso,
        }),
      });
    }
  }

  // 3. Dispatch official email confirmation to student
  try {
    await dispatchLeaveDecisionEmailNotification({
      studentEmail: params.studentEmail,
      studentName: params.studentName,
      prn: params.prn,
      subject: params.subject,
      lectureDate: params.lectureDate,
      lectureTime: params.lectureTime,
      decision: params.decision,
      adminName: adminLabel,
      leaveType: params.leaveType,
      reason: params.reason,
    });
  } catch (emailErr) {
    console.debug("Decision email notification dispatch non-blocking error:", emailErr);
  }

  return {
    success: true,
    decision: params.decision,
    attendanceStatus: attendanceStatus,
    message: isApproved
      ? `✅ Certificate verified and accepted! Marked ${params.studentName} as PRESENT for ${params.subject} on ${params.lectureDate}.`
      : `❌ Application rejected. Marked ${params.studentName} as ABSENT for ${params.subject} on ${params.lectureDate}.`,
  };
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

// ---------------------------------------------------------------------
// 10. FACULTY / TEACHER ADMINISTRATION (ADMIN ONLY)
// ---------------------------------------------------------------------

export async function getTeachersList() {
  const data = await supabaseQuery("teachers?select=*&order=created_at.asc");
  return data || [];
}

export async function addNewTeacher(teacherData: {
  teacher_id: string;
  full_name: string;
  email: string;
  phone?: string;
  department: string;
  designation?: string;
  password?: string;
}) {
  const cleanId = teacherData.teacher_id.trim();
  const cleanEmail = teacherData.email.trim().toLowerCase();

  // Check if ID or Email exists
  const existing = await supabaseQuery(
    `teachers?or=(teacher_id.eq.${encodeURIComponent(cleanId)},email.ilike.${encodeURIComponent(cleanEmail)})&limit=1`
  );
  if (existing && existing.length > 0) {
    if (existing[0].teacher_id === cleanId) {
      throw new Error(`Faculty member with Teacher ID ${cleanId} is already registered.`);
    }
    throw new Error(`Faculty member with email ${cleanEmail} is already registered.`);
  }

  const payload = {
    teacher_id: cleanId,
    full_name: teacherData.full_name.trim(),
    email: cleanEmail,
    phone: teacherData.phone?.trim() || null,
    department: teacherData.department.trim(),
    designation: teacherData.designation?.trim() || "Assistant Professor",
    password_hash: teacherData.password || "Teacher@123",
  };

  const inserted = await supabaseQuery("teachers", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });

  return {
    success: true,
    message: "Faculty member registered successfully!",
    teacher: inserted && inserted.length > 0 ? inserted[0] : payload,
  };
}

export async function deleteTeacherByAdmin(teacherId: string) {
  const cleanId = teacherId.trim();
  await supabaseQuery(`teachers?teacher_id=eq.${encodeURIComponent(cleanId)}`, {
    method: "DELETE",
  });
  return { success: true, message: `Faculty member ${cleanId} removed successfully.` };
}
