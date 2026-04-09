import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDebouncer } from '../../src/preload/debounce.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createDebouncer (TSC-A27)', () => {
  it('coalesces N rapid calls into 1 invocation within the debounce window', () => {
    const fn = vi.fn();
    const debounced = createDebouncer(500, fn);

    for (let i = 0; i < 10; i++) {
      debounced();
      vi.advanceTimersByTime(50);
    }
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('fires the trailing call after the window elapses', () => {
    const fn = vi.fn();
    const debounced = createDebouncer(500, fn);

    debounced();
    vi.advanceTimersByTime(499);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('supports multiple sequential bursts', () => {
    const fn = vi.fn();
    const debounced = createDebouncer(500, fn);

    debounced();
    debounced();
    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(1);

    debounced();
    debounced();
    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('passes the last call arguments to the debounced fn', () => {
    const fn = vi.fn();
    const debounced = createDebouncer<[number]>(500, fn);

    debounced(1);
    debounced(2);
    debounced(3);
    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledWith(3);
  });

  it('cancel() prevents a pending call from firing', () => {
    const fn = vi.fn();
    const debounced = createDebouncer(500, fn);

    debounced();
    debounced.cancel();
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
  });
});
