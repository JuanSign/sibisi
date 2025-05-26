'use client';

import React, { useState, useEffect } from 'react';
import { Model } from '../lib/Model';
import { saveModel, loadModel, getAllModelNames } from '../lib/IndexedDB';

interface ModelSelectorProps {
    onModelChange: (model: Model | null) => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ onModelChange }) => {
    const [selectedModelName, setSelectedModelName] = useState<string | null>(null);
    const [modelNames, setModelNames] = useState<string[]>([]);

    // Load all model names from IndexedDB on mount
    useEffect(() => {
        getAllModelNames().then(setModelNames).catch(console.error);
    }, []);

    // Load model from IndexedDB when selected
    useEffect(() => {
        if (selectedModelName) {
            loadModel(selectedModelName)
                .then(model => onModelChange(model))
                .catch(err => {
                    console.error('Failed to load model:', err);
                    onModelChange(null);
                });
        } else {
            onModelChange(null);
        }
    }, [selectedModelName]);

    // Create a new model
    const handleCreateModel = async () => {
        const newModelName = prompt('Enter new model name:');
        if (!newModelName) return;

        if (modelNames.includes(newModelName)) {
            alert('Model name already exists!');
            return;
        }

        const frameCountInput = prompt('Enter number of frames:');
        const numberOfFrames = frameCountInput ? parseInt(frameCountInput, 10) : NaN;
        if (isNaN(numberOfFrames) || numberOfFrames <= 0) {
            alert('Invalid number of frames!');
            return;
        }

        const newModel = new Model(newModelName, numberOfFrames);
        try {
            await saveModel(newModelName, newModel);
            setModelNames(prev => [...prev, newModelName]);
            setSelectedModelName(newModelName);
            onModelChange(newModel);
        } catch (err) {
            console.error('Failed to save new model:', err);
            alert('Failed to create model. Check console for details.');
        }
    };


    return (
        <div className="mb-4 text-white">
            <div className="flex items-center gap-2">
                <select
                    className="bg-gray-800 text-white px-2 py-1 rounded"
                    value={selectedModelName ?? ''}
                    onChange={e => setSelectedModelName(e.target.value)}
                >
                    <option value="" disabled>Select a model</option>
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
    );
};

export default ModelSelector;
