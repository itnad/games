// 소리: Web Audio로 메트로놈(딱딱이)과 악귀 신호를 합성한다. 외부 음원 파일은 쓰지 않는다.
// 모든 예약은 AudioContext.currentTime 기준이다. setTimeout으로 박을 치지 않는다.

const DEG = Math.PI / 180;

export function createBaksalAudio(context) {
  const master = context.createGain();
  master.gain.value = 0.9;
  master.connect(context.destination);

  function envelope(gainNode, at, peak, attack, decay) {
    gainNode.gain.cancelScheduledValues(at);
    gainNode.gain.setValueAtTime(0.0001, at);
    gainNode.gain.exponentialRampToValueAtTime(peak, at + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  }

  function panned(pan) {
    if (typeof context.createStereoPanner === "function") {
      const panner = context.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      panner.connect(master);
      return panner;
    }
    return master;
  }

  function tone({ at, frequency, type = "sine", peak = 0.5, attack = 0.005, decay = 0.12, pan = 0, slideTo = null }) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, at + attack + decay);
    envelope(gain, at, peak, attack, decay);
    oscillator.connect(gain);
    gain.connect(panned(pan));
    oscillator.start(at);
    oscillator.stop(at + attack + decay + 0.05);
  }

  let noiseBuffer = null;
  function noise({ at, peak = 0.4, decay = 0.08, pan = 0, highpass = 1200 }) {
    if (!noiseBuffer) {
      noiseBuffer = context.createBuffer(1, context.sampleRate * 0.5, context.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    }
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = context.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = highpass;
    const gain = context.createGain();
    envelope(gain, at, peak, 0.003, decay);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(panned(pan));
    source.start(at);
    source.stop(at + decay + 0.05);
  }

  /** 방위 차이(도)를 스테레오 팬으로 바꾼다. 뒤쪽 소리는 조금 작게 들리게 한다. */
  function panFor(relativeAzimuthDeg) {
    return Math.sin((relativeAzimuthDeg || 0) * DEG);
  }
  function behindFactor(relativeAzimuthDeg) {
    return Math.abs(relativeAzimuthDeg || 0) > 90 ? 0.75 : 1;
  }

  return {
    context,
    /** 딱딱이. 마디 첫 박은 강하게. */
    metronome(at, strong) {
      noise({ at, peak: strong ? 0.55 : 0.3, decay: strong ? 0.07 : 0.045, highpass: strong ? 900 : 1600 });
      tone({ at, frequency: strong ? 520 : 760, type: "triangle", peak: strong ? 0.35 : 0.18, decay: strong ? 0.09 : 0.05 });
    },
    /** 보정 화면용 단순 클릭. */
    click(at) {
      tone({ at, frequency: 1000, type: "square", peak: 0.25, decay: 0.04 });
    },
    spawn(at, relativeAzimuth) {
      const pan = panFor(relativeAzimuth);
      tone({ at, frequency: 220, type: "sawtooth", peak: 0.25 * behindFactor(relativeAzimuth), decay: 0.5, pan, slideTo: 330 });
    },
    /** 공격 예고. 동작별로 음높이가 다르다: 숙이기 높음, 좌우 중간, 젖히기 낮음. */
    cue(at, gesture, relativeAzimuth) {
      const pan = panFor(relativeAzimuth);
      const level = behindFactor(relativeAzimuth);
      if (gesture === "duck") tone({ at, frequency: 1320, peak: 0.45 * level, decay: 0.28, pan, slideTo: 1760 });
      else if (gesture === "left" || gesture === "right") tone({ at, frequency: 660, type: "triangle", peak: 0.45 * level, decay: 0.28, pan: gesture === "left" ? -0.8 : 0.8 });
      else tone({ at, frequency: 165, type: "sawtooth", peak: 0.5 * level, decay: 0.35, pan, slideTo: 110 });
    },
    arrive(at, gesture, relativeAzimuth) {
      const pan = panFor(relativeAzimuth);
      noise({ at, peak: gesture === "back" ? 0.5 : 0.35, decay: 0.16, pan, highpass: gesture === "duck" ? 2200 : 600 });
    },
    shot(at) {
      noise({ at, peak: 0.5, decay: 0.09, highpass: 500 });
      tone({ at, frequency: 240, type: "square", peak: 0.3, decay: 0.07, slideTo: 90 });
    },
    judgment(at, judgment) {
      if (judgment === "ttak") tone({ at, frequency: 1568, peak: 0.3, decay: 0.12 });
      else if (judgment === "joa") tone({ at, frequency: 1046, peak: 0.22, decay: 0.1 });
    },
    dodged(at) {
      tone({ at, frequency: 880, type: "triangle", peak: 0.3, decay: 0.1 });
      tone({ at: at + 0.08, frequency: 1320, type: "triangle", peak: 0.3, decay: 0.14 });
    },
    playerHit(at) {
      tone({ at, frequency: 140, type: "sawtooth", peak: 0.6, decay: 0.3, slideTo: 60 });
      noise({ at, peak: 0.4, decay: 0.2, highpass: 300 });
    },
    purified(at) {
      [523, 659, 784, 1046].forEach((frequency, index) => tone({ at: at + index * 0.07, frequency, peak: 0.3, decay: 0.3 }));
    },
    /** 저주 파동 예고: 으스스한 떨림. 도착 박까지 이어진다. */
    curseCue(at, relativeAzimuth) {
      const pan = panFor(relativeAzimuth);
      tone({ at, frequency: 392, type: "sine", peak: 0.35 * behindFactor(relativeAzimuth), decay: 0.9, pan, slideTo: 415 });
      tone({ at: at + 0.25, frequency: 466, type: "sine", peak: 0.25, decay: 0.7, pan });
    },
    cursed(at) {
      tone({ at, frequency: 220, type: "sawtooth", peak: 0.4, decay: 0.6, slideTo: 110 });
      tone({ at: at + 0.1, frequency: 233, type: "sine", peak: 0.3, decay: 0.8 });
    },
    roomStart(at, boss) {
      if (boss) {
        tone({ at, frequency: 98, type: "sawtooth", peak: 0.6, decay: 0.9, slideTo: 65 });
        tone({ at: at + 0.15, frequency: 196, type: "square", peak: 0.25, decay: 0.5 });
        noise({ at, peak: 0.4, decay: 0.4, highpass: 200 });
      } else {
        [523, 784].forEach((frequency, index) => tone({ at: at + index * 0.12, frequency, type: "triangle", peak: 0.3, decay: 0.25 }));
      }
    },
    talisman(at) {
      [659, 880, 1318].forEach((frequency, index) => tone({ at: at + index * 0.06, frequency, peak: 0.25, decay: 0.25 }));
    },
    shield(at) {
      tone({ at, frequency: 1760, type: "triangle", peak: 0.35, decay: 0.35, slideTo: 880 });
      noise({ at, peak: 0.25, decay: 0.2, highpass: 3000 });
    },
    blocked(at) {
      tone({ at, frequency: 1046, type: "square", peak: 0.3, decay: 0.12 });
      noise({ at, peak: 0.3, decay: 0.1, highpass: 2500 });
    },
    torch(at) {
      noise({ at, peak: 0.45, decay: 0.5, highpass: 800 });
      tone({ at, frequency: 330, type: "triangle", peak: 0.3, decay: 0.5, slideTo: 660 });
    },
    weak(at) {
      tone({ at, frequency: 2093, peak: 0.3, decay: 0.08 });
      tone({ at: at + 0.05, frequency: 2637, peak: 0.3, decay: 0.14 });
    },
    dryFire(at) {
      tone({ at, frequency: 1800, type: "square", peak: 0.12, decay: 0.03 });
    },
    reload(at) {
      noise({ at, peak: 0.35, decay: 0.12, highpass: 1500 });
      tone({ at: at + 0.09, frequency: 520, type: "triangle", peak: 0.3, decay: 0.08 });
      tone({ at: at + 0.16, frequency: 780, type: "triangle", peak: 0.3, decay: 0.1 });
    },
    whisper(at, relativeAzimuth) {
      const pan = panFor(relativeAzimuth);
      noise({ at, peak: 0.18, decay: 0.45, pan, highpass: 4000 });
    },
    now() {
      return context.currentTime;
    },
  };
}
