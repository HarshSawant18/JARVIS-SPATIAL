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
let localReferenceSpace = null;
let hitTestSource = null;


// =====================================================
// OBJECTS
// =====================================================

let reticle = null;
let cube = null;


// =====================================================
// CHECK AR
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
            "❌ AR check failed.";

        startButton.disabled = true;
    }
}


// =====================================================
// CREATE SCENE
// =====================================================

function createScene() {

    scene = new THREE.Scene();


    // Camera

    camera =
        new THREE.PerspectiveCamera();


    camera.matrixAutoUpdate = false;


    // Light

    const light =
        new THREE.HemisphereLight(
            0xffffff,
            0xbbbbff,
            3
        );

    scene.add(light);


    // -------------------------------------------------
    // RETICLE
    // -------------------------------------------------

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
            roughness: 0.3,
            metalness: 0.4
        });


    cube =
        new THREE.Mesh(
            geometry,
            material
        );


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


        // -------------------------------------------------
        // Scene
        // -------------------------------------------------

        createScene();

        createCube();


        // -------------------------------------------------
        // Renderer
        // -------------------------------------------------

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


        document.body.appendChild(
            renderer.domElement
        );


        // -------------------------------------------------
        // AR Session
        // -------------------------------------------------

        xrSession =
            await navigator.xr.requestSession(
                "immersive-ar",
                {
                    requiredFeatures: [
                        "local",
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


        // -------------------------------------------------
        // Give session to Three.js
        // -------------------------------------------------

        await renderer.xr.setSession(
            xrSession
        );


        // -------------------------------------------------
        // Reference space
        // -------------------------------------------------

        localReferenceSpace =
            await xrSession.requestReferenceSpace(
                "local"
            );


        // -------------------------------------------------
        // Viewer space
        // -------------------------------------------------

        const viewerSpace =
            await xrSession.requestReferenceSpace(
                "viewer"
            );


        // -------------------------------------------------
        // Hit test source
        // -------------------------------------------------

        hitTestSource =
            await xrSession.requestHitTestSource({
                space: viewerSpace
            });


        // -------------------------------------------------
        // UI
        // -------------------------------------------------

        startButton.style.display =
            "none";


        status.textContent =
            "📷 Move your phone slowly around the room";


        // -------------------------------------------------
        // XR LOOP
        // -------------------------------------------------

        renderer.setAnimationLoop(
            renderAR
        );


        // -------------------------------------------------
        // END SESSION
        // -------------------------------------------------

        xrSession.addEventListener(
            "end",
            () => {

                renderer.setAnimationLoop(null);

                xrSession = null;

                hitTestSource = null;

                localReferenceSpace = null;

                if (reticle) {
                    reticle.visible = false;
                }

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
// AR FRAME LOOP
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
    // Hit test
    // -------------------------------------------------

    if (hitTestSource) {

        const results =
            frame.getHitTestResults(
                hitTestSource
            );


        if (results.length > 0) {

            const hit =
                results[0];


            const pose =
                hit.getPose(
                    localReferenceSpace
                );


            if (pose) {

                // Show reticle

                reticle.visible = true;


                reticle.matrix.fromArray(
                    pose.transform.matrix
                );


                // -------------------------------------------------
                // AUTO PLACE CUBE
                // -------------------------------------------------

                if (!cube.visible) {

                    cube.matrix.fromArray(
                        pose.transform.matrix
                    );


                    cube.matrixAutoUpdate =
                        false;


                    cube.visible = true;


                    status.textContent =
                        "🧊 CUBE PLACED — MOVE YOUR PHONE";
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


    // -------------------------------------------------
    // Render
    // -------------------------------------------------

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
// INITIALIZE
// =====================================================

startButton.disabled = true;

checkARSupport();
