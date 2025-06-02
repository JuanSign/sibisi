export type Landmark = [number, number, number]; // [x, y, z]
export type Frame = {
    image: string;
    landmarks: Landmark[];
};
export type Sample = Frame[];

export interface ModelJSON {
    name: string;
    numberOfFrames: number;
    labels: string[];
    averages: Record<string, Landmark[][]>; // label -> frames -> landmarks -> [x,y,z]
    counts: Record<string, number>;
}

export class Model {
    name: string
    numberOfFrames: number;
    labels: string[];
    averages: Record<string, number[][][]>; // [frame][landmark][xyz]
    counts: Record<string, number>; // number of samples per label

    constructor(name: string, numberOfFrames: number) {
        this.name = name;
        this.numberOfFrames = numberOfFrames;
        this.labels = [];
        this.averages = {};
        this.counts = {};
    }


    normalizeFrames(frames: Frame[]): Frame[] {
        if (frames.length === 0) return [];

        const anchor: Landmark = frames[0].landmarks[0];
        const ref: Landmark = frames[0].landmarks[9];

        const dx = ref[0] - anchor[0];
        const dy = ref[1] - anchor[1];
        const dz = ref[2] - anchor[2];
        const scale = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-6;

        return frames.map((frame): Frame => {
            const normalizedLandmarks: Landmark[] = frame.landmarks.map(([x, y, z]) => {
                const nx = (x - anchor[0]) / scale;
                const ny = (y - anchor[1]) / scale;
                const nz = (z - anchor[2]) / scale;
                return [nx, ny, nz];
            });

            return {
                image: frame.image,
                landmarks: normalizedLandmarks,
            };
        });
    }


    train(label: string, frames: Frame[]): void {
        if (frames.length !== this.numberOfFrames) {
            console.warn(`Skipping training: expected ${this.numberOfFrames} frames, got ${frames.length}`);
            return;
        }
        if (frames.some(f => f.landmarks.length === 0)) {
            console.warn(`Skipping training: some frames have no landmarks.`);
            return;
        }

        const normFrames = this.normalizeFrames(frames);
        const landmarks = normFrames.map(f => f.landmarks);

        if (!this.averages[label]) {
            this.labels.push(label);
            this.averages[label] = landmarks.map(frame =>
                frame.map(([x, y, z]) => [x, y, z])
            );
            this.counts[label] = 1;
        } else {
            const avg = this.averages[label];
            const count = ++this.counts[label];

            for (let i = 0; i < this.numberOfFrames; i++) {
                for (let j = 0; j < landmarks[i].length; j++) {
                    for (let k = 0; k < 3; k++) {
                        avg[i][j][k] =
                            ((avg[i][j][k] ?? 0) * (count - 1) + landmarks[i][j][k]) / count;
                    }
                }
            }
        }
    }


    predict(frames: Frame[]): Record<string, number> {
        const normFrames = this.normalizeFrames(frames)
        const input = normFrames.map(f => f.landmarks);
        const distances: Record<string, number> = {};

        for (const label of this.labels) {
            const avg = this.averages[label];
            let sum = 0;

            for (let i = 0; i < this.numberOfFrames; i++) {
                for (let j = 0; j < input[i].length; j++) {
                    for (let k = 0; k < 3; k++) {
                        const diff = input[i][j][k] - avg[i][j][k];
                        sum += diff * diff;
                    }
                }
            }

            distances[label] = Math.sqrt(sum);
        }

        const scores: Record<string, number> = {};
        const totalInv = Object.values(distances).reduce(
            (sum, d) => sum + 1 / (d + 1e-6),
            0
        );

        for (const label of this.labels) {
            scores[label] = 1 / (distances[label] + 1e-6) / totalInv;
        }

        return scores;
    }

    toJSON(): object {
        return {
            name: this.name,
            numberOfFrames: this.numberOfFrames,
            labels: this.labels,
            averages: this.averages,
            counts: this.counts,
        };
    }

    static fromJSON(json: ModelJSON): Model {
        const model = new Model(json.name, json.numberOfFrames);
        model.labels = json.labels;
        model.averages = json.averages;
        model.counts = json.counts;
        return model;
    }
}
