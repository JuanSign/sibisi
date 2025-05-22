"use client";

import { useEffect, useRef, useState } from "react";
import {
  DrawingUtils,
  FilesetResolver,
  GestureRecognizer,
} from "@mediapipe/tasks-vision";

export default function GestureBox() {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [recordedFrames, setRecordedFrames] = useState<string[]>([]);
  const [selectedFrames, setSelectedFrames] = useState<Set<number>>(new Set());

  const framesPerSlide = 5;
  const totalSlides = Math.ceil(recordedFrames.length / framesPerSlide);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastScrollY = useRef(0);
  const slideRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const BOX_WIDTH = 640;
  const BOX_HEIGHT = 480;

  // Setup webcam
  const prepareVideoStream = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: BOX_WIDTH, height: BOX_HEIGHT },
      audio: false,
    });

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.addEventListener("loadeddata", () => {
        process();
      });
    }
  };

  // Main hand detection loop
  const process = async () => {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );

    const gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-tasks/gesture_recognizer/gesture_recognizer.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 2,
    });
    setModelLoaded(true);

    let lastWebcamTime = -1;
    const video = videoRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    const renderLoop = () => {
      if (video.currentTime === lastWebcamTime) {
        requestAnimationFrame(renderLoop);
        return;
      }

      lastWebcamTime = video.currentTime;
      const result = gestureRecognizer.recognizeForVideo(video, performance.now());

      ctx.drawImage(video, 0, 0, BOX_WIDTH, BOX_HEIGHT);

      if (result.landmarks) {
        result.landmarks.forEach((landmarks, handIndex) => {
          const drawingUtils = new DrawingUtils(ctx);
          drawingUtils.drawConnectors(
            landmarks,
            GestureRecognizer.HAND_CONNECTIONS,
            { color: "#00FF00", lineWidth: 2 }
          );
          drawingUtils.drawLandmarks(landmarks, {
            color: "#FF0000",
            lineWidth: 1,
          });
        });
      }

      requestAnimationFrame(renderLoop);
    };

    renderLoop();
  };

  // Record frames
  const beginCapture = () => {
    setIsRecording(true);
    setRecordedFrames([]);

    const captureInterval = 100;
    const duration = 5000;
    const frames: string[] = [];

    const capture = () => {
      const frame = canvasRef.current!.toDataURL("image/png");
      frames.push(frame);
    };

    const intervalId = setInterval(capture, captureInterval);

    setTimeout(() => {
      clearInterval(intervalId);
      setRecordedFrames(frames);
      setIsRecording(false);

      setTimeout(() => {
        slideRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }, duration);
  };
  const startRecording = async () => {
    if (!canvasRef.current) return;

    // 3-second countdown
    let count = 3;
    setCountdown(count);

    const countdownInterval = setInterval(() => {
      count--;
      setCountdown(count);

      if (count === 0) {
        clearInterval(countdownInterval);
        setCountdown(null);
        beginCapture();
      }
    }, 1000);
  };

  // Frame selection
  const toggleFrameSelection = (globalIndex: number) => {
    setSelectedFrames((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(globalIndex)) {
        newSet.delete(globalIndex);
      } else {
        newSet.add(globalIndex);
      }
      return newSet;
    });
  };

  // Effects
  useEffect(() => {
    prepareVideoStream();
  }, []);
  useEffect(() => {
    const timeout = setTimeout(() => {
      window.scrollTo({ top: lastScrollY.current });
    }, 50);

    return () => clearTimeout(timeout);
  }, [currentSlide]);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center py-8">
      {/* Model Indicator */}
      {!modelLoaded && (
        <p className="text-yellow-400 text-lg mb-4">Loading model...</p>
      )}
      {modelLoaded && (
        <p className="text-green-500 text-lg mb-4">Model Ready</p>
      )}

      {/* Countdown */}
      {countdown !== null && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 px-4 py-2 rounded text-white text-3xl font-bold">
          {countdown}
        </div>
      )}

      {/* Video and Canvas */}
      <div
        className="relative"
        style={{ width: BOX_WIDTH, height: BOX_HEIGHT }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          width={BOX_WIDTH}
          height={BOX_HEIGHT}
          className="absolute top-0 left-0"
          style={{ transform: "rotateY(180deg)" }}
        />
        <canvas
          ref={canvasRef}
          width={BOX_WIDTH}
          height={BOX_HEIGHT}
          className="absolute top-0 left-0 pointer-events-none"
          style={{ transform: "rotateY(180deg)" }}
        />
      </div>

      {/* Record Button */}
      <div className="mt-6">
        <button
          className="px-6 py-3 bg-blue-500 text-white text-lg font-medium rounded hover:bg-blue-600 transition"
          onClick={startRecording}
          disabled={isRecording}
        >
          {isRecording ? "Recording..." : "Record 5s"}
        </button>
      </div>

      {/* Recorded Frame Preview */}
      {recordedFrames.length > 0 && (
        <div ref={slideRef} className="mt-8 text-center w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 px-4 mb-4">
            {recordedFrames
              .slice(currentSlide * framesPerSlide, (currentSlide + 1) * framesPerSlide)
              .map((frame, idx) => {
                const globalIndex = currentSlide * framesPerSlide + idx;
                const isSelected = selectedFrames.has(globalIndex);
                return (
                  <div
                    key={globalIndex}
                    onClick={() => toggleFrameSelection(globalIndex)}
                    className={`relative cursor-pointer border-4 rounded shadow transition duration-200 ${isSelected ? "border-green-400" : "border-transparent"
                      }`}
                  >
                    <img
                      src={frame}
                      alt={`Frame ${globalIndex}`}
                      className="w-full rounded"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-green-400 bg-opacity-30 rounded pointer-events-none" />
                    )}
                  </div>
                );
              })}
          </div>
          <button
            onClick={() => {
              lastScrollY.current = window.scrollY;
              setCurrentSlide((s) => Math.max(s - 1, 0));
            }}
            disabled={currentSlide === 0}
            className="px-4 py-2 bg-gray-600 text-white rounded disabled:opacity-50"
          >
            Prev
          </button>

          <button
            onClick={() => {
              lastScrollY.current = window.scrollY;
              setCurrentSlide((s) => Math.min(s + 1, totalSlides - 1));
            }}
            disabled={currentSlide >= totalSlides - 1}
            className="px-4 py-2 bg-gray-600 text-white rounded disabled:opacity-50"
          >
            Next
          </button>

          <div className="flex justify-between items-center mt-4 px-4">
            <span className="text-white text-sm">
              Selected: {selectedFrames.size} / {recordedFrames.length}
            </span>
            <button
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              onClick={() => {
                const selectedImages = Array.from(selectedFrames).map(i => recordedFrames[i]);
                console.log("✅ Selected Frames:", selectedImages);
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
