// Test for Clock abstraction - ensures deterministic time control
// Context7: consulted for vitest
import { describe, it, expect, beforeEach } from 'vitest';

import { SystemClock, TestClock } from './clock.js';

describe('Clock Abstraction', () => {
  describe('SystemClock', () => {
    it('should return current system time', () => {
      const clock = new SystemClock();
      const before = Date.now();
      const clockTime = clock.now().getTime();
      const after = Date.now();

      // Clock time should be between before and after
      expect(clockTime).toBeGreaterThanOrEqual(before);
      expect(clockTime).toBeLessThanOrEqual(after);
    });

    it('should return different times on subsequent calls', async () => {
      const clock = new SystemClock();
      const time1 = clock.now().getTime();

      // Wait a tiny bit to ensure time advances
      await new Promise(resolve => setTimeout(resolve, 1));

      const time2 = clock.now().getTime();
      expect(time2).toBeGreaterThanOrEqual(time1);
    });
  });

  describe('TestClock', () => {
    let clock: TestClock;
    const startTime = new Date('2024-01-01T00:00:00Z').getTime();

    beforeEach(() => {
      clock = new TestClock(startTime);
    });

    it('should return the initial time', () => {
      expect(clock.now().getTime()).toBe(startTime);
    });

    it('should advance time by specified milliseconds', () => {
      clock.advance(1000);
      expect(clock.now().getTime()).toBe(startTime + 1000);

      clock.advance(500);
      expect(clock.now().getTime()).toBe(startTime + 1500);
    });

    it('should allow setting arbitrary time', () => {
      const newTime = new Date('2025-01-01T00:00:00Z').getTime();
      clock.setTime(newTime);
      expect(clock.now().getTime()).toBe(newTime);
    });

    it('should return same time on multiple calls without advance', () => {
      const time1 = clock.now().getTime();
      const time2 = clock.now().getTime();
      const time3 = clock.now().getTime();

      expect(time1).toBe(time2);
      expect(time2).toBe(time3);
    });

    it('should create Date objects with correct time', () => {
      const date = clock.now();
      expect(date).toBeInstanceOf(Date);
      expect(date.toISOString()).toBe('2024-01-01T00:00:00.000Z');

      clock.advance(3600000); // Advance 1 hour
      const newDate = clock.now();
      expect(newDate.toISOString()).toBe('2024-01-01T01:00:00.000Z');
    });
  });
});
