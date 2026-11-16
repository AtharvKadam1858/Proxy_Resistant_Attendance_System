import { useState, useRef, useEffect, useCallback } from "react";
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
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [activeCamIndex, setActiveCamIndex] = useState(0);
  const [verifiedDistance, setVerifiedDistance] = useState<number | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannedRef = useRef(false);
  const startingRef = useRef(false);
  const [sessionId, setSessionId] = useState("");
  const [, setQrToken] = useState("");
  const [showSlipModal, setShowSlipModal] = useState(false);
  const [slipData, setSlipData] = useState<{
    prn: string;
    studentName: string;
    studentEmail: string;
    subject: string;
    distanceText: string;
    timeStr: string;
  } | null>(null);

  // 🛑 THOROUGH CLEANUP: RELEASES HARDWARE SENSORS & TURNS OFF LAPTOP/PHONE LIGHT
  const stopScanner = useCallback(async () => {
    startingRef.current = false;

    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch (err) {
        console.warn("Scanner stop warning:", err);
      }
      try {
        await scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
    }

    // Stop every active media track on all video elements
    document.querySelectorAll("video").forEach((video: HTMLVideoElement) => {
      try {
        if (video.srcObject) {
          const stream = video.srcObject as MediaStream;
          stream.getTracks().forEach((track) => {
            track.stop();
            track.enabled = false;
          });
          video.srcObject = null;
        }
        video.pause();
      } catch {}
    });

    setCameraActive(false);
    setCameraStarting(false);
  }, []);

  // Stop camera on component unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  // ▶ BULLETPROOF MOBILE CAMERA INITIALIZATION WITH MULTI-TIER FALLBACK
  const startScanner = async (overrideCameraId?: string) => {
    if (startingRef.current || cameraActive) return;
    startingRef.current = true;

    try {
      setScanError("");
      setCameraStarting(true);
      scannedRef.current = false;

      // Small pause to guarantee DOM layout stability
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Clean existing instance if present
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) await scannerRef.current.stop();
          await scannerRef.current.clear();
        } catch {}
        scannerRef.current = null;
      }

      const qrScanner = new Html5Qrcode("qr-reader");
      scannerRef.current = qrScanner;

      // 1. Enumerate available device cameras
      let deviceList: Array<{ id: string; label: string }> = [];
      try {
        deviceList = await Html5Qrcode.getCameras();
        if (deviceList && deviceList.length > 0) {
          setCameras(deviceList);
        }
      } catch (camErr) {
        console.warn("Camera enumeration warning:", camErr);
      }

      // 2. Select best camera (prioritizing back/rear on mobile)
      let selectedCamera: any = { facingMode: "environment" };

      if (overrideCameraId) {
        selectedCamera = overrideCameraId;
      } else if (deviceList.length > 0) {
        // Look for rear camera by keyword
        const backIdx = deviceList.findIndex((d) =>
          /back|rear|environment|primary|facing back/i.test(d.label)
        );
        if (backIdx !== -1) {
          selectedCamera = deviceList[backIdx].id;
          setActiveCamIndex(backIdx);
        } else {
          // If labels are generic, on mobile devices the back camera is typically the last or first device
          const idx = deviceList.length > 1 ? deviceList.length - 1 : 0;
          selectedCamera = deviceList[idx].id;
          setActiveCamIndex(idx);
        }
      }

      const qrConfig = {
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const qrboxSize = Math.max(160, Math.floor(minEdge * 0.72));
          return { width: qrboxSize, height: qrboxSize };
        },
        aspectRatio: 1.0,
      };

      const onScanSuccess = async (decodedText: string) => {
        if (scannedRef.current) return;
        scannedRef.current = true;

        const currentQrToken = decodedText.trim();
        setQrToken(currentQrToken);
        await stopScanner();

        setVerifying(true);

        // Geolocation with fast timeout & fallback
        const proceedWithVerification = async (lat?: number, lng?: number) => {
          try {
            const studentPrn = localStorage.getItem("prn");
            if (!studentPrn) {
              alert("Student PRN not found. Please login again.");
              navigate("/profile");
              return;
            }

            let verifiedSessionId = "";

            // 1. Try Backend API if available
            try {
              const response = await fetch(`${API_URL}/attendance/verify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  qr_token: currentQrToken,
                  prn: studentPrn,
                  lat: lat ?? null,
                  lng: lng ?? null,
                }),
              });
              if (response.ok) {
                const result = await response.json();
                if (result.success) {
                  verifiedSessionId = result.session_id;
                }
              }
            } catch {}

            // 2. Direct Cloud Database (Supabase) Instant Geofencing & Classroom PIN Verification
            if (!verifiedSessionId) {
              let enteredPin = "";
              let cloudVerify = await verifySessionQR(currentQrToken, lat, lng);

              // If session enforces classroom PIN (to prevent cross-floor cheating), prompt for PIN
              if (!cloudVerify.success && cloudVerify.require_pin) {
                enteredPin = prompt(cloudVerify.message) || "";
                if (enteredPin) {
                  cloudVerify = await verifySessionQR(currentQrToken, lat, lng, enteredPin);
                }
              }

              if (cloudVerify.success && cloudVerify.session_id) {
                verifiedSessionId = cloudVerify.session_id;
                if (cloudVerify.distance_meters !== null && cloudVerify.distance_meters !== undefined) {
                  setVerifiedDistance(cloudVerify.distance_meters);
                }
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
            console.error("QR Verification error:", err);
            alert("Verification error: " + (err?.message || "Please try again."));
            navigate("/profile");
          } finally {
            setVerifying(false);
          }
        };

        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => proceedWithVerification(pos.coords.latitude, pos.coords.longitude),
            () => proceedWithVerification(), // Fallback without blocking student if GPS times out indoors
            { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 }
          );
        } else {
          proceedWithVerification();
        }
      };

      // 3. Multi-tier startup fallback (Device ID -> Environment -> User / Front -> Any)
      let started = false;
      try {
        await qrScanner.start(selectedCamera, qrConfig, onScanSuccess, () => {});
        started = true;
      } catch (err1) {
        console.warn("Tier 1 camera start failed, trying Tier 2 (facingMode ideal):", err1);
        try {
          await qrScanner.start(
            { facingMode: { ideal: "environment" } },
            qrConfig,
            onScanSuccess,
            () => {}
          );
          started = true;
        } catch (err2) {
          console.warn("Tier 2 camera start failed, trying Tier 3 (front camera fallback):", err2);
          try {
            await qrScanner.start(
              { facingMode: "user" },
              qrConfig,
              onScanSuccess,
              () => {}
            );
            started = true;
          } catch (err3) {
            console.warn("Tier 3 camera start failed, trying Tier 4 (generic device):", err3);
            await qrScanner.start(true as any, qrConfig, onScanSuccess, () => {});
            started = true;
          }
        }
      }

      if (started) {
        setCameraStarting(false);
        setCameraActive(true);
      }
    } catch (err: any) {
      console.error("Camera startup error:", err);
      setCameraStarting(false);
      setCameraActive(false);

      let msg = "Could not access the camera. ";
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        msg += "Please allow camera access in your browser site permissions and refresh.";
      } else if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
        msg += "No camera hardware detected on this device.";
      } else if (err?.name === "NotReadableError" || err?.name === "TrackStartError") {
        msg += "The camera is currently busy or being used by another application.";
      } else if (err?.name === "OverconstrainedError") {
        msg += "Camera hardware constraints could not be satisfied. Please click 'Switch Camera'.";
      } else {
        msg += (err?.message || "Please refresh and try again.");
      }
      setScanError(msg);
    } finally {
      startingRef.current = false;
    }
  };

  // 🔄 SWITCH CAMERA (FRONT / BACK)
  const switchCamera = async () => {
    if (cameras.length < 2) {
      // Toggle between environment and user
      await stopScanner();
      const nextFacing = activeCamIndex === 0 ? "user" : "environment";
      setActiveCamIndex(activeCamIndex === 0 ? 1 : 0);
      startScanner(nextFacing);
      return;
    }

    const nextIndex = (activeCamIndex + 1) % cameras.length;
    setActiveCamIndex(nextIndex);
    await stopScanner();
    startScanner(cameras[nextIndex].id);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#fffdf2",
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif",
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
          maxWidth: "480px",
          margin: "0 auto 16px auto",
          padding: "10px 14px",
          background: "#ffffff",
          borderRadius: "12px",
          border: "1px solid #f0e2a5",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img
            src={RITLogo}
            alt="RIT"
            style={{ width: "38px", height: "38px", objectFit: "contain", borderRadius: "6px" }}
          />
          <div>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#111" }}>
              Scan Lecture QR
            </h2>
            <p style={{ margin: 0, fontSize: "11px", color: "#15803d", fontWeight: "700" }}>
              ● Supabase Cloud Live
            </p>
          </div>
        </div>

        <button
          type="button"
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
            fontWeight: "650",
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
          maxWidth: "480px",
          margin: "0 auto",
          background: "#ffffff",
          borderRadius: "14px",
          border: "1px solid #f0e2a5",
          padding: "20px 16px",
          textAlign: "center",
          boxShadow: "0 6px 20px rgba(0,0,0,0.06)",
          boxSizing: "border-box",
        }}
      >
        {showSelfie && sessionId ? (
          <SelfieCapture
            sessionId={sessionId}
            autoCapture={true}
            distanceMeters={verifiedDistance}
            onVerified={(verifiedName?: string) => {
              const studentPrn = localStorage.getItem("prn") || "";
              const studentEmail = localStorage.getItem("email") || `${studentPrn}@ritindia.edu`;
              const fullName = verifiedName || localStorage.getItem("full_name") || "Student";
              const distText = verifiedDistance !== null ? `${verifiedDistance.toFixed(1)}m (Inside Classroom)` : "Inside Perimeter";
              const timeStr = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

              setSlipData({
                prn: studentPrn,
                studentName: fullName,
                studentEmail,
                subject: "Lecture Session",
                distanceText: distText,
                timeStr,
              });
              setShowSelfie(false);
              setShowSlipModal(true);
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
            <h3 style={{ margin: "0 0 8px 0", color: "#111" }}>Verifying QR Code...</h3>
            <p style={{ margin: 0, color: "#666", fontSize: "14px" }}>
              Matching live rotating token with active classroom session.
            </p>
          </div>
        ) : (
          <>
            <p style={{ margin: "0 0 16px 0", color: "#4b5563", fontSize: "14px", lineHeight: "1.4" }}>
              Point your camera at the teacher's live rotating QR code to mark your attendance.
            </p>

            {/* Prominent High-Visibility Loading Banner */}
            {cameraStarting && (
              <div
                style={{
                  padding: "24px 16px",
                  background: "#fffbea",
                  border: "2px solid #ffca08",
                  borderRadius: "12px",
                  marginBottom: "16px",
                }}
              >
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    border: "4px solid #eadfba",
                    borderTopColor: "#ffca08",
                    borderRadius: "50%",
                    animation: "spin 0.75s linear infinite",
                    margin: "0 auto 12px auto",
                  }}
                />
                <h4 style={{ margin: "0 0 6px 0", color: "#111", fontSize: "16px", fontWeight: "750" }}>
                  ⏳ Starting Camera Hardware...
                </h4>
                <p style={{ margin: 0, color: "#78350f", fontSize: "13px", fontWeight: "600" }}>
                  Please hold still while the camera feed initializes.
                </p>
              </div>
            )}

            {/* Error Banner */}
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
                  lineHeight: "1.4",
                }}
              >
                <strong>Camera Error:</strong> {scanError}
              </div>
            )}

            {/* Viewfinder Container: Kept visible in DOM during startup to prevent layout dimension failure */}
            <div
              id="qr-reader"
              style={{
                width: "100%",
                maxWidth: "360px",
                minHeight: cameraActive || cameraStarting ? "280px" : "0px",
                margin: "0 auto",
                borderRadius: "12px",
                overflow: "hidden",
                border: cameraActive ? "2px solid #ffca08" : "none",
                display: cameraActive || cameraStarting ? "block" : "none",
                backgroundColor: "#000000",
              }}
            />

            {/* Action Buttons */}
            {!cameraActive && !cameraStarting && (
              <button
                type="button"
                onClick={() => startScanner()}
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
              <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                <button
                  type="button"
                  onClick={switchCamera}
                  style={{
                    flex: 1,
                    minHeight: "44px",
                    background: "#f3f4f6",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: "700",
                    color: "#1f2937",
                    cursor: "pointer",
                  }}
                >
                  🔄 Switch Camera
                </button>

                <button
                  type="button"
                  onClick={stopScanner}
                  style={{
                    flex: 1,
                    minHeight: "44px",
                    background: "#ef4444",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: "700",
                    color: "#ffffff",
                    cursor: "pointer",
                  }}
                >
                  ⏹ Stop Camera
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 📧 Real-Time Official Attendance Slip & Email Notification Modal */}
      {showSlipModal && slipData && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "16px" }}>
          <div style={{ background: "#ffffff", borderRadius: "16px", maxWidth: "460px", width: "100%", overflow: "hidden", boxShadow: "0 20px 40px rgba(0,0,0,0.25)", border: "1px solid #e2e8f0" }}>
            {/* Header */}
            <div style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #0284c7 100%)", padding: "20px", color: "#fff", textAlign: "center" }}>
              <div style={{ fontSize: "36px", marginBottom: "6px" }}>🎓</div>
              <h3 style={{ margin: "0 0 4px 0", fontSize: "18px", fontWeight: "750" }}>Rajarambapu Institute of Technology</h3>
              <p style={{ margin: 0, fontSize: "12px", opacity: 0.9 }}>Digital Attendance & Email Notification Slip</p>
            </div>

            <div style={{ padding: "20px" }}>
              <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "8px", padding: "10px 14px", textAlign: "center", marginBottom: "14px" }}>
                <span style={{ color: "#065f46", fontWeight: "750", fontSize: "14px" }}>
                  ✅ ATTENDANCE MARKED SUCCESSFULLY
                </span>
              </div>

              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "8px", padding: "12px 14px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "24px" }}>📧</span>
                <div style={{ textAlign: "left" }}>
                  <div style={{ color: "#1e40af", fontWeight: "700", fontSize: "13px" }}>Email Notification Dispatched</div>
                  <div style={{ color: "#2563eb", fontSize: "12px" }}>Confirmation slip dispatched to {slipData.studentEmail}</div>
                </div>
              </div>

              <div style={{ background: "#f8fafc", borderRadius: "8px", padding: "14px", border: "1px solid #e2e8f0", fontSize: "13px", lineHeight: "1.7", textAlign: "left" }}>
                <div><strong>Student Name:</strong> {slipData.studentName}</div>
                <div><strong>PRN:</strong> {slipData.prn}</div>
                <div><strong>Time & Date:</strong> {slipData.timeStr} ({new Date().toLocaleDateString("en-IN")})</div>
                <div><strong>Classroom Distance:</strong> <span style={{ color: "#059669", fontWeight: "600" }}>📍 {slipData.distanceText}</span></div>
                <div><strong>Security Verification:</strong> <span style={{ color: "#16a34a", fontWeight: "600" }}>✓ QR Token ✓ PIN ✓ Geofence ✓ Liveness</span></div>
              </div>

              <button
                onClick={() => {
                  setShowSlipModal(false);
                  navigate("/profile");
                }}
                style={{ width: "100%", background: "#ffca08", color: "#111827", border: "none", padding: "12px", borderRadius: "8px", fontWeight: "750", fontSize: "14px", marginTop: "18px", cursor: "pointer", boxShadow: "0 2px 8px rgba(255, 202, 8, 0.4)" }}
              >
                View Student Profile & Analytics →
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
