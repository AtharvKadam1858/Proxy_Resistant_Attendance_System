import { useEffect, useRef, useState } from "react";
import { API_URL } from "../../src/config";
import { markAttendanceForStudent } from "../services/supabase";

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

  // ============================================================
  // START CAMERA
  // ============================================================

  useEffect(() => {
    let mounted = true;

    const startCamera = async () => {
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" },
            audio: false,
          });
        } catch (camErr) {
          console.warn("Front camera mode failed, falling back to any camera:", camErr);
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
          stream.getTracks().forEach((track) => {
            track.stop();
            track.enabled = false;
          });
        }
      } catch (err) {
        console.error("Camera error:", err);
        alert(
          "Unable to access camera. Please allow camera permissions in your browser."
        );
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
          stream.getTracks().forEach((track) => {
            track.stop();
            track.enabled = false;
          });
        }
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  // ============================================================
  // AUTO CAPTURE
  // ============================================================

  useEffect(() => {
    if (!autoCapture) {
      return;
    }

    const timer = setTimeout(() => {
      capture();
    }, 2500);

    return () => {
      clearTimeout(timer);
    };
  }, [autoCapture]);

  // ============================================================
  // STOP CAMERA
  // ============================================================

  const stopCamera = () => {
    if (!videoRef.current) {
      return;
    }

    try {
      videoRef.current.pause();
    } catch {}

    const stream = videoRef.current.srcObject as MediaStream | null;
    if (stream) {
      stream.getTracks().forEach((track) => {
        track.stop();
        track.enabled = false;
      });
    }

    videoRef.current.srcObject = null;
  };

  // ============================================================
  // CAPTURE SELFIE
  // ============================================================

  const capture = async () => {
    if (!videoRef.current || !canvasRef.current) {
      return;
    }

    if (loading) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // ============================================================
    // CHECK CAMERA
    // ============================================================

    if (
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      alert(
        "Camera is not ready. Please keep your face visible and try again."
      );

      return;
    }

    // ============================================================
    // GET PRN
    // ============================================================

    const prn = localStorage.getItem("prn");

    if (!prn) {
      alert(
        "Student PRN not found. Please login again."
      );

      stopCamera();

      onFailed();

      return;
    }

    // ============================================================
    // CHECK SESSION
    // ============================================================

    if (!sessionId) {
      alert(
        "Attendance session not found."
      );

      stopCamera();

      onFailed();

      return;
    }

    setLoading(true);

    // ============================================================
    // SET CANVAS SIZE
    // ============================================================

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      alert(
        "Unable to process camera image."
      );

      setLoading(false);

      return;
    }

    // ============================================================
    // DRAW VIDEO FRAME
    // ============================================================

    ctx.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    // ============================================================
    // CONVERT IMAGE TO BLOB
    // ============================================================

    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          alert(
            "Could not capture selfie."
          );

          setLoading(false);

          return;
        }

        try {
          // ======================================================
          // DEBUG
          // ======================================================

          console.log(
            "======================================"
          );

          console.log(
            "FACE VERIFICATION"
          );

          console.log(
            "Backend:",
            `${API_URL}/verify-face`
          );

          console.log(
            "PRN:",
            prn
          );

          console.log(
            "Session ID:",
            sessionId
          );

          console.log(
            "Image size:",
            blob.size
          );

          console.log(
            "======================================"
          );

          // ======================================================
          // CREATE FORM DATA
          // ======================================================

          const formData = new FormData();

          formData.append(
            "image",
            blob,
            "selfie.jpg"
          );

          formData.append(
            "prn",
            prn
          );

          formData.append(
            "session_id",
            sessionId
          );

          // ======================================================
          // CALL FACE VERIFICATION
          // ======================================================

          const response = await fetch(
            `${API_URL}/verify-face`,
            {
              method: "POST",
              body: formData,
            }
          );

          console.log(
            "Face verification HTTP status:",
            response.status
          );

          // ======================================================
          // READ RESPONSE
          // ======================================================

          const result = await response.json();

          console.log(
            "Face verification response:",
            result
          );

          // ======================================================
          // BACKEND ERROR
          // ======================================================

          if (!response.ok) {
            alert(
              result.message ||
              "Face verification request failed."
            );

            stopCamera();

            onFailed();

            return;
          }

          // ======================================================
          // FACE VERIFICATION FAILED
          // ======================================================

          if (!result.verified) {
            alert(
              result.message ||
              "Face verification failed."
            );

            stopCamera();

            onFailed();

            return;
          }

          // ======================================================
          // FACE VERIFIED
          // ======================================================

          console.log(
            "======================================"
          );

          console.log(
            "FACE VERIFIED SUCCESSFULLY"
          );

          console.log(
            "PRN:",
            result.prn
          );

          console.log(
            "Name:",
            result.name
          );

          console.log(
            "======================================"
          );

          // ======================================================
          // MARK ATTENDANCE
          // ======================================================

          const markResponse = await fetch(
            `${API_URL}/attendance/mark`,
            {
              method: "POST",

              headers: {
                "Content-Type": "application/json",
              },

              body: JSON.stringify({
                prn: prn,
                session_id: sessionId,
              }),
            }
          );

          console.log(
            "Attendance mark HTTP status:",
            markResponse.status
          );

          const markResult =
            await markResponse.json();

          console.log(
            "Attendance mark response:",
            markResult
          );

          // ======================================================
          // ATTENDANCE MARK FAILED
          // ======================================================

          if (!markResponse.ok || !markResult.success) {
            alert(
              markResult.message ||
              "Unable to mark attendance."
            );

            stopCamera();

            onFailed();

            return;
          }

          // ======================================================
          // SUCCESS
          // ======================================================

          console.log(
            "Attendance marked successfully."
          );

          stopCamera();

          onVerified(
            result.name || prn
          );

        } catch (apiErr: any) {
          console.warn(
            "API Server unavailable, falling back to cloud database attendance:",
            apiErr
          );

          try {
            const cloudResult = await markAttendanceForStudent(sessionId, prn, distanceMeters);
            stopCamera();
            onVerified(cloudResult.name || prn);
            return;
          } catch (cloudErr: any) {
            console.error("Cloud attendance error:", cloudErr);
            alert(
              cloudErr?.message ||
              "Unable to record attendance. Please try again."
            );
            stopCamera();
            onFailed();
          }
        } finally {
          setLoading(false);
        }
      },
      "image/jpeg",
      0.9
    );
  };

  // ============================================================
  // UI
  // ============================================================

  return (
    <div
      style={{
        textAlign: "center",
        marginTop: "10px",
      }}
    >
      <h3 style={{ margin: "0 0 14px 0", color: "#111827", fontSize: "18px", fontWeight: "750" }}>
        Face Verification
      </h3>

      {!cameraReady && (
        <div
          style={{
            padding: "24px 16px",
            background: "#fffbea",
            border: "2px dashed #ffca08",
            borderRadius: "12px",
            maxWidth: "340px",
            margin: "0 auto 16px auto",
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              border: "3px solid #eadfba",
              borderTopColor: "#ffca08",
              borderRadius: "50%",
              animation: "spin 0.75s linear infinite",
              margin: "0 auto 12px auto",
            }}
          />
          <h4 style={{ margin: "0 0 4px 0", color: "#111", fontSize: "15px" }}>
            ⏳ Starting camera, please wait...
          </h4>
          <p style={{ margin: 0, color: "#78350f", fontSize: "12px" }}>
            Please hold still and face the screen.
          </p>
        </div>
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onLoadedData={() => setCameraReady(true)}
        width={350}
        style={{
          borderRadius: "12px",
          border: "2px solid #ffca08",
          maxWidth: "100%",
          display: cameraReady ? "inline-block" : "none",
          boxShadow: "0 4px 14px rgba(0,0,0,0.1)",
        }}
      />

      <br />
      <br />

      {!autoCapture && (
        <button
          onClick={capture}
          disabled={loading || !cameraReady}
          style={{
            background: "#ffca08",
            border: "none",
            borderRadius: "8px",
            padding: "10px 20px",
            fontWeight: "750",
            cursor: "pointer",
          }}
        >
          {loading ? "Verifying Face..." : "Capture Selfie"}
        </button>
      )}

      {autoCapture && cameraReady && (
        <p style={{ color: "#374151", fontSize: "14px", fontWeight: "600" }}>
          {loading ? "⚡ Verifying Face with Cloud System..." : "👀 Looking for face..."}
          <br />
          <span style={{ fontSize: "12px", color: "#6b7280", fontWeight: "400" }}>
            Please keep your face clearly visible within camera frame.
          </span>
        </p>
      )}

      <canvas
        ref={canvasRef}
        style={{
          display: "none",
        }}
      />
    </div>
  );
}