/**
 * Portfolio Catalina Sin - Main JS
 * Uses GSAP Observer for strict full-page snapping scroll
 */

// Disable browser scroll restoration so page always starts at top on refresh
if (history.scrollRestoration) {
    history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);

gsap.registerPlugin(Observer);

// ==========================================================================
//   Full Page Scroll Logic (Snap)
// ==========================================================================

let sections = [];
let currentIndex = -1;
let animating = false;

document.addEventListener("DOMContentLoaded", () => {
    // Gather all fullpage sections: Hero + Works + Footer
    sections = [document.querySelector('.hero'), ...document.querySelectorAll('.panel')];

    // Set initial section states - z-index so hero is on top
    gsap.set(sections, {
        zIndex: (i, target, targets) => targets.length - i
    });

    // Only hide panel sections (works, footer) - NEVER hide the hero
    // The hero is always visible from CSS to avoid black-screen-on-refresh
    const panelSections = sections.slice(1);
    gsap.set(panelSections, { autoAlpha: 0, yPercent: 100 });

    // Ensure all internal work content starts invisible for entry animation
    gsap.set('.work-item__content', { opacity: 0, y: 50 });

    // Initial Load - Hero content fade-in animation
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    // Fade in intro title & subtitle smoothly
    tl.to(".hero__content", {
        opacity: 1,
        y: 0,
        duration: 1.8,
        delay: 0.2 // slight delay after page load for impact
    });

    currentIndex = 0; // Set to hero

    let pullAmount = 0;
    const PULL_THRESHOLD = 150;
    const RESISTANCE = 0.9;     // More movement as requested
    let pullTimer = null;

    // Initialize Observer for Mouse Wheel / Trackpad / Touch
    Observer.create({
        type: "wheel,touch,pointer",
        onChange: (self) => {
            if (animating) return;

            // Accumulate delta
            pullAmount += self.deltaY * -1;

            // Check boundaries
            if (pullAmount > 0 && currentIndex === 0) { pullAmount = 0; return; }
            if (pullAmount < 0 && currentIndex === sections.length - 1) { pullAmount = 0; return; }

            // Peak visual logic
            let offset = pullAmount * RESISTANCE;

            // Move current section with a short damping duration
            gsap.to(sections[currentIndex], {
                y: offset,
                duration: 0.15, // slightly faster damping
                ease: "power2.out",
                overwrite: "auto"
            });

            // Show and move target section
            let targetIndex = pullAmount > 0 ? currentIndex - 1 : currentIndex + 1;
            if (targetIndex >= 0 && targetIndex < sections.length) {
                let startPos = pullAmount > 0 ? -window.innerHeight : window.innerHeight;
                gsap.to(sections[targetIndex], {
                    autoAlpha: 1,
                    zIndex: 10,
                    y: startPos + offset,
                    duration: 0.15,
                    ease: "power2.out",
                    overwrite: "auto"
                });
            }

            // If threshold reached, commit to transition
            if (Math.abs(pullAmount) >= PULL_THRESHOLD) {
                let finalDir = pullAmount > 0 ? -1 : 1;
                // CAPTURE THE ACTUAL VISUAL POSITION to avoid jump
                let visualOffset = gsap.getProperty(sections[currentIndex], "y");
                pullAmount = 0;
                gotoSection(currentIndex + finalDir, finalDir, visualOffset);
                return;
            }

            // Reset logic if scrolling stops (Increased to 250ms for slow scrolls)
            clearTimeout(pullTimer);
            pullTimer = setTimeout(() => {
                if (!animating && pullAmount !== 0) {
                    let targetIndexSnap = pullAmount > 0 ? currentIndex - 1 : currentIndex + 1;
                    let targets = [sections[currentIndex]];
                    if (targetIndexSnap >= 0 && targetIndexSnap < sections.length) {
                        targets.push(sections[targetIndexSnap]);
                    }

                    gsap.killTweensOf(targets); // Ensure a clean transition start

                    gsap.to(targets, {
                        y: 0,
                        duration: 0.6,
                        ease: "power3.out",
                        onComplete: () => {
                            if (!animating) {
                                // Hide the peeked section
                                sections.forEach((s, i) => {
                                    if (i !== currentIndex) gsap.set(s, { autoAlpha: 0 });
                                });
                            }
                        }
                    });
                    pullAmount = 0;
                }
            }, 250);
        },
        preventDefault: true
    });
});

function gotoSection(index, direction, initialOffset = 0) {
    // Prevent out of bounds
    if (index < 0 || index >= sections.length) return;

    // Pause custom audio if playing, when leaving the section
    if (typeof customAudio !== 'undefined' && !customAudio.paused) {
        customAudio.pause();
        if (currentCustomTrackRow) updateTrackUI(currentCustomTrackRow, false);
    }

    animating = true;

    let fromSection = sections[currentIndex];
    let toSection = sections[index];

    // Kill any active "peek" tweens to prevent conflicts
    gsap.killTweensOf([fromSection, toSection]);

    let dFactor = direction === 1 ? -1 : 1;
    let tl = gsap.timeline({
        defaults: { duration: 1.0, ease: "power3.out" },
        onComplete: () => {
            animating = false;
            // Drive video panel lifecycle after the transition lands
            const _vpEl = document.getElementById('agua-brasil-video');
            const _vpPanel = document.getElementById('obra-video');
            if (_vpPanel && _vpEl) {
                if (sections[index] === _vpPanel) {
                    // Start unmuted as requested. Set volume and state.
                    _vpEl.volume = 1.0;
                    _vpEl.muted = videoPanelMuted;

                    _vpEl.play().catch(() => {
                        // If unmuted autoplay is blocked, we leave it muted 
                        // so it plays visually, but we DON'T update videoPanelMuted.
                        // This allows the first interaction to unmute it naturally.
                        _vpEl.muted = true;
                        _vpEl.play().catch(() => { });
                    });

                    if (typeof updateMuteIcons === 'function') updateMuteIcons();
                    // Start grain loop DIRECTLY (bypasses window override issue)
                    if (typeof startGrainLoop === 'function') startGrainLoop();
                    // Start circular ripple loop
                    if (typeof startRippleLoop === 'function') startRippleLoop();
                } else {
                    _vpEl.pause();
                    // Stop grain loop DIRECTLY
                    if (typeof stopGrainLoop === 'function') stopGrainLoop();
                    // Stop circular ripple loop
                    if (typeof stopRippleLoop === 'function') stopRippleLoop();
                }
            }

            // --- HERO SECTION RESOURCE MANAGEMENT ---
            if (index === 0) {
                // We are on the Hero section
                if (typeof startHeroWaves === 'function') startHeroWaves();
                // Resume audio processing if it was enabled
                if (audioCtx && audioState !== 0) {
                    audioCtx.resume();
                }
            } else {
                // We left the Hero section
                if (typeof stopHeroWaves === 'function') stopHeroWaves();
                // Suspend audio processing to save CPU
                if (audioCtx) {
                    audioCtx.suspend();
                }
            }
        }
    });

    // Make next section visible and place it at the starting position
    // We don't reset y:0 here yet; we use initialOffset
    gsap.set(toSection, { autoAlpha: 1, zIndex: 10 });
    gsap.set(fromSection, { zIndex: 1 });

    // Animate CURRENT section out (from its peeked pixel offset to its target percentage)
    tl.fromTo(fromSection,
        { yPercent: 0, y: initialOffset },
        { yPercent: 100 * dFactor, y: 0, duration: 0.8, ease: "power3.out" },
        0
    );

    // Animate NEXT section in — starts purely from its off-screen percentage (no y offset)
    // Using y: initialOffset as the start caused a compound position that looked like a bounce
    tl.fromTo(toSection,
        { yPercent: -100 * dFactor, y: 0 },
        { yPercent: 0, y: 0, duration: 0.8, ease: "power3.out" },
        0
    );

    // Trigger internal content reveal on the incoming section
    // Works for: work-item panels (.work-item__content),
    //            Eva Candil (.spotify-panel__inner),
    //            Agua Brasil (.video-panel__video)
    let content = toSection.querySelector('.work-item__content')
        || toSection.querySelector('.spotify-panel__inner')
        || toSection.querySelector('.video-panel__video');
    if (content) {
        gsap.set(content, { autoAlpha: 0, y: -40 * dFactor });
        tl.to(content, { autoAlpha: 1, y: 0, duration: 0.7, ease: "power2.out" }, 0.35);
    }

    // Reset OUTGOING section's inner content so it's ready for next entry
    let prevContent = fromSection.querySelector('.work-item__content')
        || fromSection.querySelector('.spotify-panel__inner')
        || fromSection.querySelector('.video-panel__video');
    if (prevContent) {
        tl.set(prevContent, { autoAlpha: 1, y: 0 });
    }

    currentIndex = index;
    if (typeof updateNavActiveState === 'function') updateNavActiveState(index);
}

// Clear all GSAP inline styles before page unloads.
// Without this, GSAP's opacity/visibility/transform inline styles persist on the
// DOM elements during the brief rendering window on refresh, causing the black screen.
window.addEventListener('pagehide', () => {
    if (sections.length > 0) {
        gsap.set(sections, { clearProps: 'all' });
        gsap.set('.work-item__content', { clearProps: 'all' });
    }
});

// ==========================================================================
//   Interactive Soundwave Canvas (Hero Section)
// ==========================================================================

const canvas = document.getElementById('soundwave-canvas');
const ctx = canvas.getContext('2d');
let heroAnimId = null;

let width, height;
let mouse = { x: 0, y: 0, targetX: 0, targetY: 0, targetStrength: 0, strength: 0 };
let masterPhase = 0;

// Set canvas size
function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    // Set natural starting position for mouse (center)
    if (mouse.x === 0 && mouse.y === 0) {
        mouse.x = width / 2;
        mouse.y = height / 2;
        mouse.targetX = width / 2;
        mouse.targetY = height / 2;
    }
}

// Track mouse on window to prevent overlays from blocking interaction or triggering mouseleave
window.addEventListener('mousemove', (e) => {
    // Only track if we are in the hero section (first 100vh)
    if (window.scrollY > window.innerHeight) {
        mouse.targetStrength = 0;
        return;
    }

    // Convert to relative coordinates if needed, but here clientX/Y is fine as canvas is full screen
    mouse.targetX = e.clientX;
    mouse.targetY = e.clientY;
    mouse.targetStrength = 1;

    // Small optimization: if we are near the canvas top/bottom center, ensure we aren't being blocked
    // (though pointer-events: none on title should handle this)
});

// Use visibility change or scroll as fallback to fade out
window.addEventListener('scroll', () => {
    if (window.scrollY > window.innerHeight * 0.5) {
        mouse.targetStrength = 0;
    }
});

window.addEventListener('resize', resizeCanvas);


// Hero wave config — all values live-editable from the control panel
let heroWaveConfig = {
    opacity: 0.1,   // alpha of each wave line
    waveCount: 43,    // number of wave lines
    deflection: 4.5,  // cursor drag strength (the "arrastre" multiplier)
    amplitude: 55,    // base wave height in px
    frequency: 0.045, // horizontal wave frequency
    speed: 0.0195,// phase advance per frame
    gravityRadius: 224,   // px — cursor influence radius (0 = disabled)
    lineWidth: 1.0,   // base stroke width in px
    randomness: 1.0,   // multiplier for index-based offsets
    gravityPull: 1.0, // cohesive vertical pull strength
};

// Store defaults for reset functionality
const defaultHeroWaveConfig = { ...heroWaveConfig };

// Setup wave color array — rebuilt when waveCount changes
const waveColors = [];

function buildWaveColors() {
    waveColors.length = 0;
    for (let i = 0; i < heroWaveConfig.waveCount; i++) {
        waveColors.push(`rgba(245, 245, 245, ${heroWaveConfig.opacity})`);
    }
}
buildWaveColors();

// ==========================================================================
//   Audio state — declared here so drawWaves() can access them safely
// ==========================================================================
let audioCtx = null;
let audioEnabled = false;
let osc1 = null, oscBase = null, oscFifth = null, oscOctUp = null, oscOctDown = null;
let gainBase = null, gainFifth = null, gainOctUp = null, gainOctDown = null;
let oscTouch = null, gainTouch = null;
let lfo = null, lfoGain = null;
let fmOsc = null, fmGain = null;
let fuzzNode = null, fuzzPreGain = null, cleanGain = null, fuzzPostGain = null;
let filter = null, masterGain = null, synthGain = null, compressor = null;
let sampleFilter = null, sampleGain = null;
let audioTargetVolume = 0;
let audioTargetFreq = 180;
let audioTargetFilter = 800;

// Arpeggiator Globals
let arpLastTime = 0;
let arpStep = 0;

// Wave visual state sampler — 6 key x positions across the screen
// We store current + previous dy to compute velocity (rate of change)
const SAMPLE_COUNT = 6;
let waveSnapshot = new Float32Array(SAMPLE_COUNT); // dy this frame
let wavePrevSnapshot = new Float32Array(SAMPLE_COUNT); // dy previous frame
let chaosAccum = 0; // accumulated chaos from touch, reset each frame

// Draw frame
function drawWaves() {
    // Lerp mouse for smooth following
    mouse.x += (mouse.targetX - mouse.x) * 0.05;
    mouse.y += (mouse.targetY - mouse.y) * 0.05;
    mouse.strength += (mouse.targetStrength - mouse.strength) * 0.05; // smooth fade in/out

    ctx.clearRect(0, 0, width, height);

    const masterAmplitude = heroWaveConfig.amplitude;
    const masterFrequency = heroWaveConfig.frequency;

    let isAnyTouched = false;
    let maxTouchIntensity = 0;

    // --- Wave visual sampler setup ---
    // Rotate snapshot buffers
    wavePrevSnapshot.set(waveSnapshot);
    waveSnapshot.fill(0);
    chaosAccum = 0;
    // X positions to sample (evenly spread across screen)
    const sampleXs = Array.from({ length: SAMPLE_COUNT }, (_, i) => Math.round(width * (i + 0.5) / SAMPLE_COUNT));

    waveColors.forEach((color, index) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        // Make some lines slightly thicker for depth
        ctx.lineWidth = (index === 2 || index === 7) ? heroWaveConfig.lineWidth * 1.5 : heroWaveConfig.lineWidth;

        // Start path slightly below the middle to leave room for the title
        const startY = (height / 2) + 50;
        ctx.moveTo(0, startY);

        // Echo effect: phaseOffset now varies by x-position and config randomness
        // At the left edge, all waves overlap (phaseOffset ≈ 0).
        // By screen midpoint, they reach full separation (index * 0.15).
        const maxPhaseOffset = index * 0.15 * heroWaveConfig.randomness;

        // Progressive wave separation constants (unified with loop below)
        const separationStart = width * 0.20;
        const separationEnd = width * 0.80;

        // For mouse proximity detection, evaluate phaseOffset at the mouse's x using same logic as loop
        const mouseSepProgress = Math.min(1, Math.max(0, (mouse.x - separationStart) / (separationEnd - separationStart)));
        const mouseEased = mouseSepProgress * mouseSepProgress * (3 - 2 * mouseSepProgress);
        const phaseOffsetAtMouse = maxPhaseOffset * mouseEased;

        // 1. GRAVEDAD Y DETECCIÓN DE CERCANÍA:
        // Calculamos la distancia de la onda entera con respecto al cursor
        // IMPORTANTE: El dinamismo de la amplitud (que crece a la derecha) debe coincidir con el loop de dibujo
        const dynamicAmplitudeAtMouse = masterAmplitude * (0.8 + (mouse.x / width) * 0.7);
        const pureYAtMouseX = Math.sin((mouse.x * masterFrequency) + masterPhase - phaseOffsetAtMouse) * dynamicAmplitudeAtMouse;
        const waveYAtMouseX = startY + pureYAtMouseX;

        const distanceToWave = Math.abs(mouse.y - waveYAtMouseX);

        let touchIntensity = 0;
        let hitHeightNormalized = 0; // -1 (top peak) to 1 (bottom valley)

        if (mouse.strength > 0.01 && distanceToWave < heroWaveConfig.gravityRadius) {
            isAnyTouched = true;
            const rawIntensity = 1 - (distanceToWave / heroWaveConfig.gravityRadius);
            // Apply interaction strength for smooth fade
            touchIntensity = Math.pow(rawIntensity, 2.5) * mouse.strength;
            hitHeightNormalized = pureYAtMouseX / masterAmplitude;
            if (touchIntensity > maxTouchIntensity) maxTouchIntensity = touchIntensity;
        }

        // Draw the wave horizontally
        for (let x = 0; x <= width; x += 4) {

            // Progressive wave separation (moved constants up)
            const separationProgress = Math.min(1, Math.max(0, (x - separationStart) / (separationEnd - separationStart)));
            const easedProgress = separationProgress * separationProgress * (3 - 2 * separationProgress); // smoothstep
            const phaseOffset = maxPhaseOffset * easedProgress;

            const distX = x - mouse.x;
            const absDistX = Math.abs(distX);
            // Interaction parameter calculation
            // MOD: Expansion towards the right (starts at 0.8x on the left, grows to 1.5x on the right)
            let dynamicAmplitude = masterAmplitude * (0.8 + (x / width) * 0.7);
            let chaosPhase = 0;
            let gravityOffset = 0;

            if (touchIntensity > 0 && distX >= 0) {
                // 1. IZQUIERDA INMÓVIL (distX < 0 ignora esto):
                // Para evitar un quiebre recto en el mouse (distX = 0), suavizamos la entrada (ease-in-out)
                // desde el mouse hasta 150px a la derecha. En el instante de tocar, vale 0.
                const entrySmoothness = distX < 150 ? Math.sin((distX / 150) * (Math.PI / 2)) : 1;

                // Efecto de estela que se apaga hacia el final de la pantalla derecha
                const rightTrailIntensity = Math.max(0, 1 - (distX / (width * 0.8)));

                // 2. GRAVEDAD COHERENTE:
                // Tirón unificado de la masa controlable por heroWaveConfig.gravityPull
                const verticalPull = (mouse.y - waveYAtMouseX);
                const coherentGravity = (verticalPull * heroWaveConfig.gravityPull) * touchIntensity;

                // 3. ACOMPAÑAMIENTO ORGÁNICO / RANDOM:
                // Multiplicador influenciado por la aleatoriedad general
                const organicResistance = Math.cos(index * 3 * (heroWaveConfig.randomness > 0 ? heroWaveConfig.randomness : 0.001) + masterPhase * 2 + distX * 0.01) * (masterAmplitude * 0.8) * touchIntensity;

                // 4. DESVÍO DIRECCIONAL HACIA LAS ESQUINAS (Efecto "Responsive")
                // Calculamos a qué altura del lienzo estás tocando (Negativo = Mitad superior, Positivo = Mitad inferior)
                const touchHeightOffset = mouse.y - startY;

                // Deflexión extrema — controlada por heroWaveConfig.deflection
                const deflection = touchHeightOffset * heroWaveConfig.deflection * (distX / width) * touchIntensity;

                // Combinamos la gravedad y resistencia local (que se apagan con rightTrailIntensity)
                // y le sumamos la deflexión direccional (que en vez de apagarse, crece hacia el borde derecho).
                // Todo esto es suavizado en su nacimiento por entrySmoothness para que no genere ángulos rectos.
                gravityOffset = ((coherentGravity + organicResistance) * rightTrailIntensity + deflection) * entrySmoothness;

                // Mantenemos el desorden fluido (marea) para el tramado hermoso en las colas.
                // AÑADIDO: Si la intensidad es máxima (tacto directo), la fase explota (REDUCIDO DE 15 A 3)
                const extraRandomCenter = 0; // bajado a 0 a pedido del usuario
                chaosPhase += Math.sin(x * 0.006 + index * 6 + masterPhase * 2.0) * extraRandomCenter * rightTrailIntensity * touchIntensity * entrySmoothness;
            }

            // Pure Sinusoidal Formula + Chaos Phase + Gravity Pull
            const dy = Math.sin((x * masterFrequency) + masterPhase - phaseOffset + chaosPhase) * dynamicAmplitude + gravityOffset;

            // --- Sample wave height at key positions ---
            // We accumulate dy contributions from all waves at each sample x
            for (let s = 0; s < SAMPLE_COUNT; s++) {
                if (Math.abs(x - sampleXs[s]) < 4) {
                    waveSnapshot[s] += dy / waveColors.length; // running average
                }
            }
            // Accumulate chaos for audio noise layer
            chaosAccum += Math.abs(chaosPhase);

            ctx.lineTo(x, startY + dy);
        }

        ctx.stroke();
    });

    // Speed of wave travelling forward.
    masterPhase -= heroWaveConfig.speed * (1 + (isAnyTouched ? 0.3 : 0));

    // Normalize chaosAccum (divide by total iterations so it's 0..1 range)
    const normalizedChaos = Math.min(1, chaosAccum / (waveColors.length * width / 4 * 0.5));

    // Update audio engine every frame with visual state
    if (audioEnabled) {
        updateAudio(
            maxTouchIntensity,
            mouse.x / width,
            mouse.y / height,
            masterPhase,
            waveSnapshot,
            wavePrevSnapshot,
            normalizedChaos
        );
    }

    heroAnimId = requestAnimationFrame(drawWaves);
}

function startHeroWaves() {
    if (!heroAnimId) {
        heroAnimId = requestAnimationFrame(drawWaves);
    }
}

function stopHeroWaves() {
    if (heroAnimId) {
        cancelAnimationFrame(heroAnimId);
        heroAnimId = null;
    }
}

// Boot up
resizeCanvas();
startHeroWaves();



// ==========================================================================
//   Audio Engine (Web Audio API — 0 external dependencies, ~4KB code)
// ==========================================================================

// (Audio state variables are declared above, before drawWaves, to avoid temporal dead zone)

// --- Preset definitions ---
// Preset 1: Synth oscillator (built-in). Presets 2-4: sample-based (future).
const AUDIO_PRESETS = [
    { id: 'synth', label: 'synth', type: 'oscillator' },
    { id: 'sample1', label: 'sample 1', type: 'sample', src: null },
    { id: 'sample2', label: 'sample 2', type: 'sample', src: null },
    { id: 'sample3', label: 'sample 3', type: 'sample', src: null },
];
let currentPreset = 0;

let sampleBuffer = null;
let sampleSource = null;
let bgSampleEl = null;
let sampleMediaSource = null;

// Helper for Fuzz / Distortion Node
function makeDistortionCurve(amount) {
    const k = typeof amount === 'number' ? amount : 50,
        n_samples = 44100,
        curve = new Float32Array(n_samples),
        deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
        let x = i * 2 / n_samples - 1;
        curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    return curve;
}

function initAudioContext() {
    if (audioCtx) return;

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // Compressor at the end of chain — prevents clipping
    compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 10;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;
    compressor.connect(audioCtx.destination);

    // Master gain (controls overall volume)
    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
    masterGain.connect(compressor);

    // ================= CANAL SINTETIZADOR =================
    // Filter (lowpass — shapes the timbre of the synth)
    filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    filter.Q.value = 2.5; // Controlled by Knob 4 now
    filter.connect(masterGain);

    // ================= CANAL SAMPLE BGM =================
    sampleGain = audioCtx.createGain();
    sampleGain.gain.setValueAtTime(0, audioCtx.currentTime);
    sampleGain.connect(compressor); // Saltea el masterGain del sinte

    sampleFilter = audioCtx.createBiquadFilter();
    sampleFilter.type = 'lowpass';
    sampleFilter.frequency.value = 22000; // Totalmente abierto (sonido limpio de la canción) por default
    sampleFilter.Q.value = 1.0;
    sampleFilter.connect(sampleGain);

    // LFO — slow modulation for ambient "breathing"
    lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 4; // LFO depth in Hz
    lfoGain.connect(filter.frequency);

    lfo = audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.25; // 0.25 Hz — very slow breathing
    lfo.connect(lfoGain);
    lfo.start();

    // Fuzz / Distortion Parallel Routing (Wet / Dry)
    // 1. SynthGain (Source) -> CleanGain -> Filter (DRY)
    // 2. SynthGain (Source) -> FuzzPreGain -> FuzzNode -> FuzzPostGain -> Filter (WET)

    cleanGain = audioCtx.createGain();
    cleanGain.gain.value = 1.0;
    cleanGain.connect(filter);

    fuzzPreGain = audioCtx.createGain();
    fuzzPreGain.gain.value = 1.0; // Drive into distortion

    fuzzNode = audioCtx.createWaveShaper();
    fuzzNode.curve = makeDistortionCurve(400); // 400 = extreme distortion
    fuzzNode.oversample = '4x';

    fuzzPostGain = audioCtx.createGain();
    fuzzPostGain.gain.value = 0.0; // Starts completely dry (Fuzz off)

    fuzzPreGain.connect(fuzzNode);
    fuzzNode.connect(fuzzPostGain);
    fuzzPostGain.connect(filter);

    // Synth Gain (to mute oscillators cleanly when in Sample mode)
    synthGain = audioCtx.createGain();
    synthGain.gain.value = 1;

    // Split synth signal to both Clean and Fuzz paths
    synthGain.connect(cleanGain);
    synthGain.connect(fuzzPreGain);

    // Main Synth Oscillator (Osc1)
    osc1 = audioCtx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = 180;
    osc1.detune.value = 0;
    osc1.connect(synthGain);
    osc1.start();

    // FM Chaos Modulator
    fmGain = audioCtx.createGain();
    fmGain.gain.value = 0; // Starts off

    fmOsc = audioCtx.createOscillator();
    fmOsc.type = 'sawtooth';
    fmOsc.frequency.value = 100;
    fmOsc.connect(fmGain);
    fmOsc.start();

    // Secondary Harmonic Oscillators (replacing osc2)
    oscBase = audioCtx.createOscillator();
    oscBase.type = 'triangle';
    gainBase = audioCtx.createGain();
    gainBase.gain.value = 0.5; // Default volume
    fmGain.connect(oscBase.frequency);
    oscBase.connect(gainBase);
    gainBase.connect(synthGain);
    oscBase.start();

    oscFifth = audioCtx.createOscillator();
    oscFifth.type = 'triangle';
    gainFifth = audioCtx.createGain();
    gainFifth.gain.value = 0;
    fmGain.connect(oscFifth.frequency);
    oscFifth.connect(gainFifth);
    gainFifth.connect(synthGain);
    oscFifth.start();

    oscOctUp = audioCtx.createOscillator();
    oscOctUp.type = 'triangle';
    gainOctUp = audioCtx.createGain();
    gainOctUp.gain.value = 0;
    fmGain.connect(oscOctUp.frequency);
    oscOctUp.connect(gainOctUp);
    gainOctUp.connect(synthGain);
    oscOctUp.start();

    oscOctDown = audioCtx.createOscillator();
    oscOctDown.type = 'triangle';
    gainOctDown = audioCtx.createGain();
    gainOctDown.gain.value = 0;
    fmGain.connect(oscOctDown.frequency);
    oscOctDown.connect(gainOctDown);
    gainOctDown.connect(synthGain);
    oscOctDown.start();

    // Physical Touch Oscillator (Sawtooth for bright raspy character)
    oscTouch = audioCtx.createOscillator();
    oscTouch.type = 'sawtooth';
    gainTouch = audioCtx.createGain();
    gainTouch.gain.value = 0; // Starts muted until waves are touched
    fmGain.connect(oscTouch.frequency); // Also affected by FM if active
    oscTouch.connect(gainTouch);
    gainTouch.connect(synthGain);
    oscTouch.start();

    // Load Background Sample
    loadBackgroundSample();
}

async function loadBackgroundSample() {
    try {
        const response = await fetch('assets/audio/brasil 2.mp3');
        if (!response.ok) throw new Error("Fetch falló (probablemente file:///)");
        const arrayBuffer = await response.arrayBuffer();
        sampleBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    } catch (e) {
        console.warn("Error cargando Buffer (Gapless). Usando fallback puro HTML5 Audio:", e);
        // Fallback: Si abren el archivo .html suelto, usamos el Tag Audio nativo (sin conectarlo a WebAudio para evitar el mute de CORS)
        bgSampleEl = new Audio('assets/audio/brasil 2.mp3');
        bgSampleEl.loop = true;
    }
}

function startSamplePlayback() {
    if (!audioCtx) return;

    if (sampleBuffer) {
        if (sampleSource) {
            sampleSource.stop();
            sampleSource.disconnect();
        }

        sampleSource = audioCtx.createBufferSource();
        sampleSource.buffer = sampleBuffer;
        sampleSource.loop = true; // Seamless WebAudio loop
        sampleSource.connect(sampleFilter);
        sampleSource.start();
    } else if (bgSampleEl) {
        bgSampleEl.currentTime = 0;
        bgSampleEl.play().catch(e => console.error(e));
    }
}

function stopSamplePlayback() {
    if (sampleSource) {
        sampleSource.stop();
        sampleSource.disconnect();
        sampleSource = null;
    }
}

// --- Escalas Musicales (Knob 0. a 5) ---
// Cada escala es un array de frecuencias a lo largo de varias octavas
// Se calcularon a partir de E1 (41.20Hz) / E2 (82.41Hz)
const SCALES = [
    // 0: Pentatónica Menor (Graves a agudos. Sensación: Nativa/Ancestral)
    [55.00, 65.41, 73.42, 82.41, 98.00, 110.00, 130.81, 146.83, 164.81, 196.00, 220.00, 261.63, 293.66, 329.63],

    // 1: Escala Mayor (E Major. Sensación: Feliz / Épica)
    [82.41, 92.50, 103.83, 110.00, 123.47, 138.59, 155.56, 164.81, 185.00, 207.65, 220.00, 246.94, 277.18, 311.13, 329.63],

    // 2: Escala Menor Natural (E Minor. Sensación: Triste / Melancólica)
    [82.41, 92.50, 98.00, 110.00, 123.47, 130.81, 146.83, 164.81, 185.00, 196.00, 220.00, 246.94, 261.63, 293.66, 329.63],

    // 3: Escala Enigmática de Verdi (C Enigmatic. Sensación: Extraña / Misteriosa / Disonante)
    [65.41, 69.30, 82.41, 92.50, 103.83, 116.54, 123.47, 130.81, 138.59, 164.81, 185.00, 207.65, 233.08, 246.94, 261.63, 277.18, 329.63],

    // 4: Escala de Tonos Enteros (Whole Tone. Sensación: Flotante / De ensueño)
    [65.41, 73.42, 82.41, 92.50, 103.83, 116.54, 130.81, 146.83, 164.81, 185.00, 207.65, 233.08, 261.63, 293.66, 329.63],

    // 5: Escala Hirajoshi (A pentatónica japonesa. Sensación: Oriental / Tensa)
    [55.00, 61.74, 65.41, 82.41, 87.31, 110.00, 123.47, 130.81, 164.81, 174.61, 220.00, 246.94, 261.63, 329.63]
];

// --- Control Panel State ---
let controlConfig = {
    // Modo Sintetizador
    scaleIndex: 0,        // Knob 0: Índice p/ elegir la escala completa
    basePitchIndex: 7,    // Knob 1: Nota base dentro de la escala
    arpRange: 5,          // Knob 2: Cuántas notas saltar como máximo
    lfoDepth: 400,        // Knob 3: Rango del LFO en Hz
    filterRes: 2.5,       // Knob 4: Resonancia del Filtro (Q)
    smoothing: 0.02,      // Knob 5: Tiempo de suavizado T

    // Modo Sample (Brasil 2)
    sPitch: 1.0,          // Knob S1: Tono base (playbackRate)
    sPitchRange: 0.15,    // Knob S2: Rango de variación del pitch con el mouse
    sBrightness: 2000,    // Knob S3: Frio/Brillo base del filtro
    sFilterRange: 10000,  // Knob S4: Sensibilidad del filtro a la onda
    sLFO: 200,            // Knob S5: Profundidad de modulación tímbrica (LFO)
    sVol: 1.5             // Knob S6: Sensibilidad de volumen base
};

// Configurar los event listeners para los knobs cuando el DOM está listo
document.addEventListener('DOMContentLoaded', () => {
    // Add toggle functionality for hero audio controls
    const audioToggleBtn = document.getElementById('audio-controls-toggle');
    const audioControlsPanel = document.getElementById('audio-controls');

    if (audioControlsPanel) {
        // Prevent clicks on the panel from interacting with the canvas/background
        audioControlsPanel.addEventListener('click', e => e.stopPropagation());
    }

    if (audioToggleBtn && audioControlsPanel) {
        audioToggleBtn.addEventListener('click', (e) => {
            audioControlsPanel.classList.toggle('is-collapsed');
        });
    }

    const bindKnob = (id, key, isFloat) => {
        const input = document.getElementById(`knob-${id}`);
        const valSpan = document.getElementById(`val-${id}`);
        if (!input || !valSpan) return;

        // Init span
        valSpan.textContent = input.value;

        input.addEventListener('input', (e) => {
            const val = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
            controlConfig[key] = val;

            // Texto especial según el ID del knob
            if (id === 'scale') {
                const names = ["Pentatónica", "Mayor", "Menor", "Enigmática", "Tonos Enteros", "Hirajoshi"];
                valSpan.textContent = names[val];
            } else if (id === 's-pitch') {
                valSpan.textContent = val.toFixed(2) + '×';
            } else {
                valSpan.textContent = val;
            }
        });

        // Disparar evento inicial p/ setear nombres
        if (id === 'scale' || id === 's-pitch') input.dispatchEvent(new Event('input'));
    };

    // Knobs Sintetizador
    bindKnob('scale', 'scaleIndex', false);
    bindKnob('pitch', 'basePitchIndex', false);
    bindKnob('arpeggio', 'arpRange', false);
    bindKnob('lfo', 'lfoDepth', false);
    bindKnob('resonance', 'filterRes', true);
    bindKnob('smooth', 'smoothing', true);

    // Knobs Sample
    bindKnob('s-pitch', 'sPitch', true);
    bindKnob('s-pitchrange', 'sPitchRange', true);
    bindKnob('s-brightness', 'sBrightness', false);
    bindKnob('s-filterrange', 'sFilterRange', false);
    bindKnob('s-lfo', 'sLFO', false);
    bindKnob('s-vol', 'sVol', true);
});

// Called every frame from drawWaves() — updates audio to match visual state
// Three-layer system (Option C):
//   Layer 1: masterPhase  → ambient LFO breathing (always on)
//   Layer 2: waveSnapshot → arpegio-like pitch modulation (mouse nearby)
//   Layer 3: chaosNorm    → pitch noise/randomization (mouse touching)
function updateAudio(touchIntensity, mouseXNorm, mouseYNorm, masterPh, snapshot, prevSnapshot, chaosNorm) {
    if (!audioCtx || !audioEnabled) return;

    const now = audioCtx.currentTime;

    // Si no hay intervención del mouse, apagamos el audio por completo (0.0 vol)
    // Para el sample (audioState===2) no hacemos return inmediato: dejamos que el
    // bloque de abajo lo apague suavemente (fade del sampleGain a 0).
    if (touchIntensity <= 0.01 && chaosNorm <= 0.01) {
        masterGain.gain.setTargetAtTime(0, now, 0.5); // Fade out suave (sintetizador)
        if (audioState === 2) {
            // Apagamos el sample también cuando no hay interacción del mouse
            if (sampleGain) sampleGain.gain.setTargetAtTime(0, now, 0.5);
            if (bgSampleEl && !sampleSource) bgSampleEl.volume = 0;
        }
        return;
    }

    // Suavizado dinámico usando el Knob 5:
    const T = touchIntensity > 0.01 ? controlConfig.smoothing : 0.08;

    // --- LAYER 1: LFO (KNOB 3) ---
    const lfoRate = 0.15;
    lfoGain.gain.setTargetAtTime(10 + touchIntensity * controlConfig.lfoDepth, now, T);
    lfo.frequency.setTargetAtTime(lfoRate, now, T * 3);

    // --- LAYER 2: Barrido Continuo (X axis / MOUSE HORIZONTAL) (KNOBS 1 y 2) ---
    // Obtenemos la escala seleccionada (Knob 0)
    const currentScale = SCALES[controlConfig.scaleIndex];

    // Partimos de la nota base (Knob 1)
    let baseIndex = Math.min(controlConfig.basePitchIndex, currentScale.length - 1);

    // Progresión horizontal:
    // Mantenemos mouseXNorm para que el pitch responda en toda la pantalla
    let horizontalWipeNorm = (mouseXNorm * 2) - 1; // de -1 (Izq) a +1 (Der)

    // Salto relativo continuo (Ej: -5.0 a +5.0) en base a "Salto Arpegio" (Knob 2)
    let continuousJump = horizontalWipeNorm * controlConfig.arpRange;
    let finalPitch = 220; // Default value, will be overwritten

    // T_pitch is usually T (smooth), but for Arpeggiator it will be instantaneous (0.01)
    let T_pitch = T;

    if (audioState === 3 || audioState === 0) {
        // --- LAYER 2: Barrido Continuo (GLIDE) ---
        let floatIndex = baseIndex + continuousJump;

        // Clamping para no salir de los bordes del array
        floatIndex = Math.max(0, Math.min(floatIndex, currentScale.length - 1));

        // Interpolación Lineal (Lerp) entre las dos notas más cercanas
        const lowerIndex = Math.floor(floatIndex);
        const upperIndex = Math.ceil(floatIndex);
        const fraction = floatIndex - lowerIndex;

        const freqLow = currentScale[lowerIndex];
        const freqHigh = currentScale[upperIndex];

        finalPitch = freqLow + (freqHigh - freqLow) * fraction;

    } else if (audioState === 1) {
        // --- LAYER 2: ARPEGIADOR RÍTMICO ---
        // Velocidad del arpegio (fija a 150ms o podría mapearse a un knob visual)
        const arpSpeed = 0.15; // seg

        if (now - arpLastTime > arpSpeed) {
            arpStep++;
            arpLastTime = now;
        }

        // ¿Hacia dónde saltamos? Direction + o -
        let jumpDirection = continuousJump >= 0 ? 1 : -1;
        // Cuántos saltos máximos (0 a 10)
        // Usamos Math.ceil para que NO haya zona muerta en el centro.
        // Además, obligamos a que siempre haya al menos 1 paso de movimiento musical
        // para evitar que el arpegio se "congele" en una nota sola en el medio.
        let maxSteps = Math.max(1, Math.ceil(Math.abs(continuousJump)));

        // Si maxSteps es 0, repetimos la misma nota principal
        let activeIndex = baseIndex;

        if (maxSteps > 0) {
            // Ciclo de ida y vuelta (Arpegio Up/Down o Down/Up)
            // Longitud total del ciclo: si sube 4 notas, el ciclo es 0,1,2,3,4,3,2,1 -> 8 pasos
            let cycleLength = maxSteps * 2;
            let seqPos = arpStep % cycleLength;

            // Calculamos en qué paso del arpegio estamos
            let stepOffset = (seqPos <= maxSteps) ? seqPos : (cycleLength - seqPos);

            activeIndex = baseIndex + (stepOffset * jumpDirection);
        }

        // Clamping seguro
        activeIndex = Math.max(0, Math.min(activeIndex, currentScale.length - 1));
        finalPitch = currentScale[activeIndex];

        // Cambio instantáneo para efecto "secuenciador", no portamento
        T_pitch = 0.01;
    }

    // --- LAYER 3 & EFFECTS (Y axis / MOUSE VERTICAL POSITION) ---
    // En lugar de leer UN solo punto (snapshot[4]), buscamos la elevación MÁXIMA
    // detectada en todos los sensores para que el volumen sea estable mientras la onda viaja.
    let maxDy = 0;
    for (let i = 0; i < snapshot.length; i++) {
        if (Math.abs(snapshot[i]) > maxDy) maxDy = Math.abs(snapshot[i]);
    }

    // Elevación vertical mapeada a 0 - 1 (donde 0 es chato y 1 es ola gigante vertical)
    const verticalElevationNorm = Math.min(1, maxDy / 70);

    // Convertimos mouseYNorm (que viene de 0 a 1) a un rango centrado: -1 (arriba) a +1 (abajo)
    const mouseYMapped = (mouseYNorm * 2) - 1;

    // --- OPCIÓN B: HARMONIC CROSSFADE (MOUSE Y) ---
    // mouseYMapped va de -1 (arriba de todo) a +1 (abajo de todo)
    let volBase = 0.5;
    let volFifth = 0;
    let volOctUp = 0;
    let volOctDown = 0;

    if (touchIntensity > 0.001) { // Same threshold lowering here
        if (mouseYMapped < -0.1) {
            // Arriba del centro: Crossfade suave hacia Quinta y luego Octava Arriba
            // Mapeamos de -0.1 (centro superior) a -1.0 (techo)
            const upIntensity = Math.min(1, Math.abs(mouseYMapped + 0.1) / 0.9);

            if (upIntensity < 0.5) {
                // Primera mitad del techo: Fade in de Quinta (hasta 50% de intensidad arriba)
                const fade = upIntensity * 2; // de 0 a 1
                volFifth = fade * 0.8; // subido a 0.8
                volBase = 0.5 - (fade * 0.3);
            } else {
                // Segunda mitad del techo: Fade out Quinta, Fade in Octava Arriba
                const fade = (upIntensity - 0.5) * 2; // de 0 a 1
                volFifth = (1 - fade) * 0.8;
                volOctUp = fade * 0.8; // subido a 0.8
                volBase = 0.2;
            }
        } else if (mouseYMapped > 0.1) {
            // Abajo del centro: Crossfade suave hacia Sub-Octava
            // Mapeamos de 0.1 (centro inferior) a 1.0 (piso)
            const downIntensity = Math.min(1, (mouseYMapped - 0.1) / 0.9);
            volOctDown = downIntensity * 0.8; // subido a 0.8
            volBase = 0.5 - (downIntensity * 0.3); // Base baja más
        }
    }

    // --- UI EFFCTS TOGGLES (MOUSE Y ABSOLUTE) ---
    // Distancia desde el centro (0 en el centro, 1 en los extremos superior/inferior)
    const yExtremity = Math.abs(mouseYMapped);
    const efxResonanceToggle = document.getElementById('efx-resonance');
    const efxFmToggle = document.getElementById('efx-fm');
    const efxFuzzToggle = document.getElementById('efx-fuzz');

    let dynamicFilterQ = controlConfig.filterRes;
    let dynamicFmAmount = 0;
    let wetFuzzVol = 0.0;
    let dryCleanVol = 1.0;
    let fuzzDrive = 1.0;
    let touchVol = 0.0; // Volume for the distinct physical touch oscillator

    // Si el mouse interactúa MÁS MÍNIMAMENTE (bajamos el threshold a 0.001)
    if (touchIntensity > 0.001) {

        // 0. PHYSICAL TOUCH LAYER (oscTouch)
        // Solo suena cuando cortamos la onda de verdad (touchIntensity > 0.6 implica distancia < 30px)
        if (touchIntensity > 0.6) {
            // Se intensifica rápido al tocar. Lo limitamos a 0.6 máx para no saturar.
            touchVol = Math.min(0.6, (touchIntensity - 0.6) * 1.5);
        }

        // 1. Resonancia Extrema (Acid) - SOLO cuando tocas físicamente las ondas
        if (efxResonanceToggle && efxResonanceToggle.checked && touchIntensity > 0.6) {
            // Sube exponencialmente hacia los bordes
            const resIntensity = Math.max(0, (yExtremity - 0.2) / 0.8);
            dynamicFilterQ += resIntensity * 30; // Sube hasta 30+
        }

        // 2. FM Chaos (Instabilidad metálica) - SOLO de la mitad para abajo O tocando la onda
        if (efxFmToggle && efxFmToggle.checked && (mouseYMapped > 0 || touchIntensity > 0.6)) {
            const fmIntensity = Math.max(0, (yExtremity - 0.1) / 0.9);
            dynamicFmAmount = Math.pow(fmIntensity, 2) * 1200;
        }

        // 3. Fuzz (Distorsión) - SOLO de la mitad para abajo (mouseYMapped > 0)
        if (efxFuzzToggle && efxFuzzToggle.checked && mouseYMapped > 0) {
            // Calculamos intensidad basándonos solo en el recorrido hacia abajo
            const fuzzIntensity = Math.max(0, (mouseYMapped - 0.15) / 0.85);

            wetFuzzVol = fuzzIntensity * 0.9; // Llega al 90%
            dryCleanVol = 1.0 - (fuzzIntensity * 0.7); // Baja el limpio al 30%
            fuzzDrive = 1.0 + (Math.pow(fuzzIntensity, 2) * 15.0); // Multiplica masivo
        }
    }

    // --- VOLUME ---
    // Volumen condicionado a cuánto se elevó la onda verticalmente + touch
    let intensityScore = Math.min(1, verticalElevationNorm + (touchIntensity * 0.5));

    if (audioState === 1 || audioState === 3 || audioState === 0) {
        // === SINTETIZADOR ===
        let pitchDamping = 1.0;
        if (finalPitch > 220) {
            pitchDamping = Math.max(0.4, 1.0 - ((finalPitch - 220) / 110) * 0.6);
        }
        const masterVolTarget = intensityScore * 0.25 * pitchDamping;

        // Filtro dinámico: 
        // En modo Arpegio (3) aseguramos que el filtro siempre esté por encima de la nota tocada
        // para que no la "ahogue" si la onda visual está bajita.
        let baseFilterFreq = 150 + (verticalElevationNorm * 2000);
        if (audioState === 1) {
            baseFilterFreq = Math.max(baseFilterFreq, finalPitch * 1.8);
        }
        const filterFreq = Math.min(20000, baseFilterFreq);

        // Crossfade Harmonic Oscillators Array (using T_pitch for frequencies to snap in Arp mode)
        osc1.frequency.setTargetAtTime(Math.max(20, finalPitch), now, T_pitch);

        oscBase.frequency.setTargetAtTime(Math.max(20, finalPitch), now, T_pitch);
        gainBase.gain.setTargetAtTime(volBase, now, T);

        oscFifth.frequency.setTargetAtTime(Math.max(20, finalPitch * 1.498), now, T_pitch); // Quinta
        gainFifth.gain.setTargetAtTime(volFifth, now, T);

        oscOctUp.frequency.setTargetAtTime(Math.max(20, finalPitch * 2.0), now, T_pitch); // Octava Arriba
        gainOctUp.gain.setTargetAtTime(volOctUp, now, T);

        oscOctDown.frequency.setTargetAtTime(Math.max(20, finalPitch * 0.5), now, T_pitch); // Octava Abajo
        gainOctDown.gain.setTargetAtTime(volOctDown, now, T);

        // Physical touch oscillator targeting a Fifth (+7 semitones) for aggressive harmonic cut
        oscTouch.frequency.setTargetAtTime(Math.max(20, finalPitch * 1.498), now, T_pitch);
        // Slightly faster attack/release (0.05) than T so it feels very responsive to physical crossing
        gainTouch.gain.setTargetAtTime(touchVol, now, 0.05);

        // Apply Aggressive Effects
        filter.frequency.setTargetAtTime(filterFreq, now, T);
        filter.Q.setTargetAtTime(dynamicFilterQ, now, T);

        // Fuzz Routing
        cleanGain.gain.setTargetAtTime(dryCleanVol, now, T);
        fuzzPreGain.gain.setTargetAtTime(fuzzDrive, now, T);
        fuzzPostGain.gain.setTargetAtTime(wetFuzzVol, now, T);

        fmGain.gain.setTargetAtTime(dynamicFmAmount, now, 0.05); // faster response for FM

        // Tracking FM frequency
        fmOsc.frequency.setTargetAtTime(finalPitch * 0.25, now, T);

        masterGain.gain.setTargetAtTime(masterVolTarget, now, T);

        // Muteamos el canal sample
        if (sampleGain) sampleGain.gain.setTargetAtTime(0, now, T);

    } else if (audioState === 2) {
        // === TRACK BRASIL 2 (SAMPLE) ===
        // Un mp3 necesita más volumen (1.0 vs 0.25 del sinte) y un espectro de frecuencias más amplio
        const sampleVol = intensityScore * controlConfig.sVol;

        // --- 1. PITCH (PlaybackRate) ---
        // Combinamos el tono base del knob con el barrido horizontal del mouse (X axis)
        const samplePitchMod = (mouseXNorm * 2 - 1) * controlConfig.sPitchRange;
        const finalPlaybackRate = Math.max(0.1, controlConfig.sPitch + samplePitchMod);

        if (sampleSource) {
            sampleSource.playbackRate.setTargetAtTime(finalPlaybackRate, now, T);
        }

        // --- 2. FILTRO ÉPICO (Mouse Y + Onda) ---
        // Si el mouse sube las ondas verticales, la canción se "abre".
        // Partimos del brillo base del tablero y sumamos la sensibilidad configurada.
        const sampleFilterFreq = controlConfig.sBrightness + (verticalElevationNorm * controlConfig.sFilterRange);

        // --- 3. LFO (Modulación tímbrica pulsante) ---
        // Aplicamos el LFO que ya existía (Layer 1) también al filtro del sample
        const lfoAmount = (Math.sin(now * 2.0) * controlConfig.sLFO); // Oscilación dedicada sencilla

        if (sampleGain) sampleGain.gain.setTargetAtTime(sampleVol, now, T);
        if (sampleFilter) {
            sampleFilter.frequency.setTargetAtTime(Math.max(20, sampleFilterFreq + lfoAmount), now, T);
            sampleFilter.Q.setTargetAtTime(1.0 + verticalElevationNorm * 2, now, T);
        }

        // Fallback para HTML5 Audio nativo (limitado, no soporta filter/lfo tan fácil sin WebAudio)
        if (bgSampleEl && !sampleSource) {
            bgSampleEl.volume = Math.max(0, Math.min(1, sampleVol));
            bgSampleEl.playbackRate = finalPlaybackRate;
        }

        // Nos aseguramos que el sinte interactivo esté reseteado/muteado
        masterGain.gain.setTargetAtTime(0, now, T);
    }
}

// 0 = Apagado, 1 = Sintetizador Interactivo, 2 = Sample (Brasil 2), 3 = Arpegiador Sintetizador
let audioState = 0;

// Toggle sound on/off/sample
function toggleAudio() {
    const btn = document.getElementById('audio-toggle');
    const iconEl = document.getElementById('audio-icon');
    const controlsPanel = document.getElementById('audio-controls');

    // Siempre nos aseguramos de que el audioContext esté creado
    initAudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    audioState = (audioState + 1) % 4; // Cycle 0 -> 1 -> 2 -> 3 -> 0

    if (audioState === 1) {
        // STATE 1: SINTETIZADOR ARPEGIADOR
        audioEnabled = true;

        // Detenemos el sample si venía sonando
        stopSamplePlayback();

        // Prendemos los osciladores sintéticos
        if (synthGain) synthGain.gain.setValueAtTime(1, audioCtx.currentTime);

        btn.classList.add('is-active');
        iconEl.textContent = '1';
        btn.setAttribute('aria-label', 'Cambiar a Track 2');

        if (controlsPanel) {
            controlsPanel.classList.add('is-visible');
            controlsPanel.classList.add('is-synth');
            controlsPanel.classList.remove('is-sample');
        }

    } else if (audioState === 2) {
        // STATE 2: SAMPLE AUDIO (Brasil 2)
        audioEnabled = true;

        if (synthGain) synthGain.gain.setValueAtTime(0, audioCtx.currentTime);

        iconEl.textContent = '2';
        btn.setAttribute('aria-label', 'Cambiar a Track 3');

        if (controlsPanel) {
            controlsPanel.classList.add('is-visible');
            controlsPanel.classList.remove('is-synth');
            controlsPanel.classList.add('is-sample');
        }

        // Arrancamos el sample en Web Audio
        startSamplePlayback();

    } else if (audioState === 3) {
        // STATE 3: SINTETIZADOR INTERACTIVO
        audioEnabled = true;

        // Detenemos el sample si venía sonando
        stopSamplePlayback();

        // Prendemos los osciladores (abriendo su volumen independiente)
        if (synthGain) synthGain.gain.setValueAtTime(1, audioCtx.currentTime);

        btn.classList.add('is-active');
        iconEl.textContent = '3';
        btn.setAttribute('aria-label', 'Desactivar sonido');

        if (controlsPanel) {
            controlsPanel.classList.add('is-visible');
            controlsPanel.classList.add('is-synth');
            controlsPanel.classList.remove('is-sample');
        }

    } else {
        // STATE 0: TODO APAGADO
        audioEnabled = false;
        btn.classList.remove('is-active');
        iconEl.textContent = '○';
        btn.setAttribute('aria-label', 'Activar sonido');

        if (controlsPanel) {
            controlsPanel.classList.remove('is-visible');
            controlsPanel.classList.remove('is-synth');
            controlsPanel.classList.remove('is-sample');
        }

        if (masterGain) {
            masterGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1);
        }
        // Mutear explícitamente el canal del sample (salta masterGain, hay que silenciarlo aquí)
        if (sampleGain) {
            sampleGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1);
        }

        stopSamplePlayback();

        // Silenciar el fallback HTML5 Audio
        if (bgSampleEl) {
            bgSampleEl.pause();
            bgSampleEl.volume = 0;
        }
    }
}

// Wire up toggle button
document.getElementById('audio-toggle').addEventListener('click', toggleAudio);

// ==========================================================================
//   Custom Audio Player (Bailó toda la noche)
// ==========================================================================
const customAudio = new Audio();
let currentCustomTrackRow = null;
const trackRows = document.querySelectorAll('.track-row:not(.is-empty)');
const volumeBarContainer = document.getElementById('volume-bar-container');
const volumeBarFill = document.getElementById('volume-bar-fill');

// Global Progress Elements — all players
const allProgressContainers = document.querySelectorAll('.player-progress .track-progress-container');
const allProgressFills = document.querySelectorAll('.player-progress .track-progress-fill');
const allTimeCurrent = document.querySelectorAll('.player-progress .track-time--current');

function syncProgress(percent) {
    allProgressFills.forEach(fill => fill.style.width = `${percent}%`);
}
function syncTime(text) {
    allTimeCurrent.forEach(el => el.textContent = text);
}

// Set initial volume
customAudio.volume = 0.6;
if (volumeBarFill) volumeBarFill.style.width = '60%';

// All volume bar fills (one per player panel) — keep them in sync
const allVolumeFills = document.querySelectorAll('.volume-bar-fill');
const allVolumeContainers = document.querySelectorAll('.volume-bar-container');

function syncVolumeFills(percentage) {
    allVolumeFills.forEach(fill => fill.style.width = `${percentage * 100}%`);
}

allVolumeContainers.forEach(container => {
    container.addEventListener('click', (e) => {
        const rect = container.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        let percentage = clickX / rect.width;
        percentage = Math.max(0, Math.min(1, percentage));
        customAudio.volume = percentage;
        syncVolumeFills(percentage);
    });
});

function updateTrackUI(row, isPlaying) {
    const playIcon = row.querySelector('.icon-play');
    const pauseIcon = row.querySelector('.icon-pause');
    if (isPlaying) {
        row.classList.add('is-active');
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
    } else {
        row.classList.remove('is-active');
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
    }
}

function formatTime(seconds) {
    if (isNaN(seconds)) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

trackRows.forEach(row => {
    const btn = row.querySelector('.track-btn');
    const src = row.getAttribute('data-src');

    btn.addEventListener('click', () => {
        if (currentCustomTrackRow === row) {
            // Toggle play/pause
            if (customAudio.paused) {
                customAudio.play();
                updateTrackUI(row, true);
            } else {
                customAudio.pause();
                updateTrackUI(row, false);
            }
        } else {
            // Play new track
            if (currentCustomTrackRow) {
                updateTrackUI(currentCustomTrackRow, false);
            }
            currentCustomTrackRow = row;
            customAudio.src = src;
            customAudio.play();
            updateTrackUI(row, true);
        }
    });
});

// Progress Bar Click — wire up all players
allProgressContainers.forEach(container => {
    container.addEventListener('click', (e) => {
        if (!currentCustomTrackRow || !customAudio.duration) return;
        const rect = container.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = clickX / rect.width;
        customAudio.currentTime = percentage * customAudio.duration;
    });
});

// Update Global Progress and Timers
customAudio.addEventListener('timeupdate', () => {
    if (!currentCustomTrackRow) return;
    if (customAudio.duration) {
        const percent = (customAudio.currentTime / customAudio.duration) * 100;
        syncProgress(percent);
        syncTime(formatTime(customAudio.currentTime));
    }
});

customAudio.addEventListener('loadedmetadata', () => {
    // Total time element was removed per user request
});

customAudio.addEventListener('ended', () => {
    if (currentCustomTrackRow) {
        updateTrackUI(currentCustomTrackRow, false);
        currentCustomTrackRow = null;
    }
    syncProgress(0);
    syncTime('0:00');
});

// ==========================================================================
//   Full-Screen Video Panel Logic (Agua Brasil)
// ==========================================================================

const videoPanel = document.getElementById('obra-video');
const videoPanelEl = document.getElementById('agua-brasil-video');
const videoMuteIcon = document.getElementById('video-mute-icon');
const iconMuted = document.getElementById('icon-muted');
const iconUnmuted = document.getElementById('icon-unmuted');

let videoPanelMuted = false; // start unmuted as requested
let muteIconTimer = null;

// Tries playback; starts unmuted by default.
function playVideoPanel() {
    if (!videoPanelEl) return;
    videoPanelEl.volume = 1.0;
    videoPanelEl.muted = videoPanelMuted;
    videoPanelEl.currentTime = 0;
    videoPanelEl.play().catch(() => {
        // If unmuted autoplay is blocked, playback muted temporarily
        // without overriding the global videoPanelMuted intent.
        videoPanelEl.muted = true;
        videoPanelEl.play().catch(() => { });
    });
    updateMuteIcons();
}

function pauseVideoPanel() {
    if (!videoPanelEl) return;
    videoPanelEl.pause();
}

function updateMuteIcons() {
    if (!iconMuted || !iconUnmuted || !videoPanelEl) return;
    // The icons reflect the INTENDED state (videoPanelMuted), 
    // ensuring "Unmuted" is shown even if the browser has it suppressed.
    iconMuted.style.display = videoPanelMuted ? 'block' : 'none';
    iconUnmuted.style.display = videoPanelMuted ? 'none' : 'block';
}

function showMuteIcon() {
    if (!videoMuteIcon) return;
    // Reset animation by removing then re-adding the class
    videoMuteIcon.classList.remove('is-visible');
    // Force reflow so the browser resets the animation
    void videoMuteIcon.offsetWidth;
    videoMuteIcon.classList.add('is-visible');

    clearTimeout(muteIconTimer);
    muteIconTimer = setTimeout(() => {
        videoMuteIcon.classList.remove('is-visible');
    }, 1300);
}

// Click on the video element specifically to toggle mute
if (videoPanelEl) {
    videoPanelEl.addEventListener('click', (e) => {
        // Prevent other panel clicks from triggering this
        e.stopPropagation();

        // Check if the video is silenced by the browser despite our intent (videoPanelMuted=false)
        if (videoPanelEl.muted && !videoPanelMuted) {
            // Case: suppressed by browser. This click only "unlocks" sound.
            videoPanelEl.muted = false;
            videoPanelEl.volume = 1.0;
        } else {
            // Standard toggle: user explicitly wants to change the state
            videoPanelMuted = !videoPanelMuted;
            videoPanelEl.muted = videoPanelMuted;
            videoPanelEl.volume = 1.0;
        }

        updateMuteIcons();
        showMuteIcon();
    });
}

// Initialise mute icons on load and set default video state
if (videoPanelEl) {
    videoPanelEl.muted = videoPanelMuted;
    videoPanelEl.volume = 1.0;
}
updateMuteIcons();

// ==========================================================================
//   Film Grain Overlay Logic
// ==========================================================================
const grainCanvas = document.getElementById('grain-canvas');
let grainCtx = null;
let grainAnimationFrame = null;
let lastGrainDraw = 0;

// Grain parameters — updated live from the control panel
let grainConfig = {
    density: 69,   // % of pixels that get noise (0-100)
    intensity: 90,   // max brightness per grain pixel (0-255)
    fps: 15,   // animation speed (frames per second)
    size: 1,    // pixel block size (1 = 1px, 2 = 2px blocks, etc.)
    opacity: 0     // starts at 0 (disabled) — enable via control panel
};

// Wire up the grain control panel sliders
document.addEventListener('DOMContentLoaded', () => {
    // Add toggle functionality for grain controls
    const toggleBtn = document.getElementById('grain-toggle');
    const controlsPanel = document.getElementById('grain-controls');

    if (controlsPanel) {
        // Prevent clicks on the panel from muting the video
        controlsPanel.addEventListener('click', e => e.stopPropagation());
    }

    if (toggleBtn && controlsPanel) {
        toggleBtn.addEventListener('click', (e) => {
            controlsPanel.classList.toggle('is-collapsed');
            // Keep it as '−' as requested by the user even when collapsed
        });
    }

    const grainBindings = [
        { id: 'gc-density', key: 'density', format: v => `${v}%` },
        { id: 'gc-intensity', key: 'intensity', format: v => `${v}` },
        {
            id: 'gc-opacity', key: null, format: v => `${v}%`,
            onchange: v => {
                grainConfig.opacity = v / 100;
                if (grainCanvas) grainCanvas.style.opacity = grainConfig.opacity;
            }
        },
        { id: 'gc-fps', key: 'fps', format: v => `${v}fps` },
        { id: 'gc-size', key: 'size', format: v => `${v}px` },
    ];

    grainBindings.forEach(({ id, key, format, onchange }) => {
        const input = document.getElementById(id);
        const valEl = document.getElementById(`val-${id}`);
        if (!input) return;

        input.addEventListener('input', (e) => {
            const v = parseFloat(e.target.value);
            if (key) grainConfig[key] = v;
            if (onchange) onchange(v);
            if (valEl) valEl.textContent = format(v);
        });
    });

    // -----------------------------------------------------------------------
    //   Wave Controls Panel wiring
    // -----------------------------------------------------------------------
    const waveToggleBtn = document.getElementById('wave-toggle');
    const wavePanel = document.getElementById('wave-controls');

    if (wavePanel) {
        // Prevent panel clicks from muting the video
        wavePanel.addEventListener('click', e => e.stopPropagation());
    }

    if (waveToggleBtn && wavePanel) {
        waveToggleBtn.addEventListener('click', () => {
            wavePanel.classList.toggle('is-collapsed');
        });
    }

    const waveBindings = [
        {
            id: 'wc-offset', key: 'timeOffset',
            format: v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}s`,
            onchange: v => {
                // When offset changes, reset onset index so patterns re-sync cleanly
                rippleNextOnsetIdx = 0;
            }
        },
        {
            id: 'wc-spawncount', key: 'spawnCount',
            format: v => `×${v}`
        },
        { id: 'wc-opacity', key: 'maxOpacity', format: v => `${v.toFixed(2)}` },
        { id: 'wc-spawnoffset', key: 'spawnRadiusOffset', format: v => `${v}px` },
        { id: 'wc-randomness', key: 'spawnRandomness', format: v => `${v.toFixed(1)}` },
        { id: 'wc-interact', key: 'interactStrength', format: v => `${v.toFixed(1)}` },
        { id: 'wc-speed', key: 'speedBase', format: v => `${v}px/s` },
        { id: 'wc-undulation', key: 'undulationAmp', format: v => `${v.toFixed(1)}px` },
        { id: 'wc-gravity', key: 'gravityRadius', format: v => v === 0 ? 'off' : `${v}px` },
        { id: 'wc-linewidth', key: 'lineWidth', format: v => `${v.toFixed(1)}px` },
    ];

    waveBindings.forEach(({ id, key, format, onchange }) => {
        const input = document.getElementById(id);
        const valEl = document.getElementById(`val-${id}`);
        if (!input) return;

        input.addEventListener('input', (e) => {
            const v = parseFloat(e.target.value);
            if (key) rippleConfig[key] = v;
            if (onchange) onchange(v);
            if (valEl) valEl.textContent = format(v);
        });
    });

    // -----------------------------------------------------------------------
    //   Hero Wave Controls Panel wiring
    // -----------------------------------------------------------------------
    const heroWaveToggleBtn = document.getElementById('hero-wave-toggle');
    const heroWavePanel = document.getElementById('hero-wave-controls');

    if (heroWavePanel) {
        // Prevent panel clicks from interfering with other elements
        heroWavePanel.addEventListener('click', e => e.stopPropagation());
    }

    if (heroWaveToggleBtn && heroWavePanel) {
        heroWaveToggleBtn.addEventListener('click', () => {
            heroWavePanel.classList.toggle('is-collapsed');
        });
    }

    const heroWaveBindings = [
        {
            id: 'hw-opacity', key: 'opacity', format: v => `${v.toFixed(2)}`,
            onchange: () => { buildWaveColors(); } // Rebuild colors to apply new alpha
        },
        {
            id: 'hw-count', key: 'waveCount', format: v => `${v}`,
            onchange: () => { buildWaveColors(); } // Rebuild colors array to match new count
        },
        { id: 'hw-deflection', key: 'deflection', format: v => `${v.toFixed(1)}` },
        { id: 'hw-amplitude', key: 'amplitude', format: v => `${v}px` },
        { id: 'hw-frequency', key: 'frequency', format: v => `${v.toFixed(3)}` },
        { id: 'hw-speed', key: 'speed', format: v => `${v.toFixed(4)}` },
        { id: 'hw-randomness', key: 'randomness', format: v => `${v.toFixed(1)}` },
        { id: 'hw-gravitypull', key: 'gravityPull', format: v => `${v.toFixed(2)}x` },
        { id: 'hw-gravity', key: 'gravityRadius', format: v => `${v}px` },
        { id: 'hw-linewidth', key: 'lineWidth', format: v => `${v.toFixed(1)}px` },
    ];

    heroWaveBindings.forEach(({ id, key, format, onchange }) => {
        const input = document.getElementById(id);
        const valEl = document.getElementById(`val-${id}`);
        const groupEl = input ? input.closest('.grain-knob-group') : null;
        if (!input) return;

        // update function to set UI and config
        const updateVal = (v) => {
            input.value = v;
            if (key) heroWaveConfig[key] = v;
            if (onchange) onchange(v);
            if (valEl) valEl.textContent = format(v);
        };

        input.addEventListener('input', (e) => {
            updateVal(parseFloat(e.target.value));
        });

        // Double click anywhere on the group container resets that specific value
        if (groupEl && key) {
            groupEl.addEventListener('dblclick', (e) => {
                e.preventDefault();
                updateVal(defaultHeroWaveConfig[key]);
            });
            // Also add title tooltip to explain double click
            groupEl.title = "Doble click para restablecer";
        }
    });

    // Master Reset All Button
    const resetAllBtn = document.getElementById('hw-reset-all');
    if (resetAllBtn) {
        resetAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Reset config dictionary
            Object.assign(heroWaveConfig, defaultHeroWaveConfig);
            // Re-trigger visual update for each input 
            heroWaveBindings.forEach(({ id, key, format, onchange }) => {
                if (key) {
                    const input = document.getElementById(id);
                    const valEl = document.getElementById(`val-${id}`);
                    const v = heroWaveConfig[key];
                    if (input) input.value = v;
                    if (valEl) valEl.textContent = format(v);
                    if (onchange) onchange(v);
                }
            });
        });
    }
});


function initGrain() {
    if (!grainCanvas) return;
    grainCtx = grainCanvas.getContext('2d', { alpha: true, willReadFrequently: false });
    resizeGrain();
    window.addEventListener('resize', resizeGrain);
}

function resizeGrain() {
    if (!grainCanvas) return;
    // Render at 1:1 pixel (not DPR) so we can control grain size ourselves
    // Use the actual CSS size of the canvas element instead of the whole window
    const w = grainCanvas.clientWidth || window.innerWidth;
    const h = grainCanvas.clientHeight || window.innerHeight;

    grainCanvas.width = Math.max(1, Math.ceil(w / grainConfig.size));
    grainCanvas.height = Math.max(1, Math.ceil(h / grainConfig.size));
}

function drawGrain(timestamp) {
    if (!grainCtx) return;

    // Throttle to configured FPS
    if (timestamp - lastGrainDraw < (1000 / grainConfig.fps)) {
        grainAnimationFrame = requestAnimationFrame(drawGrain);
        return;
    }
    lastGrainDraw = timestamp;

    const w = grainCanvas.width;
    const h = grainCanvas.height;
    const imgData = grainCtx.createImageData(w, h);
    const data = imgData.data;
    const densityThreshold = grainConfig.density / 100; // 0..1

    for (let i = 0; i < data.length; i += 4) {
        if (Math.random() < densityThreshold) {
            const v = Math.random() * grainConfig.intensity;
            data[i] = 255;   // R
            data[i + 1] = 245;   // G (sepia tint)
            data[i + 2] = 230;   // B
            data[i + 3] = v;     // Alpha = intensity
        }
        // pixels where random >= density threshold remain fully transparent (0,0,0,0)
    }

    grainCtx.putImageData(imgData, 0, 0);
    grainAnimationFrame = requestAnimationFrame(drawGrain);
}

function startGrainLoop() {
    if (!grainCtx) initGrain();
    // Always restart the loop fresh (handles size changes)
    lastGrainDraw = performance.now();
    grainCanvas.style.opacity = grainConfig.opacity;
    // Reset canvas size in case it changed
    resizeGrain();
    if (!grainAnimationFrame) {
        grainAnimationFrame = requestAnimationFrame(drawGrain);
    }
}


function stopGrainLoop() {
    if (grainAnimationFrame) {
        cancelAnimationFrame(grainAnimationFrame);
        grainAnimationFrame = null;
    }
}

// ==========================================================================
//   Circular Ripple Wave Engine (Agua Brasil video panel)
// ==========================================================================

const rippleCanvas = document.getElementById('ripple-canvas');
let rippleCtx = null;
let rippleAnimId = null;
let rippleW = 0, rippleH = 0;

// Each active wave ring
// { radius, maxRadius, speed, phase, undulationFreq, undulationAmp, opacity, lineWidth }
const rippleWaves = [];

// Mouse position relative to the video panel (normalised 0-1)
let rippleMouse = { x: 0.5, y: 0.5, active: false };

// Centralized config — all values are live-editable from the Wave Controls panel
let rippleConfig = {
    timeOffset: 0,    // s    — onset offset (−2 to +2)
    spawnCount: 1,    // n    — waves per onset (multiplier)
    maxOpacity: 0.15, // 0–1  — max alpha per ring
    spawnRadiusOffset: 0,    // px   — initial radius gap between co-spawned waves
    spawnRandomness: 1.0,  // 0–2  — multiplier for random variation between co-spawned waves
    interactStrength: 3.5,  // px   — wave-to-wave interference amplitude
    speedBase: 55,   // px/s — base expansion speed
    undulationAmp: 6,    // px   — amplitude of organic edge wobble
    gravityRadius: 200,  // px   — mouse influence radius (0 = disabled)
    lineWidth: 0.6,  // px   — ring stroke width
};

// Audio-synced cues for Agua Brasil
const RIPPLE_CUES = {
    "onsets": [
        0.7, 0.88, 1.81, 4.29, 5.81, 6.81, 9.4, 11.33, 12.18, 14.43, 14.89, 15.83,
        25.76, 25.9, 26.14, 26.46, 26.66, 26.87, 27.08, 27.3, 27.52, 27.73, 27.98,
        28.22, 28.48, 28.74, 29.02, 29.29, 29.59, 29.91, 30.25, 31.6
    ],
    "tremble": [
        { "start": 18.28, "end": 21.78 },
        { "start": 23.32, "end": 30.02 }
    ]
};

// Spawn timing
let rippleNextOnsetIdx = 0;
let rippleLastVideoTime = 0;

// Diagonal half-length of the panel — the max radius a ring needs to
// reach before it has definitely left every edge.
function rippleMaxRadius() {
    return Math.sqrt(rippleW * rippleW + rippleH * rippleH) * 0.5 + 20;
}

// initialRadius: starting radius (px) — used to pre-offset co-spawned waves
function spawnRipple(now, initialRadius = 0) {
    const max = rippleMaxRadius();
    const rnd = rippleConfig.spawnRandomness; // 0 = identical waves, 1 = normal, 2 = very random

    // Speed: base + randomised variation scaled by randomness
    const speed = rippleConfig.speedBase + Math.random() * (rippleConfig.speedBase * 0.4 * rnd);
    // Undulation frequency: always varies (keeps distinct silhouettes)
    const undulationFreq = 4 + Math.floor(Math.random() * 5);
    // Undulation amplitude: randomness scales the "spread" around the config value
    const ampCenter = rippleConfig.undulationAmp;
    const undulationAmp = ampCenter * (1 - 0.5 * rnd + Math.random() * rnd);
    // Phase: full rotation always shuffled (regardless of randomness)
    const phase = Math.random() * Math.PI * 2;
    // Line width: base + variation scaled by randomness
    const lineWidth = rippleConfig.lineWidth + Math.random() * (rippleConfig.lineWidth * 0.5 * rnd);

    rippleWaves.push({
        radius: initialRadius,
        maxRadius: max,
        speed,
        phase,
        undulationFreq,
        undulationAmp,
        opacity: 0,     // fades in on birth, out near edges
        lineWidth,
        born: now
    });
}

function drawRipples(timestamp) {
    if (!rippleCtx) return;

    const dt = Math.min((timestamp - (drawRipples._last || timestamp)) / 1000, 0.05);
    drawRipples._last = timestamp;

    rippleCtx.clearRect(0, 0, rippleW, rippleH);

    // Sync spawning with video currentTime
    const video = document.getElementById('agua-brasil-video');
    let isTrembling = false;

    if (video) {
        const curTime = video.currentTime;

        // Reset index if video looped back
        if (curTime < rippleLastVideoTime - 1) {
            rippleNextOnsetIdx = 0;
        }

        // Apply temporal offset: shift the perceived time for onset matching.
        // Positive offset = onsets trigger later (waves born after the audio cue).
        // Negative offset = onsets trigger earlier (waves born before the cue).
        const effectiveTime = curTime - rippleConfig.timeOffset;

        // Spawn ripples for each onset we've just passed (using offset-adjusted time)
        while (rippleNextOnsetIdx < RIPPLE_CUES.onsets.length &&
            effectiveTime >= RIPPLE_CUES.onsets[rippleNextOnsetIdx]) {
            // Spawn spawnCount waves per onset, each offset by spawnRadiusOffset
            for (let k = 0; k < rippleConfig.spawnCount; k++) {
                spawnRipple(timestamp, k * rippleConfig.spawnRadiusOffset);
            }
            rippleNextOnsetIdx++;
        }

        // Check for trembling ranges
        for (const range of RIPPLE_CUES.tremble) {
            if (curTime >= range.start && curTime <= range.end) {
                isTrembling = true;
                break;
            }
        }

        rippleLastVideoTime = curTime;
    }

    // Origin always stays at dead centre — independent of mouse
    const cx = rippleW * 0.5;
    const cy = rippleH * 0.5;

    const max = rippleMaxRadius();

    // Mouse position in canvas pixels (absolute)
    const mxPx = (rippleMouse.active && rippleConfig.gravityRadius > 0) ? rippleMouse.x * rippleW : null;
    const myPx = (rippleMouse.active && rippleConfig.gravityRadius > 0) ? rippleMouse.y * rippleH : null;
    const GRAVITY_RADIUS = rippleConfig.gravityRadius;  // px — influence zone of the mouse
    const MAX_PULL = 18;   // px — max displacement at distance 0

    // --- Wave-to-wave interaction ---
    // For each ring, accumulate a perturbation from other rings whose radius
    // is within INTERACT_THRESH px. Proximity modulates an extra sinusoidal
    // distortion that creates interference patterns where rings cross.
    const INTERACT_THRESH = 45;  // px — rings closer than this interact
    const INTERACT_STRENGTH = rippleConfig.interactStrength; // live from control panel

    const n = rippleWaves.length;
    const perturbation = new Float32Array(n); // extra radial offset per ring

    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            if (i === j) continue;
            const radiusDiff = Math.abs(rippleWaves[i].radius - rippleWaves[j].radius);
            if (radiusDiff < INTERACT_THRESH) {
                // Closest rings generate strongest patterns (falls off linearly)
                const proximity = 1 - radiusDiff / INTERACT_THRESH;
                // Phase difference drives the interference shape
                const phaseDelta = rippleWaves[j].phase - rippleWaves[i].phase;
                perturbation[i] += proximity * INTERACT_STRENGTH * Math.sin(phaseDelta + timestamp * 0.0005);
            }
        }
    }

    for (let i = n - 1; i >= 0; i--) {
        const w = rippleWaves[i];

        // Advance radius
        w.radius += w.speed * dt;

        // Remove if fully beyond screen
        if (w.radius > max) {
            rippleWaves.splice(i, 1);
            continue;
        }

        // Opacity envelope:
        //   - Fade IN over first 60px of radius
        //   - Fade OUT over the last 30% of travel to the edge
        const fadeInProgress = Math.min(1, w.radius / 60);
        const fadeOutStart = max * 0.70;
        const fadeOutProgress = w.radius > fadeOutStart
            ? 1 - (w.radius - fadeOutStart) / (max - fadeOutStart)
            : 1;
        w.opacity = fadeInProgress * fadeOutProgress * rippleConfig.maxOpacity;

        // Draw the ring point-by-point
        const STEPS = 180;

        rippleCtx.beginPath();

        for (let s = 0; s <= STEPS; s++) {
            const angle = (s / STEPS) * Math.PI * 2;

            // Base sinusoidal undulation + wave-to-wave interference perturbation
            const baseUndulation = Math.sin(angle * w.undulationFreq + w.phase + timestamp * 0.0008) * w.undulationAmp;
            const waveInteraction = Math.sin(angle * (w.undulationFreq + 1) + timestamp * 0.0004) * perturbation[i];

            // Trembling effect: high-frequency jitter during intense audio parts
            const trembleJitter = isTrembling
                ? Math.sin(angle * 40 + timestamp * 0.05) * 4 + (Math.random() - 0.5) * 2
                : 0;

            const r = w.radius + baseUndulation + waveInteraction + trembleJitter;

            // This point's position on the ring (before mouse repulsion)
            let px = cx + Math.cos(angle) * r;
            let py = cy + Math.sin(angle) * r;

            // Per-point mouse repulsion (only when mouse is active)
            if (mxPx !== null) {
                const dx = px - mxPx;
                const dy = py - myPx;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < GRAVITY_RADIUS && dist > 0) {
                    // Repulsion falls off with square root for a wider, smoother feel
                    const t = 1 - dist / GRAVITY_RADIUS;
                    const strength = t * t * MAX_PULL;  // ease-in: strongest near cursor
                    px += (dx / dist) * strength;
                    py += (dy / dist) * strength;
                }
            }

            if (s === 0) {
                rippleCtx.moveTo(px, py);
            } else {
                rippleCtx.lineTo(px, py);
            }
        }

        rippleCtx.closePath();
        rippleCtx.strokeStyle = `rgba(245, 245, 245, ${w.opacity.toFixed(3)})`;
        rippleCtx.lineWidth = w.lineWidth;
        rippleCtx.stroke();
    }

    rippleAnimId = requestAnimationFrame(drawRipples);
}




function initRipples() {
    if (!rippleCanvas) return;
    rippleCtx = rippleCanvas.getContext('2d');
    resizeRipples();
    window.addEventListener('resize', resizeRipples);

    // Track mouse inside the video panel for subtle shift
    const vpPanel = document.getElementById('obra-video');
    if (vpPanel) {
        vpPanel.addEventListener('mousemove', (e) => {
            const rect = vpPanel.getBoundingClientRect();
            rippleMouse.x = (e.clientX - rect.left) / rect.width;
            rippleMouse.y = (e.clientY - rect.top) / rect.height;
            rippleMouse.active = true;
        });
        vpPanel.addEventListener('mouseleave', () => {
            rippleMouse.active = false;
        });
    }
}

function resizeRipples() {
    if (!rippleCanvas) return;
    rippleW = rippleCanvas.clientWidth || window.innerWidth;
    rippleH = rippleCanvas.clientHeight || window.innerHeight;
    rippleCanvas.width = rippleW;
    rippleCanvas.height = rippleH;
}

function startRippleLoop() {
    if (!rippleCtx) initRipples();
    resizeRipples();
    rippleLastSpawn = 0; // force immediate first spawn
    if (!rippleAnimId) {
        drawRipples._last = performance.now();
        rippleAnimId = requestAnimationFrame(drawRipples);
    }
}

function stopRippleLoop() {
    if (rippleAnimId) {
        cancelAnimationFrame(rippleAnimId);
        rippleAnimId = null;
    }
    // Clear canvas and drain wave pool so it's clean on next entry
    rippleWaves.length = 0;
    rippleNextOnsetIdx = 0;
    rippleLastVideoTime = 0;
    if (rippleCtx) rippleCtx.clearRect(0, 0, rippleW, rippleH);
}


// ==========================================================================
//   Eva Candil — Procedural Dot Frame
//   Paints small grey circles near the panel edges using rejection sampling.
//   Dots don't overlap, opacity 0.3, concentrated on the border band.
// ==========================================================================
(function initEvaDots() {
    const canvas = document.getElementById('eva-dots-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Dot config
    const DOT_RADIUS = 3.5;    // px — circle radius
    const MIN_GAP = 2.5;    // px — minimum gap between circle edges
    const MIN_DIST = DOT_RADIUS * 2 + MIN_GAP;
    const BAND = 0.22;   // fraction of width/height = border band width
    const MAX_TRIES = 40;     // rejection sampling attempts per dot
    const DOT_COLOR = 'rgba(180, 180, 180, 0.30)';

    let dots = [];

    function isInBorderBand(x, y, w, h) {
        const bx = w * BAND;
        const by = h * BAND;
        return x < bx || x > w - bx || y < by || y > h - by;
    }

    function tooClose(x, y) {
        for (const d of dots) {
            const dx = d.x - x;
            const dy = d.y - y;
            if (dx * dx + dy * dy < MIN_DIST * MIN_DIST) return true;
        }
        return false;
    }

    function generate(w, h) {
        dots = [];
        const CANDIDATES = Math.floor((w * h * BAND) / (MIN_DIST * MIN_DIST) * 2.2);

        for (let i = 0; i < CANDIDATES; i++) {
            for (let t = 0; t < MAX_TRIES; t++) {
                const x = DOT_RADIUS + Math.random() * (w - DOT_RADIUS * 2);
                const y = DOT_RADIUS + Math.random() * (h - DOT_RADIUS * 2);
                if (isInBorderBand(x, y, w, h) && !tooClose(x, y)) {
                    dots.push({ x, y });
                    break;
                }
            }
        }
    }

    function draw() {
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = DOT_COLOR;
        for (const d of dots) {
            ctx.beginPath();
            ctx.arc(d.x, d.y, DOT_RADIUS, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function resize() {
        const panel = document.getElementById('obra-eva-candil');
        if (!panel) return;
        const rect = panel.getBoundingClientRect();
        canvas.width = rect.width || window.innerWidth;
        canvas.height = rect.height || window.innerHeight;
        generate(canvas.width, canvas.height);
        draw();
    }

    // Initial render
    resize();
    window.addEventListener('resize', resize);
})();

// ==========================================================================
//   Floating Navigation Logic
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
    const nav = document.getElementById('float-nav');
    const trigger = document.getElementById('float-nav-trigger');
    const list = document.getElementById('float-nav-list');
    const links = document.querySelectorAll('.float-nav__link');
    const items = document.querySelectorAll('.float-nav__item');
    let isOpen = false;

    if (!nav || !trigger || !list) return;

    // Toggle menu
    trigger.addEventListener('click', () => {
        isOpen = !isOpen;
        trigger.setAttribute('aria-expanded', isOpen);

        if (isOpen) {
            nav.classList.add('is-open');
            list.style.pointerEvents = 'auto';
            // Staggered fade in (bottom to top)
            gsap.to(items, {
                opacity: 1,
                y: 0,
                x: 0,
                duration: 0.4,
                stagger: -0.05,
                ease: "back.out(1.5)"
            });
        } else {
            nav.classList.remove('is-open');
            list.style.pointerEvents = 'none';
            // Staggered fade out (top to bottom)
            gsap.to(items, {
                opacity: 0,
                y: 15,
                x: 0,
                duration: 0.3,
                stagger: 0.03,
                ease: "power2.in"
            });
        }
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (isOpen && !nav.contains(e.target)) {
            trigger.click();
        }
    });

    // Handle clicks on links
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            const targetIndex = parseInt(e.target.getAttribute('data-index'), 10);
            if (!isNaN(targetIndex) && targetIndex >= 0 && targetIndex < sections.length) {
                // Determine direction
                const direction = targetIndex > currentIndex ? 1 : -1;
                // Close menu
                if (isOpen) trigger.click();

                // If it's the exact same section, do nothing
                if (targetIndex === currentIndex) return;

                // Call the global gotoSection
                gotoSection(targetIndex, direction, direction > 0 ? window.innerHeight : -window.innerHeight);
            }
        });
    });

    // Update active class when section changes
    window.updateNavActiveState = function (index) {
        links.forEach(link => link.classList.remove('is-active'));
        const activeLink = document.querySelector(`.float-nav__link[data-index="${index}"]`);
        if (activeLink) {
            activeLink.classList.add('is-active');
        }
    };

    // Need to initialize active state after a small delay to ensure sections are populated
    setTimeout(() => {
        if (typeof currentIndex !== 'undefined') {
            updateNavActiveState(currentIndex);
        }
    }, 100);
});

// --------------------------------------------------------------------------
// PAGE VISIBILITY: Auto-mute when switching tabs/apps
// --------------------------------------------------------------------------
document.addEventListener('visibilitychange', () => {
    if (audioCtx) {
        if (document.visibilityState === 'hidden') {
            // Suspend audio processing completely when tab is hidden
            audioCtx.suspend();
        } else {
            // Resume only if audio was active (State 1, 2 or 3)
            if (audioState !== 0) {
                audioCtx.resume();
            }
        }
    }
});
