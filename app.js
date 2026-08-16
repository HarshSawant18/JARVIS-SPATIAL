const startButton = document.getElementById("startAR");
const status = document.getElementById("status");

let xrSession = null;
let xrReferenceSpace = null;
let xrHitTestSource = null;


// =====================================================
// CHECK WEBXR
// =====================================================

async function checkARSupport() {

    if (!navigator.xr) {

        status.textContent =
            "WebXR is not available.";

        startButton.disabled = true;

        return;
    }


    try {

        const supported =
            await navigator.xr.isSessionSupported(
                "immersive-ar"
            );


        if (supported) {

            status.textContent =
                "🔥 AR is supported!";

            startButton.disabled = false;

        } else {

            status.textContent =
                "AR is not supported.";

            startButton.disabled = true;
        }

    } catch (error) {

        console.error(error);

        status.textContent =
            "Could not check AR support.";

        startButton.disabled = true;
    }
}


// =====================================================
// START AR
// =====================================================

async function startAR() {

    try {

        status.textContent =
            "Starting AR...";


        // ---------------------------------------------
        // Request AR session
        // ---------------------------------------------

        xrSession = await navigator.xr.requestSession(
            "immersive-ar",
            {
                requiredFeatures: [
                    "hit-test"
                ]
            }
        );


        status.textContent =
            "🔥 AR SESSION STARTED!";


        startButton.textContent =
            "AR RUNNING";


        startButton.disabled = true;


        // ---------------------------------------------
        // When AR ends
        // ---------------------------------------------

        xrSession.addEventListener(
            "end",
            () => {

                xrSession = null;

                xrHitTestSource = null;

                startButton.disabled = false;

                startButton.textContent =
                    "START AR";

                status.textContent =
                    "AR session ended.";
            }
        );


        // ---------------------------------------------
        // Get viewer reference space
        // ---------------------------------------------

        const viewerSpace =
            await xrSession.requestReferenceSpace(
                "viewer"
            );


        // ---------------------------------------------
        // Hit test
        // ---------------------------------------------

        xrHitTestSource =
            await xrSession.requestHitTestSource({

                space: viewerSpace

            });


        // ---------------------------------------------
        // Local reference space
        // ---------------------------------------------

        xrReferenceSpace =
            await xrSession.requestReferenceSpace(
                "local"
            );


        // ---------------------------------------------
        // Start XR frame loop
        // ---------------------------------------------

        xrSession.requestAnimationFrame(
            onXRFrame
        );


    } catch (error) {

        console.error(
            "AR ERROR:",
            error
        );


        status.textContent =
            "AR ERROR: " + error.message;

        xrSession = null;
    }
}


// =====================================================
// XR FRAME
// =====================================================

function onXRFrame(
    time,
    frame
) {

    const session =
        frame.session;


    // Request next frame

    session.requestAnimationFrame(
        onXRFrame
    );


    if (!xrHitTestSource) {

        return;
    }


    // Get hit test results

    const hitTestResults =
        frame.getHitTestResults(
            xrHitTestSource
        );


    if (
        hitTestResults.length > 0
    ) {

        const hit =
            hitTestResults[0];


        const pose =
            hit.getPose(
                xrReferenceSpace
            );


        if (pose) {

            status.textContent =
                "🎯 SURFACE DETECTED!";
        }
    }
}


// =====================================================
// BUTTON
// =====================================================

startButton.addEventListener(
    "click",
    startAR
);


// =====================================================
// START
// =====================================================

startButton.disabled = true;

checkARSupport();
