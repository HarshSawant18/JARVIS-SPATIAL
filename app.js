import * as THREE from
    "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";


// =====================================================
// UI
// =====================================================

const startButton =
    document.getElementById("startAR");

const status =
    document.getElementById("status");


// =====================================================
// THREE.JS
// =====================================================

let renderer = null;

let scene = null;

let camera = null;


// =====================================================
// WEBXR
// =====================================================

let xrSession = null;

let hitTestSource = null;

let localReferenceSpace = null;


// =====================================================
// AR OBJECTS
// =====================================================

let reticle = null;

let cube = null;


// =====================================================
// CHECK AR SUPPORT
// =====================================================

async function checkARSupport() {

    if (!navigator.xr) {

        status.textContent =
            "❌ WebXR is not available.";

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
                "🔥 AR READY";

            startButton.disabled = false;

        } else {

            status.textContent =
                "❌ AR is not supported.";

            startButton.disabled = true;
        }

    } catch (error) {

        console.error(error);

        status.textContent =
            "❌ Could not check AR support.";

        startButton.disabled = true;
    }
}


// =====================================================
// CREATE THREE.JS SCENE
// =====================================================

function createScene() {

    scene = new THREE.Scene();


    // -------------------------------------------------
    // CAMERA
    // -------------------------------------------------

    camera =
        new THREE.PerspectiveCamera();


    // -------------------------------------------------
    // LIGHT
    // -------------------------------------------------

    const hemisphereLight =
        new THREE.HemisphereLight(
            0xffffff,
            0xbbbbff,
            3
        );


    scene.add(
        hemisphereLight
    );


    // -------------------------------------------------
    // RETICLE
    // -------------------------------------------------

    const reticleGeometry =
        new THREE.RingGeometry(
            0.08,
            0.10,
            32
        );


    reticleGeometry.rotateX(
        -Math.PI / 2
    );


    const reticleMaterial =
        new THREE.MeshBasicMaterial({
            color: 0x00ff00
        });


    reticle =
        new THREE.Mesh(
            reticleGeometry,
            reticleMaterial
        );


    reticle.matrixAutoUpdate =
        false;


    reticle.visible =
        false;


    scene.add(
        reticle
    );
}


// =====================================================
// CREATE CUBE
// =====================================================

function createCube() {

    if (cube) {

        return;
    }


    const geometry =
        new THREE.BoxGeometry(
            0.15,
            0.15,
            0.15
        );


    const material =
        new THREE.MeshStandardMaterial({
            color: 0x00aaff,
            roughness: 0.35,
            metalness: 0.25
        });


    cube =
        new THREE.Mesh(
            geometry,
            material
        );


    cube.visible =
        false;


    scene.add(
        cube
    );
}


// =====================================================
// START AR
// =====================================================

async function startAR() {

    try {

        status.textContent =
            "Starting AR...";


        // =================================================
        // CREATE RENDERER
        // =================================================

        if (!renderer) {

            renderer =
                new THREE.WebGLRenderer({

                    alpha: true,

                    antialias: true
                });


            renderer.setPixelRatio(
                window.devicePixelRatio
            );


            renderer.setSize(
                window.innerWidth,
                window.innerHeight
            );


            // Transparent background.
            // The phone camera provides the background.

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
        }


        // =================================================
        // CREATE SCENE
        // =================================================

        createScene();

        createCube();


        // =================================================
        // REQUEST AR SESSION
        // =================================================

        xrSession =
            await navigator.xr.requestSession(
                "immersive-ar",
                {

                    requiredFeatures: [
                        "hit-test"
                    ],

                    optionalFeatures: [
                        "dom-overlay"
                    ],

                    domOverlay: {
                        root: document.body
                    }
                }
            );


        // =================================================
        // GIVE SESSION TO THREE.JS
        // =================================================

        await renderer.xr.setSession(
            xrSession
        );


        // =================================================
        // REFERENCE SPACE
        // =================================================

        localReferenceSpace =
            await xrSession.requestReferenceSpace(
                "local"
            );


        // =================================================
        // VIEWER SPACE
        // =================================================

        const viewerSpace =
            await xrSession.requestReferenceSpace(
                "viewer"
            );


        // =================================================
        // HIT TEST SOURCE
        // =================================================

        hitTestSource =
            await xrSession.requestHitTestSource({
                space: viewerSpace
            });


        // =================================================
        // SCREEN TAP / SELECT
        // =================================================

        xrSession.addEventListener(
            "select",
            placeCube
        );


        // =================================================
        // UPDATE UI
        // =================================================

        startButton.style.display =
            "none";


        status.textContent =
            "📷 AR ACTIVE — move your phone slowly";


        // =================================================
        // XR RENDER LOOP
        // =================================================

        renderer.setAnimationLoop(
            renderAR
        );


        // =================================================
        // AR SESSION END
        // =================================================

        xrSession.addEventListener(
            "end",
            handleSessionEnd
        );


    } catch (error) {

        console.error(
            "AR START ERROR:",
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
// AR RENDER LOOP
// =====================================================

function renderAR(
    time,
    frame
) {

    if (!frame || !xrSession) {

        return;
    }


    // =================================================
    // HIT TEST
    // =================================================

    if (hitTestSource) {

        const hitTestResults =
            frame.getHitTestResults(
                hitTestSource
            );


        if (
            hitTestResults.length > 0
        ) {

            const hit =
                hitTestResults[0];


            const hitPose =
                hit.getPose(
                    localReferenceSpace
                );


            if (hitPose) {

                reticle.visible =
                    true;


                reticle.matrix.fromArray(
                    hitPose.transform.matrix
                );


                if (!cube ||
                    !cube.visible) {

                    status.textContent =
                        "🎯 SURFACE FOUND — TAP TO PLACE";
                }
            }

        } else {

            reticle.visible =
                false;
        }
    }


    // =================================================
    // RENDER SCENE
    // =================================================

    renderer.render(
        scene,
        camera
    );
}


// =====================================================
// PLACE CUBE
// =====================================================

function placeCube() {

    if (
        !reticle ||
        !reticle.visible ||
        !cube
    ) {

        return;
    }


    // Get position from reticle

    cube.position.setFromMatrixPosition(
        reticle.matrix
    );


    // Get orientation from reticle

    cube.quaternion.setFromRotationMatrix(
        reticle.matrix
    );


    cube.visible =
        true;


    status.textContent =
        "🧊 CUBE PLACED!";
}


// =====================================================
// HANDLE AR SESSION END
// =====================================================

function handleSessionEnd() {

    if (renderer) {

        renderer.setAnimationLoop(
            null
        );
    }


    xrSession =
        null;


    hitTestSource =
        null;


    localReferenceSpace =
        null;


    if (reticle) {

        reticle.visible =
            false;
    }


    if (cube) {

        cube.visible =
            false;
    }


    startButton.style.display =
        "inline-block";


    startButton.disabled =
        false;


    status.textContent =
        "AR session ended.";
}


// =====================================================
// START BUTTON
// =====================================================

startButton.addEventListener(
    "click",
    startAR
);


// =====================================================
// INITIALIZE
// =====================================================

startButton.disabled =
    true;


checkARSupport();
