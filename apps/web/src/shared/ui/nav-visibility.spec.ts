import assert from 'node:assert/strict';
import test from 'node:test';
import { visibleNavSections } from './nav-visibility';

const SECTIONS = [
  { titleKey: 'data', items: [{ page: 'contacts' }, { page: 'places' }] },
  {
    titleKey: 'system',
    items: [
      { page: 'zca', adminOnly: true },
      { page: 'googleStorage', adminOnly: true },
      { page: 'settings' },
    ],
  },
  { titleKey: 'adminOnlySection', items: [{ page: 'secret', adminOnly: true }] },
];

const pages = (sections: ReturnType<typeof visibleNavSections>) =>
  sections.map((section) => section.items.map((item) => (item as { page: string }).page));

void test('visibleNavSections keeps every item for an admin', () => {
  assert.deepEqual(visibleNavSections(SECTIONS, true), SECTIONS);
});

void test('visibleNavSections drops admin-only items and empty sections for a non-admin', () => {
  const visible = visibleNavSections(SECTIONS, false);

  assert.deepEqual(pages(visible), [['contacts', 'places'], ['settings']]);
  assert.deepEqual(
    visible.map((section) => section.titleKey),
    ['data', 'system'],
  );
});

void test('visibleNavSections hides admin-only items while the role is unknown', () => {
  assert.deepEqual(pages(visibleNavSections(SECTIONS, undefined)), [
    ['contacts', 'places'],
    ['settings'],
  ]);
});
