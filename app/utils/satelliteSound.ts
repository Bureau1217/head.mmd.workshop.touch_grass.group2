/**
 * Utility: Satellite Sound Synthesizer (Web Audio API)
 * Synthesizes an organic, deep orbital pass sound with Doppler effect
 * and low-frequency earthquake tremor during the satellite's closest transit.
 * Zero external audio files required.
 */

let audioCtx: AudioContext | null = null;
let isUnlocked = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }

  if (audioCtx && audioCtx.state === 'suspended' && isUnlocked) {
    audioCtx.resume().catch(() => {
      // Ignore autoplay policy restrictions until next user gesture
    });
  }

  return audioCtx;
}

/**
 * Register lightweight unlock listener on user gesture (click, keydown, touch)
 */
export function initAudioUnlock(): void {
  if (typeof window === 'undefined' || isUnlocked) return;

  const unlock = () => {
    isUnlocked = true;
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    window.removeEventListener('click', unlock);
    window.removeEventListener('touchstart', unlock);
    window.removeEventListener('keydown', unlock);
  };

  window.addEventListener('click', unlock, { passive: true });
  window.addEventListener('touchstart', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
}

/**
 * Plays an organic satellite pass and earthquake vibration sound:
 * - Starts really low/subtle when it enters (t = 0)
 * - Swells to strongest intensity at the middle of transit (t = 1.2s) with sub-bass Doppler sweep and rumble
 * - Fades away smoothly as it departs (t = 2.4s)
 */
export function playSatellitePassSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const duration = 2.4;
    const zenithTime = now + 1.2;

    // 1. Primary Doppler Drone (Satellite transit in upper atmosphere)
    const oscDoppler = ctx.createOscillator();
    oscDoppler.type = 'sine';
    oscDoppler.frequency.setValueAtTime(46, now);
    oscDoppler.frequency.exponentialRampToValueAtTime(88, zenithTime);
    oscDoppler.frequency.exponentialRampToValueAtTime(38, now + duration);

    // 2. Sub-bass Earthquake Tremor (Deep physical ground rumble)
    const oscRumble = ctx.createOscillator();
    oscRumble.type = 'triangle';
    oscRumble.frequency.setValueAtTime(30, now);
    oscRumble.frequency.linearRampToValueAtTime(44, zenithTime);
    oscRumble.frequency.linearRampToValueAtTime(26, now + duration);

    // 3. Low-Pass Filter (Opens up at zenith, muffles as it recedes)
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(75, now);
    filter.frequency.exponentialRampToValueAtTime(260, zenithTime);
    filter.frequency.exponentialRampToValueAtTime(60, now + duration);

    // 4. Tremor LFO (Modulates gain to simulate physical ground vibration peaking at zenith)
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(8, now);
    lfo.frequency.linearRampToValueAtTime(13, zenithTime);
    lfo.frequency.linearRampToValueAtTime(7, now + duration);

    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0.001, now);
    lfoGain.gain.linearRampToValueAtTime(0.035, zenithTime);
    lfoGain.gain.linearRampToValueAtTime(0.001, now + duration);

    // 5. Master Gain Envelope: Starts really low, peaks smoothly at middle, decays smoothly away
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    masterGain.gain.exponentialRampToValueAtTime(0.13, zenithTime);
    masterGain.gain.exponentialRampToValueAtTime(0.015, now + 2.0);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    // Wiring audio nodes
    oscDoppler.connect(filter);
    oscRumble.connect(filter);
    filter.connect(masterGain);

    lfo.connect(lfoGain);
    lfoGain.connect(masterGain.gain);

    masterGain.connect(ctx.destination);

    // Trigger synthesis
    oscDoppler.start(now);
    oscRumble.start(now);
    lfo.start(now);

    oscDoppler.stop(now + duration + 0.05);
    oscRumble.stop(now + duration + 0.05);
    lfo.stop(now + duration + 0.05);
  } catch (err) {
    console.debug('[satelliteSound] Audio play skipped:', err);
  }
}
