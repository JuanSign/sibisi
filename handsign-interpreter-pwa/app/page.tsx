"use client";

import { useRef, useState } from "react";
import ModelSelector from "@/components/ModelSelector";
import { Frame, Model } from "@/lib/Model";
import VideoFeed from "@/components/VideoFeed";
import BufferPreview from "@/components/BufferPreview";
import { FrameSelector } from "@/components/FrameSelector";
import { saveModel } from "@/lib/IndexedDB";
import PredictionViewer from "@/components/PredictionViewer";

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedFrames, setRecordedFrames] = useState<Frame[]>([]);
  const [predictionResult, setPredictionResult] = useState<Record<string, number>>({});
  const [liveFrames, setLiveFrames] = useState<Frame[]>([]);

  const model = useRef<Model | null>(null);

  const BOX_WIDTH = 640;
  const BOX_HEIGHT = 480;

  const handleRecordFinish = (frames: Frame[]) => {
    setRecordedFrames(frames);
    setIsRecording(false);
    console.log(`Recording complete. Captured ${frames.length} frames.`);
  };

  const handleFrameSelectionFinish = async (frames: Frame[]) => {
    setRecordedFrames([]);
    console.log(`Selection complete. Selected ${frames.length} frames.`);

    if (!model.current) {
      alert("No model loaded.");
      return;
    }

    const label = prompt("Enter label for this gesture:");
    if (!label) {
      alert("Training cancelled: no label provided.");
      return;
    }

    model.current.train(String(label), frames);
    await saveModel(model.current.name, model.current);
  };

  const handleFrame = (frame: Frame) => {
    if (!model.current) return;
    const numFrames = model.current.numberOfFrames;

    setLiveFrames((prev) => {
      const newFrames = [...prev, frame].slice(-numFrames);
      if (newFrames.length === numFrames) {
        const result = model.current!.predict(newFrames);
        setPredictionResult(result);
      }
      return newFrames;
    });
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center py-8">
      <ModelSelector onModelChange={(m) => (model.current = m)} />

      <div className="flex flex-col items-center">
        {/* Live buffer preview if a model is selected */}
        {model && (
          <BufferPreview frames={liveFrames} />
        )}
      </div>

      {/* Video and Live Predictions Side by Side */}
      <div className="flex gap-6 mt-4 items-start">
        <VideoFeed onRecordFinish={handleRecordFinish} onFrame={handleFrame} record={isRecording} width={BOX_WIDTH} height={BOX_HEIGHT} />
        {liveFrames.length >= (model.current?.numberOfFrames ?? 50) && (<PredictionViewer predictions={predictionResult} />)}
      </div>

      {recordedFrames.length > 0 && (<FrameSelector
        recordedFrames={recordedFrames}
        numToSelect={model.current?.numberOfFrames ?? 10}
        onDone={handleFrameSelectionFinish}
      />)}

      {/* Record Button */}
      <div className="mt-6">
        <button
          className="px-6 py-3 bg-blue-500 text-white text-lg font-medium rounded hover:bg-blue-600 transition"
          onClick={() => setIsRecording(true)}
          disabled={isRecording}
        >
          {isRecording ? "Training..." : "Train"}
        </button>
      </div>
    </div>
  );
}