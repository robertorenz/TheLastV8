/* The Last V8 — procedural sound: SID-flavoured chiptune, engine, effects. Everything is synthesised, no samples. */
(function (root) {
  'use strict';

  let ac = null, master, musicBus, sfxBus, noiseBuf;
  let engine = null, skid = null;
  let muted = false, musicOn = false, musicTimer = null, step = 0, nextTime = 0;

  function init() {
    if (ac) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ac.destination);

    // Music bus with a short slap-back delay for that tape-echo feel.
    musicBus = ac.createGain(); musicBus.gain.value = 0.3;
    const delay = ac.createDelay(0.5); delay.delayTime.value = 0.19;
    const fb = ac.createGain(); fb.gain.value = 0.22;
    const wet = ac.createGain(); wet.gain.value = 0.35;
    musicBus.connect(master); musicBus.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);

    sfxBus = ac.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);

    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    buildEngine();
  }

  function resume() { if (ac && ac.state === 'suspended') ac.resume(); }

  function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ac.currentTime, 0.02); }

  function buildEngine() {
    const o1 = ac.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 50;
    const o2 = ac.createOscillator(); o2.type = 'square'; o2.frequency.value = 25;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300; f.Q.value = 2;
    const g = ac.createGain(); g.gain.value = 0;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(sfxBus); o1.start(); o2.start();
    engine = { o1, o2, f, g };

    const n = ac.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
    const bf = ac.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 1800; bf.Q.value = 3;
    const sg = ac.createGain(); sg.gain.value = 0;
    n.connect(bf); bf.connect(sg); sg.connect(sfxBus); n.start();
    skid = { g: sg };
  }

  // norm: 0..1 of top speed, throttle 0/1, on: engine running, skidding: tyres squealing
  function setEngine(norm, throttle, on, skidding) {
    if (!ac) return;
    const t = ac.currentTime;
    engine.g.gain.setTargetAtTime(on ? 0.05 + norm * 0.08 + throttle * 0.03 : 0, t, 0.08);
    const fr = 45 + norm * 150 + throttle * 10;
    engine.o1.frequency.setTargetAtTime(fr, t, 0.06);
    engine.o2.frequency.setTargetAtTime(fr / 2 + 1, t, 0.06);
    engine.f.frequency.setTargetAtTime(250 + norm * 1400 + throttle * 300, t, 0.08);
    skid.g.gain.setTargetAtTime(skidding && on ? 0.1 : 0, t, 0.05);
  }

  function tone(freq, t, dur, type, vol, dest, slideTo) {
    const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest || sfxBus); o.start(t); o.stop(t + dur + 0.02);
  }
  function blip(freq, dur, type, vol, when, slideTo) { if (!ac) return; tone(freq, ac.currentTime + (when || 0), dur, type || 'square', vol == null ? 0.25 : vol, sfxBus, slideTo); }

  function noiseBurst(dur, freq, vol, sweepTo, when) {
    if (!ac) return;
    const t = ac.currentTime + (when || 0);
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t); s.stop(t + dur + 0.02);
  }

  const sfx = {
    pickup() { [660, 880, 1320].forEach((f, i) => blip(f, 0.12, 'square', 0.18, i * 0.07)); },
    checkpoint() { [523, 784].forEach((f, i) => blip(f, 0.2, 'triangle', 0.3, i * 0.12)); },
    beep() { blip(880, 0.12, 'square', 0.22); },
    door() { blip(90, 0.3, 'sawtooth', 0.3, 0, 40); noiseBurst(0.18, 500, 0.25); },
    explosion() { noiseBurst(1.4, 2600, 0.9, 120); blip(110, 0.7, 'sine', 0.8, 0, 28); noiseBurst(0.5, 6000, 0.4, 800, 0.05); },
    fanfare() { [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.22, 'square', 0.22, i * 0.12)); blip(1047, 0.7, 'square', 0.22, 0.5); blip(1319, 0.7, 'triangle', 0.2, 0.5); },
    fail() { [330, 262, 196, 131].forEach((f, i) => blip(f, 0.4, 'sawtooth', 0.22, i * 0.28)); },
    detonation() { noiseBurst(3, 3000, 1, 60); blip(60, 2.5, 'sine', 0.9, 0, 20); },
  };

  // ---- sequencer: 148 bpm, 16th steps, four-chord loop (Am F C G), Hubbard-style arpeggios ----
  const BPM = 148, STEP = 60 / BPM / 4;
  const CHORDS = [{ root: 45, minor: true }, { root: 41, minor: false }, { root: 48, minor: false }, { root: 43, minor: false }];
  const BASS = [0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0, 0, 7, 12, 7];
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  function drum(kind, t) {
    if (kind === 'kick') tone(150, t, 0.16, 'sine', 0.6, musicBus, 40);
    else if (kind === 'snare') { noiseBurstAt(t, 0.14, 2500, 0.28); tone(220, t, 0.08, 'triangle', 0.25, musicBus, 120); }
    else noiseBurstAt(t, 0.04, 9000, 0.08);
  }
  function noiseBurstAt(t, dur, freq, vol) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = freq;
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(musicBus); s.start(t); s.stop(t + dur + 0.02);
  }

  function schedule() {
    if (!musicOn) return;
    while (nextTime < ac.currentTime + 0.14) {
      const bar = Math.floor(step / 16) % 4, s = step % 16, ch = CHORDS[bar];
      const third = ch.minor ? 3 : 4;
      const phrase = Math.floor(step / 64) % 4;
      const arp = [0, third, 7, 12, third, 7, 12, third + 12, 7, 12, third + 12, 19, 12, third + 12, 19, 24];

      if (s % 2 === 0 || s === 13) tone(midi(ch.root + BASS[s]), nextTime, STEP * 1.7, 'square', 0.16, musicBus);
      let lead;
      if (phrase === 0) lead = arp[s];
      else if (phrase === 1) lead = arp[(s * 5) % 16];
      else if (phrase === 2) lead = (s % 4 === 3) ? arp[15 - s] : arp[s % 8];
      else lead = arp[15 - s];
      tone(midi(ch.root + 24 + lead), nextTime, STEP * 0.85, 'square', 0.11, musicBus);
      if (phrase >= 2 && s % 4 === 0) tone(midi(ch.root + 36 + arp[(s + bar) % 8]), nextTime, STEP * 3, 'triangle', 0.12, musicBus);

      if (s === 0 || s === 8 || s === 10) drum('kick', nextTime);
      if (s === 4 || s === 12) drum('snare', nextTime);
      if (s % 2 === 1) drum('hat', nextTime);

      step++; nextTime += STEP;
    }
  }
  function startMusic() {
    if (!ac || musicOn) return;
    musicOn = true; step = 0; nextTime = ac.currentTime + 0.05;
    musicTimer = setInterval(schedule, 40);
  }
  function stopMusic() { musicOn = false; if (musicTimer) clearInterval(musicTimer); musicTimer = null; }

  root.LastV8Sound = Object.assign({ init, resume, setMuted, setEngine, startMusic, stopMusic, get ready() { return !!ac; } }, sfx);
})(window);
