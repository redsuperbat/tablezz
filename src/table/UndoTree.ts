export interface Change {
  undo(): void;
}
export class UndoTree {
  #changes: Change[] = [];

  undo() {
    this.#changes.pop()?.undo();
  }

  addChange(change: Change) {
    this.#changes.push(change);
  }
}
