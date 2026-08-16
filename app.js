import * as THREE from
    "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";


const startButton = document.getElementById("startAR");
const status = document.getElementById("status");

let session = null;
let renderer = null;
let scene = null;
let camera = null;

let hitTestSource = null;
let hitTestSourceRequested = false;

let reticle = null;
let cube = null;


// =====================================================
// CHECK AR SUPPORT
// =====================================================

async function checkAR() {

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
                "AR is not supported.";

            startButton.disabled = true;
        }

    } catch (error) {

        console.error(error);

        status.textContent =
            "AR check failed.";

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


        // =================================================
        // CANVAS
        // =================================================

        const canvas =
            document.createElement("canvas");

        document.body.appendChild(canvas);


        // =================================================
        // WEBGL CONTEXT
        // =================================================

        const gl =
            canvas.getContext(
                "webgl",
                {
                    xrCompatible: true,
                    alpha: true,
                    antialias: true
                }
            );


        if (!gl) {

            throw new Error(
                "WebGL could not be created."
            );
        }


        // =================================================
        // THREE.JS RENDERER
        // =================================================

        renderer =
            new THREE.WebGLRenderer({

                canvas: canvas,

                context: gl,

                alpha: true,

                antialias: true,

                preserveDrawingBuffer: true

            });


        renderer.autoClear = false;


        // =================================================
        // THREE.JS SCENE
        // =================================================

        scene =
            new THREE.Scene();


        // =================================================
        // CAMERA
        // =================================================

        camera =
            new THREE.PerspectiveCamera();


        camera.matrixAutoUpdate =
            false;


        // =================================================
        // LIGHT
        // =================================================

        const light =
            new THREE.HemisphereLight(
                0xffffff,
                0xbbbbff,
                3
            );

        scene.add(light);


        // =================================================
        // REQUEST XR SESSION
        // =================================================

        session =
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
        // CREATE XR RENDERING LAYER
        // =================================================

        const baseLayer =
            new XRWebGLLayer(
                session,
                gl
            );


        session.updateRenderState({
            baseLayer: baseLayer
        });


        // =================================================
        // REFERENCE SPACE
        // =================================================

        const referenceSpace =
            await session.requestReferenceSpace(
                "local"
            );


        // =================================================
        // VIEWER SPACE FOR HIT TEST
        // =================================================

        const viewerSpace =
            await session.requestReferenceSpace(
                "viewer"
            );


        hitTestSource =
            await session.requestHitTestSource({
                space: viewerSpace
            });


        // =================================================
        // CREATE RETICLE
        // =================================================

        const reticleGeometry =
            new THREE.RingGeometry(
                0.08,
                0.1,
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


        scene.add(reticle);


        // =================================================
        // SCREEN TAP
        // =================================================

        session.addEventListener(
            "select",
            placeCube
        );


        // =================================================
        // HIDE START BUTTON
        // =================================================

        startButton.style.display =
            "none";


        status.textContent =
            "📷 AR ACTIVE — move your phone slowly";


        // =================================================
        // XR FRAME LOOP
        // =================================================

        session.requestAnimationFrame(
            (time, frame) => {

                onXRFrame(
                    time,
                    frame,
                    referenceSpace
                );

            }
        );


        // =================================================
        // SESSION END
        // =================================================

        session.addEventListener(
            "end",
            () => {

                session = null;

                hitTestSource = null;

                hitTestSourceRequested =
                    false;

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
// XR FRAME
// =====================================================

function onXRFrame(
    time,
    frame,
    referenceSpace
) {

    session.requestAnimationFrame(
        (nextTime, nextFrame) => {

            onXRFrame(
                nextTime,
                nextFrame,
                referenceSpace
            );

        }
    );


    const pose =
        frame.getViewerPose(
            referenceSpace
        );


    if (!pose) {

        return;
    }


    // =================================================
    // BIND XR FRAMEBUFFER
    // =================================================

    const baseLayer =
        session.renderState.baseLayer;


    renderer.setFramebuffer(
        baseLayer.framebuffer
    );


    // =================================================
    // GET FIRST VIEW
    // =================================================

    const view =
        pose.views[0];


    const viewport =
        baseLayer.getViewport(
            view
        );


    renderer.setSize(
        viewport.width,
        viewport.height,
        false
    );


    // =================================================
    // UPDATE THREE CAMERA
    // =================================================

    camera.matrix.fromArray(
        view.transform.matrix
    );


    camera.projectionMatrix.fromArray(
        view.projectionMatrix
    );


    camera.matrixWorld.copy(
        camera.matrix
    );


    camera.matrixWorldInverse
        .copy(camera.matrixWorld)
        .invert();


    camera.updateMatrixWorld(
        true
    );


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
                    referenceSpace
                );


            if (hitPose) {

                reticle.visible =
                    true;


                reticle.matrix.fromArray(
                    hitPose.transform.matrix
                );


                if (!cube) {

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
    // RENDER
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
        !reticle.visible
    ) {

        return;
    }


    // Create cube once

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


    // Put cube at reticle position

    cube.matrix.copy(
        reticle.matrix
    );


    cube.matrixAutoUpdate =
        false;


    cube.visible =
        true;


    status.textContent =
        "🧊 CUBE PLACED!";
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
