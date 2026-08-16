const startButton = document.getElementById("startAR");

const status = document.getElementById("status");


async function checkAR() {

    if (!navigator.xr) {

        status.textContent =
            "WebXR is not available in this browser.";

        return;

    }


    const supported =
        await navigator.xr.isSessionSupported(
            "immersive-ar"
        );


    if (supported) {

        status.textContent =
            "🔥 Immersive AR is supported!";

        startButton.disabled = false;

    } else {

        status.textContent =
            "AR is not supported on this browser.";

        startButton.disabled = true;

    }

}


startButton.disabled = true;

checkAR();