import { beforeEach, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { useMoneyVisibilityStore } from './money-visibility-store';
import { canShowCombinedMoney, useSavingsVisibilityStore } from './savings-visibility-store';

beforeEach(() => {
  useMoneyVisibilityStore.setState({ isMoneyVisible: false });
  useSavingsVisibilityStore.setState({ isSavingsVisible: false });
});

void test('savings start hidden', () => {
  assert.equal(useSavingsVisibilityStore.getInitialState().isSavingsVisible, false);
});

void test('the global switch does not reveal savings', () => {
  useMoneyVisibilityStore.getState().toggleMoneyVisibility();
  assert.equal(useMoneyVisibilityStore.getState().isMoneyVisible, true);
  assert.equal(useSavingsVisibilityStore.getState().isSavingsVisible, false);
});

void test('the savings switch does not reveal other amounts', () => {
  useSavingsVisibilityStore.getState().toggleSavingsVisibility();
  assert.equal(useSavingsVisibilityStore.getState().isSavingsVisible, true);
  assert.equal(useMoneyVisibilityStore.getState().isMoneyVisible, false);
});

void test('a figure containing savings needs both switches', () => {
  assert.equal(canShowCombinedMoney(false, false), false);
  assert.equal(canShowCombinedMoney(true, false), false);
  assert.equal(canShowCombinedMoney(false, true), false);
  assert.equal(canShowCombinedMoney(true, true), true);
});
