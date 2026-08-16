import * as THREE from
    "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";

const startButton = document.getElementById("startAR");
const status = document.getElementById("status");

let renderer = null;
let scene = null;
let camera = null;

let xrSession = null;
let localReferenceSpace = null;
let viewerSpace = null;
let hitTestSource = null;

let reticle = null;
let cube = null;
let cubeAnchor = null;

let currentHit = null;


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
            "❌ AR support check failed.";

        startButton.disabled = true;
    }
}


// =====================================================
// CREATE SCENE
// =====================================================

function createScene() {

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera();

    camera.matrixAutoUpdate = false;


    const light =
        new THREE.HemisphereLight(
            0xffffff,
            0xbbbbff,
            3
        );

    scene.add(light);


    // Reticle

    const reticleGeometry =
        new THREE.RingGeometry(
            0.08,
            0.11,
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

    reticle.matrixAutoUpdate = false;

    reticle.visible = false;

    scene.add(reticle);
}


// =====================================================
// CREATE CUBE
// =====================================================

function createCube() {

    const geometry =
        new THREE.BoxGeometry(
            0.20,
            0.20,
            0.20
        );


    const material =
        new THREE.MeshStandardMaterial({
            color: 0x00aaff,
            roughness: 0.30,
            metalness: 0.40
        });


    cube =
        new THREE.Mesh(
            geometry,
            material
        );

    cube.matrixAutoUpdate = false;

    cube.visible = false;

    scene.add(cube);
}


// =====================================================
// START AR
// =====================================================

async function startAR() {

    try {

        status.textContent =
            "Starting AR...";


        createScene();

        createCube();


        // Renderer

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


        renderer.xr.enabled = true;

        renderer.xr.setReferenceSpaceType(
            "local"
        );


        document.body.appendChild(
            renderer.domElement
        );


        // XR session

        xrSession =
            await navigator.xr.requestSession(
                "immersive-ar",
                {
                    requiredFeatures: [
                        "local",
                        "hit-test",
                        "anchors"
                    ],

                    optionalFeatures: [
                        "dom-overlay"
                    ],

                    domOverlay: {
                        root: document.body
                    }
                }
            );


        await renderer.xr.setSession(
            xrSession
        );


        // Reference spaces

        localReferenceSpace =
            await xrSession.requestReferenceSpace(
                "local"
            );


        viewerSpace =
            await xrSession.requestReferenceSpace(
                "viewer"
            );


        // Hit test

        hitTestSource =
            await xrSession.requestHitTestSource({
                space: viewerSpace
            });


        // Screen tap

        xrSession.addEventListener(
            "select",
            handleSelect
        );


        startButton.style.display =
            "none";


        status.textContent =
            "📷 Move your phone slowly around the room";


        renderer.setAnimationLoop(
            renderAR
        );


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
// AR FRAME
// =====================================================

function renderAR(
    time,
    frame
) {

    if (
        !frame ||
        !xrSession
    ) {

        return;
    }


    // -------------------------------------------------
    // Update cube from anchor
    // -------------------------------------------------

    if (cubeAnchor) {

        const anchorPose =
            frame.getPose(
                cubeAnchor.anchorSpace,
                localReferenceSpace
            );


        if (anchorPose) {

            cube.matrix.fromArray(
                anchorPose.transform.matrix
            );


            cube.visible = true;
        }
    }


    // -------------------------------------------------
    // Hit test
    // -------------------------------------------------

    currentHit = null;


    if (hitTestSource) {

        const hitResults =
            frame.getHitTestResults(
                hitTestSource
            );


        if (hitResults.length > 0) {

            currentHit =
                hitResults[0];


            const hitPose =
                currentHit.getPose(
                    localReferenceSpace
                );


            if (hitPose) {

                reticle.visible = true;


                reticle.matrix.fromArray(
                    hitPose.transform.matrix
                );


                if (!cube.visible) {

                    status.textContent =
                        "🎯 SURFACE FOUND — TAP TO PLACE";
                }
            }

        } else {

            reticle.visible = false;


            if (!cube.visible) {

                status.textContent =
                    "🔎 Looking for a surface...";
            }
        }
    }


    renderer.render(
        scene,
        camera
    );
}


// =====================================================
// SCREEN TAP
// =====================================================

async function handleSelect() {

    if (
        !currentHit ||
        !reticle ||
        !reticle.visible
    ) {

        return;
    }


    try {

        // -------------------------------------------------
        // Create anchor directly from hit result
        // -------------------------------------------------

        if (
            typeof currentHit.createAnchor ===
            "function"
        ) {

            cubeAnchor =
                await currentHit.createAnchor();


            status.textContent =
                "⚓ CUBE ANCHORED!";
        }

        // -------------------------------------------------
        // Fallback if hit-result anchors unavailable
        // -------------------------------------------------

        else {

            status.textContent =
                "🧊 CUBE PLACED — ANCHOR NOT AVAILABLE";
        }


        // -------------------------------------------------
        // Immediately place cube
        // -------------------------------------------------

        const hitPose =
            currentHit.getPose(
                localReferenceSpace
            );


        if (hitPose) {

            cube.matrix.fromArray(
                hitPose.transform.matrix
            );


            cube.visible = true;
        }


        reticle.visible = false;


    } catch (error) {

        console.error(
            "ANCHOR ERROR:",
            error
        );


        status.textContent =
            "❌ Anchor error: " +
            error.message;
    }
}


// =====================================================
// SESSION END
// =====================================================

function handleSessionEnd() {

    if (renderer) {

        renderer.setAnimationLoop(
            null
        );
    }


    if (cubeAnchor) {

        try {

            cubeAnchor.delete();

        } catch (error) {

            console.warn(error);
        }
    }


    cubeAnchor = null;

    xrSession = null;

    hitTestSource = null;

    localReferenceSpace = null;

    viewerSpace = null;

    currentHit = null;


    if (reticle) {

        reticle.visible = false;
    }


    if (cube) {

        cube.visible = false;
    }


    startButton.style.display =
        "inline-block";

    startButton.disabled =
        false;


    status.textContent =
        "AR session ended.";
}


// =====================================================
// BUTTON
// =====================================================

startButton.addEventListener(
    "click",
    startAR
);


// =====================================================
// INITIALIZE
// =====================================================

startButton.disabled = true;

checkARSupport();
