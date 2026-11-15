import { useState, useRef, useEffect } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useNavigate } from "react-router-dom";
import SelfieCapture from "../../components/SelfieCapture";
import { API_URL } from "../../config";
import { verifySessionQR } from "../../services/supabase";
import RITLogo from "../../assets/RIT_logo.jpeg";

export default function ScanQR() {
  const navigate = useNavigate();
  const [showSelfie, setShowSelfie] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanError, setScanError] = useState("");
  const [verifying, setVerifying] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannedRef = useRef(false);
  const [sessionId, setSessionId] = useState("");
  const [, setQrToken] = useState("");

  // 🛑 STOP SCANNER + RELEASE CAMERA CLEANLY
  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch {}
      try {
        await scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
    }

    const reader = document.getElementById("qr-reader");
    if (reader) reader.innerHTML = "";

    document.querySelectorAll("video").forEach((video: any) => {
      if (video.srcObject) {
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        video.srcObject = null;
      }
    });

    setCameraActive(false);
    setCameraStarting(false);
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  // ▶ FAST DIRECT CAMERA START (ZERO REDUNDANT CALLS)
  const startScanner = async () => {
    try {
      setScanError("");
      setCameraStarting(true);
      scannedRef.current = false;

      // Small delay to ensure DOM element is mounted
      await new Promise((resolve) => setTimeout(resolve, 80));

      const qrScanner = new Html5Qrcode("qr-reader");
      scannerRef.current = qrScanner;

      const qrConfig = {
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const qrboxSize = Math.max(180, Math.floor(minEdge * 0.72));
          return { width: qrboxSize, height: qrboxSize };
        },
        aspectRatio: 1.0,
      };

      await qrScanner.start(
        { facingMode: "environment" },
        qrConfig,
        async (decodedText: string) => {
          if (scannedRef.current) return;
          scannedRef.current = true;

          const currentQrToken = decodedText.trim();
          setQrToken(currentQrToken);
          await stopScanner();

          setVerifying(true);

          // Get Geolocation Coordinates
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              try {
                const studentPrn = localStorage.getItem("prn");
                if (!studentPrn) {
                  alert("Student PRN not found. Please login again.");
                  navigate("/profile");
                  return;
                }

                let verifiedSessionId = "";

                // 1. Try Backend API if online
                try {
                  const response = await fetch(`${API_URL}/attendance/verify`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      qr_token: currentQrToken,
                      prn: studentPrn,
                      lat: pos.coords.latitude,
                      lng: pos.coords.longitude,
                    }),
                  });
                  if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                      verifiedSessionId = result.session_id;
                    } else {
                      alert(result.message || "QR code expired or invalid.");
                      scannedRef.current = false;
                      navigate("/profile");
                      return;
                    }
                  }
                } catch {
                  // Fallback to direct cloud verification
                }

                // 2. Fallback to Supabase Cloud Verification
                if (!verifiedSessionId) {
                  const cloudVerify = await verifySessionQR(currentQrToken);
                  if (cloudVerify.success && cloudVerify.session_id) {
                    verifiedSessionId = cloudVerify.session_id;
                  } else {
                    alert(cloudVerify.message || "Invalid or expired QR code.");
                    scannedRef.current = false;
                    navigate("/profile");
                    return;
                  }
                }

                setSessionId(verifiedSessionId);
                setShowSelfie(true);
              } catch (err: any) {
                console.error(err);
                alert("Verification error: " + (err?.message || "Please try again."));
                navigate("/profile");
              } finally {
                setVerifying(false);
              }
            },
            () => {
              setVerifying(false);
              alert("❌ Location permission required for proxy-resistant verification.");
              navigate("/profile");
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        },
        () => {}
      );

      setCameraStarting(false);
      setCameraActive(true);
    } catch (err: any) {
      console.error("Camera startup error:", err);
      setCameraStarting(false);
      setCameraActive(false);

      let msg = "Could not access the camera. ";
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        msg += "Please allow camera access in your browser settings.";
      } else if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
        msg += "No back camera found on this device.";
      } else if (err?.name === "NotReadableError" || err?.name === "TrackStartError") {
        msg += "Camera is currently being used by another application.";
      } else {
        msg += (err?.message || "Please refresh and try again.");
      }
      setScanError(msg);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#fffdf2",
        fontFamily: "'Segoe UI', Arial, sans-serif",
        padding: "16px",
        boxSizing: "border-box",
      }}
    >
      {/* Top Navigation Bar */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          maxWidth: "500px",
          margin: "0 auto 20px auto",
          padding: "10px 14px",
          background: "#ffffff",
          borderRadius: "12px",
          border: "1px solid #f0e2a5",
          boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img
            src={RITLogo}
            alt="RIT"
            style={{ width: "38px", height: "38px", objectFit: "contain", borderRadius: "6px" }}
          />
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#111" }}>
            Scan Lecture QR
          </h2>
        </div>

        <button
          onClick={() => {
            stopScanner();
            navigate("/profile");
          }}
          style={{
            background: "#f3f4f6",
            border: "1px solid #d1d5db",
            borderRadius: "7px",
            padding: "6px 12px",
            fontSize: "13px",
            fontWeight: "600",
            color: "#374151",
            cursor: "pointer",
          }}
        >
          ← Profile
        </button>
      </header>

      {/* Main Content Card */}
      <div
        style={{
          maxWidth: "500px",
          margin: "0 auto",
          background: "#ffffff",
          borderRadius: "14px",
          border: "1px solid #f0e2a5",
          padding: "24px 18px",
          textAlign: "center",
          boxShadow: "0 6px 20px rgba(0,0,0,0.06)",
          boxSizing: "border-box",
        }}
      >
        {showSelfie && sessionId ? (
          <SelfieCapture
            sessionId={sessionId}
            autoCapture={true}
            onVerified={() => {
              alert("✅ Attendance Marked Successfully!");
              setShowSelfie(false);
              navigate("/profile");
            }}
            onFailed={() => {
              alert("❌ Face Verification Failed. Please try again.");
              setShowSelfie(false);
              navigate("/profile");
            }}
          />
        ) : verifying ? (
          <div style={{ padding: "40px 20px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                border: "4px solid #f0e2a5",
                borderTopColor: "#ffca08",
                borderRadius: "50%",
                animation: "spin 0.75s linear infinite",
                margin: "0 auto 16px auto",
              }}
            />
            <h3 style={{ margin: "0 0 8px 0", color: "#111" }}>Verifying QR & Location...</h3>
            <p style={{ margin: 0, color: "#666", fontSize: "14px" }}>
              Matching rotating token with active classroom session.
            </p>
          </div>
        ) : (
          <>
            <p style={{ margin: "0 0 18px 0", color: "#4b5563", fontSize: "14px" }}>
              Point your camera at the teacher's live rotating QR code to mark attendance.
            </p>

            {/* Spinner when camera is starting */}
            {cameraStarting && (
              <div
                style={{
                  padding: "30px 20px",
                  background: "#fffbea",
                  border: "2px dashed #ffca08",
                  borderRadius: "12px",
                  marginBottom: "20px",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    border: "4px solid #eadfba",
                    borderTopColor: "#ffca08",
                    borderRadius: "50%",
                    animation: "spin 0.75s linear infinite",
                    margin: "0 auto 14px auto",
                  }}
                />
                <h4 style={{ margin: "0 0 6px 0", color: "#111", fontSize: "16px" }}>
                  ⏳ Starting camera, please wait...
                </h4>
                <p style={{ margin: 0, color: "#78350f", fontSize: "13px" }}>
                  Initializing camera hardware and optical scanner.
                </p>
              </div>
            )}

            {/* Error Message */}
            {scanError && (
              <div
                style={{
                  padding: "14px",
                  background: "#fef2f2",
                  border: "1px solid #fca5a5",
                  borderRadius: "8px",
                  color: "#991b1b",
                  fontSize: "13px",
                  marginBottom: "16px",
                  textAlign: "left",
                }}
              >
                <strong>Camera Error:</strong> {scanError}
              </div>
            )}

            {/* Viewfinder Container */}
            <div
              id="qr-reader"
              style={{
                width: "100%",
                maxWidth: "360px",
                minHeight: cameraActive ? "300px" : "0px",
                margin: "0 auto",
                borderRadius: "12px",
                overflow: "hidden",
                border: cameraActive ? "2px solid #ffca08" : "none",
                display: cameraActive ? "block" : "none",
              }}
            />

            {!cameraActive && !cameraStarting && (
              <button
                type="button"
                onClick={startScanner}
                style={{
                  width: "100%",
                  minHeight: "48px",
                  background: "#ffca08",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "16px",
                  fontWeight: "750",
                  color: "#111",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  boxShadow: "0 4px 12px rgba(255, 202, 8, 0.3)",
                }}
              >
                📷 Open Camera & Scan QR
              </button>
            )}

            {cameraActive && (
              <button
                type="button"
                onClick={stopScanner}
                style={{
                  width: "100%",
                  marginTop: "16px",
                  minHeight: "42px",
                  background: "#ef4444",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "700",
                  color: "#ffffff",
                  cursor: "pointer",
                }}
              >
                ⏹ Stop Camera
              </button>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
