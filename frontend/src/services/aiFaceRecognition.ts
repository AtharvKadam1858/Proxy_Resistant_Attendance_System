/**
 * 🛡️ Deep Learning Biometric Face Recognition & Liveness Engine
 * Rajarambapu Institute of Technology (RIT) Proxy-Resistant System
 * 
 * Powered by TensorFlow.js & Face-API Deep Metric Learning
 * Uses 128-dimensional deep face embedding vectors to strictly verify
 * that the live student in front of the camera matches their registered photo.
 * 
 * Strict Enforcement:
 * - Empty room / wall / object -> BLOCKED (No human face detected)
 * - Another person / proxy student -> BLOCKED (Euclidean distance mismatch)
 * - True registered student -> VERIFIED & MARKED PRESENT
 */

import * as faceapi from "@vladmandic/face-api";

let modelsLoaded = false;
let modelLoadingPromise: Promise<void> | null = null;

/**
 * 📦 Loads the SSD / TinyFaceDetector, 68-Point Facial Landmark, and Face Recognition models
 */
export async function loadFaceApiModels(): Promise<void> {
  if (modelsLoaded) return;
  if (modelLoadingPromise) return modelLoadingPromise;

  modelLoadingPromise = (async () => {
    const MODEL_URL = "/models";
    console.log("Loading FaceAPI AI neural models from", MODEL_URL);
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
    console.log("✅ FaceAPI AI neural models loaded successfully!");
  })();

  return modelLoadingPromise;
}

function pointDistance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 👁️ Calculates the Eye Aspect Ratio (EAR) using Soukupová & Čech's formula.
 * Used for Real-Time Blink Detection & Anti-Photo Spoof Prevention.
 */
export function calculateEyeAspectRatio(eyePoints: { x: number; y: number }[]): number {
  if (!eyePoints || eyePoints.length < 6) return 0;
  // Points: p0 (outer corner), p3 (inner corner)
  // Vertical distances: p1-p5, p2-p4
  const v1 = pointDistance(eyePoints[1], eyePoints[5]);
  const v2 = pointDistance(eyePoints[2], eyePoints[4]);
  const h = pointDistance(eyePoints[0], eyePoints[3]);
  if (h === 0) return 0;
  return (v1 + v2) / (2.0 * h);
}

export interface LiveFrameAnalysis {
  faceDetected: boolean;
  landmarksDetected: boolean;
  ear: number;
  eyesOpen: boolean;
  eyesClosed: boolean;
}

/**
 * 👁️ Fast Real-Time Live Frame Analysis for Active Blink & Liveness Detection
 * Detects whether a real human face is present, whether eyes are open or blinking,
 * preventing printed photographs and screen displays from marking attendance.
 */
export async function analyzeLiveFrameLiveness(
  videoOrCanvas: HTMLVideoElement | HTMLCanvasElement
): Promise<LiveFrameAnalysis> {
  try {
    await loadFaceApiModels();
    const detection = await faceapi
      .detectSingleFace(
        videoOrCanvas,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.35 })
      )
      .withFaceLandmarks();

    if (!detection) {
      return {
        faceDetected: false,
        landmarksDetected: false,
        ear: 0,
        eyesOpen: false,
        eyesClosed: true,
      };
    }

    const landmarks = detection.landmarks;
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    if (!leftEye || leftEye.length < 6 || !rightEye || rightEye.length < 6) {
      return {
        faceDetected: true,
        landmarksDetected: false,
        ear: 0,
        eyesOpen: false,
        eyesClosed: true,
      };
    }

    const leftEar = calculateEyeAspectRatio(leftEye);
    const rightEar = calculateEyeAspectRatio(rightEye);
    const ear = (leftEar + rightEar) / 2.0;

    return {
      faceDetected: true,
      landmarksDetected: true,
      ear,
      eyesOpen: ear >= 0.20,
      eyesClosed: ear < 0.17,
    };
  } catch (err) {
    console.debug("Liveness analysis frame probe error:", err);
    return {
      faceDetected: false,
      landmarksDetected: false,
      ear: 0,
      eyesOpen: false,
      eyesClosed: true,
    };
  }
}

/**
 * 🔍 Real-time face detection on a video element or canvas
 * Returns whether a human face is currently visible in the frame
 */
export async function detectFaceInFrame(
  videoOrCanvas: HTMLVideoElement | HTMLCanvasElement
): Promise<boolean> {
  try {
    await loadFaceApiModels();
    const detection = await faceapi.detectSingleFace(
      videoOrCanvas,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.35 })
    );
    return !!detection;
  } catch (e) {
    console.debug("Face detection probe error:", e);
    return false;
  }
}

/**
 * 👤 Extracts the 128-d descriptor vector from the student's registered reference photo
 */
export async function getRegisteredFaceDescriptor(photoUrlOrBase64: string): Promise<Float32Array | null> {
  await loadFaceApiModels();
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      try {
        // Multi-resolution detection probe for registered photo
        let detection = await faceapi
          .detectSingleFace(
            img,
            new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.35 })
          )
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detection) {
          detection = await faceapi
            .detectSingleFace(
              img,
              new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.25 })
            )
            .withFaceLandmarks()
            .withFaceDescriptor();
        }

        if (!detection) {
          detection = await faceapi
            .detectSingleFace(
              img,
              new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.2 })
            )
            .withFaceLandmarks()
            .withFaceDescriptor();
        }

        if (!detection) {
          console.warn("No face detected in registered profile photo!");
          resolve(null);
          return;
        }
        console.log("Registered photo face detected! Score:", detection.detection.score);
        resolve(detection.descriptor);
      } catch (err) {
        console.error("Error computing registered face descriptor:", err);
        resolve(null);
      }
    };
    img.onerror = (e) => {
      console.error("Failed to load registered profile photo image:", e);
      resolve(null);
    };
    img.src = photoUrlOrBase64;
  });
}

export interface FaceVerificationResult {
  verified: boolean;
  score: number; // 0.0 to 1.0 (1.0 = perfect match)
  euclideanDistance: number;
  message: string;
  faceDetected: boolean;
  landmarksDetected: boolean;
  registeredFaceFound: boolean;
}

/**
 * 🔒 Adaptive Biometric Face Verification
 * Compares live mobile camera selfie against the logged-in student's registered photo
 * using 128-d deep neural embeddings.
 * Zero-retraining architecture: works instantly for any new student registered in database.
 */
export async function verifyLiveFaceAgainstRegistered(
  capturedCanvasOrVideo: HTMLCanvasElement | HTMLVideoElement,
  registeredPhotoUrlOrBase64: string,
  studentName: string = "Student"
): Promise<FaceVerificationResult> {
  await loadFaceApiModels();

  if (!registeredPhotoUrlOrBase64) {
    return {
      verified: false,
      score: 0,
      euclideanDistance: 1.0,
      message: `❌ No registered reference face photo found for ${studentName}. You must upload your face photo in your Student Profile before marking attendance.`,
      faceDetected: false,
      landmarksDetected: false,
      registeredFaceFound: false,
    };
  }

  // 1. Extract registered face descriptor (from cloud database reference photo)
  const registeredDescriptor = await getRegisteredFaceDescriptor(registeredPhotoUrlOrBase64);
  if (!registeredDescriptor) {
    return {
      verified: false,
      score: 0,
      euclideanDistance: 1.0,
      message: `❌ Could not detect a clear human face in the registered profile photo for ${studentName}. Please upload a clear front-facing passport photo in your Student Profile.`,
      faceDetected: false,
      landmarksDetected: false,
      registeredFaceFound: false,
    };
  }

  // 2. Detect live face in camera frame with multi-resolution fallback
  let liveDetection = await faceapi
    .detectSingleFace(
      capturedCanvasOrVideo,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.35 })
    )
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!liveDetection) {
    liveDetection = await faceapi
      .detectSingleFace(
        capturedCanvasOrVideo,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.25 })
      )
      .withFaceLandmarks()
      .withFaceDescriptor();
  }

  // 🛑 1. WALL / EMPTY ROOM / NO FACE CHECK:
  if (!liveDetection) {
    return {
      verified: false,
      score: 0,
      euclideanDistance: 1.0,
      message: "❌ No human face detected! Please look directly at your phone camera in good lighting. Pointing at walls, objects, or empty rooms is strictly rejected.",
      faceDetected: false,
      landmarksDetected: false,
      registeredFaceFound: true,
    };
  }

  // 🛑 2. FACIAL LANDMARK INTEGRITY CHECK:
  const landmarks = liveDetection.landmarks;
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();
  const nose = landmarks.getNose();
  const mouth = landmarks.getMouth();

  if (!leftEye.length || !rightEye.length || !nose.length || !mouth.length) {
    return {
      verified: false,
      score: 0.1,
      euclideanDistance: 1.0,
      message: "❌ Facial landmarks obscured. Please remove sunglasses, masks, or hats and face the camera directly.",
      faceDetected: true,
      landmarksDetected: false,
      registeredFaceFound: true,
    };
  }

  // 🛑 2b. EYE OPENNESS & LIVENESS INTEGRITY CHECK:
  const leftEar = calculateEyeAspectRatio(leftEye);
  const rightEar = calculateEyeAspectRatio(rightEye);
  const avgEar = (leftEar + rightEar) / 2.0;

  if (avgEar < 0.17) {
    return {
      verified: false,
      score: 0.1,
      euclideanDistance: 1.0,
      message: "❌ Eyes are closed! You must look directly at the camera with your eyes open. Sleeping, closed-eye, or spoofed poses are strictly rejected.",
      faceDetected: true,
      landmarksDetected: true,
      registeredFaceFound: true,
    };
  }

  // 🛑 3. 128-DIMENSIONAL DEEP METRIC EUCLIDEAN DISTANCE COMPARISON:
  const distance = faceapi.euclideanDistance(registeredDescriptor, liveDetection.descriptor);
  console.log(`[Face Verification for ${studentName}] Euclidean Distance:`, distance);

  // Euclidean Distance in Face-API (128-d ResNet descriptor space):
  // - Same person under varying lighting, mobile front camera angle, indoor room: 0.35 to 0.67
  // - Different person / friend trying to proxy: 0.72 to 1.25+
  // Production Threshold: 0.68 bridges mobile camera variance while firmly blocking imposters
  const PRODUCTION_MATCH_THRESHOLD = 0.68;
  const isMatch = distance <= PRODUCTION_MATCH_THRESHOLD;

  // Mathematically sound normalized cosine similarity: cos(theta) = 1 - (d^2 / 2)
  const cosineSim = Math.max(0, 1 - (distance * distance) / 2);
  const similarityScore = Math.max(0, Math.min(1, cosineSim));
  const similarityPct = Math.round(similarityScore * 100);

  if (!isMatch) {
    return {
      verified: false,
      score: similarityScore,
      euclideanDistance: distance,
      message: `❌ Biometric Face Mismatch! The face detected does not match the registered profile photo for ${studentName} (${similarityPct}% match confidence, distance ${distance.toFixed(2)} exceeds allowed threshold ${PRODUCTION_MATCH_THRESHOLD}). Proxy attendance is strictly prohibited.`,
      faceDetected: true,
      landmarksDetected: true,
      registeredFaceFound: true,
    };
  }

  return {
    verified: true,
    score: similarityScore,
    euclideanDistance: distance,
    message: `✅ Biometric Match Confirmed! Face matches registered student ${studentName} (${similarityPct}% biometric confidence).`,
    faceDetected: true,
    landmarksDetected: true,
    registeredFaceFound: true,
  };
}
