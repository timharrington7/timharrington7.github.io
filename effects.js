class EmptyEffect {
  constructor(usDisplayTime) {
    this.usDisplayTime = usDisplayTime;
  }
  setup(startPosition, usStartTime) {
    this.startPosition = startPosition;
    this.usStartTime = usStartTime;
  }
  isLaserOn(position, usTime) {
    this.usLastTime = usTime;
    return false;
  }
  isFinished(usTime) {
    return usTime >= this.usDisplayTime + this.usStartTime;
  }
}

class FullEffect extends EmptyEffect {
  constructor(usDisplayTime) {
    super(usDisplayTime)
  }
  isLaserOn(position, usTime) {
    this.usLastTime = usTime;
    return true;
  }
}

class SunrayEffect extends EmptyEffect {
  constructor(usDisplayTime, beamCount, usRotationTime = 0) {
    super(usDisplayTime);
    this.usDisplayTime = usDisplayTime;
    this.beamCount = beamCount;
    this.bucketWidth = 1 / beamCount;
    this.usRotationTime = usRotationTime;
  }
  isLaserOn(position, usTime) {
    this.usLastTime = usTime;
    let rotationProgress = 0;
    if (this.usRotationTime) {
      const delta = (usTime - this.usStartTime) % this.usRotationTime;
      rotationProgress = delta / this.usRotationTime;
    }
    position = (position + rotationProgress) % 1;
    position = (position / this.bucketWidth) % 1;
    return this.isBeamInOnWindow(position, rotationProgress);
  }  
  isBeamInOnWindow(position, rotationProgress) {
    if (position < .5) {
      return true;
    } else {
      return false;
    }   
  }
  isFinished() {
    return this.usLastTime >= this.usDisplayTime + this.usStartTime;
  }
}

class ReverseSunrayEffect extends SunrayEffect {
  isLaserOn(position, usStartTime) {
    return super.isLaserOn(1 - position, usStartTime);
  }
  isBeamInOnWindow(position) {
    if (position < .5) {
      return false;
    } else {
      return true;
    }   
  }
}

class CoverEffect extends EmptyEffect {
  constructor(usDisplayTime) {
    super(usDisplayTime);
    this.usDisplayTime = usDisplayTime;
  }
  isLaserOn(position, usTime) {
    this.usLastTime = usTime;
    const delta = (usTime - this.usStartTime) % this.usDisplayTime;
    const rotationProgress = delta / this.usDisplayTime;
    if (position < rotationProgress) {
      return true;
    }
    return false;
  }  
}

class UncoverEffect extends EmptyEffect {
  constructor(usDisplayTime) {
    super(usDisplayTime);
    this.usDisplayTime = usDisplayTime;
  }
  isLaserOn(position, usTime) {
    this.usLastTime = usTime;
    const delta = (usTime - this.usStartTime) % this.usDisplayTime;
    const rotationProgress = delta / this.usDisplayTime;
    if (position < rotationProgress) {
      return false;
    }
    return true;
  }  
}

class OpeningSunrayEffect extends SunrayEffect {
  isBeamInOnWindow(position, rotationProgress) {
    const delta = (this.usLastTime - this.usStartTime) % this.usDisplayTime;
    const displayProgress = (delta / this.usDisplayTime) / 2;
    if ((1 - position) < displayProgress) {
      return false;
    }
    return true;
  }
}

class ClosingSunrayEffect extends SunrayEffect {
  isBeamInOnWindow(position, rotationProgress) {
    const delta = (this.usLastTime - this.usStartTime) % this.usDisplayTime;
    const displayProgress = (delta / this.usDisplayTime) / 2;
    if (position < displayProgress + 0.5) {
      return true;
    }
    return false;
  }
}

class HalfEffect extends EmptyEffect {
  isLaserOn(position, usTime) {
    return position < .5;
  }
}

class FadeAndUnfadeEffect extends EmptyEffect {
  constructor(usDisplayTime, options = {}) {    
    super(usDisplayTime);
    const {delayUs = -1, transitionUs = -1, invert = false} = options;
    this.invert = invert;
    this.fadeDurationUs = usDisplayTime;
    this.fadeDelayUs = (delayUs === -1) ? 0 * 1000 * 1000 : delayUs;
    this.transitionUs = (transitionUs === -1) ? 300 * 1000 : transitionUs;
    this.transitionProgress = this.transitionUs / this.fadeDurationUs;
    this.cycleTimeUs = this.fadeDurationUs + this.fadeDelayUs;
    this.darkWindowUs = 40 * 1000;
    this.darkWindowProgress = this.darkWindowUs / this.fadeDurationUs;
    this.dimFn = ldim;
  }
  isLaserOn(position, usTime) {
    const usNow = window.performance.now() * 1000;
    const elapsedUs = usNow - this.usStartTime;
    const curCycleUs = elapsedUs % this.cycleTimeUs;
    if (curCycleUs < this.fadeDelayUs) {
      // not currently shimmering
      return true;
    }
    const shimmerCycleUs = curCycleUs - this.fadeDelayUs;
    const curShimmerProgress = shimmerCycleUs / this.fadeDurationUs;
    let x, p;
    if (curShimmerProgress > (this.transitionProgress + this.darkWindowProgress)) {
      // gradually increase intensity
      const windowSize = 1 - this.transitionProgress - this.darkWindowProgress;
      const windowStart = this.transitionProgress + this.darkWindowProgress;
      const windowProgress = (curShimmerProgress - windowStart) / windowSize;
      return tdim(1 - windowProgress);
    } else if (curShimmerProgress < (this.transitionProgress - this.darkWindowProgress)) {
      const windowSize = this.transitionProgress - this.darkWindowProgress;
      const windowStart = 0;
      const windowProgress = (curShimmerProgress - windowStart) / windowSize;
      // gradually decrease intensity
      return tdim(windowProgress);
    } else {
      return tdim(1);
    }
  }
}

// Brightest at position = 0
// Darkest at position = 1
function tdim(position) {
  const cliff = 0.8 * Math.PI / 2;
  let x = cliff * position;
  const p = Math.tan(x)/Math.tan(cliff);
  return (1-p) > Math.random();
}

function ldim(position) {
  return position > Math.random();
}

class CompositeEffect extends EmptyEffect {
  constructor(usDisplayTime) {
    super(usDisplayTime);
    this.effects = [];
    this.currentEffectPos = -1;
  }
  addEffect(effect) {
    this.effects.push(effect);
  }
  getNextEffect() {
    this.currentEffectPos++;
    return this.effects[this.currentEffectPos % this.effects.length];
  }
  isLaserOn(position, usTime) {
    if (!this.effect || this.effect.isFinished(usTime)) {
      this.effect = this.getNextEffect();
      this.effect.setup(position, usTime);
    }
    return this.effect.isLaserOn(position, usTime);
  }
}

class BeatEffect extends CompositeEffect {
  constructor(bpm, beatCount, useFade = false) {
    const beatIntervalUs = (60 / bpm) * 1000 * 1000;
    if (useFade) {
      super(beatIntervalUs * beatCount);
      const fadeOptions = {
        delayUs: 0,
        transitionUs: beatIntervalUs / 3
      };
      for (let i = 0; i < bpm; i++) {
        this.addEffect(new FadeAndUnfadeEffect(beatIntervalUs, fadeOptions));
      }
    } else {
      super(beatIntervalUs * (beatCount + 1));
      const beatFlashDurationUs = 300 * 1000; // 200 ms
      for (let i = 0; i < bpm + 1; i++) {
        this.addEffect(new FullEffect(beatFlashDurationUs / 2));
        this.addEffect(new EmptyEffect(beatIntervalUs - beatFlashDurationUs));
        this.addEffect(new FullEffect(beatFlashDurationUs));
      }
    }
  }
}
