import type { KeybindExpression } from "./Keybind";
import type { KeyEvent } from "./KeybindChecker";

export class KeybindLeaderTracker {
  #isLeaderActive?: ReturnType<typeof setTimeout>;
  #expired = false;
  readonly #expirationTime: number;
  readonly #leaderKey: string;

  constructor(expirationTime: number, leaderKey: KeybindExpression) {
    this.#expirationTime = expirationTime;
    this.#leaderKey = leaderKey;
  }

  #track(): void {
    this.#expired = false;
    clearTimeout(this.#isLeaderActive);

    this.#isLeaderActive = setTimeout(() => {
      this.#clear();
    }, this.#expirationTime);
  }

  #isTracking() {
    return this.#isLeaderActive != null;
  }

  #clear() {
    clearTimeout(this.#isLeaderActive);
    this.#isLeaderActive = undefined;
    this.#expired = true;
  }

  get isActive() {
    return !this.#expired;
  }

  checkLeaderAndStartTracking(e: KeyEvent): { trackingStarted: boolean } {
    // If it is the leader key and we are not tracking we
    // start tracking and ignore the event for the keybind
    // checks
    if (this.#isLeader(e) && !this.#isTracking()) {
      this.#track();
      return { trackingStarted: true };
    }

    // If it's not a leader key we just ignore and allow
    // the consecutive checks to happen
    return { trackingStarted: false };
  }

  #isLeader(e: KeyEvent) {
    // check code here as well for more configuration options
    return e.code === this.#leaderKey || this.#leaderKey === e.key;
  }
}
