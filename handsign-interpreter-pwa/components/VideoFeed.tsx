import { useEffect, useRef, useState } from 'react';
import {
    DrawingUtils,
    FilesetResolver,
    GestureRecognizer,
} from '@mediapipe/tasks-vision';
import { Frame, Landmark } from '../lib/Model';

type VideoFeedProps = {
    onRecordFinish: (frames: Frame[]) => void;
    onFrame: (frame: Frame) => void;
    record: boolean;
    width: number;
    height: number;
};

export default function VideoFeed({
    onRecordFinish,
    onFrame,
    record,
    width,
    height,
}: VideoFeedProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const gestureRecognizerRef = useRef<GestureRecognizer | null>(null);
    const currentLandmarks = useRef<Landmark[]>([]);
    const isFrameValid = useRef(false);

    const [isInitialized, setIsInitialized] = useState(false);
    const [countdown, setCountdown] = useState<number | null>(null);

    useEffect(() => {
        prepareVideoStream();
    }, []);

    useEffect(() => {
        if (record) {
            startRecording();
        }
    }, [record]);

    const prepareVideoStream = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width, height },
                audio: false,
            });

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
                videoRef.current.addEventListener('loadeddata', () => {
                    console.log('Video stream ready.');
                    process();
                });
            }
        } catch (err) {
            console.error('Failed to get video stream:', err);
        }
    };

    const process = async () => {
        if (gestureRecognizerRef.current) {
            console.log('Gesture recognizer already initialized.');
            return;
        }

        console.log('Initializing gesture recognizer...');
        const vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        const gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath:
                    'https://storage.googleapis.com/mediapipe-tasks/gesture_recognizer/gesture_recognizer.task',
                delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numHands: 2,
        });

        gestureRecognizerRef.current = gestureRecognizer;
        console.log('Gesture recognizer initialized.');
        setIsInitialized(true);


        const video = videoRef.current!;
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        let lastWebcamTime = -1;

        const renderLoop = async () => {
            if (video.currentTime === lastWebcamTime) {
                requestAnimationFrame(renderLoop);
                return;
            }

            lastWebcamTime = video.currentTime;

            const result = gestureRecognizer.recognizeForVideo(video, performance.now());

            ctx.drawImage(video, 0, 0, width, height);

            const landmarks = result?.landmarks?.[0] ?? null;

            if (landmarks) {
                isFrameValid.current = true;
                const drawingUtils = new DrawingUtils(ctx);
                drawingUtils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, {
                    color: '#00FF00',
                    lineWidth: 2,
                });
                drawingUtils.drawLandmarks(landmarks, {
                    color: '#FF0000',
                    lineWidth: 0.01,
                });

                const image = canvas.toDataURL('image/png');
                const frame = {
                    image,
                    landmarks: landmarks.map(({ x, y, z }) => [x, y, z]) as Landmark[],
                };

                currentLandmarks.current = frame.landmarks;
                onFrame(frame);
            } else isFrameValid.current = false;

            requestAnimationFrame(renderLoop);
        };

        renderLoop();
    };

    const startRecording = async () => {
        if (!canvasRef.current) return;
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

    const beginCapture = () => {
        console.log('Beginning capture...');
        const captureInterval = 100; // in ms
        const duration = 5000; // in ms
        const frames: Frame[] = [];

        const capture = () => {
            if (isFrameValid.current) {
                if (currentLandmarks.current.length === 0) return;
                const image = canvasRef.current!.toDataURL('image/png');
                frames.push({ image, landmarks: currentLandmarks.current });
            }
        };

        const intervalId = setInterval(capture, captureInterval);

        setTimeout(() => {
            clearInterval(intervalId);
            console.log(`Recorded ${frames.length} frames.`);
            onRecordFinish(frames);
        }, duration);
    };

    return (
        <div className="relative w-fit">
            {/* Hidden video feed */}
            <video ref={videoRef} style={{ display: 'none' }} playsInline muted />

            {/* Visible canvas */}
            <canvas ref={canvasRef} width={width} height={height} />

            {/* Loading... */}
            {!isInitialized && (
                <div
                    className="absolute top-0 left-0 flex items-center justify-center"
                    style={{
                        width,
                        height,
                        backgroundColor: '#888',
                    }}
                >
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-white border-opacity-70"></div>
                </div>
            )}


            {/* Transparent overlay for countdown */}
            {isInitialized && countdown !== null && (
                <div
                    className="absolute top-0 left-0 flex items-center justify-center"
                    style={{
                        width,
                        height,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        color: 'white',
                        fontSize: '5rem',
                        fontWeight: 'bold',
                    }}
                >
                    {countdown}
                </div>
            )}
        </div>
    );
}
