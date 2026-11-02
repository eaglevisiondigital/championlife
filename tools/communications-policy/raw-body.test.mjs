import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac, timingSafeEqual} from 'node:crypto';
import {boundedBody, verifiedProviderEvent} from '../../supabase/functions/_shared/communications/activation.mjs';

const bytes = text => new TextEncoder().encode(text);
const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
function request(chunks, options = {}) {
  let index = 0;
  return {body: new ReadableStream({
    pull(controller) {
      if (index < chunks.length) controller.enqueue(chunks[index++]);
      else controller.close();
    },
    cancel: options.cancel,
  })};
}

for (const [name, text] of [
  ['whitespace and escapes', ' \r\n{"a": "\\u0061", "n": 1e2}\n'],
  ['Unicode without normalization', '{"text":"é e\u0301 🎵"}'],
  ['leading BOM', '\ufeff{"event":"synthetic"}'],
  ['repeated and embedded BOM', '\ufeff\ufeff{"text":"a\ufeffb"}'],
]) test(`raw body preserves exact UTF-8 bytes: ${name}`, async () => {
  const original = bytes(text);
  // Every multibyte code point, including BOM, crosses chunk boundaries.
  const raw = await boundedBody(request(Array.from(original, byte => new Uint8Array([byte]))));
  assert.deepEqual(bytes(raw), original);
});

test('8192-byte limit includes BOM and multibyte content', async () => {
  const original = bytes('\ufeff' + 'é'.repeat(4094) + 'x');
  assert.equal(original.length, 8192);
  assert.deepEqual(bytes(await boundedBody(request([original]))), original);
});
test('over-limit streamed body cancels before verification', async () => {
  let cancelled = false;
  await assert.rejects(boundedBody(request([bom, bytes('x'.repeat(8190))], {
    cancel() { cancelled = true; },
  })), /Body too large/);
  assert.equal(cancelled, true);
});
for (const invalid of [[0xc0, 0xaf], [0xed, 0xa0, 0x80], [0xff], [0xe2, 0x82]]) {
  test(`malformed UTF-8 ${invalid.join('-')} fails without replacement`, async () => {
    await assert.rejects(boundedBody(request([new Uint8Array(invalid)])), TypeError);
  });
}
test('absent request body fails closed', async () => {
  await assert.rejects(boundedBody({body: null}), /Missing body/);
});

test('signature over original body cannot authenticate a prepended BOM variant', async () => {
  const profileId = '11111111-1111-4111-8111-111111111111';
  const organizationId = '22222222-2222-4222-8222-222222222222';
  const binding = {profile_id: profileId, organization_id: organizationId,
    provider: 'sms_transport', environment: 'acceptance', project_ref: 'fictional-only',
    from: '+15555550100', reply_to: null};
  const profile = {...binding, structured_callbacks: true, sender: {
    id: profileId, organization_id: organizationId, provider: binding.provider,
    channel: 'sms', from_address: binding.from, reply_to: null,
  }};
  const event = {type: 'delivery', event_id: 'synthetic-event', provider: binding.provider,
    provider_message_id: 'synthetic-receipt', attempt_id: '33333333-3333-4333-8333-333333333333', status: 'delivered'};
  const original = bytes(JSON.stringify(event));
  const key = 'fictional-local-test-key-not-a-provider-credential';
  const mac = value => createHmac('sha256', key).update(value).digest();
  const headers = new Headers({signature: mac(original).toString('hex')});
  let parsed = 0;
  async function verifier(raw, receivedHeaders) {
    const actual = mac(raw), expected = Buffer.from(receivedHeaders.get('signature'), 'hex');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw Error('Signature denied');
    parsed++;
    return JSON.parse(raw);
  }
  const verify = async chunks => verifiedProviderEvent(await boundedBody(request(chunks)), headers, profile, binding, verifier);
  assert.equal((await verify([original])).action, 'callback_external');
  assert.equal(parsed, 1);
  await assert.rejects(verify([bom, original]), /Signature denied/);
  assert.equal(parsed, 1, 'changed request is rejected before JSON parsing');
});
