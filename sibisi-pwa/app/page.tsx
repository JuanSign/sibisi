"use client";

import { useEffect, useRef, useState } from "react";
import {
  DrawingUtils,
  FilesetResolver,
  GestureRecognizer,
} from "@mediapipe/tasks-vision";
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';

const MODEL_PREFIX = "indexeddb://gesture-model/";

const createLSTMModel = () => {
  const model = tf.sequential();
  model.add(tf.layers.lstm({ inputShape: [10, 63], units: 64 }));
  model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 10, activation: 'softmax' }));

  model.compile({
    optimizer: tf.train.adam(),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });

  return model;
};

const preprocessFramesForLSTM = (
  frames: Frame[],
  sequenceLength: number,
  labelIndex: number
): { xs: tf.Tensor3D; ys: tf.Tensor2D } => {
  const sequences: number[][][] = [];
  const labels: number[] = [];

  for (let i = 0; i <= frames.length - sequenceLength; i++) {
    const seq = frames.slice(i, i + sequenceLength).map(frame => {
      const hand = frame.landmarks[0]; // only use first hand
      return hand.flatMap(p => [p.x, p.y, p.z]);
    });

    if (seq.length === sequenceLength) {
      sequences.push(seq);
      labels.push(labelIndex);
    }
  }

  const xs = tf.tensor3d(sequences); // shape: [numSamples, 10, 63]
  const oneHot = tf.oneHot(tf.tensor1d(labels, 'int32'), 10);
  const ys = oneHot as tf.Tensor2D; // ✅ Type assertion to Tensor2D

  return { xs, ys };
};

type Frame = {
  image: string; // base64 PNG
  landmarks: Array<Array<{ x: number; y: number; z: number }>>; // array of landmarks per hand
};

export default function GestureBox() {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [recordedFrames, setRecordedFrames] = useState<Frame[]>([]);
  const [selectedFrames, setSelectedFrames] = useState<Set<number>>(new Set());
  const [modelNames, setModelNames] = useState<string[]>([]);
  const [selectedModelName, setSelectedModelName] = useState<string | null>(null);
  const [tfModel, setTfModel] = useState<tf.LayersModel | null>(null);

  const framesPerSlide = 5;
  const totalSlides = Math.ceil(recordedFrames.length / framesPerSlide);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastScrollY = useRef(0);
  const slideRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const currentLandmarks = useRef<Array<Array<{ x: number; y: number; z: number }>>>([]);

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
      currentLandmarks.current = result.landmarks.length > 0 ? result.landmarks : [];

      if (result.landmarks.length != 0) {
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
    const frames: Frame[] = [];

    const capture = () => {
      if (currentLandmarks.current.length == 0) return
      const image = canvasRef.current!.toDataURL("image/png");
      const landmarks = currentLandmarks.current;
      frames.push({ image, landmarks });
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

  useEffect(() => {
    const loadModelList = async () => {
      const models = await tf.io.listModels();

      const names = Object.keys(models)
        .filter(k => k.startsWith(MODEL_PREFIX))
        .map(k => k.replace(MODEL_PREFIX, ""));

      setModelNames(names);
      if (names.length > 0 && !selectedModelName) {
        setSelectedModelName(names[0]);
      }
    };

    loadModelList();
  }, []);

  useEffect(() => {
    const loadSelectedModel = async () => {
      if (selectedModelName) {
        try {
          const model = await tf.loadLayersModel(`${MODEL_PREFIX}${selectedModelName}`);
          setTfModel(model);
        } catch (e) {
          console.error("Failed to load model:", e);
        }
      }
    };
    loadSelectedModel();
  }, [selectedModelName]);


  const handleCreateModel = async () => {
    const name = prompt("Enter model name:");
    if (!name) return;

    const model = createLSTMModel();
    await saveModelToIndexedDB(model, name);

    const updatedModels = await tf.io.listModels();
    const updatedNames = Object.keys(updatedModels)
      .filter(k => k.startsWith(MODEL_PREFIX))
      .map(k => k.replace(MODEL_PREFIX, ""));

    setModelNames(updatedNames);
    setSelectedModelName(name);
  };



  const saveModelToIndexedDB = async (model: tf.LayersModel, name: string) => {
    await model.save(`${MODEL_PREFIX}${name}`);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center py-8">
      <div className="mb-4 text-white">
        <label className="block mb-1 text-sm">Selected Model:</label>
        <div className="flex items-center gap-2">
          <select
            className="bg-gray-800 text-white px-2 py-1 rounded"
            value={selectedModelName ?? ""}
            onChange={(e) => setSelectedModelName(e.target.value)}
          >
            {modelNames.map(name => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button
            onClick={handleCreateModel}
            className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            Create New Model
          </button>
        </div>
      </div>

      {/* Model Indicator */}
      {!modelLoaded && (
        <p className="text-yellow-400 text-lg mb-4">Loading Gesture Detector...</p>
      )}
      {modelLoaded && (
        <p className="text-green-500 text-lg mb-4">Gesture Detector Ready</p>
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
                      src={frame.image}
                      alt={`Frame ${globalIndex}`}
                      className="w-full rounded"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-green-400 bg-opacity-30 rounded pointer-events-none" />
                    )}
                  </div>
                );
              })
            }
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
              onClick={async () => {
                const selectedImages = Array.from(selectedFrames).map(i => recordedFrames[i]);
                if (selectedImages.length < 10) {
                  alert("Please select at least 10 frames.");
                  return;
                }

                if (!tfModel || !selectedModelName) {
                  alert("No model is loaded.");
                  return;
                }

                const labelStr = prompt("Enter gesture label index (0–9):");
                if (labelStr === null) return;

                const labelIndex = parseInt(labelStr);
                if (isNaN(labelIndex) || labelIndex < 0 || labelIndex > 9) {
                  alert("Invalid label. Please enter a number between 0 and 9.");
                  return;
                }

                const { xs, ys } = preprocessFramesForLSTM(selectedImages, 10, labelIndex);
                await tfModel.fit(xs, ys, {
                  epochs: 5,
                  batchSize: 2,
                  callbacks: {
                    onEpochEnd: (epoch, logs) => {
                      console.log(`Epoch ${epoch + 1}`, logs);
                    },
                  },
                });

                await saveModelToIndexedDB(tfModel, selectedModelName);
                alert("✅ Model trained and saved.");
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
