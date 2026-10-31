import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';
import { buildDesertLayout } from '../background/desertLayout';
import { drawDesert } from '../background/drawDesert';

export class DesertScene extends Phaser.Scene {
  static readonly KEY = 'Desert';

  constructor() {
    super(DesertScene.KEY);
  }

  create(): void {
    drawDesert(this, buildDesertLayout(GAME_WIDTH, GAME_HEIGHT));
    this.registry.set('ready', true);
  }
}
