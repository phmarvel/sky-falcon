import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../constants";
import { buildDesertLayout } from "../background/desertLayout";
import { drawDesert } from "../background/drawDesert";
import {
  type FalconBounds,
  type FalconState,
  createFalcon,
  flap,
} from "../falcon/falconPhysics";
import { type FalconView, createFalconView } from "../falcon/drawFalcon";
import { createPressGate } from "../falcon/pressGate";
import type { ObstacleKind } from "../obstacles/obstacleField";
import {
  type ObstacleView,
  createObstacleView,
} from "../obstacles/drawObstacles";
import { randomSeed } from "../obstacles/random";
import { getLangStore } from "../i18n/langStore";
import { getBestScoreStore } from "../score/bestScore";
import { type ScoreView, createScoreView } from "../score/drawScore";
import { scoreOf } from "../score/runScore";
import { scrollSpeedOf, speedLevelOf } from "../score/speedUp";
import { showGameOver } from "../ui/GameOverScreen";
import { autopilotWantsFlap } from "../run/autopilot";
import {
  type RunOverReason,
  type RunState,
  advanceRun,
  createRun,
  parseRunOptions,
} from "../run/runState";

/** How long the falcon is left alone on the sand before the game over screen covers it. */
const GAME_OVER_DELAY_MS = { ground: 300, obstacle: 900 } as const;

/** What the scene shares in the registry; the browser tests read it. */
export interface FalconSnapshot {
  y: number;
  vy: number;
  phase: FalconState["phase"];
  flaps: number;
  /** Game seconds flown in this run; tests measure against it, not the wall clock. */
  time: number;
  groundY: number;
}

/** One obstacle as the registry shares it. */
export interface ObstacleSnapshot {
  id: number;
  kind: ObstacleKind;
  x: number;
  width: number;
  gapTop: number;
  gapBottom: number;
}

/**
 * The run: the desert, the falcon that flaps and falls, and the towers and palm trees coming from the right.
 * The first flap starts the run; touching the ground or an obstacle ends it.
 * Address settings: `?seed=N` gives the same obstacles every time; `?obstacles=off` flies without them;
 * `?autopilot=1` plays by itself (a demo for screenshots).
 */
export class FlightScene extends Phaser.Scene {
  static readonly KEY = "Flight";
  /** Sent once when the run ends, with the reason ('ground' or 'obstacle'). */
  static readonly RUN_OVER = "run-over";

  private run!: RunState;
  private view!: FalconView;
  private obstacleView!: ObstacleView;
  private scoreView!: ScoreView;
  private bounds!: FalconBounds;
  private readonly keys = createPressGate();
  private autopilot = false;

  constructor() {
    super(FlightScene.KEY);
  }

  create(): void {
    const layout = buildDesertLayout(GAME_WIDTH, GAME_HEIGHT);
    drawDesert(this, layout);

    this.bounds = { top: 0, groundY: layout.horizonY };
    const options = parseRunOptions(window.location.search);
    this.autopilot = options.autopilot;
    this.run = createRun(
      createFalcon(),
      this.bounds,
      options.seed ?? randomSeed(),
      options.obstacles,
    );
    this.obstacleView = createObstacleView(this, this.bounds.groundY);
    this.scoreView = createScoreView(this, getLangStore().get());
    this.view = createFalconView(this, this.bounds.groundY);
    this.view.update(this.run.falcon, this.time.now);

    // Pointer covers the mouse and touch; Phaser stops the browser's copied mouse events after a touch.
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onFlap, this);
    const keyboard = this.input.keyboard;
    if (keyboard) {
      keyboard.addCapture("SPACE");
      keyboard.on("keydown-SPACE", this.onSpaceDown, this);
      keyboard.on("keyup-SPACE", this.onSpaceUp, this);
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.stopInput());

    this.registry.set("ready", false);
    this.registry.set("screen", "flight");
    this.registry.set("runOver", false);
    this.registry.set("runOverReason", null);
    this.registry.set("gameOver", null);
    this.publish();
    this.registry.set("ready", true);
  }

  update(time: number, delta: number): void {
    if (this.autopilot && autopilotWantsFlap(this.run)) this.onFlap();
    if (this.run.falcon.phase === "flying") {
      this.run = advanceRun(this.run, delta, this.bounds);
      this.obstacleView.sync(this.run.field);
      if (this.run.over) this.endRun(this.run.over);
      this.publish();
    }
    this.view.update(this.run.falcon, time);
  }

  private onSpaceDown(event: KeyboardEvent): void {
    if (this.keys.down("SPACE", event.repeat)) this.onFlap();
  }

  private onSpaceUp(): void {
    this.keys.up("SPACE");
  }

  private onFlap(): void {
    if (this.run.over || this.run.falcon.phase === "down") return;
    this.run = { ...this.run, falcon: flap(this.run.falcon) };
    this.view.flapWing();
    this.publish();
  }

  private endRun(reason: RunOverReason): void {
    // The obstacles freeze, the falcon ends up on the sand (dropping there after an obstacle) and ignores input;
    // then the game over screen shows the score and the best score (saved on the device when beaten).
    this.stopInput();
    if (reason === "obstacle") this.view.fallFrom(this.run.falcon.y);
    const { best, isNewBest } = getBestScoreStore().record(scoreOf(this.run));
    const score = scoreOf(this.run);
    this.registry.set("runOver", true);
    this.registry.set("runOverReason", reason);
    this.events.emit(FlightScene.RUN_OVER, reason);
    // Scene time, so slow frames do not shorten it; after an obstacle the falcon first drops to the sand.
    this.time.delayedCall(
      reason === "obstacle"
        ? GAME_OVER_DELAY_MS.obstacle
        : GAME_OVER_DELAY_MS.ground,
      () =>
        showGameOver(this, {
          score,
          best,
          isNewBest,
          lang: getLangStore().get(),
          onPlayAgain: () => this.scene.restart(),
        }),
    );
  }

  private stopInput(): void {
    this.input.off(Phaser.Input.Events.POINTER_DOWN, this.onFlap, this);
    this.input.keyboard?.off("keydown-SPACE", this.onSpaceDown, this);
    this.input.keyboard?.off("keyup-SPACE", this.onSpaceUp, this);
  }

  private publish(): void {
    const { y, vy, phase, flaps, time } = this.run.falcon;
    const snapshot: FalconSnapshot = {
      y,
      vy,
      phase,
      flaps,
      time,
      groundY: this.bounds.groundY,
    };
    this.registry.set("falcon", snapshot);
    const obstacles: ObstacleSnapshot[] = (this.run.field?.obstacles ?? []).map(
      ({ id, kind, x, width, gapTop, gapBottom }) => ({
        id,
        kind,
        x,
        width,
        gapTop,
        gapBottom,
      }),
    );
    this.registry.set("obstacles", obstacles);
    this.registry.set("passed", this.run.passed);
    const score = scoreOf(this.run);
    this.scoreView.set(score);
    this.registry.set("score", score);
    this.registry.set("scoreText", this.scoreView.text());
    this.registry.set("speedLevel", speedLevelOf(score));
    this.registry.set("scrollSpeed", scrollSpeedOf(score));
    this.registry.set("obstaclesDrawn", this.obstacleView.count());
  }
}
