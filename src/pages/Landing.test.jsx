import { describe, expect, it } from 'vitest';
import { buildHeroMosaicLoopItems } from '../lib/heroMosaic';

describe('Landing desktop hero mosaic', () => {
  it('builds two identical sequences for a seamless 50 percent animation loop', () => {
    const cards = [{ id: 'one' }, { id: 'two' }, { id: 'three' }];
    const loop = buildHeroMosaicLoopItems(cards);

    expect(loop).toHaveLength(cards.length * 2);
    expect(loop.slice(0, cards.length)).toEqual(cards);
    expect(loop.slice(cards.length)).toEqual(cards);
  });

  it('does not create placeholder cards for an invalid sequence', () => {
    expect(buildHeroMosaicLoopItems(null)).toEqual([]);
  });
});
