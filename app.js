import * as THREE from
    "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";


const startButton =
    document.getElementById("startAR");

const status =
    document.getElementById("status");


let camera;
let scene;
let renderer;

let controller;

let reticle;

let hitTestSource = null;

let hitTestSourceRequested = false;

let cube = null;


// ======================================================
// CHECK WEBXR
// ======================================================

async function checkAR() {

    if (!navigator.xr) {

        status.textContent =
            "WebXR not available";

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

        }
        else {

            status.textContent =
                "AR not supported";

            startButton.disabled = true;
        }

    }
    catch (error) {

        console.error(error);

        status.textContent =
            "AR check failed";

        startButton.disabled = true;
    }
}


// ======================================================
// START AR
// ======================================================

async function startAR() {

    try {

        status.textContent =
            "Starting AR...";


        const session =
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


        // ----------------------------------------------
        // THREE.JS
        // ----------------------------------------------

        scene = new THREE.Scene();


        camera =
            new THREE.PerspectiveCamera();


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


        renderer.xr.enabled = true;


        document.body.appendChild(
            renderer.domElement
        );


        // ----------------------------------------------
        // LIGHT
        // ----------------------------------------------

        const light =
            new THREE.HemisphereLight(
                0xffffff,
                0xbbbbff,
                3
            );


        scene.add(light);


        // ----------------------------------------------
        // RETICLE
        // ----------------------------------------------

        const ringGeometry =
            new THREE.RingGeometry(
                0.08,
                0.1,
                32
            );


        ringGeometry.rotateX(
            -Math.PI / 2
        );


        const ringMaterial =
            new THREE.MeshBasicMaterial({
                color: 0x00ff00
            });


        reticle =
            new THREE.Mesh(
                ringGeometry,
                ringMaterial
            );


        reticle.matrixAutoUpdate =
            false;


        reticle.visible =
            false;


        scene.add(reticle);


        // ----------------------------------------------
        // CONTROLLER
        // ----------------------------------------------

        controller =
            renderer.xr.getController(0);


        controller.addEventListener(
            "select",
            placeCube
        );


        scene.add(controller);


        // ----------------------------------------------
        // START XR
        // ----------------------------------------------

        renderer.xr.setSession(
            session
        );


        session.addEventListener(
            "end",
            () => {

                status.textContent =
                    "AR ended";

                hitTestSource = null;

                hitTestSourceRequested =
                    false;

                startButton.disabled =
                    false;

                startButton.textContent =
                    "START AR";
            }
        );


        startButton.style.display =
            "none";


        status.textContent =
            "📷 AR ACTIVE — move your phone slowly";


        renderer.setAnimationLoop(
            render
        );

    }
    catch (error) {

        console.error(
            "AR START ERROR:",
            error
        );


        status.textContent =
            "❌ " + error.name +
            ": " + error.message;
    }
}


// ======================================================
// PLACE CUBE
// ======================================================

function placeCube() {

    if (
        !reticle ||
        !reticle.visible
    ) {

        return;
    }


    // If cube doesn't exist,
    // create it.

    if (!cube) {

        const geometry =
            new THREE.BoxGeometry(
                0.15,
                0.15,
                0.15
            );


        const material =
            new THREE.MeshStandardMaterial({
                color: 0x00aaff
            });


        cube =
            new THREE.Mesh(
                geometry,
                material
            );


        scene.add(cube);
    }


    // Put cube exactly where
    // the reticle detected the surface.

    cube.position.setFromMatrixPosition(
        reticle.matrix
    );


    cube.visible = true;


    status.textContent =
        "🧊 CUBE PLACED!";
}


// ======================================================
// RENDER LOOP
// ======================================================

function render(
    timestamp,
    frame
) {

    if (!frame) {

        return;
    }


    const session =
        renderer.xr.getSession();


    // ----------------------------------------------
    // HIT TEST
    // ----------------------------------------------

    if (!hitTestSourceRequested) {

        session.requestReferenceSpace(
            "viewer"
        )
        .then(
            viewerSpace => {

                session.requestHitTestSource({
                    space: viewerSpace
                })
                .then(
                    source => {

                        hitTestSource =
                            source;
                    }
                );

            }
        );


        hitTestSourceRequested =
            true;
    }


    if (hitTestSource) {

        const referenceSpace =
            renderer.xr.getReferenceSpace();


        const hitTestResults =
            frame.getHitTestResults(
                hitTestSource
            );


        if (
            hitTestResults.length > 0
        ) {

            const hit =
                hitTestResults[0];


            const pose =
                hit.getPose(
                    referenceSpace
                );


            if (pose) {

                reticle.visible =
                    true;


                reticle.matrix.fromArray(
                    pose.transform.matrix
                );


                if (!cube) {

                    status.textContent =
                        "🎯 SURFACE FOUND — TAP TO PLACE";
                }
            }

        }
        else {

            reticle.visible =
                false;
        }
    }


    renderer.render(
        scene,
        camera
    );
}


// ======================================================
// BUTTON
// ======================================================

startButton.addEventListener(
    "click",
    startAR
);


// ======================================================
// START CHECK
// ======================================================

startButton.disabled =
    true;


checkAR();
