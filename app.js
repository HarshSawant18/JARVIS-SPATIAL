import {
    FilesetResolver,
    HandLandmarker
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";


// =====================================================
// ELEMENTS
// =====================================================

const video =
    document.getElementById("camera");

const canvas =
    document.getElementById("overlay");

const ctx =
    canvas.getContext("2d");

const startButton =
    document.getElementById("startCamera");

const status =
    document.getElementById("status");


// =====================================================
// MEDIAPIPE
// =====================================================

let handLandmarker = null;

let cameraStarted = false;

let lastVideoTime = -1;


// =====================================================
// HAND CONNECTIONS
// =====================================================

const HAND_CONNECTIONS = [

    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],

    [0, 5],
    [5, 6],
    [6, 7],
    [7, 8],

    [0, 9],
    [9, 10],
    [10, 11],
    [11, 12],

    [0, 13],
    [13, 14],
    [14, 15],
    [15, 16],

    [0, 17],
    [17, 18],
    [18, 19],
    [19, 20],

    [5, 9],
    [9, 13],
    [13, 17]
];


// =====================================================
// DISTANCE
// =====================================================

function distance(a, b) {

    const dx =
        a.x - b.x;

    const dy =
        a.y - b.y;

    return Math.sqrt(
        dx * dx +
        dy * dy
    );
}


// =====================================================
// INITIALIZE MEDIAPIPE
// =====================================================

async function initializeHandTracking() {

    try {

        status.textContent =
            "Loading hand tracking...";


        // Load MediaPipe WASM

        const vision =
            await FilesetResolver.forVisionTasks(

                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"

            );


        // Create Hand Landmarker

        handLandmarker =
            await HandLandmarker.createFromOptions(

                vision,

                {

                    baseOptions: {

                        modelAssetPath:
                            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"

                    },

                    runningMode:
                        "VIDEO",

                    // Track TWO hands

                    numHands:
                        2,

                    minHandDetectionConfidence:
                        0.5,

                    minHandPresenceConfidence:
                        0.5,

                    minTrackingConfidence:
                        0.5
                }
            );


        status.textContent =
            "✅ Hand tracking ready";

        startButton.disabled =
            false;


    } catch (error) {

        console.error(
            "MediaPipe initialization error:",
            error
        );


        status.textContent =
            "❌ MediaPipe failed to load";
    }
}


// =====================================================
// START REAR CAMERA
// =====================================================

async function startCamera() {

    try {

        status.textContent =
            "Requesting rear camera...";


        // IMPORTANT:
        // environment = rear camera

        const stream =
            await navigator.mediaDevices.getUserMedia({

                video: {

                    facingMode: {
                        ideal: "environment"
                    },

                    width: {
                        ideal: 1280
                    },

                    height: {
                        ideal: 720
                    }
                },

                audio: false
            });


        // Attach camera stream

        video.srcObject =
            stream;


        // Wait for camera

        await video.play();


        // Resize overlay

        resizeCanvas();


        // Start detection

        cameraStarted =
            true;


        startButton.style.display =
            "none";


        status.textContent =
            "📷 Rear camera active — show your hands";


        requestAnimationFrame(
            detectHands
        );


    } catch (error) {

        console.error(
            "Camera error:",
            error
        );


        status.textContent =
            "❌ Camera error: " +
            error.name;
    }
}


// =====================================================
// RESIZE CANVAS
// =====================================================

function resizeCanvas() {

    if (
        !video.videoWidth ||
        !video.videoHeight
    ) {

        return;
    }


    canvas.width =
        video.videoWidth;

    canvas.height =
        video.videoHeight;
}


// =====================================================
// DRAW HAND
// =====================================================

function drawHand(
    landmarks
) {

    const width =
        canvas.width;

    const height =
        canvas.height;


    // =================================================
    // DRAW BONES
    // =================================================

    ctx.strokeStyle =
        "#00ffff";

    ctx.lineWidth =
        3;


    for (
        const [start, end]
        of HAND_CONNECTIONS
    ) {

        const startPoint =
            landmarks[start];

        const endPoint =
            landmarks[end];


        ctx.beginPath();


        ctx.moveTo(

            startPoint.x * width,

            startPoint.y * height
        );


        ctx.lineTo(

            endPoint.x * width,

            endPoint.y * height
        );


        ctx.stroke();
    }


    // =================================================
    // DRAW LANDMARKS
    // =================================================

    for (
        const point
        of landmarks
    ) {

        ctx.beginPath();


        ctx.arc(

            point.x * width,

            point.y * height,

            6,

            0,

            Math.PI * 2
        );


        ctx.fillStyle =
            "#ffffff";


        ctx.fill();
    }


    // =================================================
    // PINCH DETECTION
    // =================================================

    const thumb =
        landmarks[4];

    const index =
        landmarks[8];


    const pinchDistance =
        distance(
            thumb,
            index
        );


    const pinch =
        pinchDistance < 0.06;


    // =================================================
    // DRAW THUMB → INDEX
    // =================================================

    ctx.beginPath();


    ctx.moveTo(

        thumb.x * width,

        thumb.y * height
    );


    ctx.lineTo(

        index.x * width,

        index.y * height
    );


    ctx.strokeStyle =
        pinch
            ? "#00ff00"
            : "#ff00ff";


    ctx.lineWidth =
        5;


    ctx.stroke();


    // =================================================
    // PINCH POINT
    // =================================================

    const pinchX =
        (
            thumb.x +
            index.x
        ) / 2;


    const pinchY =
        (
            thumb.y +
            index.y
        ) / 2;


    ctx.beginPath();


    ctx.arc(

        pinchX * width,

        pinchY * height,

        pinch
            ? 15
            : 8,

        0,

        Math.PI * 2
    );


    ctx.fillStyle =
        pinch
            ? "#00ff00"
            : "#ff00ff";


    ctx.fill();


    return pinch;
}


// =====================================================
// DETECT HANDS
// =====================================================

async function detectHands() {

    if (
        !cameraStarted ||
        !handLandmarker
    ) {

        return;
    }


    // Make sure overlay matches
    // camera resolution.

    resizeCanvas();


    // Detect when video advances

    if (

        video.readyState >= 2 &&

        video.currentTime !==
            lastVideoTime

    ) {

        lastVideoTime =
            video.currentTime;


        // ---------------------------------------------
        // MediaPipe
        // ---------------------------------------------

        const results =
            handLandmarker.detectForVideo(

                video,

                performance.now()
            );


        // ---------------------------------------------
        // Clear old landmarks
        // ---------------------------------------------

        ctx.clearRect(

            0,

            0,

            canvas.width,

            canvas.height
        );


        // ---------------------------------------------
        // Get detected hands
        // ---------------------------------------------

        const hands =
            results.landmarks || [];


        // ---------------------------------------------
        // No hand
        // ---------------------------------------------

        if (
            hands.length === 0
        ) {

            status.textContent =
                "🖐️ Show your hand";
        }


        // ---------------------------------------------
        // Draw every detected hand
        // ---------------------------------------------

        let pinchCount =
            0;


        for (
            const hand
            of hands
        ) {

            const isPinching =
                drawHand(
                    hand
                );


            if (isPinching) {

                pinchCount++;
            }
        }


        // ---------------------------------------------
        // Status
        // ---------------------------------------------

        if (
            hands.length > 0
        ) {

            if (
                pinchCount === 2
            ) {

                status.textContent =
                    "🔥 TWO HANDS — BOTH PINCHING";

            } else if (
                pinchCount === 1
            ) {

                status.textContent =
                    "🤏 PINCH DETECTED";

            } else {

                status.textContent =
                    `✋ ${
                        hands.length
                    } HAND${
                        hands.length > 1
                            ? "S"
                            : ""
                    } DETECTED`;
            }
        }
    }


    // Continue tracking

    requestAnimationFrame(
        detectHands
    );
}


// =====================================================
// BUTTON
// =====================================================

startButton.addEventListener(

    "click",

    startCamera
);


// =====================================================
// INITIALIZE
// =====================================================

startButton.disabled =
    true;


initializeHandTracking();
