import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyJsonLayerFilters,
  stripEndscreen,
  stripGuestSignInPrompts,
  upgradeThumbnailUrl,
  upgradeThumbnails
} from '../src/json-layer-filters.mjs';

const ON = {
  removeEndscreen: true,
  upgradeThumbnails: true,
  hideGuestSignInPrompts: true
};
const OFF = {
  removeEndscreen: false,
  upgradeThumbnails: false,
  hideGuestSignInPrompts: false
};

function fixture() {
  return {
    endscreen: { endscreenRenderer: { elements: [] } },
    playerResponse: { endscreen: { endscreenRenderer: {} }, videoDetails: {} },
    contents: {
      items: [
        { feedNudgeRenderer: { title: 'Sign in' } },
        { alertWithActionsRenderer: {} },
        {
          gridButtonRenderer: {
            title: { runs: [{ text: 'Sign in for better recommendations' }] }
          }
        },
        {
          videoRenderer: {
            videoId: 'abc',
            thumbnail: {
              thumbnails: [
                { url: 'https://i.ytimg.com/vi/abc/hqdefault.jpg?sqp=x', width: 480 },
                { url: 'https://i.ytimg.com/vi_webp/abc/mqdefault.webp', width: 320 },
                { url: 'https://i.ytimg.com/vi/abc/default.jpg' },
                { url: 'https://i9.ytimg.com/vi/abc/hqdefault.jpg' },
                { url: 'https://i.ytimg.com/vi/abc/maxresdefault.jpg' },
                { url: 'https://i.ytimg.com/vi/abc/hq720.jpg' },
                { url: 'https://i.ytimg.com/vi/abc/sddefault.jpg' }
              ]
            }
          }
        }
      ]
    }
  };
}

test('removes end screens only when endscreenRenderer is present', () => {
  const data = fixture();
  assert.equal(stripEndscreen(data), true);
  assert.equal('endscreen' in data, false);
  assert.equal('endscreen' in data.playerResponse, false);

  const other = { endscreen: { somethingElse: 1 } };
  assert.equal(stripEndscreen(other), false);
  assert.deepEqual(other, { endscreen: { somethingElse: 1 } });
  assert.equal(stripEndscreen(null), false);
  assert.equal(stripEndscreen('x'), false);
});

test('upgrades regular thumbnail URLs to sddefault.jpg', () => {
  assert.equal(
    upgradeThumbnailUrl('https://i.ytimg.com/vi/abc/hqdefault.jpg?sqp=x'),
    'https://i.ytimg.com/vi/abc/sddefault.jpg'
  );
  assert.equal(
    upgradeThumbnailUrl('https://i.ytimg.com/vi_webp/abc/mqdefault.webp'),
    'https://i.ytimg.com/vi/abc/sddefault.jpg'
  );
  assert.equal(
    upgradeThumbnailUrl('//i.ytimg.com/vi/a-B_1/default.jpg'),
    '//i.ytimg.com/vi/a-B_1/sddefault.jpg'
  );
  assert.equal(upgradeThumbnailUrl('https://i9.ytimg.com/vi/abc/hqdefault.jpg'), null);
  assert.equal(upgradeThumbnailUrl('https://i.ytimg.com/vi/abc/maxresdefault.jpg'), null);
  assert.equal(upgradeThumbnailUrl('https://i.ytimg.com/vi/abc/sddefault.jpg'), null);
  assert.equal(upgradeThumbnailUrl(42), null);
});

test('upgradeThumbnails rewrites thumbnail arrays in place', () => {
  const data = fixture();
  assert.equal(upgradeThumbnails(data), true);
  const urls = data.contents.items[3].videoRenderer.thumbnail.thumbnails.map(
    (t) => t.url
  );
  assert.deepEqual(urls, [
    'https://i.ytimg.com/vi/abc/sddefault.jpg',
    'https://i.ytimg.com/vi/abc/sddefault.jpg',
    'https://i.ytimg.com/vi/abc/sddefault.jpg',
    'https://i9.ytimg.com/vi/abc/hqdefault.jpg',
    'https://i.ytimg.com/vi/abc/maxresdefault.jpg',
    'https://i.ytimg.com/vi/abc/hq720.jpg',
    'https://i.ytimg.com/vi/abc/sddefault.jpg'
  ]);
  assert.equal(upgradeThumbnails(data), false);
});

test('strips guest sign-in prompt entries', () => {
  const data = fixture();
  assert.equal(stripGuestSignInPrompts(data), true);
  assert.equal(data.contents.items.length, 1);
  assert.ok(data.contents.items[0].videoRenderer);
  assert.equal(stripGuestSignInPrompts(data), false);
});

test('dispatcher is a no-op when every key is false', () => {
  const data = fixture();
  const before = JSON.stringify(data);
  assert.equal(applyJsonLayerFilters(data, OFF), false);
  assert.equal(JSON.stringify(data), before);
});

test('dispatcher applies enabled filters independently', () => {
  const data = fixture();
  assert.equal(
    applyJsonLayerFilters(data, { ...OFF, removeEndscreen: true }),
    true
  );
  assert.equal('endscreen' in data, false);
  assert.equal(data.contents.items.length, 4);

  assert.equal(applyJsonLayerFilters(fixture(), ON), true);
});

test('filters never throw on hostile input', () => {
  const cyclic = { a: {} };
  cyclic.a.b = cyclic;
  const thrower = {
    get endscreen() {
      throw new Error('boom');
    }
  };
  const proxy = new Proxy(
    {},
    {
      get() {
        throw new Error('boom');
      },
      ownKeys() {
        throw new Error('boom');
      }
    }
  );
  for (const input of [null, undefined, 1, 'x', [], cyclic, thrower, proxy]) {
    assert.doesNotThrow(() => applyJsonLayerFilters(input, ON));
    assert.doesNotThrow(() => stripEndscreen(input));
    assert.doesNotThrow(() => upgradeThumbnails(input));
    assert.doesNotThrow(() => stripGuestSignInPrompts(input));
  }
  assert.doesNotThrow(() => applyJsonLayerFilters(fixture(), null));
});
