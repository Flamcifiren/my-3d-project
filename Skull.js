/* __V3D_TEMPLATE__ - template-based file; delete this line to prevent this file from being updated */

'use strict';

window.addEventListener('load', e => {
    const params = v3d.AppUtils.getPageParams();
    createApp({
        containerId: 'v3d-container',
        fsButtonId: 'fullscreen-button',
        sceneURL: params.load || 'Skull.gltf',
        logicURL: params.logic || 'visual_logic.js',
       });
});



async function createApp({containerId, fsButtonId = null, sceneURL, logicURL = ''}) {
    if (!sceneURL) {
        console.log('No scene URL specified');
        return;
    }

    // some puzzles can benefit from cache
    v3d.Cache.enabled = true;

    let PL = null, PE = null;
    if (v3d.AppUtils.isXML(logicURL)) {
        const PUZZLES_DIR = '/puzzles/';
        const logicURLJS = logicURL.match(/(.*)\.xml$/)[1] + '.js';
        PL = await new v3d.PuzzlesLoader().loadEditorWithLogic(PUZZLES_DIR, logicURLJS);
        PE = v3d.PE;
    } else if (v3d.AppUtils.isJS(logicURL)) {
        PL = await new v3d.PuzzlesLoader().loadLogic(logicURL);
    }

    let initOptions = { useFullscreen: true };
    if (PL) {
        initOptions = PL.execInitPuzzles({ container: containerId }).initOptions;
    }
    sceneURL = initOptions.useCompAssets ? `${sceneURL}.xz` : sceneURL;

    const disposeFullscreen = prepareFullscreen(containerId, fsButtonId,
            initOptions.useFullscreen);
    const preloader = createPreloader(containerId, initOptions, PE);

    const app = createAppInstance(containerId, initOptions, preloader, PE);
    app.addEventListener('dispose', () => disposeFullscreen && disposeFullscreen());

    if (initOptions.preloaderStartCb) initOptions.preloaderStartCb();
    app.loadScene(sceneURL, () => {
        app.enableControls();
        app.run();

        if (PE) PE.updateAppInstance(app);
        if (PL) PL.init(app, initOptions);

        runCode(app, PL);
    }, null, () => {
        console.log(`Can't load the scene ${sceneURL}`);
    });

    return { app, PL };
}


function createPreloader(containerId, initOptions, PE) {
    const preloader = initOptions.useCustomPreloader
            ? createCustomPreloader(initOptions.preloaderProgressCb,
            initOptions.preloaderEndCb)
            : new v3d.SimplePreloader({ container: containerId });

    if (PE) puzzlesEditorPreparePreloader(preloader, PE);

    return preloader;
}

function createCustomPreloader(updateCb, finishCb) {
    class CustomPreloader extends v3d.Preloader {
        constructor() {
            super();
        }

        onUpdate(percentage) {
            super.onUpdate(percentage);
            if (updateCb) updateCb(percentage);
        }

        onFinish() {
            super.onFinish();
            if (finishCb) finishCb();
        }
    }

    return new CustomPreloader();
}

/**
 * Modify the app's preloader to track the loading process in the Puzzles Editor.
 */
function puzzlesEditorPreparePreloader(preloader, PE) {
    const _onUpdate = preloader.onUpdate.bind(preloader);
    preloader.onUpdate = function(percentage) {
        _onUpdate(percentage);
        PE.loadingUpdateCb(percentage);
    }

    const _onFinish = preloader.onFinish.bind(preloader);
    preloader.onFinish = function() {
        _onFinish();
        PE.loadingFinishCb();
    }
}


function createAppInstance(containerId, initOptions, preloader, PE) {
    const ctxSettings = {};
    if (initOptions.useBkgTransp) ctxSettings.alpha = true;
    if (initOptions.preserveDrawBuf) ctxSettings.preserveDrawingBuffer = true;

    const app = new v3d.App(containerId, ctxSettings, preloader);
    if (initOptions.useBkgTransp) {
        app.clearBkgOnLoad = true;
        if (app.renderer) {
            app.renderer.setClearColor(0x000000, 0);
        }
    }

    // namespace for communicating with code generated by Puzzles
    app.ExternalInterface = {};
    prepareExternalInterface(app);
    if (PE) PE.viewportUseAppInstance(app);

    return app;
}


function prepareFullscreen(containerId, fsButtonId, useFullscreen) {
    const container = document.getElementById(containerId);
    const fsButton = document.getElementById(fsButtonId);

    if (!fsButton) {
        return null;
    }
    if (!useFullscreen) {
        if (fsButton) fsButton.style.display = 'none';
        return null;
    }

    const fsEnabled = () => document.fullscreenEnabled
            || document.webkitFullscreenEnabled
            || document.mozFullScreenEnabled
            || document.msFullscreenEnabled;
    const fsElement = () => document.fullscreenElement
            || document.webkitFullscreenElement
            || document.mozFullScreenElement
            || document.msFullscreenElement;
    const requestFs = elem => (elem.requestFullscreen
            || elem.mozRequestFullScreen
            || elem.webkitRequestFullscreen
            || elem.msRequestFullscreen).call(elem);
    const exitFs = () => (document.exitFullscreen
            || document.mozCancelFullScreen
            || document.webkitExitFullscreen
            || document.msExitFullscreen).call(document);
    const changeFs = () => {
        const elem = fsElement();
        fsButton.classList.add(elem ? 'fullscreen-close' : 'fullscreen-open');
        fsButton.classList.remove(elem ? 'fullscreen-open' : 'fullscreen-close');
    };

    function fsButtonClick(event) {
        event.stopPropagation();
        if (fsElement()) {
            exitFs();
        } else {
            requestFs(container);
        }
    }

    if (fsEnabled()) fsButton.style.display = 'inline';

    fsButton.addEventListener('click', fsButtonClick);
    document.addEventListener('webkitfullscreenchange', changeFs);
    document.addEventListener('mozfullscreenchange', changeFs);
    document.addEventListener('msfullscreenchange', changeFs);
    document.addEventListener('fullscreenchange', changeFs);

    const disposeFullscreen = () => {
        fsButton.removeEventListener('click', fsButtonClick);
        document.removeEventListener('webkitfullscreenchange', changeFs);
        document.removeEventListener('mozfullscreenchange', changeFs);
        document.removeEventListener('msfullscreenchange', changeFs);
        document.removeEventListener('fullscreenchange', changeFs);
    }

    return disposeFullscreen;
}


function prepareExternalInterface(app) {
    /**
     * Register functions in the app.ExternalInterface to call them from
     * Puzzles, e.g:
     * app.ExternalInterface.myJSFunction = function() {
     *     console.log('Hello, World!');
     * }
     */

}

function runCode(app, puzzles) {
    const skull = app.scene.getObjectByName('20250206_145107_mesh');
  if (!skull) {
        console.error('Skull object not found!');
        return;
    }

    // CONFIGURATION
    const sensitivity = -0.001;  // Inverted movement
    const maxRotation = 0.4;     // Maximum rotation (~11 degrees)
    const rotationAxis = 'y';    // 'y' for left/right or 'x' for up/down

    const windowCenterX = window.innerWidth / 2;
    const windowCenterY = window.innerHeight / 2;

    let targetRotation = 0;

    // MOUSE MOVE EVENT (Desktop)
    document.addEventListener('mousemove', (event) => {
        if (rotationAxis === 'y') {
            targetRotation = (event.clientX - windowCenterX) * sensitivity;
        } else if (rotationAxis === 'x') {
            targetRotation = (event.clientY - windowCenterY) * sensitivity;
        }
        targetRotation = Math.max(-maxRotation, Math.min(maxRotation, targetRotation));
    });

    // TOUCH MOVE EVENT (Mobile)
    document.addEventListener('touchmove', (event) => {
        const touch = event.touches[0];  // Get the first touch point
        if (rotationAxis === 'y') {
            targetRotation = (touch.clientX - windowCenterX) * sensitivity;
        } else if (rotationAxis === 'x') {
            targetRotation = (touch.clientY - windowCenterY) * sensitivity;
        }
        targetRotation = Math.max(-maxRotation, Math.min(maxRotation, targetRotation));
    }, { passive: true });  // passive:true for better performance on mobile

    // SMOOTH ANIMATION
    app.addEventListener('beforeRender', () => {
        if (rotationAxis === 'y') {
            skull.rotation.y += (targetRotation - skull.rotation.y) * 0.02;
        } else if (rotationAxis === 'x') {
            skull.rotation.x += (targetRotation - skull.rotation.x) * 0.02;
        }
    });
}
