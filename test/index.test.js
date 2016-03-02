const should = require('should');

const IndexedPolygon = require('../index.js');

const paris = require('./fixtures/paris');

describe('IndexedPolygon', function () {
  describe('new IndexedPolygon', function () {
    it('should create a new IndexedPolygon', () => {
      const indexed = new IndexedPolygon(paris);
      should.exist(indexed);
    });
  });

  describe('#intersects() - Returns "point in polygon"', function () {
    describe('Plain shape', function () {
      [{
        expl: 'point completely inside the polygon',
        feature: paris,
        input: [2.342834, 48.859745],
        expected: true
      }, {
        expl: 'point outside the polygon but inside the smallest rectangle',
        feature: paris,
        input: [2.433471, 48.853420],
        expected: false
      }, {
        expl: 'point completely outside the polygon',
        feature: paris,
        input: [2.294082, 48.786961],
        expected: false
      }, {
        expl: 'point outside the polygon and almost outside the smallest rectangle',
        feature: paris,
        input: [2.450637, 48.888423],
        expected: false
      }].forEach(scene => {
        it(`${scene.expl}`, () => {
          const indexed = new IndexedPolygon(scene.feature);
          indexed.intersects(scene.input).should.equal(scene.expected);
        });
      });
    });
  });

  describe('#getCacheStats() - Returns the numbers of "i"s, "o"s and "x"s in the cache', function () {
    describe('Plain shape', function () {
      it('should return stats about the cache', () => {
        const indexed = new IndexedPolygon(paris);
        const cacheStats = indexed.getCacheStats();
        should.exist(cacheStats);
        cacheStats.i.should.be.greaterThan(0);
        cacheStats.o.should.be.greaterThan(0);
        cacheStats.x.should.be.greaterThan(0);
      });
    });
  });
});