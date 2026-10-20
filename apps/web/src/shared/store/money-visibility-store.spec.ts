import assert from 'node:assert/strict';
import test from 'node:test';
import { useMoneyVisibilityStore } from './money-visibility-store';

const initialState = useMoneyVisibilityStore.getInitialState();

test.beforeEach(() => {
  useMoneyVisibilityStore.setState(initialState, true);
});

test('amounts start hidden on every load', () => {
  assert.equal(initialState.isMoneyVisible, false);
  assert.equal(useMoneyVisibilityStore.getState().isMoneyVisible, false);
});

test('toggleMoneyVisibility flips visibility', () => {
  useMoneyVisibilityStore.getState().toggleMoneyVisibility();
  assert.equal(useMoneyVisibilityStore.getState().isMoneyVisible, true);
  useMoneyVisibilityStore.getState().toggleMoneyVisibility();
  assert.equal(useMoneyVisibilityStore.getState().isMoneyVisible, false);
});

test('setMoneyVisibility sets an explicit value', () => {
  useMoneyVisibilityStore.getState().setMoneyVisibility(true);
  assert.equal(useMoneyVisibilityStore.getState().isMoneyVisible, true);
  useMoneyVisibilityStore.getState().setMoneyVisibility(false);
  assert.equal(useMoneyVisibilityStore.getState().isMoneyVisible, false);
});
