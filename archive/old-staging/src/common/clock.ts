// Clock abstraction for testable time dependency injection
// Allows deterministic testing without weakening test contracts

export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

// Test clock for controlled time advancement in tests
export class TestClock implements Clock {
  private currentTime: number;

  constructor(startTime: number = Date.now()) {
    this.currentTime = startTime;
  }

  now(): Date {
    return new Date(this.currentTime);
  }

  advance(ms: number): void {
    this.currentTime += ms;
  }

  setTime(time: number): void {
    this.currentTime = time;
  }
}
