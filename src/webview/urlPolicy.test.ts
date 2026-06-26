import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyUrl, isHealzChatUrl } from './urlPolicy';

test('keeps Healz navigation inside the WebView', () => {
  assert.equal(classifyUrl('https://app.healz.ai/app/chat'), 'internal');
  assert.equal(classifyUrl('https://app.healz.ai/es'), 'internal');
  assert.equal(classifyUrl('about:blank'), 'internal');
  assert.equal(
    classifyUrl('blob:https://app.healz.ai/1d7b0d93'),
    'internal',
  );
});

test('opens normal external destinations with the operating system', () => {
  assert.equal(classifyUrl('https://example.com/article'), 'external');
  assert.equal(classifyUrl('mailto:help@example.com'), 'external');
  assert.equal(classifyUrl('tel:+12025550123'), 'external');
  assert.equal(classifyUrl('geo:55.75,37.61'), 'external');
});

test('blocks unsafe or malformed navigation', () => {
  assert.equal(classifyUrl('javascript:alert(1)'), 'blocked');
  assert.equal(classifyUrl('data:text/html,hello'), 'blocked');
  assert.equal(classifyUrl('intent://unsafe'), 'blocked');
  assert.equal(classifyUrl('not a url'), 'blocked');
  assert.equal(classifyUrl('https://app.healz.ai.evil.example'), 'external');
});

test('detects only authenticated Healz chat routes', () => {
  assert.equal(isHealzChatUrl('https://app.healz.ai/app/chat'), true);
  assert.equal(isHealzChatUrl('https://app.healz.ai/app/chat/case-1'), true);
  assert.equal(isHealzChatUrl('https://app.healz.ai/chat'), false);
  assert.equal(isHealzChatUrl('https://example.com/app/chat'), false);
});
