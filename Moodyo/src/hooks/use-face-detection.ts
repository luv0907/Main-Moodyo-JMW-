import { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver, Landmark } from '@mediapipe/tasks-vision';

export type DetectedMood = 'happy' | 'joyfull' | 'sad' | 'depressed' | 'neutral';

export type DetectionResult = {
    mood: DetectedMood;
    confidence: number;
    isStable: boolean;
    landmarks?: Landmark[];
};

export const useFaceDetection = () => {
    const [faceLandmarker, setFaceLandmarker] = useState<FaceLandmarker | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const detectionHistory = useRef<DetectedMood[]>([]);
    const STABILITY_THRESHOLD = 5;

    useEffect(() => {
        // Suppress MediaPipe's informational/internal messages that appear as errors in Next.js dev mode
        const originalError = console.error;
        const originalWarn = console.warn;
        const SUPPRESS_PATTERNS = ['XNNPACK', 'vision_wasm_internal', 'roi->width', 'CalculatorGraph', 'image_to_tensor', 'INFO:'];
        const shouldSuppress = (msg: string) => SUPPRESS_PATTERNS.some(p => msg.includes(p));

        console.error = (...args: any[]) => {
            if (shouldSuppress(args[0]?.toString() || '')) return;
            originalError.apply(console, args);
        };
        console.warn = (...args: any[]) => {
            if (shouldSuppress(args[0]?.toString() || '')) return;
            originalWarn.apply(console, args);
        };

        const initDetector = async () => {
            try {
                const filesetResolver = await FilesetResolver.forVisionTasks(
                    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
                );
                const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
                    baseOptions: {
                        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
                        delegate: 'GPU',
                    },
                    outputFaceBlendshapes: true,
                    runningMode: 'VIDEO',
                    numFaces: 1,
                });
                setFaceLandmarker(landmarker);
                setIsLoading(false);
            } catch (err) {
                setError('Face detection initialization failed.');
                setIsLoading(false);
            }
        };

        initDetector();

        return () => {
            console.error = originalError;
            console.warn = originalWarn;
        };
    }, []);

    const resetHistory = () => {
        detectionHistory.current = [];
    };

    const detectMood = (video: HTMLVideoElement): DetectionResult => {
        // Guard: video must be ready with valid dimensions
        if (!faceLandmarker || !video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
            return { mood: 'neutral', confidence: 0, isStable: false };
        }

        try {
            const results = faceLandmarker.detectForVideo(video, performance.now());
            const landmarks: Landmark[] | undefined = results.faceLandmarks?.[0];

            if (!results.faceBlendshapes || results.faceBlendshapes.length === 0) {
                return { mood: 'neutral', confidence: 0, isStable: false, landmarks };
            }

            const shapes = results.faceBlendshapes[0].categories;
            const getS = (name: string) => shapes.find(s => s.categoryName === name)?.score || 0;

            // ── ADVANCED EMOTION SCORING ──────────────────────────────────────────
            // 1. JOYFULL — high energy: big smile + eye squint + open mouth
            const joyfullScore = (
                getS('mouthSmileLeft')  * 0.4 +
                getS('mouthSmileRight') * 0.4 +
                getS('eyeSquintLeft')   * 0.3 +
                getS('eyeSquintRight')  * 0.3 +
                getS('jawOpen')         * 0.2
            );

            // 2. HAPPY — relaxed smile, brows neutral
            const happyScore = (
                getS('mouthSmileLeft')  * 0.5 +
                getS('mouthSmileRight') * 0.5 +
                (1 - getS('browDownLeft'))  * 0.2 +
                (1 - getS('browDownRight')) * 0.2
            );

            // 3. SAD — inner brow raise, mouth frown, puckered lips
            const sadScore = (
                getS('browInnerUp')       * 0.6 +
                getS('mouthFrownLeft')   * 0.4 +
                getS('mouthFrownRight')  * 0.4 +
                getS('mouthPucker')      * 0.2
            );

            // 4. DEPRESSED — downcast eyes, brow down, no smile
            const depressedScore = (
                getS('browDownLeft')       * 0.4 +
                getS('browDownRight')      * 0.4 +
                getS('eyeLookDownLeft')    * 0.3 +
                getS('eyeLookDownRight')   * 0.3 +
                (1 - (getS('mouthSmileLeft') + getS('mouthSmileRight'))) * 0.4
            );
            // ─────────────────────────────────────────────────────────────────────

            const scores: Record<DetectedMood, number> = {
                joyfull:   joyfullScore,
                happy:     happyScore,
                sad:       sadScore,
                depressed: depressedScore,
                neutral:   0.15,
            };

            let mood: DetectedMood = 'neutral';
            let maxScore = 0;

            (Object.keys(scores) as DetectedMood[]).forEach(k => {
                if (scores[k] > maxScore) {
                    maxScore = scores[k];
                    mood = k;
                }
            });

            // If confidence is below threshold, stay neutral
            if (maxScore < 0.35) mood = 'neutral';

            // Stability buffer: mood must appear consistently before locking
            detectionHistory.current.push(mood);
            if (detectionHistory.current.length > 15) detectionHistory.current.shift();

            const lastN = detectionHistory.current.slice(-STABILITY_THRESHOLD);
            const isStable =
                lastN.length === STABILITY_THRESHOLD &&
                lastN.every(m => m === mood && m !== 'neutral');

            return { mood, confidence: maxScore, isStable, landmarks };
        } catch {
            return { mood: 'neutral', confidence: 0, isStable: false };
        }
    };

    return { detectMood, isLoading, error, resetHistory };
};
