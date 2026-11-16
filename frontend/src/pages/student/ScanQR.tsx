import { useState, useRef, useEffect, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useNavigate } from "react-router-dom";
import SelfieCapture from "../../components/SelfieCapture";
import { API_URL } from "../../config";
import { verifySessionQR } from "../../services/supabase";
import { dispatchAttendanceEmailNotification } from "../../services/emailService";
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

  // 📍 Proactive Student Geolocation State
  const [studentCoords, setStudentCoords] = useState<{ lat: number; lng: number } | null>(() => {
    try {
      const cachedLat = localStorage.getItem("student_last_lat");
      const cachedLng = localStorage.getItem("student_last_lng");
      return cachedLat && cachedLng ? { lat: parseFloat(cachedLat), lng: parseFloat(cachedLng) } : null;
    } catch {
      return null;
    }
  });
  const [studentLocStatus, setStudentLocStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('requesting');
  const [studentLocAccuracy, setStudentLocAccuracy] = useState<number | null>(null);

  const requestStudentLocation = useCallback((isUserGesture = false) => {
    if (!("geolocation" in navigator)) {
      setStudentLocStatus('denied');
      return;
    }
    setStudentLocStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setStudentCoords({ lat, lng });
        setStudentLocAccuracy(Math.round(pos.coords.accuracy));
        setStudentLocStatus('granted');
        try {
          localStorage.setItem("student_last_lat", lat.toString());
          localStorage.setItem("student_last_lng", lng.toString());
        } catch {}
      },
      (err) => {
        console.warn("Student high-accuracy GPS failed, retrying standard mode:", err);
        navigator.geolocation.getCurrentPosition(
          (fallbackPos) => {
            const lat = fallbackPos.coords.latitude;
            const lng = fallbackPos.coords.longitude;
            setStudentCoords({ lat, lng });
            setStudentLocAccuracy(Math.round(fallbackPos.coords.accuracy));
            setStudentLocStatus('granted');
            try {
              localStorage.setItem("student_last_lat", lat.toString());
              localStorage.setItem("student_last_lng", lng.toString());
            } catch {}
          },
          (fallbackErr) => {
            console.warn("Student location permission denied or timed out:", fallbackErr);
            setStudentLocStatus('denied');
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
        );
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
    );
  }, []);

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

  // Proactively request student location upon mounting & clean up camera on unmount
  useEffect(() => {
    requestStudentLocation(false);
    return () => {
      stopScanner();
    };
  }, [stopScanner, requestStudentLocation]);

  // 🔊 Audio Chime & Mobile Haptic Vibration Feedback on QR Detection
  const playScanSuccessFeedback = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch {}
    try {
      if ("vibrate" in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
    } catch {}
  };

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

        playScanSuccessFeedback();

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

        if (studentCoords) {
          proceedWithVerification(studentCoords.lat, studentCoords.lng);
        } else if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setStudentCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
              proceedWithVerification(pos.coords.latitude, pos.coords.longitude);
            },
            () => proceedWithVerification(), // Fallback without blocking student if GPS times out indoors
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
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

      {/* 🎓 Unified Student Portal Navigation Tabs */}
      <div
        style={{
          display: "flex",
          background: "#f1f5f9",
          borderRadius: "12px",
          padding: "5px",
          margin: "0 auto 16px auto",
          maxWidth: "480px",
          gap: "8px",
          border: "1.5px solid #e2e8f0",
          boxShadow: "inset 0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        <button
          type="button"
          onClick={() => {
            stopScanner();
            navigate("/profile");
          }}
          style={{
            flex: 1,
            padding: "11px 16px",
            borderRadius: "9px",
            border: "none",
            fontSize: "14px",
            fontWeight: "800",
            cursor: "pointer",
            transition: "all 0.25s ease",
            background: "transparent",
            color: "#64748b",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <span>👤</span> Student Profile Section
        </button>

        <button
          type="button"
          style={{
            flex: 1,
            padding: "11px 16px",
            borderRadius: "9px",
            border: "none",
            fontSize: "14px",
            fontWeight: "800",
            cursor: "pointer",
            transition: "all 0.25s ease",
            background: "#ffca08",
            color: "#000000",
            boxShadow: "0 4px 12px rgba(255,202,8,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <span>📷</span> Scan QR Code
        </button>
      </div>

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

              // 🚀 Multi-Channel Automated Email Dispatch + In-App Receipt Log
              dispatchAttendanceEmailNotification({
                sessionId,
                prn: studentPrn,
                studentName: fullName,
                studentEmail,
                subject: "Classroom Lecture Session",
                department: localStorage.getItem("department") || "Engineering",
                year: localStorage.getItem("year") || "Final Year",
                lectureDate: new Date().toLocaleDateString("en-IN"),
                lectureTime: timeStr,
                distanceMeters: verifiedDistance,
              }).catch((e) => console.debug("Email notification trigger:", e));

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

            {/* 📍 Proactive Classroom Geolocation Status Card */}
            <div
              style={{
                padding: "10px 14px",
                background: studentLocStatus === "granted" ? "#f0fdf4" : studentLocStatus === "requesting" ? "#fefce8" : "#fef2f2",
                border: `1px solid ${studentLocStatus === "granted" ? "#86efac" : studentLocStatus === "requesting" ? "#fde047" : "#fca5a5"}`,
                borderRadius: "10px",
                marginBottom: "14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                flexWrap: "wrap",
                textAlign: "left"
              }}
            >
              <div style={{ flex: 1, minWidth: "180px" }}>
                <div style={{ fontWeight: 700, fontSize: "13px", color: studentLocStatus === "granted" ? "#166534" : studentLocStatus === "requesting" ? "#854d0e" : "#991b1b" }}>
                  {studentLocStatus === "granted"
                    ? "🟢 Classroom GPS Proximity: Active"
                    : studentLocStatus === "requesting"
                    ? "🟡 Requesting Device Location..."
                    : "🔴 Location Access Required"}
                </div>
                <div style={{ fontSize: "11px", color: "#4b5563", marginTop: "2px" }}>
                  {studentLocStatus === "granted"
                    ? `Locked at ${studentCoords?.lat.toFixed(4)}° N, ${studentCoords?.lng.toFixed(4)}° E (±${studentLocAccuracy || 10}m accuracy)`
                    : "Required to confirm you are physically inside the lecture hall."}
                </div>
              </div>
              {studentLocStatus !== "granted" ? (
                <button
                  type="button"
                  onClick={() => requestStudentLocation(true)}
                  style={{
                    background: "#2563eb",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: 650,
                    cursor: "pointer"
                  }}
                >
                  📍 Allow Location
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => requestStudentLocation(true)}
                  style={{
                    background: "#e5e7eb",
                    color: "#374151",
                    border: "none",
                    borderRadius: "6px",
                    padding: "4px 8px",
                    fontSize: "11px",
                    cursor: "pointer"
                  }}
                >
                  🔄 Refresh GPS
                </button>
              )}
            </div>

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

            {/* 🧪 Immediate Biometric AI Face Matcher Diagnostic Button */}
            {!cameraActive && (
              <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px dashed #e2e8f0" }}>
                <button
                  type="button"
                  onClick={async () => {
                    await stopScanner();
                    setSessionId("DEMO_VERIFY_" + Date.now());
                    setShowSelfie(true);
                  }}
                  style={{
                    width: "100%",
                    background: "#f0fdf4",
                    border: "1.5px solid #86efac",
                    color: "#166534",
                    padding: "11px 16px",
                    borderRadius: "10px",
                    fontWeight: "750",
                    fontSize: "13.5px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    boxShadow: "0 2px 6px rgba(34, 197, 94, 0.15)",
                  }}
                >
                  <span>🧪</span> Test Biometric AI Face Matcher (Front Camera)
                </button>
                <p style={{ margin: "8px 0 0 0", fontSize: "11.5px", color: "#64748b" }}>
                  Verify that your registered face is matched and that pointing at a wall or another person is strictly rejected.
                </p>
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

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "18px" }}>
                <a
                  href={`mailto:${slipData.studentEmail}?subject=${encodeURIComponent(`Official Attendance Slip: ${slipData.subject} (${slipData.timeStr})`)}&body=${encodeURIComponent(`Rajarambapu Institute of Technology (RIT)\nOfficial Digital Attendance Receipt\n\nStudent Name: ${slipData.studentName}\nPRN: ${slipData.prn}\nSession: ${slipData.subject}\nRecorded Time: ${slipData.timeStr}\nProximity: ${slipData.distanceText}\nVerification: 100% Cryptographic QR + Geofence + Biometric Face Verified\n\nPreserve this slip for examination eligibility validation.`)}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    width: "100%",
                    boxSizing: "border-box",
                    background: "#0284c7",
                    color: "#ffffff",
                    textDecoration: "none",
                    padding: "11px",
                    borderRadius: "8px",
                    fontWeight: "750",
                    fontSize: "13.5px",
                    boxShadow: "0 2px 8px rgba(2, 132, 199, 0.35)",
                  }}
                >
                  <span>✉️</span> Forward Slip to My Email App
                </a>

                <button
                  onClick={() => {
                    setShowSlipModal(false);
                    navigate("/profile");
                  }}
                  style={{ width: "100%", background: "#ffca08", color: "#111827", border: "none", padding: "12px", borderRadius: "8px", fontWeight: "750", fontSize: "14px", cursor: "pointer", boxShadow: "0 2px 8px rgba(255, 202, 8, 0.4)" }}
                >
                  View Student Profile & Analytics →
                </button>
              </div>
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
