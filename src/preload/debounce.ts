// Trailing-edge debouncer. The last call inside `ms` wins; preceding
// calls are dropped. Returns an object exposing the debounced fn plus a
// `cancel` hook for teardown / tests.

export interface Debounced<TArgs extends unknown[]> {
  (...args: TArgs): void;
  cancel: () => void;
}

export function createDebouncer<TArgs extends unknown[]>(
  ms: number,
  fn: (...args: TArgs) => void,
): Debounced<TArgs> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const debounced = ((...args: TArgs) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  }) as Debounced<TArgs>;

  debounced.cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return debounced;
}
