import test from 'node:test';
import assert from 'node:assert/strict';
import { getClientIp } from './client-ip.util';

function request(headers: Record<string, string>, ip?: string) {
  return { ip, get: (name: string) => headers[name.toLowerCase()] };
}

void test('getClientIp prefers the Cloudflare header, then nginx, then the socket', () => {
  assert.equal(
    getClientIp(
      request({ 'cf-connecting-ip': '203.0.113.7', 'x-real-ip': '10.0.0.2' }, '10.0.0.1'),
    ),
    '203.0.113.7',
  );
  assert.equal(getClientIp(request({ 'x-real-ip': '10.0.0.2' }, '10.0.0.1')), '10.0.0.2');
  assert.equal(getClientIp(request({}, '10.0.0.1')), '10.0.0.1');
  assert.equal(getClientIp(request({})), 'unknown');
});

void test('getClientIp takes the first address of a list and skips blank headers', () => {
  assert.equal(getClientIp(request({ 'x-real-ip': ' 198.51.100.4 , 10.0.0.2' })), '198.51.100.4');
  assert.equal(
    getClientIp(request({ 'cf-connecting-ip': ' ', 'x-real-ip': '10.0.0.2' })),
    '10.0.0.2',
  );
});
