import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';
import { buildDesertLayout } from '../background/desertLayout';
import { drawDesert } from '../background/drawDesert';
import { type FalconBounds, type FalconState, advanceFalcon, createFalcon, flap } from '../falcon/falconPhysics';
import { type FalconView, createFalconView } from '../falcon/drawFalcon';
import { createPressGate } from '../falcon/pressGate';

/** What the scene shares in the registry; the browser tests read it. */
export interface FalconSnapshot {
  y: number;
  vy: number;
  phase: FalconState['phase'];
  flaps: number;
  groundY: number;
}

/** The run: the desert, and the falcon that flaps and falls. The first flap starts the run; touching the ground ends it. */
export class FlightScene extends Phaser.Scene {
  static readonly KEY = 'Flight';
  /** Sent once when the falcon touches the ground. */
  static readonly RUN_OVER = 'run-over';

  private falcon!: FalconState;
  private view!: FalconView;
  private bounds!: FalconBounds;
  private readonly keys = createPressGate();

  constructor() {
    super(FlightScene.KEY);
  }

  create(): void {
    const layout = buildDesertLayout(GAME_WIDTH, GAME_HEIGHT);
    drawDesert(this, layout);

    this.bounds = { top: 0, groundY: layout.horizonY };
    this.falcon = createFalcon();
    this.view = createFalconView(this, this.bounds.groundY);
    this.view.update(this.falcon, this.time.now);

    // Pointer covers the mouse and touch; Phaser stops the browser's copied mouse events after a touch.
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onFlap, this);
    const keyboard = this.input.keyboard;
    if (keyboard) {
      keyboard.addCapture('SPACE');
      keyboard.on('keydown-SPACE', this.onSpaceDown, this);
      keyboard.on('keyup-SPACE', this.onSpaceUp, this);
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.stopInput());

    this.registry.set('runOver', false);
    this.publish();
    this.registry.set('ready', true);
  }

  update(time: number, delta: number): void {
    if (this.falcon.phase === 'flying') {
      this.falcon = advanceFalcon(this.falcon, delta, this.bounds);
      if (this.falcon.phase === 'down') this.endRun();
      this.publish();
    }
    this.view.update(this.falcon, time);
  }

  private onSpaceDown(event: KeyboardEvent): void {
    if (this.keys.down('SPACE', event.repeat)) this.onFlap();
  }

  private onSpaceUp(): void {
    this.keys.up('SPACE');
  }

  private onFlap(): void {
    if (this.falcon.phase === 'down') return;
    this.falcon = flap(this.falcon);
    this.view.flapWing();
    this.publish();
  }

  private endRun(): void {
    // Until the game over screen exists, the run simply stops: the falcon lies on the sand and ignores input.
    this.stopInput();
    this.registry.set('runOver', true);
    this.events.emit(FlightScene.RUN_OVER);
  }

  private stopInput(): void {
    this.input.off(Phaser.Input.Events.POINTER_DOWN, this.onFlap, this);
    this.input.keyboard?.off('keydown-SPACE', this.onSpaceDown, this);
    this.input.keyboard?.off('keyup-SPACE', this.onSpaceUp, this);
  }

  private publish(): void {
    const { y, vy, phase, flaps } = this.falcon;
    const snapshot: FalconSnapshot = { y, vy, phase, flaps, groundY: this.bounds.groundY };
    this.registry.set('falcon', snapshot);
  }
}
