import { Frame, Landmark } from "../lib/Model";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    DrawingUtils,
    FilesetResolver,
    GestureRecognizer,
} from "@mediapipe/tasks-vision";

type VideoFeedProps = {
    onRecordFinish: (frames: Frame[]) => void;
    onFrame: (frame: Frame) => void;
    record: boolean;
    showLandmark: boolean;
    showVideo: boolean;
};


export default function VideoFeed({
    onRecordFinish,
    onFrame,
    record,
    showLandmark,
    showVideo,
}: VideoFeedProps) {
    const gestureRecognizerRef = useRef<GestureRecognizer | null>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    const isFrameValid = useRef(false);
    const currentLandmarks = useRef<Landmark[]>([]);

    const showLandmarkRef = useRef(showLandmark);
    const showVideoRef = useRef(showVideo);

    const prevRecordRef = useRef(false);
    const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const captureTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const [isInitialized, setIsInitialized] = useState(false);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [aspectRatio, setAspectRatio] = useState<number | null>(null);
    const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null);

    useEffect(() => {
        showLandmarkRef.current = showLandmark;
    }, [showLandmark]);

    useEffect(() => {
        showVideoRef.current = showVideo;
    }, [showVideo]);

    useEffect(() => {
        const setupVideoStream = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: false,
                });

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;

                    videoRef.current.onloadedmetadata = () => {
                        const video = videoRef.current!;
                        const w = video.videoWidth;
                        const h = video.videoHeight;
                        setVideoDimensions({ width: w, height: h });
                        setAspectRatio(w / h);
                        video.play();
                    };
                }
            } catch (error) {
                console.error("Failed to get video stream:", error);
            }
        };

        setupVideoStream();
    }, []);

    useEffect(() => {
        if (!videoDimensions) return;
        if (gestureRecognizerRef.current) return;

        const initializeRecognizer = async () => {
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

            gestureRecognizerRef.current = gestureRecognizer;
            setIsInitialized(true);

            const video = videoRef.current!;
            const canvas = canvasRef.current!;
            const ctx = canvas.getContext("2d")!;
            let lastWebcamTime = -1;

            const renderLoop = async () => {
                if (video.currentTime === lastWebcamTime) {
                    requestAnimationFrame(renderLoop);
                    return;
                }
                lastWebcamTime = video.currentTime;

                const result = gestureRecognizer.recognizeForVideo(video, performance.now());

                ctx.clearRect(0, 0, videoDimensions.width, videoDimensions.height);

                if (showVideoRef.current)
                    ctx.drawImage(video, 0, 0, videoDimensions.width, videoDimensions.height);

                const landmarks = result?.landmarks?.[0] ?? null;

                if (landmarks) {
                    isFrameValid.current = true;
                    if (showLandmarkRef.current) {
                        const drawingUtils = new DrawingUtils(ctx);
                        drawingUtils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, {
                            color: "#00FF00",
                            lineWidth: 2,
                        });
                        drawingUtils.drawLandmarks(landmarks, {
                            color: "#FF0000",
                            radius: 2
                        });
                    }

                    const image = canvas.toDataURL("image/png");
                    const frame = {
                        image,
                        landmarks: landmarks.map(({ x, y, z }) => [x, y, z]) as Landmark[],
                    };

                    currentLandmarks.current = frame.landmarks;
                    onFrame(frame);
                } else {
                    isFrameValid.current = false;
                }

                requestAnimationFrame(renderLoop);
            };

            renderLoop();
        };

        initializeRecognizer();
    }, [videoDimensions, onFrame]);

    const beginCapture = useCallback(() => {
        const captureInterval = 100; // ms
        const duration = 5000; // ms
        const frames: Frame[] = [];

        const capture = () => {
            if (isFrameValid.current && currentLandmarks.current.length > 0) {
                const image = canvasRef.current!.toDataURL("image/png");
                frames.push({ image, landmarks: currentLandmarks.current });
            }
        };

        captureIntervalRef.current = setInterval(capture, captureInterval);

        captureTimeoutRef.current = setTimeout(() => {
            if (captureIntervalRef.current) {
                clearInterval(captureIntervalRef.current);
                captureIntervalRef.current = null;
            }
            onRecordFinish(frames);
        }, duration);
    }, [onRecordFinish]);

    const abortRecording = useCallback(() => {
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
        }
        if (captureIntervalRef.current) {
            clearInterval(captureIntervalRef.current);
            captureIntervalRef.current = null;
        }
        if (captureTimeoutRef.current) {
            clearTimeout(captureTimeoutRef.current);
            captureTimeoutRef.current = null;
        }
        setCountdown(null);
    }, []);

    const startRecording = useCallback(() => {
        if (!canvasRef.current) return;

        let count = 3;
        setCountdown(count);

        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

        countdownIntervalRef.current = setInterval(() => {
            count--;
            setCountdown(count);

            if (count === 0) {
                if (countdownIntervalRef.current) {
                    clearInterval(countdownIntervalRef.current);
                    countdownIntervalRef.current = null;
                }
                setCountdown(null);
                beginCapture();
            }
        }, 1000);
    }, [beginCapture]);

    useEffect(() => {
        if (record != prevRecordRef.current) {
            if (record) {
                startRecording();
            } else {
                abortRecording();
            }
        }
        prevRecordRef.current = record;
    }, [record, startRecording, abortRecording]);

    return (
        <div
            className="relative h-full mx-auto"
            style={{
                aspectRatio: aspectRatio ? aspectRatio.toFixed(4) : undefined,
            }}
        >
            {/* Hidden video for MediaPipe input */}
            <video
                ref={videoRef}
                style={{ display: "none" }}
                muted
                playsInline
            />

            {/* Canvas */}
            <canvas
                ref={canvasRef}
                width={videoDimensions?.width ?? 640}
                height={videoDimensions?.height ?? 480}
                className="absolute top-0 left-0 w-full h-full"
                style={{
                    display: isInitialized ? "block" : "none",
                }}
            />

            {/* Loading animation*/}
            {!isInitialized && (
                <div
                    className="absolute top-0 left-0 w-full h-full flex items-center justify-center"
                    style={{ backgroundColor: "rgba(128, 128, 128, 0.8)", zIndex: 50 }}
                >
                    <svg
                        className="animate-spin h-12 w-12 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        ></circle>
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                        ></path>
                    </svg>
                </div>
            )}

            {/* Countdown overlay */}
            {isInitialized && countdown !== null && (
                <div
                    className="absolute top-0 left-0 flex items-center justify-center"
                    style={{
                        width: "100%",
                        height: "100%",
                        backgroundColor: "rgba(0, 0, 0, 0.5)",
                        color: "white",
                        fontSize: "5rem",
                        fontWeight: "bold",
                        zIndex: 10,
                    }}
                >
                    {countdown}
                </div>
            )}
        </div>
    );
}