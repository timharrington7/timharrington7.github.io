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

class ShimmerEffect extends EmptyEffect {
  constructor(usDisplayTime) {
    super(usDisplayTime);
    this.shimmerDelayUs = 0 * 1000 * 1000;
    this.shimmerDurationUs = 3 * 1000 * 1000;
    this.shimmerTransitionUs = 300 * 1000
    this.shimmerTransition = this.shimmerTransitionUs / this.shimmerDurationUs;
    this.cycleTimeUs = this.shimmerDurationUs + this.shimmerDelayUs;
    this.darkWindowUs = 40 * 1000;
    this.darkWindow = this.darkWindowUs / this.shimmerDurationUs;
  }
  isLaserOn(position, usTime) {
    const usNow = window.performance.now() * 1000;
    const elapsedUs = usNow - this.usStartTime;
    const curCycleUs = elapsedUs % this.cycleTimeUs;
    if (curCycleUs < this.shimmerDelayUs) {
      // not currently shimmering
      return true;
    }
    const shimmerCycleUs = curCycleUs - this.shimmerDelayUs;
    const curShimmerProgress = shimmerCycleUs / this.shimmerDurationUs;
    let x, p;
    if (curShimmerProgress > (this.shimmerTransition + this.darkWindow)) {
      // gradually increase intensity
      const windowSize = 1 - this.shimmerTransition - this.darkWindow;
      const windowStart = this.shimmerTransition + this.darkWindow;
      const windowProgress = (curShimmerProgress - windowStart) / windowSize;
      return tdim(1 - windowProgress);
    } else if (curShimmerProgress < (this.shimmerTransition - this.darkWindow)) {
      const windowSize = this.shimmerTransition - this.darkWindow;
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
