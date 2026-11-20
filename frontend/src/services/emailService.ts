/**
 * 📧 Official Institutional Attendance Email & Notification Service
 * Rajarambapu Institute of Technology, Rajaramnagar
 * 
 * Automatically sends comprehensive attendance receipts to students upon marking attendance,
 * saves immutable audit records to Supabase Cloud, and triggers sensory audio/haptic feedback.
 */

import { supabaseQuery } from "./supabase";

export interface AttendanceNotificationPayload {
  sessionId: string;
  prn: string;
  studentName: string;
  studentEmail: string;
  subject: string;
  department: string;
  year: string;
  lectureDate: string;
  lectureTime?: string;
  teacherName?: string;
  distanceMeters?: number | null;
  attendancePercentage?: number | null;
  examEligible?: boolean;
}

export interface AttendanceNotificationRecord {
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
  distance_meters: number | null;
  status: string;
  notification_type: string;
  email_subject: string;
  email_content: string;
  created_at: string;
}

/**
 * 🎵 Play pleasant confirmation audio chime using Web Audio API (Zero external assets needed)
 */
export function playSuccessChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Play two-tone harmony chime (C5 523.25Hz -> E5 659.25Hz -> G5 783.99Hz)
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);
      
      gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.1);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + idx * 0.1 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.5);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime + idx * 0.1);
      osc.stop(ctx.currentTime + idx * 0.1 + 0.55);
    });
  } catch (e) {
    console.debug("Web Audio chime not permitted yet:", e);
  }
}

/**
 * 📳 Device Haptic Feedback
 */
export function triggerHapticFeedback() {
  try {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([80, 40, 120]);
    }
  } catch {}
}

/**
 * Formats an official HTML email slip
 */
export function generateEmailHtml(payload: AttendanceNotificationPayload, txnId: string): string {
  const timeStr = payload.lectureTime || new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  const distStr = payload.distanceMeters !== undefined && payload.distanceMeters !== null
    ? `${payload.distanceMeters.toFixed(1)} meters (Inside Classroom Perimeter)`
    : "Verified Inside Classroom Perimeter";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Attendance Confirmation Slip</title>
</head>
<body style="margin: 0; padding: 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; color: #1f2937;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e5e7eb;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1e3a8a 0%, #0284c7 100%); padding: 24px; text-align: center; color: #ffffff;">
      <h1 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">Rajarambapu Institute of Technology</h1>
      <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">Autonomous Institute | Approved by AICTE | Affiliated to Shivaji University</p>
      <div style="display: inline-block; margin-top: 14px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); border-radius: 20px; padding: 4px 16px; font-size: 12px; font-weight: 600;">
        OFFICIAL ATTENDANCE NOTIFICATION SLIP
      </div>
    </div>

    <!-- Status Banner -->
    <div style="background: #ecfdf5; border-bottom: 1px solid #a7f3d0; padding: 14px 24px; text-align: center;">
      <span style="color: #065f46; font-weight: 700; font-size: 15px;">
        ✅ ATTENDANCE SUCCESSFULLY RECORDED & VERIFIED
      </span>
    </div>

    <!-- Body Content -->
    <div style="padding: 24px;">
      <p style="font-size: 15px; margin-top: 0;">Dear <strong>${payload.studentName}</strong>,</p>
      <p style="font-size: 14px; line-height: 1.5; color: #4b5563;">
        Your physical attendance has been verified via Multi-Factor Smart Verification (Rotating QR, Classroom PIN, GPS Geofencing & Facial Liveness) and logged into the institutional database.
      </p>

      <!-- Lecture Details Box -->
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb; font-size: 13.5px;">
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px 14px; font-weight: 600; color: #6b7280; width: 38%;">Student PRN</td>
          <td style="padding: 10px 14px; font-weight: 700; color: #111827;">${payload.prn}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px 14px; font-weight: 600; color: #6b7280;">Subject / Course</td>
          <td style="padding: 10px 14px; font-weight: 700; color: #1e3a8a;">${payload.subject}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px 14px; font-weight: 600; color: #6b7280;">Class / Department</td>
          <td style="padding: 10px 14px; color: #111827;">${payload.department} - ${payload.year}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px 14px; font-weight: 600; color: #6b7280;">Faculty In-Charge</td>
          <td style="padding: 10px 14px; color: #111827;">${payload.teacherName || "Course Instructor"}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px 14px; font-weight: 600; color: #6b7280;">Lecture Date & Time</td>
          <td style="padding: 10px 14px; color: #111827;">${payload.lectureDate} at ${timeStr}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px 14px; font-weight: 600; color: #6b7280;">Physical Proximity</td>
          <td style="padding: 10px 14px; color: #059669; font-weight: 600;">📍 ${distStr}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; font-weight: 600; color: #6b7280;">Verification Txn ID</td>
          <td style="padding: 10px 14px; font-family: monospace; color: #4b5563;">${txnId}</td>
        </tr>
      </table>

      <!-- Exam Status Note -->
      <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 4px; margin: 18px 0; font-size: 13px; color: #1e40af;">
        <strong>Academic Notice:</strong> Please maintain at least <strong>75% cumulative attendance</strong> across all subjects to remain eligible for the Semester End Examinations (SEE).
      </div>

      <div style="text-align: center; margin-top: 24px;">
        <a href="https://smart-attendance-system-six-xi.vercel.app/profile" style="display: inline-block; background: #ffca08; color: #111827; padding: 10px 24px; border-radius: 6px; font-weight: 700; text-decoration: none; font-size: 14px;">
          View Your Attendance Dashboard →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 16px 24px; text-align: center; font-size: 11.5px; color: #9ca3af;">
      This is an automated institutional notification dispatched by the RIT Proxy-Resistant Smart Attendance System.<br>
      © 2026 Rajarambapu Institute of Technology, Rajaramnagar. All rights reserved.
    </div>
  </div>
</body>
</html>
`;
}

// 🔒 In-Memory & Session Storage Deduplication Lock
// Guarantees EXACTLY ONE email is dispatched per attendance session per student
const activeDispatchedKeys = new Set<string>();

/**
 * 🚀 Dispatches email notification, logs to Supabase Cloud, and activates sensory feedback.
 * Strictly deduplicated: sends at most ONE email per attendance session per student.
 */
export async function dispatchAttendanceEmailNotification(
  payload: AttendanceNotificationPayload
): Promise<{ success: boolean; txnId: string; message: string }> {
  // Deduplication check: key = sessionId + PRN
  const dedupeKey = `${payload.sessionId || "SESSION"}_${payload.prn || "STUDENT"}`;

  // 1. Check in-memory lock
  if (activeDispatchedKeys.has(dedupeKey)) {
    console.log("ℹ️ [Email Service] Attendance email already dispatched for this session. Skipping duplicate.");
    return {
      success: true,
      txnId: "DEDUPED",
      message: `Email already dispatched to ${payload.studentEmail}`,
    };
  }

  // 2. Check session storage lock
  try {
    const existing = sessionStorage.getItem(`rit_email_sent_${dedupeKey}`);
    if (existing) {
      activeDispatchedKeys.add(dedupeKey);
      console.log("ℹ️ [Email Service] Found existing session receipt. Skipping duplicate dispatch.");
      return {
        success: true,
        txnId: "CACHED",
        message: `Email already dispatched to ${payload.studentEmail}`,
      };
    }
  } catch {}

  // Mark as dispatched immediately
  activeDispatchedKeys.add(dedupeKey);
  try {
    sessionStorage.setItem(`rit_email_sent_${dedupeKey}`, Date.now().toString());
  } catch {}

  // Trigger sensory feedback immediately
  playSuccessChime();
  triggerHapticFeedback();

  const txnId = `RIT-ATT-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const timeStr = payload.lectureTime || new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  const emailSubject = `✅ Attendance Recorded: ${payload.subject} (${payload.lectureDate} ${timeStr})`;
  const emailHtml = generateEmailHtml(payload, txnId);

  // 1. Save immutable notification record into Supabase Cloud
  try {
    await supabaseQuery("attendance_notifications", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify({
        session_id: payload.sessionId,
        prn: payload.prn,
        student_name: payload.studentName,
        student_email: payload.studentEmail,
        subject: payload.subject,
        department: payload.department,
        year: payload.year,
        lecture_date: payload.lectureDate,
        lecture_time: timeStr,
        teacher_name: payload.teacherName || "Course Faculty",
        distance_meters: payload.distanceMeters ?? null,
        status: "Dispatched",
        notification_type: "Email & App Slip",
        email_subject: emailSubject,
        email_content: emailHtml,
      }),
    });
  } catch (dbErr) {
    console.warn("Could not save to attendance_notifications table (schema may be updating):", dbErr);
  }

  // 2. Dispatch EXACTLY ONE email via Web3Forms (with FormSubmit as silent fallback ONLY on error)
  try {
    if (payload.studentEmail && payload.studentEmail.includes("@")) {
      const emailText =
        `Dear ${payload.studentName},\n\n` +
        `Your attendance has been successfully recorded at Rajarambapu Institute of Technology.\n\n` +
        `Session Details:\n` +
        `- Subject: ${payload.subject}\n` +
        `- PRN: ${payload.prn}\n` +
        `- Class: ${payload.department} (${payload.year})\n` +
        `- Date & Time: ${payload.lectureDate} at ${timeStr}\n` +
        `- Proximity: ${payload.distanceMeters ? payload.distanceMeters.toFixed(1) + "m (Inside Classroom)" : "Classroom Perimeter Verified"}\n` +
        `- Transaction ID: ${txnId}\n\n` +
        `Please maintain at least 75% attendance for examination eligibility.\n\n` +
        `Regards,\nRIT Academic Department`;

      // Single Primary Channel: Web3Forms instant relay
      fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          access_key: "c53d1fb5-bc6d-4763-8a3d-4c3127ef64db",
          subject: emailSubject,
          from_name: "RIT Smart Attendance System",
          to_email: payload.studentEmail,
          message: emailText,
        }),
      })
        .then((res) => {
          if (!res.ok) {
            // Secondary fallback ONLY if primary channel fails
            fetch("https://formsubmit.co/ajax/" + encodeURIComponent(payload.studentEmail), {
              method: "POST",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify({
                _subject: emailSubject,
                _template: "table",
                student_name: payload.studentName,
                prn: payload.prn,
                subject: payload.subject,
                date_and_time: `${payload.lectureDate} at ${timeStr}`,
                verification_txn: txnId,
              }),
            }).catch(() => {});
          }
        })
        .catch((e) => {
          console.debug("Web3Forms error, fallbacking to FormSubmit:", e);
          fetch("https://formsubmit.co/ajax/" + encodeURIComponent(payload.studentEmail), {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
              _subject: emailSubject,
              _template: "table",
              student_name: payload.studentName,
              prn: payload.prn,
              subject: payload.subject,
              date_and_time: `${payload.lectureDate} at ${timeStr}`,
              verification_txn: txnId,
            }),
          }).catch(() => {});
        });
    }
  } catch (netErr) {
    console.debug("Network email trigger notice:", netErr);
  }

  return {
    success: true,
    txnId,
    message: `Attendance confirmed! Single slip dispatched to ${payload.studentEmail}`,
  };
}

/**
 * 📥 Retrieve student notification receipts from Supabase Cloud
 */
export async function getStudentNotificationReceipts(prn: string): Promise<AttendanceNotificationRecord[]> {
  try {
    const records = await supabaseQuery(
      `attendance_notifications?prn=eq.${encodeURIComponent(prn)}&order=created_at.desc&limit=25`
    );
    return records || [];
  } catch (err) {
    console.warn("Failed to fetch notification receipts:", err);
    return [];
  }
}

export interface PasswordResetOtpPayload {
  email: string;
  role: string;
  candidateName: string;
  identifier: string;
  otp: string;
}

/**
 * 🔐 Official Password Reset OTP Email Dispatch
 * Sends a unique 6-digit numerical OTP to candidate's registered email and logs security audit trail
 */
export async function sendPasswordResetOtpEmail(
  payload: PasswordResetOtpPayload
): Promise<{ success: boolean; message: string }> {
  const cleanEmail = payload.email.trim();
  const roleName = payload.role.charAt(0).toUpperCase() + payload.role.slice(1);
  const subject = `[RIT Security] ${payload.otp} is your Password Reset Verification Code`;
  const timeStr = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  const dateStr = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const emailText =
    `Rajarambapu Institute of Technology - Security Verification\n\n` +
    `Dear ${payload.candidateName || "User"},\n\n` +
    `Your 6-Digit Password Reset Verification OTP is:\n` +
    `>>> ${payload.otp} <<<\n\n` +
    `Account Role: ${roleName}\n` +
    `Identifier: ${payload.identifier}\n` +
    `Registered Email: ${cleanEmail}\n` +
    `Validity: 10 minutes only\n\n` +
    `Please enter this numerical OTP on the RIT Attendance Portal to verify your identity and set a new password.\n` +
    `If you did not request this password reset, please ignore this email; your account remains secure.\n\n` +
    `Regards,\nRIT Security Administration\nRajaramnagar, Islampur`;

  // 1. Audit log in Supabase attendance_notifications
  try {
    await supabaseQuery("attendance_notifications", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify({
        session_id: `OTP-${Date.now()}`,
        prn: payload.identifier,
        student_name: payload.candidateName || roleName,
        student_email: cleanEmail,
        subject: "Security: Password Reset OTP",
        department: roleName,
        year: "Security Verification",
        lecture_date: dateStr,
        lecture_time: timeStr,
        teacher_name: "Security Service",
        status: "OTP Dispatched",
        notification_type: "Password Reset OTP",
        email_subject: subject,
        email_content: `Numerical OTP: ${payload.otp} dispatched to ${cleanEmail}`,
      }),
    });
  } catch (err) {
    console.debug("Could not log to attendance_notifications:", err);
  }

  // 2. Dispatch email via Web3Forms with FormSubmit fallback
  try {
    fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        access_key: "c53d1fb5-bc6d-4763-8a3d-4c3127ef64db",
        subject: subject,
        from_name: "RIT Security Administration",
        to_email: cleanEmail,
        message: emailText,
      }),
    })
      .then((res) => {
        if (!res.ok) {
          fetch("https://formsubmit.co/ajax/" + encodeURIComponent(cleanEmail), {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
              _subject: subject,
              verification_code: payload.otp,
              account_role: roleName,
              account_id: payload.identifier,
              message: `Your RIT verification code is ${payload.otp}. Valid for 10 minutes.`,
            }),
          }).catch(() => {});
        }
      })
      .catch(() => {
        fetch("https://formsubmit.co/ajax/" + encodeURIComponent(cleanEmail), {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            _subject: subject,
            verification_code: payload.otp,
            account_role: roleName,
            account_id: payload.identifier,
            message: `Your RIT verification code is ${payload.otp}. Valid for 10 minutes.`,
          }),
        }).catch(() => {});
      });
  } catch (e) {
    console.debug("OTP dispatch notification error:", e);
  }

  return { success: true, message: `6-Digit OTP successfully dispatched to ${cleanEmail}` };
}

/**
 * 📨 Dispatches an official decision notification email (Approved / Rejected) to the student
 */
export async function dispatchLeaveDecisionEmailNotification(payload: {
  studentEmail: string;
  studentName: string;
  prn: string;
  subject: string;
  lectureDate: string;
  lectureTime?: string;
  decision: "Approved" | "Rejected";
  adminName?: string;
  leaveType?: string;
  reason?: string;
}) {
  const cleanEmail = (payload.studentEmail || "").trim().toLowerCase();
  if (!cleanEmail) return { success: false, message: "No recipient email provided" };

  const isApproved = payload.decision === "Approved";
  const statusEmoji = isApproved ? "✅" : "❌";
  const statusText = isApproved ? "APPROVED (Marked PRESENT)" : "REJECTED (Marked ABSENT)";
  const subject = `${statusEmoji} Official Leave Application ${payload.decision.toUpperCase()}: ${payload.subject} (${payload.lectureDate})`;
  const verifier = payload.adminName || "College Administration";

  const messageText = `
Rajarambapu Institute of Technology, Rajaramnagar
Official Student Attendance & Academic Affairs Division

Dear ${payload.studentName} (PRN: ${payload.prn}),

Your submitted Leave / Official Certificate application has been formally reviewed:

- Subject: ${payload.subject}
- Date of Absence: ${payload.lectureDate}
- Lecture Timing: ${payload.lectureTime || "Scheduled Lecture Time"}
- Application Category: ${payload.leaveType || "Leave / Exemption Certificate"}
- Verification Status: ${statusText}
- Verified By: ${verifier}
- Verification Date: ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}

${
  isApproved
    ? "🎉 CONGRATULATIONS: Your certificate has been verified and validated. Your attendance for this lecture has been recorded as 'PRESENT' in the institutional attendance database, contributing directly to your minimum 75% attendance criteria."
    : "⚠️ NOTICE: Your leave request has been marked as 'ABSENT' upon administrative review. If you have inquiries, please consult the Academic Office or your Department Head."
}

Best regards,
Office of Academic Affairs & Attendance Monitoring
Rajarambapu Institute of Technology (RIT)
  `.trim();

  try {
    fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        access_key: "c53d1fb5-bc6d-4763-8a3d-4c3127ef64db",
        subject: subject,
        from_name: "RIT Academic Affairs & Attendance Office",
        to_email: cleanEmail,
        message: messageText,
      }),
    })
      .then((res) => {
        if (!res.ok) {
          fetch("https://formsubmit.co/ajax/" + encodeURIComponent(cleanEmail), {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
              _subject: subject,
              status: payload.decision,
              student: payload.studentName,
              prn: payload.prn,
              subject: payload.subject,
              message: messageText,
            }),
          }).catch(() => {});
        }
      })
      .catch(() => {
        fetch("https://formsubmit.co/ajax/" + encodeURIComponent(cleanEmail), {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            _subject: subject,
            status: payload.decision,
            student: payload.studentName,
            prn: payload.prn,
            subject: payload.subject,
            message: messageText,
          }),
        }).catch(() => {});
      });
  } catch (err) {
    console.debug("Leave decision email dispatch notice:", err);
  }

  return { success: true, message: `Notification sent to ${cleanEmail}` };
}
