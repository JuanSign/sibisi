import React from "react";

type PredictionViewerProps = {
    predictions: Record<string, number>;
};

export default function PredictionViewer({ predictions }: PredictionViewerProps) {
    const entries = Object.entries(predictions);
    const topLabel = entries.reduce((maxLabel, [label, score]) =>
        score > (predictions[maxLabel] ?? -Infinity) ? label : maxLabel,
        entries[0]?.[0] ?? ""
    );

    return (
        <div className="bg-gray-800 text-white p-4 rounded w-64">
            <h2 className="text-lg font-semibold mb-2">Predictions</h2>
            <ul>
                {entries.map(([label, score]) => (
                    <li
                        key={label}
                        className={`flex justify-between py-1 px-2 rounded ${label === topLabel ? "bg-green-600 text-white font-bold" : ""
                            }`}
                    >
                        <span>{label}</span>
                        <span>{(score * 100).toFixed(1)}%</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
