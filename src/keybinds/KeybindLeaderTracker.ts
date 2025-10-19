import type { KeybindExpression } from "./Keybind";
import type { KeyEvent } from "./KeybindChecker";

export class KeybindLeaderTracker {
  readonly #expirationTime: number;
  readonly #leaderKey: string;

  #isLeaderActive?: ReturnType<typeof setTimeout>;
  #isActive = false;

  constructor(expirationTime: number, leaderKey: KeybindExpression) {
    this.#expirationTime = expirationTime;
    this.#leaderKey = leaderKey;
  }

  #track(): void {
    this.#isActive = true;
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
    this.#isActive = false;
  }

  isActive() {
    const active = this.#isActive;

    // If the leader key is active when it's checked it resets
    // for subsequent leader key presses
    if (active) {
      this.#clear();
    }

    return active;
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
    // If any modifier keys are held, it can't be the leader key
    if (e.altKey || e.ctrlKey || e.metaKey) {
      return false;
    }
    // check code here as well for more configuration options
    return e.code === this.#leaderKey || this.#leaderKey === e.key;
  }
}
