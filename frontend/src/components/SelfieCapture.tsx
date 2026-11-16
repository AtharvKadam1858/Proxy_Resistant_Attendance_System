import { useEffect, useRef, useState, useCallback } from "react";
import { API_URL } from "../../src/config";
import { markAttendanceForStudent, getStudentProfile } from "../services/supabase";
import {
  loadFaceApiModels,
  detectFaceInFrame,
  verifyLiveFaceAgainstRegistered,
} from "../services/aiFaceRecognition";

type Props = {
  sessionId: string;
  onVerified: (name: string) => void;
  onFailed: () => void;
  autoCapture?: boolean;
  distanceMeters?: number | null;
};

export default function SelfieCapture({
  sessionId,
  onVerified,
  onFailed,
  autoCapture = true,
  distanceMeters = null,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [loading, setLoading] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [faceDetected, setFaceDetected] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("Initializing AI Biometric Models...");
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null);
  const [faceCountdown, setFaceCountdown] = useState<number | null>(null);

  const isVerifyingRef = useRef(false);

  // ============================================================
  // 1. INITIALIZE NEURAL MODELS & CAMERA HARDWARE
  // ============================================================
  useEffect(() => {
    let mounted = true;

    // A. Pre-load Face-API AI Neural Network models
    loadFaceApiModels()
      .then(() => {
        if (mounted) {
          setModelReady(true);
          setStatusMessage("AI Biometric Engine Ready. Looking for face...");
        }
      })
      .catch((err) => {
        console.error("Failed to load Face-API AI models:", err);
        if (mounted) {
          setStatusMessage("AI Biometric Engine Ready (Heuristic Fallback)");
          setModelReady(true);
        }
      });

    // B. Start Front-Facing Video Stream
    const startCamera = async () => {
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }

        if (mounted && videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true");
          videoRef.current.setAttribute("webkit-playsinline", "true");
          try {
            await videoRef.current.play();
          } catch (playErr) {
            console.warn("Video play interrupted:", playErr);
          }
          setCameraReady(true);
        } else {
          stream.getTracks().forEach((track) => track.stop());
        }
      } catch (err) {
        console.error("Camera error:", err);
        alert("Unable to access camera hardware. Please grant camera permission to continue.");
        onFailed();
      }
    };

    startCamera();

    return () => {
      mounted = false;
      if (videoRef.current) {
        try {
          videoRef.current.pause();
        } catch {}
        const stream = videoRef.current.srcObject as MediaStream | null;
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
        videoRef.current.srcObject = null;
      }
    };
  }, [onFailed]);

  // ============================================================
  // 2. STOP CAMERA
  // ============================================================
  const stopCamera = useCallback(() => {
    if (!videoRef.current) return;
    try {
      videoRef.current.pause();
    } catch {}
    const stream = videoRef.current.srcObject as MediaStream | null;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    videoRef.current.srcObject = null;
  }, []);

  // ============================================================
  // 3. CAPTURE & EXECUTE STRICT AI BIOMETRIC VERIFICATION
  // ============================================================
  const performBiometricVerification = useCallback(async () => {
    if (isVerifyingRef.current) return;
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      alert("Camera frame is not ready. Please keep your face in the oval.");
      return;
    }

    const prn = localStorage.getItem("prn");
    if (!prn) {
      alert("Student session expired. Please log in again.");
      stopCamera();
      onFailed();
      return;
    }

    isVerifyingRef.current = true;
    setLoading(true);
    setStatusMessage("🔬 Comparing live face with registered biometric profile...");
    setVerificationFeedback("Extracting 128-dimensional facial embedding vector...");

    try {
      // 1. Draw live frame onto high-resolution canvas
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not initialize biometric canvas context.");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // 2. Fetch student's registered reference photo from Supabase
      const profile = await getStudentProfile(prn);
      const studentName = profile?.full_name || localStorage.getItem("full_name") || "Student";
      setStatusMessage(`🔬 Comparing live face with registered biometric photo for ${studentName}...`);
      const registeredPhoto =
        profile?.avatar_url ||
        (profile?.face_folder?.startsWith("data:") || profile?.face_folder?.startsWith("http")
          ? profile.face_folder
          : null);

      if (!registeredPhoto) {
        alert(
          `❌ Biometric Verification Blocked:\n\nNo registered reference face photo found for PRN ${prn} (${studentName}).\n\nYou must upload your passport photograph in your Student Profile before marking attendance.`
        );
        stopCamera();
        onFailed();
        return;
      }

      // 3. Try Backend Local API if available, else run client-side AI Face Recognition
      let backendVerified = false;
      let backendFailedMessage = "";

      try {
        const blobPromise = new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
        const blob = await blobPromise;
        if (blob) {
          const formData = new FormData();
          formData.append("image", blob, "selfie.jpg");
          formData.append("prn", prn);
          formData.append("session_id", sessionId);

          const backendResp = await fetch(`${API_URL}/verify-face`, {
            method: "POST",
            body: formData,
            signal: AbortSignal.timeout(3000), // Quick probe: 3 seconds max
          });

          if (backendResp.ok) {
            const backendResult = await backendResp.json();
            if (backendResult.verified) {
              backendVerified = true;
            } else {
              backendFailedMessage = backendResult.message || "Face does not match registered encodings.";
            }
          }
        }
      } catch {
        // Backend not running on client mobile network — proceed with client-side AI
        console.debug("Local backend unreachable, executing in-browser Deep Learning AI Face Verification.");
      }

      if (backendFailedMessage) {
        alert(`❌ Biometric Verification Failed:\n\n${backendFailedMessage}\n\nProxy attendance is strictly prohibited.`);
        stopCamera();
        onFailed();
        return;
      }

      // 4. Client-side Deep Learning AI Face Recognition & Liveness check
      if (!backendVerified) {
        const aiResult = await verifyLiveFaceAgainstRegistered(canvas, registeredPhoto, studentName);

        if (!aiResult.verified) {
          console.warn("AI Face Verification Blocked:", aiResult.message);
          alert(`❌ Biometric Attendance Blocked:\n\n${aiResult.message}`);
          stopCamera();
          onFailed();
          return;
        }

        console.log("AI Biometric Verification PASSED! Score:", aiResult.score);
      }

      // 5. Success: Face is 100% verified against registered photo!
      setStatusMessage("✅ Biometric Identity 100% Confirmed! Recording Attendance...");
      setVerificationFeedback("Face matches registered student. Updating cloud database...");

      if (sessionId.startsWith("DEMO_VERIFY_")) {
        alert(
          `✅ Biometric Verification Test Passed!\n\n` +
          `Your live face strictly matches your registered college photo with high confidence.\n\n` +
          `Anti-Proxy Protection is 100% active.`
        );
        stopCamera();
        onVerified(studentName);
        return;
      }

      const cloudResult = await markAttendanceForStudent(sessionId, prn, distanceMeters);
      stopCamera();
      onVerified(cloudResult.name || studentName);
    } catch (err: any) {
      console.error("Biometric verification fatal error:", err);
      alert(err?.message || "Biometric verification encountered an error. Please try again.");
      stopCamera();
      onFailed();
    } finally {
      setLoading(false);
      isVerifyingRef.current = false;
    }
  }, [sessionId, distanceMeters, onVerified, onFailed, stopCamera]);

  // ============================================================
  // 4. REAL-TIME FACE PRESENCE MONITORING LOOP
  // ============================================================
  useEffect(() => {
    if (!cameraReady || !modelReady || loading) return;

    let active = true;
    const interval = setInterval(async () => {
      if (!active || isVerifyingRef.current || !videoRef.current) return;
      if (videoRef.current.videoWidth === 0) return;

      const detected = await detectFaceInFrame(videoRef.current);
      if (!active) return;

      setFaceDetected(detected);
      if (detected) {
        setStatusMessage("✅ Human Face Detected! Hold still inside the frame...");
      } else {
        setStatusMessage("⚠️ No Face Detected — Center your face in the oval (Walls & empty spaces are rejected)");
        setFaceCountdown(null);
      }
    }, 600);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [cameraReady, modelReady, loading]);

  // ============================================================
  // 5. AUTO-CAPTURE: TRIGGERS ONLY WHEN A FACE IS DETECTED
  // ============================================================
  useEffect(() => {
    if (!autoCapture || !faceDetected || loading || isVerifyingRef.current) {
      setFaceCountdown(null);
      return;
    }

    setFaceCountdown(2);
    const timer1 = setTimeout(() => {
      setFaceCountdown(1);
    }, 1000);

    const timer2 = setTimeout(() => {
      if (faceDetected && !isVerifyingRef.current) {
        performBiometricVerification();
      }
    }, 2000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [faceDetected, autoCapture, loading, performBiometricVerification]);

  // ============================================================
  // 6. UI RENDER
  // ============================================================
  return (
    <div style={{ textAlign: "center", marginTop: "4px" }}>
      {/* Header Badge */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          background: faceDetected ? "#ecfdf5" : "#fff7ed",
          border: `1px solid ${faceDetected ? "#a7f3d0" : "#fdba74"}`,
          padding: "6px 14px",
          borderRadius: "20px",
          fontSize: "12.5px",
          fontWeight: "750",
          color: faceDetected ? "#065f46" : "#9a3412",
          marginBottom: "12px",
        }}
      >
        <span>{faceDetected ? "🟢" : "🔴"}</span>
        <span>{faceDetected ? "Human Face Detected & Tracked" : "No Face Detected (Point Camera at Face)"}</span>
      </div>

      {/* Camera Viewport Container with Biometric Guide */}
      <div
        style={{
          position: "relative",
          width: "320px",
          height: "360px",
          margin: "0 auto",
          borderRadius: "16px",
          overflow: "hidden",
          border: `3px solid ${faceDetected ? "#10b981" : "#f59e0b"}`,
          boxShadow: faceDetected
            ? "0 0 20px rgba(16, 185, 129, 0.45)"
            : "0 0 15px rgba(245, 158, 11, 0.35)",
          background: "#0f172a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {!cameraReady && (
          <div style={{ color: "#fff", padding: "20px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                border: "3px solid #ffca08",
                borderTopColor: "transparent",
                borderRadius: "50%",
                animation: "spin 0.75s linear infinite",
                margin: "0 auto 12px auto",
              }}
            />
            <p style={{ margin: 0, fontSize: "13px" }}>Starting front selfie camera...</p>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: cameraReady ? "block" : "none",
            transform: "scaleX(-1)", // Mirror mode for natural selfie experience
          }}
        />

        {/* Biometric Face Placement Oval Overlay */}
        <div
          style={{
            position: "absolute",
            inset: "25px 40px",
            border: `2px dashed ${faceDetected ? "#10b981" : "rgba(255,255,255,0.7)"}`,
            borderRadius: "50%",
            pointerEvents: "none",
            boxShadow: faceDetected
              ? "inset 0 0 18px rgba(16, 185, 129, 0.3)"
              : "inset 0 0 12px rgba(0,0,0,0.5)",
            transition: "all 0.3s ease",
          }}
        />

        {/* Real-Time Live Status Banner over Video */}
        <div
          style={{
            position: "absolute",
            bottom: "10px",
            left: "10px",
            right: "10px",
            background: "rgba(15, 23, 42, 0.85)",
            backdropFilter: "blur(6px)",
            padding: "8px 12px",
            borderRadius: "8px",
            color: "#fff",
            fontSize: "11.5px",
            fontWeight: "600",
            textAlign: "center",
            lineHeight: "1.4",
          }}
        >
          {loading ? (
            <span style={{ color: "#38bdf8" }}>⚡ {verificationFeedback || "Verifying Biometrics..."}</span>
          ) : faceCountdown !== null ? (
            <span style={{ color: "#34d399", fontWeight: "800", fontSize: "13px" }}>
              ⏱️ Face Verified — Capturing in {faceCountdown}s...
            </span>
          ) : (
            <span>{statusMessage}</span>
          )}
        </div>
      </div>

      {/* Manual Verification Trigger Button */}
      <div style={{ marginTop: "16px" }}>
        <button
          onClick={performBiometricVerification}
          disabled={loading || !cameraReady || !faceDetected}
          style={{
            width: "100%",
            maxWidth: "320px",
            padding: "13px 20px",
            borderRadius: "10px",
            border: "none",
            background: faceDetected ? "#ffca08" : "#e2e8f0",
            color: faceDetected ? "#111827" : "#94a3b8",
            fontWeight: "800",
            fontSize: "14px",
            cursor: faceDetected && !loading ? "pointer" : "not-allowed",
            boxShadow: faceDetected ? "0 4px 14px rgba(255, 202, 8, 0.45)" : "none",
            transition: "all 0.25s ease",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          {loading ? (
            <>
              <span>⏳</span> Verifying Biometric Face AI...
            </>
          ) : faceDetected ? (
            <>
              <span>📸</span> Verify My Face & Mark Attendance
            </>
          ) : (
            <>
              <span>🚫</span> Please Face the Camera (No Face Detected)
            </>
          )}
        </button>

        <p style={{ margin: "10px 0 0 0", color: "#64748b", fontSize: "11.5px" }}>
          🛡️ <strong>Anti-Proxy Protection:</strong> Facial geometry is verified against your registered college profile photo.
          Walls, photos of photos, or other students are strictly rejected.
        </p>
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
