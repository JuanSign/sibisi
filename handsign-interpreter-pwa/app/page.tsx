"use client";
import { useEffect, useRef, useState } from "react";

import { Frame, Model } from "@/lib/Model";
import { saveModel } from "@/lib/IndexedDB";

import { FrameSelector } from "@/components/FrameSelector";
import BufferPreview from "@/components/BufferPreview";
import ModelSelector from "@/components/ModelSelector";
import PredictionViewer from "@/components/PredictionViewer";
import VideoFeed from "@/components/VideoFeed";

type ToggleButtonProps = {
  label: string;
  active: boolean;
  onClick: () => void;
};

const ToggleButton = ({ label, active, onClick }: ToggleButtonProps) => (
  <button
    className={`
      flex-1 px-4 py-2 rounded transition 
      ${active ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"} 
      text-white
    `}
    onClick={onClick}
  >
    {label}
  </button>
);

const FrameModal = ({
  frames,
  onClose,
  onDone,
  numToSelect,
}: {
  frames: Frame[];
  onClose: () => void;
  onDone: (frames: Frame[]) => void;
  numToSelect: number;
}) => {
  if (frames.length === 0) return null;
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black bg-opacity-70 flex items-center justify-center p-4 sm:p-8"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-800 p-6 rounded shadow-lg w-full max-w-4xl overflow-y-auto max-h-[80vh]"
      >
        <FrameSelector
          recordedFrames={frames}
          onCancel={onClose}
          onDone={onDone}
          numToSelect={numToSelect}
        />
      </div>
    </div>
  );
};

export default function Home() {
  const [isMobile, setIsMobile] = useState(false);
  const [liveFrames, setLiveFrames] = useState<Frame[]>([]);
  const [predictionResult, setPredictionResult] = useState<Record<string, number>>({});
  const [recordedFrames, setRecordedFrames] = useState<Frame[]>([]);

  const [isRecording, setIsRecording] = useState(false);
  const [showBuffer, setShowBuffer] = useState(false);
  const [showLandmark, setShowLandmark] = useState(true);
  const [showPredictions, setShowPredictions] = useState(false);
  const [showVideo, setShowVideo] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const model = useRef<Model | null>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleRecordFinish = (frames: Frame[]) => {
    setRecordedFrames(frames);
    setIsRecording(false);
  };

  const handleFrameSelectionFinish = async (frames: Frame[]) => {
    setRecordedFrames([]);
    if (!model.current) return alert("No model loaded.");

    const label = prompt("Enter label for this gesture:");
    if (!label) return alert("Training cancelled: no label provided.");

    model.current.train(label, frames);
    await saveModel(model.current.name, model.current);
  };

  const handleFrame = (frame: Frame) => {
    if (!model.current) return;
    const numFrames = model.current.numberOfFrames;

    setLiveFrames((prev) => {
      const newFrames = [...prev, frame].slice(-numFrames);
      if (newFrames.length === numFrames && model.current) {
        const result = model.current.predict(newFrames);
        setPredictionResult(result);
      }
      return newFrames;
    });
  };

  const Layout = (
    <div className="min-h-screen bg-gray-900 text-white py-6 px-4 sm:px-8 flex flex-col items-center overflow-y-auto">
      <div className="max-w-6xl w-full mb-4">
        <ModelSelector onModelChange={(m) => (model.current = m)} />
      </div>

      {showBuffer && (
        <div className="max-w-6xl w-full mb-6">
          <BufferPreview frames={liveFrames} />
        </div>
      )}

      <div
        ref={containerRef}
        className="border border-white/30 flex-shrink-0 w-full"
      >
        <div
          ref={containerRef}
          className={`
          border border-white/30
          aspect-[4/3]
          flex-shrink-0
          w-[240px] sm:w-[360px] md:w-[480px]
          max-w-full
          mx-auto
          `}
        >
          <VideoFeed
            onFrame={handleFrame}
            onRecordFinish={handleRecordFinish}
            record={isRecording}
            showLandmark={showLandmark}
            showVideo={showVideo}
          />
        </div>


        <div
          className={`border border-white/30 flex gap-2 ${isMobile ? "flex-col w-full" : "flex-row min-w-[120px] w-auto"
            } items-start justify-center px-2 py-2`}
        >
          {/* Button controls */}
          <div className={`flex ${isMobile ? "flex-row w-full" : "flex-col"} gap-2`}>
            <ToggleButton label="Video" active={showVideo} onClick={() => setShowVideo(!showVideo)} />
            <ToggleButton label="Landmark" active={showLandmark} onClick={() => setShowLandmark(!showLandmark)} />
          </div>

          <div className={`flex ${isMobile ? "flex-row w-full" : "flex-col"} gap-2`}>
            <ToggleButton label="Predictions" active={showPredictions} onClick={() => setShowPredictions(!showPredictions)} />
            <ToggleButton label="Buffer" active={showBuffer} onClick={() => setShowBuffer(!showBuffer)} />
          </div>

          <div className={`flex ${isMobile ? "flex-row w-full" : "flex-col"} gap-2`}>
            <ToggleButton label="Train" active={isRecording} onClick={() => setIsRecording(!isRecording)} />
          </div>

          {/* Predictions container */}
          {showPredictions && (
            <div
              className={`border border-white/30 ${isMobile ? "max-h-48 w-full" : "max-h-[500]"
                } px-2 py-2 overflow-auto`}
            >
              <PredictionViewer predictions={predictionResult} />
            </div>
          )}
        </div>

        <FrameModal
          frames={recordedFrames}
          onClose={() => setRecordedFrames([])}
          onDone={handleFrameSelectionFinish}
          numToSelect={model.current?.numberOfFrames ?? 10}
        />
      </div>
    </div>
  );

  return Layout;
}