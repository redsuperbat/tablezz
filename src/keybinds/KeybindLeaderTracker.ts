import type { KeyEvent } from "./KeybindChecker";
import type { KeybindExpression } from "./useRegisterKeybind";

export class KeybindLeaderTracker {
  #isLeaderActive?: ReturnType<typeof setTimeout>;
  #expired = false;
  readonly #expirationTime: number;
  readonly #leaderKey: string;

  constructor(expirationTime: number, leaderKey: KeybindExpression) {
    this.#expirationTime = expirationTime;
    this.#leaderKey = leaderKey;
  }

  track(): void {
    this.#expired = false;
    clearTimeout(this.#isLeaderActive);

    this.#isLeaderActive = setTimeout(() => {
      this.#isLeaderActive = undefined;
      this.#expired = true;
    }, this.#expirationTime);
  }

  get isTracking() {
    return this.#isLeaderActive != null;
  }

  isLeader(e: KeyEvent) {
    // check code here as well for more configuration options
    return e.code === this.#leaderKey || this.#leaderKey === e.key;
  }

  withLeaderScope(cb: () => boolean) {
    if (this.#expired) {
      return false;
    }

    return cb();
  }
}
