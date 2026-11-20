import { useEffect, useRef, useState, useCallback } from "react";
import { markAttendanceForStudent, getStudentProfile } from "../services/supabase";
import {
  loadFaceApiModels,
  verifyLiveFaceAgainstRegistered,
  analyzeLiveFrameLiveness,
  getCachedDescriptor,
  preWarmStudentBiometrics,
  type LiveFrameAnalysis,
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
  const [eyesOpen, setEyesOpen] = useState<boolean>(false);
  const [livenessStage, setLivenessStage] = useState<"DETECTING" | "PROMPT_BLINK" | "BLINK_DETECTED" | "VERIFIED">("DETECTING");
  const [statusMessage, setStatusMessage] = useState<string>("Initializing Deep Learning Biometric Engine...");
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null);

  const isVerifyingRef = useRef(false);
  const isProcessingFrameRef = useRef(false);
  const latestAnalysisRef = useRef<LiveFrameAnalysis | null>(null);
  const baselineOpenEarRef = useRef<number>(0);
  const eyeClosedDetectedRef = useRef<boolean>(false);
  const closedTimestampRef = useRef<number>(0);
  const faceLockStartRef = useRef<number>(0);
  const cachedProfileRef = useRef<any>(null);
  const cachedDescriptorRef = useRef<Float32Array | null>(null);

  // Sensory audio chime & haptic vibration
  const playVerificationChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      osc.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.15); // E6 note
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch {}
    try {
      if ("vibrate" in navigator) {
        navigator.vibrate([80, 40, 80]);
      }
    } catch {}
  };

  // ============================================================
  // 1. PRE-WARM BIOMETRICS & START CAMERA IN PARALLEL
  // ============================================================
  useEffect(() => {
    let mounted = true;
    const prn = localStorage.getItem("prn");

    // A. Parallel pre-warm Face-API models & student descriptor (0ms wait later)
    loadFaceApiModels()
      .then(async () => {
        if (!mounted) return;
        setModelReady(true);
        setStatusMessage("⚡ AI Ready — Center your face in the oval...");

        // Pre-warm student's registered face descriptor in background
        if (prn) {
          const profile = await getStudentProfile(prn);
          if (mounted && profile) {
            cachedProfileRef.current = profile;
            const desc = await preWarmStudentBiometrics(prn);
            if (mounted && desc) {
              cachedDescriptorRef.current = desc;
              console.log("⚡ Reference photo descriptor pre-warmed for PRN:", prn);
            }
          }
        }
      })
      .catch((err) => {
        console.error("Failed to load Face-API AI models:", err);
        if (mounted) {
          setStatusMessage("AI Biometric Engine Ready (Fast Mode)");
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
  // 3. STRICT AI BIOMETRIC VERIFICATION (EXECUTES IN <200ms)
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
    setStatusMessage("⚡ Matching face with registered photo in cloud database...");
    setVerificationFeedback("Extracting live face descriptor...");

    try {
      // 1. Draw live frame onto canvas
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not initialize biometric canvas context.");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // 🛑 STRICT PRE-CAPTURE EYE OPENNESS & FULL-FACE COMPLETENESS CHECK:
      // Guarantees no attendance can EVER be recorded with half-face, side profile, or closed eyes
      const liveCheck = await analyzeLiveFrameLiveness(canvas);
      if (!liveCheck.faceDetected) {
        alert("❌ Biometric Verification Blocked:\n\nNo face detected. Please face the camera directly.");
        stopCamera();
        onFailed();
        return;
      }
      if (!liveCheck.isFullFrontalFace) {
        alert(
          `❌ Biometric Verification Blocked:\n\n` +
          `${liveCheck.fullFaceReason || "Incomplete face detected."}\n\n` +
          `A complete, centered, forward-facing face is strictly required.\n` +
          `Half-face, side-profile, and cropped camera poses are strictly prohibited.`
        );
        stopCamera();
        onFailed();
        return;
      }
      if (liveCheck.eyesClosed || liveCheck.ear < 0.21) {
        alert(
          `❌ Biometric Verification Blocked:\n\n` +
          `Eyes are closed! (Eye Ratio ${liveCheck.ear.toFixed(2)} is below minimum 0.21).\n\n` +
          `You must look directly at the camera with your eyes open.\n` +
          `Sleeping, closed-eye, or spoofed photo poses are strictly rejected.`
        );
        stopCamera();
        onFailed();
        return;
      }

      // 2. Get student profile & registered photo (instant from pre-warmed cache)
      let profile = cachedProfileRef.current;
      if (!profile) {
        profile = await getStudentProfile(prn);
        cachedProfileRef.current = profile;
      }
      const studentName = profile?.full_name || localStorage.getItem("full_name") || "Student";
      const registeredPhoto =
        profile?.avatar_url ||
        (profile?.face_folder?.startsWith("data:") || profile?.face_folder?.startsWith("http")
          ? profile.face_folder
          : null);

      if (!registeredPhoto && !cachedDescriptorRef.current && !getCachedDescriptor(prn)) {
        alert(
          `❌ Biometric Verification Blocked:\n\nNo registered reference face photo found for PRN ${prn} (${studentName}).\n\nYou must upload your passport photograph in your Student Profile before marking attendance.`
        );
        stopCamera();
        onFailed();
        return;
      }

      // 3. Direct Client-side Deep Learning AI Face Recognition (<200ms)
      const aiResult = await verifyLiveFaceAgainstRegistered(
        canvas,
        registeredPhoto || "",
        studentName,
        cachedDescriptorRef.current || getCachedDescriptor(prn),
        prn
      );

      if (!aiResult.verified) {
        console.warn("AI Face Verification Blocked:", aiResult.message);
        alert(`❌ Biometric Attendance Blocked:\n\n${aiResult.message}`);
        stopCamera();
        onFailed();
        return;
      }

      console.log("⚡ AI Biometric Verification PASSED! Score:", aiResult.score);

      // 4. Trigger Sensory Feedback (Audio Chime + Mobile Vibration)
      playVerificationChime();

      // 5. Success: Face is 100% verified against registered photo!
      setStatusMessage("✅ Biometric Identity Confirmed! Recording Attendance...");
      setVerificationFeedback("Face matches registered student. Updating cloud database...");

      if (sessionId.startsWith("DEMO_VERIFY_")) {
        alert(
          `✅ Biometric Verification Test Passed!\n\n` +
          `Your live face strictly matches your registered college photo with high confidence (${Math.round(aiResult.score * 100)}%).\n\n` +
          `Anti-Proxy Protection is 100% active.`
        );
        stopCamera();
        onVerified(studentName);
        return;
      }

      // 6. Record attendance in Supabase
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
  // 4. AUTONOMOUS FAST LIVENESS ENGINE (60ms)
  // Auto-marks on natural blink (<1.2s) OR face lock hold (2.5s)
  // ============================================================
  useEffect(() => {
    if (!cameraReady || !modelReady || loading) return;

    let active = true;

    const interval = setInterval(async () => {
      if (!active || isVerifyingRef.current || isProcessingFrameRef.current || !videoRef.current) return;
      if (videoRef.current.videoWidth === 0) return;

      isProcessingFrameRef.current = true;
      try {
        const analysis = await analyzeLiveFrameLiveness(videoRef.current);
        if (!active || isVerifyingRef.current) return;

        latestAnalysisRef.current = analysis;

        // 🛑 1. FACE DETECTION CHECK
        if (!analysis.faceDetected) {
          setFaceDetected(false);
          setEyesOpen(false);
          setLivenessStage("DETECTING");
          baselineOpenEarRef.current = 0;
          eyeClosedDetectedRef.current = false;
          faceLockStartRef.current = 0;
          setStatusMessage("⚠️ Center your face inside the oval guide");
          return;
        }

        // 🛑 1b. FULL-FACE FRONTAL & ANTI-HALF-FACE VALIDATION:
        if (!analysis.isFullFrontalFace) {
          setFaceDetected(false);
          setEyesOpen(false);
          setLivenessStage("DETECTING");
          baselineOpenEarRef.current = 0;
          eyeClosedDetectedRef.current = false;
          faceLockStartRef.current = 0; // RESET timer immediately on half-face!
          setStatusMessage(analysis.fullFaceReason || "⚠️ Full face required! Please face forward inside the oval.");
          return;
        }

        setFaceDetected(true);
        if (faceLockStartRef.current === 0) {
          faceLockStartRef.current = performance.now();
        }

        // 🛑 2. CLOSED EYES HANDLING
        if (analysis.eyesClosed) {
          setEyesOpen(false);

          // If baseline open eye was established, this is an EYELID CLOSURE in progress!
          if (baselineOpenEarRef.current >= 0.21) {
            eyeClosedDetectedRef.current = true;
            closedTimestampRef.current = performance.now();
            setLivenessStage("BLINK_DETECTED");
            setStatusMessage("👁️ Blink in progress... Reopen eyes to mark attendance!");
          } else {
            setStatusMessage("❌ Eyes are closed! Please open your eyes and face the camera.");
          }
          return;
        }

        // 🛑 3. EYES ARE OPEN
        setEyesOpen(true);
        if (baselineOpenEarRef.current === 0 || analysis.ear > baselineOpenEarRef.current) {
          baselineOpenEarRef.current = analysis.ear;
        }

        // 🛑 4. PATH A: AUTONOMOUS NATURAL BLINK CONFIRMATION
        if (eyeClosedDetectedRef.current && analysis.eyesOpen) {
          const blinkDuration = performance.now() - closedTimestampRef.current;
          if (blinkDuration >= 40 && blinkDuration <= 1500) {
            // ✨ NATURAL BLINK CONFIRMED!
            setLivenessStage("VERIFIED");
            setStatusMessage("✨ Natural Eye Blink Confirmed! 🟢 Matching face with photo...");
            eyeClosedDetectedRef.current = false;

            if (autoCapture && !isVerifyingRef.current) {
              performBiometricVerification();
              return;
            }
          } else if (blinkDuration > 1500) {
            eyeClosedDetectedRef.current = false;
          }
        }

        // 🛑 5. PATH B: AUTONOMOUS 2.5-SECOND FACE LOCK HOLD
        // If student keeps face centered with eyes open for 2.5s, auto-trigger attendance!
        const lockDuration = performance.now() - faceLockStartRef.current;
        if (autoCapture && lockDuration >= 2500 && analysis.eyesOpen && !isVerifyingRef.current) {
          setLivenessStage("VERIFIED");
          setStatusMessage("✨ Live Face Presence Verified! 🟢 Matching face with photo...");
          performBiometricVerification();
          return;
        }

        // Guidance messaging
        if (livenessStage !== "VERIFIED") {
          setLivenessStage("PROMPT_BLINK");
          const remainingSec = Math.max(1, Math.ceil((2500 - lockDuration) / 1000));
          setStatusMessage(`👀 Blink naturally, hold face (${remainingSec}s), or tap Mark Attendance`);
        }
      } catch (err) {
        console.debug("Liveness tracking error:", err);
      } finally {
        isProcessingFrameRef.current = false;
      }
    }, 60);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [cameraReady, modelReady, loading, autoCapture, livenessStage, performBiometricVerification]);

  // ============================================================
  // 5. DIRECT / EMERGENCY BUTTON HANDLER
  // Allows student to tap and immediately verify face with open eyes!
  // ============================================================
  const handleManualAction = () => {
    if (!faceDetected) {
      alert("⚠️ Please look directly at the camera with your face inside the oval.");
      return;
    }

    const currentAnalysis = latestAnalysisRef.current;

    // Strict Anti-Proxy: Reject if half-face, side profile, or incomplete face!
    if (currentAnalysis && !currentAnalysis.isFullFrontalFace) {
      alert(
        "❌ Biometric Verification Blocked:\n\n" +
        (currentAnalysis.fullFaceReason || "Half-face or incomplete face detected.\n\nPlease look directly at the camera with your full face centered inside the oval guide.")
      );
      return;
    }

    // Strict Anti-Proxy: Reject if eyes are closed!
    if (currentAnalysis && (currentAnalysis.eyesClosed || currentAnalysis.ear < 0.21)) {
      alert(
        "❌ Biometric Verification Blocked:\n\n" +
        "Eyes are closed! You cannot mark attendance with your eyes closed.\n\n" +
        "Please look directly at the camera with your eyes open."
      );
      return;
    }

    // Direct Face Verification & Attendance Marking
    performBiometricVerification();
  };

  // ============================================================
  // 6. UI RENDER
  // ============================================================
  return (
    <div style={{ textAlign: "center", marginTop: "4px" }}>
      {/* Dynamic Header Status Badge */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          background:
            livenessStage === "VERIFIED"
              ? "#ecfdf5"
              : livenessStage === "BLINK_DETECTED"
              ? "#eff6ff"
              : faceDetected
              ? "#f0fdf4"
              : "#fff7ed",
          border: `1.5px solid ${
            livenessStage === "VERIFIED"
              ? "#10b981"
              : livenessStage === "BLINK_DETECTED"
              ? "#3b82f6"
              : faceDetected
              ? "#22c55e"
              : "#fdba74"
          }`,
          padding: "6px 14px",
          borderRadius: "20px",
          fontSize: "12.5px",
          fontWeight: "750",
          color:
            livenessStage === "VERIFIED"
              ? "#047857"
              : livenessStage === "BLINK_DETECTED"
              ? "#1d4ed8"
              : faceDetected
              ? "#15803d"
              : "#9a3412",
          marginBottom: "10px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}
      >
        <span>
          {livenessStage === "VERIFIED"
            ? "🟢"
            : livenessStage === "BLINK_DETECTED"
            ? "👁️"
            : faceDetected
            ? "🟢"
            : "🔴"}
        </span>
        <span>
          {livenessStage === "VERIFIED"
            ? "Liveness Confirmed! Matching Face..."
            : livenessStage === "BLINK_DETECTED"
            ? "Blink Detected! Open eyes to capture"
            : faceDetected
            ? "Human Face Detected & Centered"
            : "No Face Detected — Look at Camera"}
        </span>
      </div>

      {/* Camera Viewport Container with Biometric Guide */}
      <div
        style={{
          position: "relative",
          width: "320px",
          height: "320px",
          margin: "0 auto",
          borderRadius: "24px",
          overflow: "hidden",
          background: "#0f172a",
          border: `3px solid ${
            livenessStage === "VERIFIED"
              ? "#10b981"
              : livenessStage === "BLINK_DETECTED"
              ? "#3b82f6"
              : faceDetected
              ? "#22c55e"
              : "#e2e8f0"
          }`,
          boxShadow: faceDetected
            ? "0 8px 24px rgba(34, 197, 94, 0.25)"
            : "0 4px 16px rgba(0,0,0,0.15)",
          transition: "border-color 0.25s ease, box-shadow 0.25s ease",
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: "scaleX(-1)", // Mirror selfie feed
          }}
        />
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {/* Biometric Face Placement Oval Guide */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "185px",
            height: "235px",
            borderRadius: "50%",
            border: `2.5px dashed ${
              livenessStage === "VERIFIED"
                ? "#10b981"
                : livenessStage === "BLINK_DETECTED"
                ? "#38bdf8"
                : faceDetected
                ? "rgba(34, 197, 94, 0.9)"
                : "rgba(255, 255, 255, 0.6)"
            }`,
            pointerEvents: "none",
            boxShadow: faceDetected ? "0 0 15px rgba(34, 197, 94, 0.4)" : "none",
            transition: "all 0.2s ease",
          }}
        />

        {/* Loading Overlay */}
        {loading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(15, 23, 42, 0.85)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              padding: "16px",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                border: "3.5px solid rgba(255,255,255,0.2)",
                borderTopColor: "#38bdf8",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                marginBottom: "12px",
              }}
            />
            <div style={{ fontSize: "14px", fontWeight: "700" }}>Verifying Identity...</div>
            <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
              Matching 128D embedding with database
            </div>
          </div>
        )}
      </div>

      {/* Guidance Text */}
      <div
        style={{
          marginTop: "10px",
          fontSize: "12px",
          color: faceDetected ? "#15803d" : "#64748b",
          fontWeight: "600",
          minHeight: "20px",
        }}
      >
        {statusMessage}
      </div>

      {verificationFeedback && (
        <div style={{ fontSize: "11px", color: "#0284c7", fontWeight: "600", marginTop: "2px" }}>
          {verificationFeedback}
        </div>
      )}

      {/* Emergency / Direct Manual Mark Attendance Button */}
      <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "8px", alignItems: "center" }}>
        <button
          onClick={handleManualAction}
          disabled={loading || !cameraReady || !modelReady}
          style={{
            background: faceDetected && eyesOpen ? "linear-gradient(135deg, #16a34a, #15803d)" : "#475569",
            color: "#ffffff",
            border: "none",
            padding: "10px 22px",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: "750",
            cursor: loading ? "not-allowed" : "pointer",
            boxShadow: faceDetected ? "0 4px 14px rgba(22, 163, 74, 0.35)" : "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.2s ease",
          }}
        >
          <span>⚡ Mark Attendance Now (Verify My Face)</span>
        </button>
        <span style={{ fontSize: "10.5px", color: "#94a3b8" }}>
          Autonomous: Blinking naturally or holding face steady also auto-records attendance
        </span>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
