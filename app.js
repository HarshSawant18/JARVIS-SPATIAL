import * as THREE from
    "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";


// =====================================================
// UI
// =====================================================

const startButton = document.getElementById("startAR");
const status = document.getElementById("status");


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
let viewerSpace = null;
let hitTestSource = null;


// =====================================================
// AR OBJECTS
// =====================================================

let reticle = null;
let cube = null;


// =====================================================
// HIT TEST
// =====================================================

let currentHit = null;


// =====================================================
// HAND TRACKING
// =====================================================

let leftHand = null;
let rightHand = null;

let handJoints = [];

let pinchLeft = false;
let pinchRight = false;

let leftPinchPosition = new THREE.Vector3();
let rightPinchPosition = new THREE.Vector3();


// =====================================================
// OBJECT CONTROL
// =====================================================

let cubePlaced = false;

let cubeGrabbed = false;

let grabMode = "none";

let grabOffset = new THREE.Vector3();


// =====================================================
// TWO-HAND SCALE
// =====================================================

let twoHandScaling = false;

let scaleStartDistance = 0;

let scaleStartSize = 0.20;


// =====================================================
// CONSTANTS
// =====================================================

const PINCH_DISTANCE = 0.035;

const GRAB_DISTANCE = 0.20;

const MIN_CUBE_SIZE = 0.05;

const MAX_CUBE_SIZE = 0.80;


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


    // ---------------------------------------------
    // Camera
    // ---------------------------------------------

    camera =
        new THREE.PerspectiveCamera();

    camera.matrixAutoUpdate = false;


    // ---------------------------------------------
    // Lighting
    // ---------------------------------------------

    const light =
        new THREE.HemisphereLight(
            0xffffff,
            0xbbbbff,
            3
        );

    scene.add(light);


    // ---------------------------------------------
    // Reticle
    // ---------------------------------------------

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


    reticle.matrixAutoUpdate =
        false;

    reticle.visible =
        false;


    scene.add(reticle);


    // ---------------------------------------------
    // Cube
    // ---------------------------------------------

    const cubeGeometry =
        new THREE.BoxGeometry(
            0.20,
            0.20,
            0.20
        );


    const cubeMaterial =
        new THREE.MeshStandardMaterial({

            color: 0x00aaff,

            roughness: 0.30,

            metalness: 0.40
        });


    cube =
        new THREE.Mesh(
            cubeGeometry,
            cubeMaterial
        );


    cube.visible =
        false;


    scene.add(cube);
}


// =====================================================
// CREATE HAND VISUALIZATION
// =====================================================

function createHandVisualization() {

    const jointGeometry =
        new THREE.SphereGeometry(
            0.008,
            8,
            8
        );


    const jointMaterial =
        new THREE.MeshBasicMaterial({
            color: 0xff00ff
        });


    for (let i = 0; i < 42; i++) {

        const joint =
            new THREE.Mesh(
                jointGeometry,
                jointMaterial
            );


        joint.visible =
            false;


        scene.add(joint);

        handJoints.push(joint);
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
        // Create scene
        // ---------------------------------------------

        createScene();

        createHandVisualization();


        // ---------------------------------------------
        // Renderer
        // ---------------------------------------------

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


        // ---------------------------------------------
        // Request AR
        // ---------------------------------------------

        xrSession =
            await navigator.xr.requestSession(

                "immersive-ar",

                {

                    requiredFeatures: [

                        "local",

                        "hit-test"
                    ],

                    optionalFeatures: [

                        "anchors",

                        "hand-tracking",

                        "dom-overlay"
                    ],

                    domOverlay: {

                        root: document.body
                    }
                }
            );


        // ---------------------------------------------
        // Give session to Three.js
        // ---------------------------------------------

        await renderer.xr.setSession(
            xrSession
        );


        // ---------------------------------------------
        // Reference spaces
        // ---------------------------------------------

        localReferenceSpace =
            await xrSession.requestReferenceSpace(
                "local"
            );


        viewerSpace =
            await xrSession.requestReferenceSpace(
                "viewer"
            );


        // ---------------------------------------------
        // Hit test
        // ---------------------------------------------

        hitTestSource =
            await xrSession.requestHitTestSource({

                space: viewerSpace
            });


        // ---------------------------------------------
        // XR HANDS
        // ---------------------------------------------

        // Ask Three.js for the two WebXR hands.
        // They will only become active if the browser
        // exposes actual hand tracking.

        leftHand =
            renderer.xr.getHand(0);

        rightHand =
            renderer.xr.getHand(1);


        scene.add(leftHand);
        scene.add(rightHand);


        // ---------------------------------------------
        // Select / screen tap
        // ---------------------------------------------

        xrSession.addEventListener(
            "select",
            placeCube
        );


        // ---------------------------------------------
        // UI
        // ---------------------------------------------

        startButton.style.display =
            "none";


        status.textContent =
            "📷 Move phone slowly to find a surface";


        // ---------------------------------------------
        // XR render loop
        // ---------------------------------------------

        renderer.setAnimationLoop(
            renderAR
        );


        // ---------------------------------------------
        // Session end
        // ---------------------------------------------

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
// PLACE CUBE
// =====================================================

function placeCube() {

    if (

        !currentHit ||

        !reticle ||

        !reticle.visible
    ) {

        return;
    }


    const pose =
        currentHit.getPose(
            localReferenceSpace
        );


    if (!pose) {

        return;
    }


    // ---------------------------------------------
    // Put cube at hit position
    // ---------------------------------------------

    cube.position.set(

        pose.transform.position.x,

        pose.transform.position.y,

        pose.transform.position.z
    );


    cube.quaternion.set(

        pose.transform.orientation.x,

        pose.transform.orientation.y,

        pose.transform.orientation.z,

        pose.transform.orientation.w
    );


    cube.visible =
        true;


    cubePlaced =
        true;


    status.textContent =
        "🧊 CUBE PLACED — USE YOUR HAND TO GRAB IT";
}


// =====================================================
// GET HAND JOINT POSE
// =====================================================

function getJointPosition(
    hand,
    frame,
    jointName
) {

    if (
        !hand ||
        !hand.hand
    ) {

        return null;
    }


    const joint =
        hand.hand.get(
            jointName
        );


    if (!joint) {

        return null;
    }


    const pose =
        frame.getJointPose(
            joint,
            localReferenceSpace
        );


    if (!pose) {

        return null;
    }


    return new THREE.Vector3(

        pose.transform.position.x,

        pose.transform.position.y,

        pose.transform.position.z
    );
}


// =====================================================
// UPDATE ONE HAND
// =====================================================

function updateHand(
    hand,
    frame,
    jointOffset,
    side
) {

    if (
        !hand ||
        !hand.hand
    ) {

        return false;
    }


    const thumbTip =
        getJointPosition(
            hand,
            frame,
            "thumb-tip"
        );


    const indexTip =
        getJointPosition(
            hand,
            frame,
            "index-finger-tip"
        );


    if (
        !thumbTip ||
        !indexTip
    ) {

        return false;
    }


    // ---------------------------------------------
    // Pinch point
    // ---------------------------------------------

    const pinchPoint =
        new THREE.Vector3()
            .addVectors(
                thumbTip,
                indexTip
            )
            .multiplyScalar(0.5);


    // ---------------------------------------------
    // Pinch distance
    // ---------------------------------------------

    const pinchDistance =
        thumbTip.distanceTo(
            indexTip
        );


    const isPinching =
        pinchDistance <
        PINCH_DISTANCE;


    // ---------------------------------------------
    // Save positions
    // ---------------------------------------------

    if (side === "left") {

        leftPinchPosition.copy(
            pinchPoint
        );

        pinchLeft =
            isPinching;

    } else {

        rightPinchPosition.copy(
            pinchPoint
        );

        pinchRight =
            isPinching;
    }


    // ---------------------------------------------
    // Draw thumb
    // ---------------------------------------------

    const thumbJoint =
        hand.hand.get(
            "thumb-tip"
        );


    const indexJoint =
        hand.hand.get(
            "index-finger-tip"
        );


    const thumbPose =
        frame.getJointPose(
            thumbJoint,
            localReferenceSpace
        );


    const indexPose =
        frame.getJointPose(
            indexJoint,
            localReferenceSpace
        );


    if (
        thumbPose &&
        indexPose
    ) {

        const thumbVisual =
            handJoints[
                jointOffset
            ];


        const indexVisual =
            handJoints[
                jointOffset + 1
            ];


        thumbVisual.position.set(

            thumbPose.transform.position.x,

            thumbPose.transform.position.y,

            thumbPose.transform.position.z
        );


        indexVisual.position.set(

            indexPose.transform.position.x,

            indexPose.transform.position.y,

            indexPose.transform.position.z
        );


        thumbVisual.visible =
            true;


        indexVisual.visible =
            true;


        // -----------------------------------------
        // Pinch point
        // -----------------------------------------

        const pinchVisual =
            handJoints[
                jointOffset + 2
            ];


        pinchVisual.position.copy(
            pinchPoint
        );


        pinchVisual.visible =
            true;


        pinchVisual.material.color.set(
            isPinching
                ? 0x00ff00
                : 0xff00ff
        );
    }


    return true;
}


// =====================================================
// HIDE HAND VISUALS
// =====================================================

function hideHandVisuals(
    offset
) {

    for (
        let i = offset;
        i < offset + 3;
        i++
    ) {

        if (handJoints[i]) {

            handJoints[i].visible =
                false;
        }
    }
}


// =====================================================
// CHECK HAND GRAB
// =====================================================

function handleSingleHandGrab(
    pinchPosition,
    isPinching
) {

    if (!cubePlaced) {

        return;
    }


    const cubeDistance =
        pinchPosition.distanceTo(
            cube.position
        );


    // ---------------------------------------------
    // Start grab
    // ---------------------------------------------

    if (
        isPinching &&
        !cubeGrabbed &&
        cubeDistance < GRAB_DISTANCE
    ) {

        cubeGrabbed =
            true;

        grabMode =
            "single";


        grabOffset =
            cube.position.clone()
                .sub(
                    pinchPosition
                );


        status.textContent =
            "🤏 CUBE GRABBED";
    }


    // ---------------------------------------------
    // Move grabbed cube
    // ---------------------------------------------

    if (
        cubeGrabbed &&
        grabMode === "single"
    ) {

        if (isPinching) {

            cube.position.copy(
                pinchPosition
            );


            cube.position.add(
                grabOffset
            );


            status.textContent =
                "✋ MOVING CUBE";

        } else {

            cubeGrabbed =
                false;

            grabMode =
                "none";


            status.textContent =
                "🧊 CUBE RELEASED";
        }
    }
}


// =====================================================
// TWO HAND SCALE
// =====================================================

function handleTwoHandScale() {

    if (
        !cubePlaced ||
        !pinchLeft ||
        !pinchRight
    ) {

        if (
            grabMode === "two-hand"
        ) {

            twoHandScaling =
                false;

            grabMode =
                "none";

            status.textContent =
                "🧊 TWO-HAND CONTROL ENDED";
        }

        return;
    }


    const distance =
        leftPinchPosition.distanceTo(
            rightPinchPosition
        );


    // ---------------------------------------------
    // Start two-hand mode
    // ---------------------------------------------

    if (!twoHandScaling) {

        twoHandScaling =
            true;

        cubeGrabbed =
            false;

        grabMode =
            "two-hand";


        scaleStartDistance =
            distance;


        scaleStartSize =
            cube.scale.x;


        status.textContent =
            "🤲 TWO-HAND CONTROL";
    }


    // ---------------------------------------------
    // Scale
    // ---------------------------------------------

    if (
        scaleStartDistance <= 0
    ) {

        return;
    }


    const ratio =
        distance /
        scaleStartDistance;


    let newScale =
        scaleStartSize *
        ratio;


    newScale =
        Math.max(
            MIN_CUBE_SIZE / 0.20,
            Math.min(
                MAX_CUBE_SIZE / 0.20,
                newScale
            )
        );


    cube.scale.set(
        newScale,
        newScale,
        newScale
    );


    // ---------------------------------------------
    // Move cube to hand midpoint
    // ---------------------------------------------

    const midpoint =
        new THREE.Vector3()
            .addVectors(
                leftPinchPosition,
                rightPinchPosition
            )
            .multiplyScalar(0.5);


    cube.position.copy(
        midpoint
    );


    status.textContent =
        "🤲 SCALE + MOVE";
}


// =====================================================
// UPDATE HAND TRACKING
// =====================================================

function updateHandTracking(
    frame
) {

    pinchLeft =
        false;

    pinchRight =
        false;


    // ---------------------------------------------
    // Left hand
    // ---------------------------------------------

    const leftDetected =
        updateHand(

            leftHand,

            frame,

            0,

            "left"
        );


    if (!leftDetected) {

        hideHandVisuals(0);
    }


    // ---------------------------------------------
    // Right hand
    // ---------------------------------------------

    const rightDetected =
        updateHand(

            rightHand,

            frame,

            3,

            "right"
        );


    if (!rightDetected) {

        hideHandVisuals(3);
    }


    // ---------------------------------------------
    // Hand tracking unavailable
    // ---------------------------------------------

    if (
        !leftDetected &&
        !rightDetected
    ) {

        if (cubePlaced) {

            status.textContent =
                "🖐️ SHOW YOUR HANDS";
        }

        return;
    }


    // ---------------------------------------------
    // TWO HAND MODE
    // ---------------------------------------------

    if (
        leftDetected &&
        rightDetected &&
        pinchLeft &&
        pinchRight
    ) {

        handleTwoHandScale();

        return;
    }


    // ---------------------------------------------
    // SINGLE HAND MODE
    // ---------------------------------------------

    if (
        grabMode === "two-hand"
    ) {

        twoHandScaling =
            false;

        grabMode =
            "none";
    }


    if (leftDetected && pinchLeft) {

        handleSingleHandGrab(
            leftPinchPosition,
            pinchLeft
        );

    } else if (
        rightDetected &&
        pinchRight
    ) {

        handleSingleHandGrab(
            rightPinchPosition,
            pinchRight
        );

    } else if (
        cubeGrabbed &&
        grabMode === "single"
    ) {

        cubeGrabbed =
            false;

        grabMode =
            "none";

        status.textContent =
            "🧊 CUBE RELEASED";
    }
}


// =====================================================
// XR RENDER LOOP
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


    // ---------------------------------------------
    // Hit testing
    // ---------------------------------------------

    currentHit =
        null;


    if (hitTestSource) {

        const hitResults =
            frame.getHitTestResults(
                hitTestSource
            );


        if (
            hitResults.length > 0
        ) {

            currentHit =
                hitResults[0];


            const hitPose =
                currentHit.getPose(
                    localReferenceSpace
                );


            if (hitPose) {

                reticle.visible =
                    true;


                reticle.matrix.fromArray(
                    hitPose.transform.matrix
                );


                if (!cubePlaced) {

                    status.textContent =
                        "🎯 SURFACE FOUND — TAP TO PLACE";
                }
            }

        } else {

            reticle.visible =
                false;
        }
    }


    // ---------------------------------------------
    // Hand tracking
    // ---------------------------------------------

    updateHandTracking(
        frame
    );


    // ---------------------------------------------
    // Render
    // ---------------------------------------------

    renderer.render(
        scene,
        camera
    );
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


    if (hitTestSource) {

        try {

            hitTestSource.cancel();

        } catch (error) {

            console.warn(error);
        }
    }


    xrSession =
        null;

    hitTestSource =
        null;

    localReferenceSpace =
        null;

    viewerSpace =
        null;


    currentHit =
        null;


    cubePlaced =
        false;


    cubeGrabbed =
        false;


    twoHandScaling =
        false;


    grabMode =
        "none";


    if (cube) {

        cube.visible =
            false;
    }


    if (reticle) {

        reticle.visible =
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
