export class History<T> {
  private states: T[];
  private cursor = 0;

  constructor(initial: T) {
    this.states = [initial];
  }

  get canUndo(): boolean {
    return this.cursor > 0;
  }

  get canRedo(): boolean {
    return this.cursor < this.states.length - 1;
  }

  push(value: T): void {
    if (this.states[this.cursor] === value) return;
    this.states = this.states.slice(0, this.cursor + 1);
    this.states.push(value);
    if (this.states.length > 100) this.states.shift();
    this.cursor = this.states.length - 1;
  }

  undo(): T | null {
    if (!this.canUndo) return null;
    this.cursor -= 1;
    return this.states[this.cursor];
  }

  redo(): T | null {
    if (!this.canRedo) return null;
    this.cursor += 1;
    return this.states[this.cursor];
  }
}