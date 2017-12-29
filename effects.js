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
  isFinished() {
    return this.usLastTime >= this.usDisplayTime + this.usStartTime;
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
