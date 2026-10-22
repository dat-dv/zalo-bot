import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldDismissSwipe, swipeOffset } from './swipe-dismiss';

test('swipeOffset follows the finger along the dismiss direction', () => {
  assert.equal(swipeOffset(120, 1), 120);
  assert.equal(swipeOffset(-80, -1), 80);
});

test('swipeOffset resists movement against the dismiss direction', () => {
  assert.equal(swipeOffset(-40, 1), -10);
  assert.equal(swipeOffset(40, -1), -10);
});

test('shouldDismissSwipe dismisses past a quarter of the surface', () => {
  assert.equal(shouldDismissSwipe({ offset: 150, size: 600, velocity: 0 }), true);
  assert.equal(shouldDismissSwipe({ offset: 149, size: 600, velocity: 0.1 }), false);
});

test('shouldDismissSwipe dismisses a fast flick even when short', () => {
  assert.equal(shouldDismissSwipe({ offset: 30, size: 600, velocity: 0.8 }), true);
});

test('shouldDismissSwipe never dismisses when pulled the wrong way', () => {
  assert.equal(shouldDismissSwipe({ offset: -10, size: 600, velocity: 2 }), false);
});
