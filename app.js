import * as THREE from
    "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";


const startButton =
    document.getElementById("startAR");

const status =
    document.getElementById("status");


let session = null;

let renderer = null;

let scene = null;

let camera = null;


// =====================================================
// CHECK AR
// =====================================================

async function checkAR() {

    if (!navigator.xr) {

        status.textContent =
            "WebXR is not available.";

        startButton.disabled =
            true;

        return;
    }


    try {

        const supported =
            await navigator.xr.isSessionSupported(
                "immersive-ar"
            );


        if (supported) {

            status.textContent =
                "🔥 AR READY";

            startButton.disabled =
                false;

        } else {

            status.textContent =
                "AR is not supported.";

            startButton.disabled =
                true;
        }

    } catch (error) {

        console.error(error);

        status.textContent =
            "AR check failed.";

        startButton.disabled =
            true;
    }
}


// =====================================================
// CREATE SCENE
// =====================================================

function createScene() {

    scene =
        new THREE.Scene();


    camera =
        new THREE.PerspectiveCamera();


    camera.matrixAutoUpdate =
        false;


    const light =
        new THREE.HemisphereLight(
            0xffffff,
            0xbbbbff,
            3
        );


    scene.add(light);
}


// =====================================================
// START AR
// =====================================================

async function startAR() {

    try {

        status.textContent =
            "Starting AR...";


        createScene();


        renderer =
            new THREE.WebGLRenderer({

                antialias: true,

                alpha: true
            });


        renderer.setPixelRatio(
            window.devicePixelRatio
        );


        renderer.setSize(
            window.innerWidth,
            window.innerHeight
        );


        renderer.setClearColor(
            0x000000,
            0
        );


        renderer.xr.enabled =
            true;


        renderer.xr.setReferenceSpaceType(
            "local"
        );


        document.body.appendChild(
            renderer.domElement
        );


        // =================================================
        // REQUEST HAND TRACKING AS OPTIONAL FEATURE
        // =================================================

        session =
            await navigator.xr.requestSession(

                "immersive-ar",

                {

                    requiredFeatures: [
                        "local"
                    ],

                    optionalFeatures: [
                        "hand-tracking",
                        "dom-overlay"
                    ],

                    domOverlay: {
                        root: document.body
                    }
                }
            );


        await renderer.xr.setSession(
            session
        );


        startButton.style.display =
            "none";


        status.textContent =
            "📷 AR ACTIVE — checking hand tracking...";


        // =================================================
        // SESSION EVENTS
        // =================================================

        session.addEventListener(
            "inputsourceschange",
            inspectInputSources
        );


        // =================================================
        // INITIAL CHECK
        // =================================================

        inspectInputSources();


        // =================================================
        // XR LOOP
        // =================================================

        renderer.setAnimationLoop(
            render
        );


        // =================================================
        // SESSION END
        // =================================================

        session.addEventListener(
            "end",
            () => {

                if (renderer) {

                    renderer.setAnimationLoop(
                        null
                    );
                }


                session =
                    null;


                startButton.style.display =
                    "inline-block";


                startButton.disabled =
                    false;


                status.textContent =
                    "AR ended.";
            }
        );


    } catch (error) {

        console.error(
            "AR ERROR:",
            error
        );


        status.textContent =
            "❌ " +
            error.name +
            ": " +
            error.message;
    }
}


// =====================================================
// INSPECT XR INPUT SOURCES
// =====================================================

function inspectInputSources() {

    if (!session) {

        return;
    }


    const sources =
        session.inputSources;


    console.log(
        "XR INPUT SOURCES:",
        sources
    );


    // -------------------------------------------------
    // No input sources
    // -------------------------------------------------

    if (!sources || sources.length === 0) {

        status.textContent =
            "⚠️ AR works, but NO XR input source detected.";

        return;
    }


    let handCount =
        0;

    let screenCount =
        0;

    let controllerCount =
        0;


    for (
        const source of sources
    ) {

        console.log(
            "XR SOURCE:",
            {
                handedness:
                    source.handedness,

                targetRayMode:
                    source.targetRayMode,

                hand:
                    source.hand
            }
        );


        if (source.hand) {

            handCount++;

        } else if (
            source.targetRayMode ===
            "screen"
        ) {

            screenCount++;

        } else {

            controllerCount++;
        }
    }


    // -------------------------------------------------
    // HAND TRACKING FOUND
    // -------------------------------------------------

    if (handCount > 0) {

        status.textContent =
            "🔥 HAND TRACKING DETECTED: " +
            handCount;

        return;
    }


    // -------------------------------------------------
    // ONLY SCREEN INPUT
    // -------------------------------------------------

    if (screenCount > 0) {

        status.textContent =
            "📱 SCREEN INPUT ONLY — no hand tracking.";

        return;
    }


    // -------------------------------------------------
    // OTHER INPUT
    // -------------------------------------------------

    status.textContent =
        "🎮 XR INPUT FOUND, but no hand input.";
}


// =====================================================
// XR RENDER
// =====================================================

function render(
    time,
    frame
) {

    if (!frame) {

        return;
    }


    // Keep checking input sources
    // because they can change during
    // the AR session.

    inspectInputSources();


    renderer.render(
        scene,
        camera
    );
}


// =====================================================
// BUTTON
// =====================================================

startButton.addEventListener(
    "click",
    startAR
);


// =====================================================
// INITIAL CHECK
// =====================================================

startButton.disabled =
    true;

checkAR();
