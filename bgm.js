(() => {
    const audio = document.getElementById('bgm-audio');
    const muteBtn = document.getElementById('mute-btn');
    const iconVolume = document.getElementById('icon-volume');
    const iconMute = document.getElementById('icon-mute');
    const volumeSlider = document.getElementById('volume-slider');
    const sliderProgress = document.getElementById('slider-progress');

    if (!audio || !muteBtn || !volumeSlider || !sliderProgress) return;

    const TIME_KEY = 'fyulap-bgm-current-time';
    const VOLUME_KEY = 'fyulap-bgm-volume';
    const MUTED_KEY = 'fyulap-bgm-muted';

    const readStorage = (key, fallback = null) => {
        try {
            const value = sessionStorage.getItem(key);
            return value === null ? fallback : value;
        } catch (_) {
            return fallback;
        }
    };

    const writeStorage = (key, value) => {
        try {
            sessionStorage.setItem(key, String(value));
        } catch (_) {}
    };

    const storedVolumeRaw = readStorage(VOLUME_KEY, null);
    const storedMutedRaw = readStorage(MUTED_KEY, null);
    const storedVolume = parseFloat(storedVolumeRaw);
    const hasValidVolume = Number.isFinite(storedVolume) && storedVolume > 0;
    const hasSavedState = storedMutedRaw !== null || storedVolumeRaw !== null;

    // 初回だけミュート。2ページ目以降は直前の状態をそのまま引き継ぐ。
    let lastVolume = hasValidVolume ? Math.max(0.01, Math.min(1, storedVolume)) : 0.5;
    let isMuted = hasSavedState ? storedMutedRaw === 'true' : true;

    audio.volume = Math.pow(lastVolume, 2);
    audio.muted = isMuted;

    // ミュート中でも、最後に設定した音量位置はバーに残す。
    // 初回だけは0から開始する。
    volumeSlider.value = hasSavedState ? String(isMuted ? lastVolume : lastVolume) : '0';

    function updateUI() {
        const sliderValue = parseFloat(volumeSlider.value) || 0;
        sliderProgress.style.width = `${sliderValue * 100}%`;
        iconVolume.style.display = isMuted ? 'none' : 'block';
        iconMute.style.display = isMuted ? 'block' : 'none';
        muteBtn.setAttribute('aria-label', isMuted ? 'ミュート解除' : 'ミュート');
        muteBtn.setAttribute('title', isMuted ? 'ミュート解除' : 'ミュート');
    }

    function saveState() {
        writeStorage(VOLUME_KEY, lastVolume);
        writeStorage(MUTED_KEY, isMuted);
    }

    updateUI();

    let restored = false;
    function restorePosition() {
        if (restored) return;
        restored = true;
        const savedTime = parseFloat(readStorage(TIME_KEY, '0'));
        if (Number.isFinite(savedTime) && savedTime >= 0 && (!Number.isFinite(audio.duration) || savedTime < audio.duration)) {
            try { audio.currentTime = savedTime; } catch (_) {}
        }
    }

    if (audio.readyState >= 1) restorePosition();
    else audio.addEventListener('loadedmetadata', restorePosition, { once: true });

    function savePosition() {
        if (Number.isFinite(audio.currentTime)) writeStorage(TIME_KEY, audio.currentTime);
    }

    audio.addEventListener('timeupdate', savePosition);
    window.addEventListener('pagehide', () => {
        savePosition();
        saveState();
    });
    window.addEventListener('beforeunload', () => {
        savePosition();
        saveState();
    });

    function playAudio() {
        audio.play().catch(() => {});
    }

    // ミュート状態なら、ミュートのままBGMを再生しておく。
    playAudio();

    // 自動再生がブロックされた場合のみ、ユーザー操作後に再試行。
    const startOnInteraction = () => {
        if (audio.paused) playAudio();
        document.removeEventListener('pointerdown', startOnInteraction);
        document.removeEventListener('keydown', startOnInteraction);
    };
    document.addEventListener('pointerdown', startOnInteraction, { once: true });
    document.addEventListener('keydown', startOnInteraction, { once: true });

    // 音量バーを動かしたら、その値を保存してミュート解除。
    volumeSlider.addEventListener('input', (event) => {
        const value = Math.max(0, Math.min(1, parseFloat(event.target.value) || 0));

        if (value > 0) {
            lastVolume = value;
            audio.volume = Math.pow(value, 2);
            isMuted = false;
            audio.muted = false;
            saveState();
            updateUI();
            if (audio.paused) playAudio();
        } else {
            isMuted = true;
            audio.muted = true;
            saveState();
            updateUI();
        }
    });

    // スピーカーアイコンでミュートON/OFFを切り替える。
    muteBtn.addEventListener('click', (event) => {
        event.stopPropagation();

        if (isMuted) {
            // 解除時は直前の音量へ戻す。
            if (!Number.isFinite(lastVolume) || lastVolume <= 0) lastVolume = 0.5;
            volumeSlider.value = String(lastVolume);
            audio.volume = Math.pow(lastVolume, 2);
            audio.muted = false;
            isMuted = false;
            if (audio.paused) playAudio();
        } else {
            audio.muted = true;
            isMuted = true;
        }

        saveState();
        updateUI();
    });
})();
