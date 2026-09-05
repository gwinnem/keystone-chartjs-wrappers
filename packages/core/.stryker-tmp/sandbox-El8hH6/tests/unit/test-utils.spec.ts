// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { createTestCanvas, createTestCanvasWithParent } from '../../src/test-utils.js';

describe('createTestCanvas', () => {
  it('returns a canvas element attached to the document', () => {
    const canvas = createTestCanvas();
    expect(canvas.tagName).toBe('CANVAS');
    expect(canvas.isConnected).toBe(true);
  });
});

describe('createTestCanvasWithParent', () => {
  it('returns a canvas nested inside a real parent div, both attached to the document', () => {
    const { canvas, parent } = createTestCanvasWithParent();
    expect(canvas.tagName).toBe('CANVAS');
    expect(parent.tagName).toBe('DIV');
    expect(canvas.parentElement).toBe(parent);
    expect(parent.isConnected).toBe(true);
  });
});
