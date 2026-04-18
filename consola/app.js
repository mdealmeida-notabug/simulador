document.addEventListener('DOMContentLoaded', () => {
    const torrentClient = new WebTorrent();
    let players = { left: null, right: null };
    let audioContexts = { left: new (window.AudioContext || window.webkitAudioContext)(), right: new (window.AudioContext || window.webkitAudioContext)() };
    let audioSources = { left: null, right: null };

    // Unlock AudioContext on first user gesture (browser autoplay policy)
    function unlockAudio() {
        Object.values(audioContexts).forEach(ctx => {
            if (ctx.state === 'suspended') ctx.resume();
        });
        document.removeEventListener('click', unlockAudio);
        populateAudioDevices();
    }
    document.addEventListener('click', unlockAudio);

    // ─── AUDIO ROUTING (CUE) ─────────────────────────────────────────
    async function populateAudioDevices() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            console.warn('Audio routing not supported in this browser.');
            return;
        }
        try {
            // Request permission to see labels
            await navigator.mediaDevices.getUserMedia({ audio: true });
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
            
            ['left', 'right'].forEach(side => {
                const select = document.getElementById(`select-output-${side}`);
                if (!select) return;
                select.innerHTML = '<option value="">Default System Output</option>';
                audioOutputs.forEach(device => {
                    if (device.deviceId === 'default' || device.deviceId === 'communications') return;
                    const opt = document.createElement('option');
                    opt.value = device.deviceId;
                    opt.textContent = device.label || `Device ${device.deviceId.substring(0,5)}...`;
                    select.appendChild(opt);
                });

                select.addEventListener('change', async (e) => {
                    const ctx = audioContexts[side];
                    if (typeof ctx.setSinkId === 'function') {
                        try {
                            await ctx.setSinkId(e.target.value);
                            console.log(`Deck ${side} routed to ${e.target.value || 'Default'}`);
                        } catch (err) {
                            console.error('Error routing audio:', err);
                        }
                    } else {
                        alert("Tu navegador no soporta el enrutamiento de audio a distintas placas (setSinkId). Usa Chrome o Edge actualizado.");
                    }
                });
            });
        } catch (err) {
            console.warn('Could not enumerate audio devices for routing:', err);
        }
    }

    // ─── BPM CALCULATION (PEAK DETECTION) ────────────────────────────
    function guessBPM(buffer) {
        if (!buffer) return 124.0;
        const data = buffer.getChannelData(0);
        const sampleRate = buffer.sampleRate;
        let peaks = [];
        const threshold = 0.8; // Peak volume threshold
        for (let i = 0; i < data.length; i++) {
            if (data[i] > threshold) peaks.push(i);
        }
        if (peaks.length < 10) return 124.0;

        let intervals = {};
        for (let i = 1; i < peaks.length; i++) {
            let diff = (peaks[i] - peaks[i-1]) / sampleRate;
            if (diff > 0.3 && diff < 1.0) { // roughly 60 to 200 BPM
                let bpm = Math.round(60 / diff);
                intervals[bpm] = (intervals[bpm] || 0) + 1;
            }
        }
        let assumedBPM = 124.0;
        let maxCount = 0;
        for (const [bpmStr, count] of Object.entries(intervals)) {
            if (count > maxCount) {
                maxCount = count;
                assumedBPM = parseFloat(bpmStr);
            }
        }
        return assumedBPM;
    }


    const trackers = [
        'wss://tracker.btorrent.xyz',
        'wss://tracker.openwebtorrent.com',
        'udp://tracker.opentrackr.org:1337/announce',
        'udp://tracker.openbittorrent.com:6969/announce'
    ];

    // Library State
    // Each entry: { id, name, blob, progress, ready }
    const library = [];
    const libraryList = document.getElementById('track-library');

    function renderLibrary() {
        if (library.length === 0) {
            libraryList.innerHTML = '<p style="color:#444;text-align:center;padding:20px;">Librería vacía. Usa la búsqueda para descargar temas.</p>';
            return;
        }
        libraryList.innerHTML = '';
        library.forEach(track => {
            const item = document.createElement('div');
            item.className = 'library-item';
            item.id = `lib-item-${track.id}`;

            if (!track.ready) {
                // Track is downloading - show progress
                item.innerHTML = `
                    <div style="flex:1;min-width:0">
                        <div style="font-size:0.75rem;font-weight:600;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:6px">
                            ⬇ ${track.name}
                        </div>
                        <div class="lib-dl-bar">
                            <div class="lib-dl-fill" id="lib-fill-${track.id}" style="width:${track.progress}%"></div>
                        </div>
                        <span class="lib-dl-pct" id="lib-pct-${track.id}">${track.progress.toFixed(0)}%</span>
                    </div>
                `;
            } else {
                // Track is ready - show load buttons
                item.innerHTML = `
                    <span style="font-size:0.75rem;font-weight:600;color:#ccc;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                        ✓ ${track.name}
                    </span>
                    <div class="lib-actions">
                        <button class="btn-mini" onclick="loadFromLibrary(${track.id},'left')">CARGAR A</button>
                        <button class="btn-mini" onclick="loadFromLibrary(${track.id},'right')">CARGAR B</button>
                    </div>
                `;
            }
            libraryList.appendChild(item);
        });
    }

    // Update an existing library item's progress without re-rendering all
    function updateLibraryProgress(id, progress) {
        const track = library.find(t => t.id === id);
        if (!track) return;
        track.progress = progress;
        const fill = document.getElementById(`lib-fill-${id}`);
        const pct  = document.getElementById(`lib-pct-${id}`);
        if (fill) fill.style.width = progress.toFixed(1) + '%';
        if (pct)  pct.textContent  = progress.toFixed(0) + '%';
    }

    function completeLibraryItem(id, blob) {
        const track = library.find(t => t.id === id);
        if (!track) return;
        track.blob  = blob;
        track.ready = true;
        renderLibrary(); // re-render to replace progress bar with buttons
    }

    // ─── GLOBAL BACKGROUND TORRENT DOWNLOAD ──────────────────────────
    function downloadTorrent(magnetLink, trackName) {
        const id = Date.now();
        library.push({ id, name: trackName, blob: null, progress: 0, ready: false });
        renderLibrary();

        torrentClient.add(magnetLink, { announce: trackers }, function(torrent) {
            torrent.on('download', () => {
                updateLibraryProgress(id, torrent.progress * 100);
            });

            // Find audio file
            const file = torrent.files.find(f =>
                f.name.endsWith('.mp3') || f.name.endsWith('.wav') || f.name.endsWith('.flac')
            );

            if (file) {
                file.getBlob((err, blob) => {
                    if (err) { console.error('Download error:', err); return; }
                    completeLibraryItem(id, blob);
                });
            } else {
                console.warn('No audio file found in torrent.');
            }
        });
    }
    window.downloadTorrent = downloadTorrent;


    // YouTube IFrame API - Ready flag (players created lazily)
    let ytApiReady = false;
    window.onYouTubeIframeAPIReady = () => { ytApiReady = true; };

    // Create hidden YT player containers on first use
    function getOrCreateYTPlayer(deckId, onReady) {
        if (players[deckId]) { onReady(players[deckId]); return; }
        // Create hidden container for the iframe
        const container = document.createElement('div');
        container.id = `yt-player-${deckId}`;
        container.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none';
        document.body.appendChild(container);
        players[deckId] = new YT.Player(`yt-player-${deckId}`, {
            height: '1', width: '1',
            playerVars: { 'autoplay': 0, 'controls': 0 },
            events: { 
                'onReady': () => onReady(players[deckId]),
                'onError': (e) => {
                    if (e.data === 150 || e.data === 101) {
                        alert(`¡Ups! El dueño de este video de YouTube no permite que se reproduzca en otras páginas webs por derechos de autor.\n\nIntenta buscar otra versión del tema o descargala vía Torrent.`);
                        const playBtn = document.getElementById(`play-${deckId}`);
                        if (playBtn && playBtn.classList.contains('active')) playBtn.click(); // Stop UI
                    } else {
                        console.warn('YouTube Player Error:', e.data);
                    }
                }
            }
        });
    }

    const BASE_SPEED = 2.0;

    function setupDeck(deckId, vuId, baseBpm) {
        const playBtn = document.getElementById(`play-${deckId}`);
        const platter = document.getElementById(`platter-${deckId}`);
        const pitchSlider = document.getElementById(`pitch-${deckId}`);
        const bpmDisplay = document.querySelector(`#deck-${deckId} .bpm-display`);
        const volSlider = document.getElementById(`vol-${deckId}`);
        const vuContainer = document.getElementById(vuId);
        const pbFill   = document.getElementById(`playback-fill-${deckId}`);
        const pbHead   = document.getElementById(`playback-head-${deckId}`);
        const pbBar    = document.getElementById(`playback-bar-${deckId}`);
        const pbElapsed = document.getElementById(`pb-elapsed-${deckId}`);
        const pbTotal   = document.getElementById(`pb-total-${deckId}`);
        const STORAGE_KEY_SLOTS = `dj_slots_${deckId}`;
        const STORAGE_KEY_ACTIVE_SLOT = `dj_active_slot_${deckId}`;
        const STORAGE_KEY_MODE  = `dj_mode_${deckId}`;
        
        let activeSlotIndex = parseInt(localStorage.getItem(STORAGE_KEY_ACTIVE_SLOT)) || 0;
        let deckSlots = JSON.parse(localStorage.getItem(STORAGE_KEY_SLOTS)) || ["", "", "", ""];
        
        let isPlaying = false;
        let currentMode = 'none';
        let currentAudioBuffer = null;
        let volumeNode = audioContexts[deckId].createGain();
        volumeNode.connect(audioContexts[deckId].destination);

        // Two-level volume: fader (vol slider) * crossfader
        let faderLevel = 1.0;      // 0.0 - 1.0 from VOL slider
        let crossfaderLevel = 1.0; // 0.0 - 1.0 from crossfader

        function applyVolume() {
            const combined = faderLevel * crossfaderLevel;
            volumeNode.gain.value = combined;
            if (currentMode === 'youtube' && players[deckId] && players[deckId].setVolume) {
                players[deckId].setVolume(combined * 100);
            }
        }

        // Initialize slots UI
        deckSlots.forEach((url, i) => {
            const input = document.getElementById(`slot-${deckId}-${i}`);
            if (input) {
                input.value = url;
                input.addEventListener('input', () => {
                    deckSlots[i] = input.value;
                    localStorage.setItem(STORAGE_KEY_SLOTS, JSON.stringify(deckSlots));
                });
            }
        });

        // Vol fader
        volSlider.addEventListener('input', () => {
            faderLevel = volSlider.value / 100;
            applyVolume();
        });

        const hotCues = new Array(8).fill(null);
        // Position tracking for Web Audio
        let playbackStartCtxTime = 0; // audioContext.currentTime when play started
        let playbackStartOffset = 0;  // buffer position when play started

        function getCurrentPosition() {
            if (currentMode === 'youtube' && players[deckId]) {
                return players[deckId].getCurrentTime ? players[deckId].getCurrentTime() : 0;
            } else if (currentMode === 'torrent') {
                if (!isPlaying) return playbackStartOffset;
                const elapsed = audioContexts[deckId].currentTime - playbackStartCtxTime;
                return playbackStartOffset + elapsed * parseFloat(pitchSlider.value);
            }
            return 0;
        }

        // VU LEDs
        const leds = [];
        for (let i = 0; i < 20; i++) {
            const led = document.createElement('div');
            led.className = 'vu-led';
            vuContainer.appendChild(led);
            leds.push(led);
        }

        function updateVU() {
            if (!isPlaying) {
                leds.forEach(l => l.className = 'vu-led');
                return;
            }
            const level = Math.floor(Math.random() * 20);
            leds.forEach((led, i) => {
                led.className = 'vu-led';
                if (i <= level) {
                    if (i < 12) led.classList.add('active-low');
                    else if (i < 17) led.classList.add('active-mid');
                    else led.classList.add('active-hi');
                }
            });
            setTimeout(updateVU, 100);
        }

        playBtn.addEventListener('click', () => {
            isPlaying = !isPlaying;
            playBtn.classList.remove('ready'); // stop pulsing when user interacts
            if (isPlaying) {
                platter.classList.add('spinning');
                playBtn.classList.add('active');
                playBtn.textContent = 'STOP';
                updateVU();
                startPlayback();
            } else {
                platter.classList.remove('spinning');
                playBtn.classList.remove('active');
                playBtn.textContent = 'PLAY';
                stopPlayback();
            }
        });

        function startPlayback(offset = null) {
            if (currentMode === 'youtube') {
                getOrCreateYTPlayer(deckId, (player) => {
                    const tryPlay = () => {
                        const state = player.getPlayerState ? player.getPlayerState() : -1;
                        if (offset !== null) player.seekTo(offset, true);
                        if (state === 5 || state === 2 || state === 1 || state === -1) {
                            player.playVideo();
                        } else {
                            setTimeout(tryPlay, 300);
                        }
                    };
                    tryPlay();
                });
            } else if (currentMode === 'torrent' && currentAudioBuffer) {
                const ctx = audioContexts[deckId];
                const seekOffset = offset !== null ? offset : playbackStartOffset;
                const doPlay = () => {
                    if (audioSources[deckId]) {
                        try { audioSources[deckId].stop(); } catch(e) {}
                    }
                    audioSources[deckId] = ctx.createBufferSource();
                    audioSources[deckId].buffer = currentAudioBuffer;
                    audioSources[deckId].playbackRate.value = parseFloat(pitchSlider.value);
                    audioSources[deckId].connect(volumeNode);
                    audioSources[deckId].start(0, Math.max(0, seekOffset));
                    playbackStartCtxTime = ctx.currentTime;
                    playbackStartOffset = seekOffset;
                };
                if (ctx.state === 'suspended') ctx.resume().then(doPlay);
                else doPlay();
            }
        }

        function stopPlayback() {
            if (currentMode === 'youtube' && players[deckId]) {
                players[deckId].pauseVideo();
            } else if (currentMode === 'torrent' && audioSources[deckId]) {
                playbackStartOffset = getCurrentPosition(); // save position before stopping
                try { audioSources[deckId].stop(); } catch(e) {}
            }
        }

        pitchSlider.addEventListener('input', () => {
            const val = parseFloat(pitchSlider.value);
            platter.style.setProperty('--spin-speed', `${(BASE_SPEED / val).toFixed(2)}s`);
            bpmDisplay.textContent = (baseBpm * val).toFixed(1);
            if (currentMode === 'torrent' && audioSources[deckId]) {
                audioSources[deckId].playbackRate.value = val;
            }
        });

        // Loader functions
        function getDuration() {
            if (currentMode === 'youtube' && players[deckId] && players[deckId].getDuration) {
                return players[deckId].getDuration() || 0;
            } else if (currentMode === 'torrent' && currentAudioBuffer) {
                return currentAudioBuffer.duration;
            }
            return 0;
        }

        // ─── PROGRESS BAR UPDATE LOOP ─────────────────────────────
        function updateProgressBar() {
            if (currentMode === 'none') { requestAnimationFrame(updateProgressBar); return; }
            const pos = getCurrentPosition();
            const dur = getDuration();
            if (dur > 0) {
                const pct = Math.min((pos / dur) * 100, 100);
                pbFill.style.width = pct + '%';
                pbHead.style.left  = pct + '%';
                pbElapsed.textContent = formatTime(pos);
                pbTotal.textContent   = formatTime(dur);
            }
            requestAnimationFrame(updateProgressBar);
        }
        requestAnimationFrame(updateProgressBar);

        // Click/seek on bar
        pbBar.addEventListener('click', (e) => {
            const rect = pbBar.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            const seekTo = ratio * getDuration();
            if (isPlaying) {
                startPlayback(seekTo);
            } else {
                playbackStartOffset = seekTo;
                pbFill.style.width = (ratio * 100) + '%';
            }
        });

        // Loader functions
        function loadYouTube(url, slotIndex = activeSlotIndex) {
            const videoId = extractVideoId(url);
            if (!videoId) return;
            const thumb = `url(https://img.youtube.com/vi/${videoId}/hqdefault.jpg)`;
            document.getElementById(`preview-${deckId}`).style.backgroundImage = thumb;
            
            // Update active slot UI
            document.querySelectorAll(`#deck-${deckId} .yt-slot`).forEach(s => s.classList.remove('active'));
            const activeSlotEl = document.querySelector(`#deck-${deckId} .yt-slot[data-slot="${slotIndex}"]`);
            if (activeSlotEl) activeSlotEl.classList.add('active');
            
            activeSlotIndex = slotIndex;
            localStorage.setItem(STORAGE_KEY_ACTIVE_SLOT, activeSlotIndex);
            localStorage.setItem(STORAGE_KEY_MODE, 'youtube');
            
            currentMode = 'youtube';
            const initPlayer = () => {
                getOrCreateYTPlayer(deckId, (player) => {
                    player.cueVideoById(videoId);
                    player.setVolume(volSlider.value);
                    playBtn.classList.add('ready');
                });
            };
            if (ytApiReady) initPlayer();
            else window.onYouTubeIframeAPIReady = () => { ytApiReady = true; initPlayer(); };
        }

        // Slot selection buttons
        document.querySelectorAll(`.btn-slot-sel[data-side="${deckId}"]`).forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.index);
                const url = deckSlots[idx];
                loadYouTube(url, idx);
            });
        });

        // loadTorrent inside deck is deprecated in favor of global background download

        function setBuffer(buffer, name) {
            currentAudioBuffer = buffer;
            currentMode = 'torrent';
            playbackStartOffset = 0;
            document.getElementById(`preview-${deckId}`).style.backgroundImage = 'url(https://via.placeholder.com/100/333/fff?text=LOADED)';
        }

        // Restore active slot on start
        if (deckSlots[activeSlotIndex]) {
            loadYouTube(deckSlots[activeSlotIndex], activeSlotIndex);
        }

        // ─── HOT CUE PADS ────────────────────────────────────────────
        const cuePads = document.querySelectorAll(`#deck-${deckId} .cue-pad`);
        cuePads.forEach(pad => {
            pad.addEventListener('click', () => {
                if (currentMode === 'none') return; // nothing loaded
                const index = parseInt(pad.dataset.pad);
                if (hotCues[index] === null) {
                    // FIRST CLICK: record current position + slot
                    hotCues[index] = {
                        slot: activeSlotIndex,
                        time: getCurrentPosition()
                    };
                    pad.style.background = 'var(--accent-color)';
                    pad.style.color = '#fff';
                    pad.style.borderColor = 'var(--accent-color)';
                    pad.style.boxShadow = '0 0 12px var(--accent-color)';
                } else {
                    // SECOND CLICK: jump to saved position
                    const cue = hotCues[index];
                    
                    const jumpToCue = () => {
                        if (isPlaying) {
                            startPlayback(cue.time);
                        } else {
                            isPlaying = true;
                            platter.classList.add('spinning');
                            playBtn.classList.add('active');
                            playBtn.textContent = 'STOP';
                            updateVU();
                            startPlayback(cue.time);
                        }
                    };

                    if (cue.slot !== activeSlotIndex) {
                        // Switch slot first
                        loadYouTube(deckSlots[cue.slot], cue.slot);
                        // Give it a moment to load
                        setTimeout(jumpToCue, 500);
                    } else {
                        jumpToCue();
                    }
                    // Flash the pad
                    pad.style.filter = 'brightness(1.5)';
                    setTimeout(() => pad.style.filter = '', 150);
                }
            });

            // Right-click to clear a cue point
            pad.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const index = parseInt(pad.dataset.pad);
                hotCues[index] = null;
                pad.style.background = '';
                pad.style.color = '';
                pad.style.borderColor = '';
                pad.style.boxShadow = '';
            });
        });

        function setMasterVolume(level) {
            crossfaderLevel = level; // 0.0 to 1.0
            applyVolume();
        }

        function setBaseBpm(newBpm) {
            baseBpm = newBpm;
            bpmDisplay.textContent = (baseBpm * parseFloat(pitchSlider.value)).toFixed(1);
        }

        return { loadYouTube, setBuffer, setMasterVolume, setBaseBpm };
    }


    const deckLeft = setupDeck('left', 'vu-left', 128.0);
    const deckRight = setupDeck('right', 'vu-right', 124.5);
    const decks = { left: deckLeft, right: deckRight };

    // ─── CROSSFADER LOGIC ────────────────────────────────────────
    // DJ curve: center = both full, left = cuts B, right = cuts A
    const crossfaderCtrl = document.getElementById('crossfader-ctrl');
    
    function applyCrossfaderPos(pos) {
        if (pos < 0) pos = 0;
        if (pos > 100) pos = 100;
        crossfaderCtrl.value = pos;
        let volA, volB;
        if (pos <= 50) {
            volA = 1.0;
            volB = pos / 50;
        } else {
            volA = (100 - pos) / 50;
            volB = 1.0;
        }
        deckLeft.setMasterVolume(volA);
        deckRight.setMasterVolume(volB);
    }

    if (crossfaderCtrl) {
        crossfaderCtrl.addEventListener('input', () => {
            applyCrossfaderPos(parseInt(crossfaderCtrl.value));
        });
    } else {
        console.warn('Crossfader element not found!');
    }

    // ─── AUTO-FADE (2s and 8s) ───────────────────────────────────
    let fadeAnimId = null;
    function triggerAutoFade(durationMs) {
        if (!crossfaderCtrl) return;
        if (fadeAnimId) cancelAnimationFrame(fadeAnimId);

        const startVal = parseFloat(crossfaderCtrl.value);
        if (startVal === 50) return; // if dead center, don't know where to go
        
        // Decide direction: move away from current side.
        const targetVal = startVal < 50 ? 100 : 0;
        const changePerMs = (targetVal - startVal) / durationMs;
        const startTime = performance.now();

        function step(now) {
            const elapsed = now - startTime;
            let currentVal = startVal + (changePerMs * elapsed);
            
            // Check boundaries
            if ((targetVal === 100 && currentVal >= 100) || (targetVal === 0 && currentVal <= 0)) {
                applyCrossfaderPos(targetVal);
                return; // done
            }
            
            applyCrossfaderPos(currentVal);
            fadeAnimId = requestAnimationFrame(step);
        }
        fadeAnimId = requestAnimationFrame(step);
    }

    const btnFadeSlow = document.getElementById('fade-slow');
    const btnFadeFast = document.getElementById('fade-fast');
    const btnFadeCut  = document.getElementById('fade-cut');
    
    if (btnFadeSlow) btnFadeSlow.addEventListener('click', () => triggerAutoFade(8000));
    if (btnFadeFast) btnFadeFast.addEventListener('click', () => triggerAutoFade(2000));
    if (btnFadeCut)  btnFadeCut.addEventListener('click', () => triggerAutoFade(500));


    // SEARCH MODAL LOGIC
    const modal = document.getElementById('search-modal');
    const resultsList = document.getElementById('search-results-list');
    let activeDeck = 'left';

    function openSearch(query, side) {
        activeDeck = side;
        resultsList.innerHTML = '<p style="color: #666; text-align: center;">Buscando en red torrent...</p>';
        modal.style.display = 'block';

        setTimeout(() => {
            const mocks = [];
            const q = ['320kbps MP3', 'FLAC Studio', '256kbps MP3', 'WAV Lossless'];
            const s = ['9.5 MB', '14.2 MB', '45.0 MB', '11.8 MB'];

            for (let i = 1; i <= 12; i++) {
                mocks.push({
                    name: `${query} Track ${i}.mp3`,
                    meta: `${q[i%4]} | ${s[i%4]}`,
                    magnet: `magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=${query}${i}`
                });
            }

            resultsList.innerHTML = '';
            mocks.forEach(m => {
                const item = document.createElement('div');
                item.className = 'search-result-item';
                item.innerHTML = `
                    <div style="font-weight: 600;">${m.name}</div>
                    <div class="track-meta">${m.meta}</div>
                `;
                item.onclick = () => {
                    modal.style.display = 'none';
                    // Download in background — deck stays free!
                    downloadTorrent(m.magnet, m.name);
                };
                resultsList.appendChild(item);
            });
        }, 800);
    }

    document.querySelector('.close-modal').onclick = () => modal.style.display = 'none';
    window.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };

    // Library Bridge
    window.loadFromLibrary = async (id, side) => {
        const track = library.find(t => t.id === id);
        if (track && decks[side]) {
            const buf = await track.blob.arrayBuffer();
            const decoded = await audioContexts[side].decodeAudioData(buf);
            
            // Calc real BPM from buffer
            const calcBpm = guessBPM(decoded);
            decks[side].setBaseBpm(calcBpm);

            decks[side].setBuffer(decoded, track.name);
        }
    };


    function extractVideoId(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }

    function formatTime(secs) {
        if (!isFinite(secs) || secs < 0) return '0:00';
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
});

