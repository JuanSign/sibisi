import { Frame } from "@/lib/Model";
import { useEffect, useRef } from "react";

type BufferPreviewProps = {
    frames: Frame[];
};

function FrameCanvas({ frame }: { frame: Frame }) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = frame.image;
    }, [frame.image]);

    return (
        <canvas
            ref={canvasRef}
            width={64}
            height={48}
            className="border border-gray-600 rounded"
        />
    );
}

export default function BufferPreview({ frames }: BufferPreviewProps) {
    const visibleFrames = frames.slice(-10);

    return (
        <div className="flex gap-2 mb-4 overflow-x-auto max-w-full px-2">
            {visibleFrames.map((frame, idx) => (
                <FrameCanvas key={idx} frame={frame} />
            ))}
        </div>
    );
}
