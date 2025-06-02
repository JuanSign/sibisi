import { Frame } from "@/lib/Model";
import React, { useState } from "react";
import Image from "next/image";

interface FrameSelectorProps {
    recordedFrames: Frame[];
    numToSelect: number;
    onDone: (selected: Frame[]) => void;
    onCancel?: () => void; // new optional cancel callback
}

const FRAMES_PER_PAGE = 5;

export const FrameSelector: React.FC<FrameSelectorProps> = ({
    recordedFrames,
    numToSelect,
    onDone,
    onCancel,
}) => {
    const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
    const [page, setPage] = useState(0);

    const toggleSelection = (index: number) => {
        setSelectedIndices((prev) => {
            const exists = prev.includes(index);
            const next = exists ? prev.filter((i) => i !== index) : [...prev, index];
            return next.length <= numToSelect ? next : prev;
        });
    };

    const handleDone = () => {
        if (selectedIndices.length === numToSelect) {
            onDone(selectedIndices.map((i) => recordedFrames[i]));
        }
    };

    const maxPage = Math.floor((recordedFrames.length - 1) / FRAMES_PER_PAGE);
    const startIndex = page * FRAMES_PER_PAGE;
    const visibleFrames = recordedFrames.slice(startIndex, startIndex + FRAMES_PER_PAGE);

    return (
        <div className="p-4 w-full text-white">
            <h2 className="text-lg font-bold mb-4 text-center">
                Selected {selectedIndices.length}/{numToSelect} Frames
            </h2>

            {/* Pagination controls centered */}
            <div className="flex items-center justify-center space-x-4 mb-4">
                <button
                    className="px-3 py-1 bg-gray-200 rounded text-black disabled:opacity-50"
                    onClick={() => setPage((p) => Math.max(p - 1, 0))}
                    disabled={page === 0}
                >
                    Prev
                </button>
                <span className="text-sm text-white">
                    Page {page + 1} of {maxPage + 1}
                </span>
                <button
                    className="px-3 py-1 bg-gray-200 rounded text-black disabled:opacity-50"
                    onClick={() => setPage((p) => Math.min(p + 1, maxPage))}
                    disabled={page >= maxPage}
                >
                    Next
                </button>
            </div>

            {/* Thumbnails */}
            <div className="flex  space-x-4 px-2 pb-2 justify-center min-w-full">
                {visibleFrames.map((frame, index) => {
                    const realIndex = startIndex + index;
                    return (
                        <div
                            key={realIndex}
                            className={`relative flex-shrink-0 w-32 h-24 rounded-lg border overflow-hidden cursor-pointer transition-transform duration-200 ${selectedIndices.includes(realIndex)
                                ? "ring-4 ring-blue-500 scale-105"
                                : "hover:ring-2 ring-gray-400 hover:scale-105"
                                }`}
                            onClick={() => toggleSelection(realIndex)}
                        >
                            <Image
                                src={frame.image}
                                alt={`Frame ${realIndex}`}
                                layout="fill"
                                objectFit="cover"
                            />
                            <div className="absolute bottom-1 right-1 text-xs bg-white/80 px-1 rounded text-black">
                                #{realIndex + 1}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Done & Cancel buttons */}
            <div className="flex justify-center gap-4 mt-4">
                <button
                    onClick={handleDone}
                    disabled={selectedIndices.length !== numToSelect}
                    className={`px-4 py-2 rounded text-white ${selectedIndices.length === numToSelect
                        ? "bg-blue-500 hover:bg-blue-600"
                        : "bg-gray-400 cursor-not-allowed"
                        }`}
                >
                    Done
                </button>
                {onCancel && (
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white"
                    >
                        Cancel
                    </button>
                )}
            </div>
        </div>
    );
};
