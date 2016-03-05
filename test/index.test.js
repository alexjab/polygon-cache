'use strict';

const should = require('should');
const pointInPolygon = require('point-in-polygon');

const IndexedPolygon = require('../index.js');

const paris = require('./fixtures/paris');
const paris1 = require('./fixtures/paris1');
const paris2 = require('./fixtures/paris2');
const paris3 = require('./fixtures/paris3');

let ITERATIONS = 100000;
if (process.env.FAST_TEST) {
  ITERATIONS = 1000;
}

describe('IndexedPolygon', function () {
  this.timeout(10000);
  describe('new IndexedPolygon', function () {
    it('should create a new IndexedPolygon', () => {
      const indexed = new IndexedPolygon(paris);
      should.exist(indexed);
    });

    it('should create new IndexedPolygons in less then 2 seconds', () => {
      for (let i = 0; i < 100; i++) {
        new IndexedPolygon(paris);
      }
    });

    it('should throw an error (feature is not a "Polygon")', () => {
      const feature = {
        "type": "Feature",
        "properties": {},
        "geometry": {
          "type": "MultiPolygon",
          "coordinates": []
        }
      };
      (() => new IndexedPolygon(feature)).should.throw('Expected Feature to be of type "Polygon", "MultiPolygon" found instead');
    });
  });

  describe('#intersects() - Returns "point in polygon"', function () {
    describe('Plain shape', function () {
      describe('Random points all over the polygon', function () {
        let indexed;
        const points = [];

        before(function() {
          indexed = new IndexedPolygon(paris);
          const minX = indexed.minX;
          const minY = indexed.minY;
          const maxX = indexed.maxX;
          const maxY = indexed.maxY;

          for (let i = 0; i < ITERATIONS; i++) {
            const point = [minY + Math.random() * (maxY - minY), minX + Math.random() * (maxX - minX)];
            const expected = pointInPolygon(point, paris.geometry.coordinates[0]);
            points.push({
              point,
              expected
            });
          }
        });

        it('should return the same as point-in-polygon', () => {
          points.forEach(point => {
            if (indexed.intersects(point.point) !== point.expected) {
              console.log(point);
            }
            indexed.intersects(point.point).should.equal(point.expected);
          });
        });
      });

      describe('Random points close to the vertices of the polygon', function () {
        let indexed;
        const points = [];

        before(function() {
          indexed = new IndexedPolygon(paris);
          const minX = indexed.minX;
          const minY = indexed.minY;
          const maxX = indexed.maxX;
          const maxY = indexed.maxY;

          paris.geometry.coordinates[0].forEach(point => {
            [
              [point[0] - 0.0001, point[1] - 0.0001],
              [point[0] - 0.0001, point[1] + 0.0001],
              [point[0] + 0.0001, point[1] + 0.0001],
              [point[0] + 0.0001, point[1] - 0.0001]
            ].forEach(point => {
              const expected = pointInPolygon(point, paris.geometry.coordinates[0]);
              points.push({
                point,
                expected
              });
            });
          });
        });

        it('should return the same as point-in-polygon', () => {
          points.forEach(point => {
            if (indexed.intersects(point.point) !== point.expected) {
              console.log(point);
            }
            indexed.intersects(point.point).should.equal(point.expected);
          });
        });
      });

      describe('Random points outside the polygon', function () {
        let indexed;
        const points = [];

        before(function() {
          indexed = new IndexedPolygon(paris);
          const minX = indexed.minX;
          const minY = indexed.minY;
          const maxX = indexed.maxX;
          const maxY = indexed.maxY;

          for (let i = 0; i < (ITERATIONS / 4); i++) {
            [
              [minY - Math.random() * 0.2, minX + Math.random() * (maxX - minX)],
              [minY + Math.random() * (maxY - minY), maxX + Math.random() * 0.2],
              [maxY + Math.random() * 0.2, minX + Math.random() * (maxX - minX)],
              [minY + Math.random() * (maxY - minY), minX - Math.random() * 0.2]
            ].forEach(point => {
              const expected = pointInPolygon(point, paris.geometry.coordinates[0]);
              points.push({
                point,
                expected
              });
            });
          }
        });

        it('should return the same as point-in-polygon', () => {
          points.forEach(point => {
            if (indexed.intersects(point.point) !== point.expected) {
              console.log(point);
            }
            indexed.intersects(point.point).should.equal(point.expected);
          });
        });
      });

      describe('Random points close to the polygon bound', function () {
        let indexed;
        const points = [];

        before(function() {
          indexed = new IndexedPolygon(paris);
          const minX = indexed.minX;
          const minY = indexed.minY;
          const maxX = indexed.maxX;
          const maxY = indexed.maxY;

          for (let i = 0; i < (ITERATIONS / 4); i++) {
            [
              [minY + Math.random() * 0.0001, minX + Math.random() * (maxX - minX)],
              [minY + Math.random() * (maxY - minY), maxX - Math.random() * 0.0001],
              [maxY - Math.random() * 0.0001, minX + Math.random() * (maxX - minX)],
              [minY + Math.random() * (maxY - minY), minX + Math.random() * 0.0001]
            ].forEach(point => {
              const expected = pointInPolygon(point, paris.geometry.coordinates[0]);
              points.push({
                point,
                expected
              });
            });
          }
        });

        it('should return the same as point-in-polygon', () => {
          points.forEach(point => {
            if (indexed.intersects(point.point) !== point.expected) {
              console.log(point);
            }
            indexed.intersects(point.point).should.equal(point.expected);
          });
        });
      });
    });

    describe('Shape with holes within tiles', function () {
      describe('Random points all over the polygon', function () {
        let indexed;
        const points = [];

        before(function() {
          indexed = new IndexedPolygon(paris1, { granularity: 3 });
          const minX = indexed.minX;
          const minY = indexed.minY;
          const maxX = indexed.maxX;
          const maxY = indexed.maxY;

          for (let i = 0; i < (ITERATIONS / 4); i++) {
            const point = [minY + Math.random() * (maxY - minY), minX + Math.random() * (maxX - minX)];
            const expected = paris1.geometry.coordinates.reduce((memo, coordinates) => {
              return pointInPolygon(point, coordinates) ? !memo : memo;
            }, false);
            points.push({
              point,
              expected
            });
          }
        });

        it('should return the same as point-in-polygon', () => {
          points.forEach(point => {
            if (indexed.intersects(point.point) !== point.expected) {
              console.log(point);
            }
            indexed.intersects(point.point).should.equal(point.expected);
          });
        });
      });
    });

    describe('Shape with a hole larger than a tile', function () {
      describe('Random points all over the polygon', function () {
        let indexed;
        const points = [];

        before(function() {
          indexed = new IndexedPolygon(paris2);
          const minX = indexed.minX;
          const minY = indexed.minY;
          const maxX = indexed.maxX;
          const maxY = indexed.maxY;

          for (let i = 0; i < (ITERATIONS / 4); i++) {
            const point = [minY + Math.random() * (maxY - minY), minX + Math.random() * (maxX - minX)];
            const expected = paris2.geometry.coordinates.reduce((memo, coordinates) => {
              return pointInPolygon(point, coordinates) ? !memo : memo;
            }, false);
            points.push({
              point,
              expected
            });
          }
        });

        it('should return the same as point-in-polygon', () => {
          points.forEach(point => {
            if (indexed.intersects(point.point) !== point.expected) {
              console.log(point);
            }
            indexed.intersects(point.point).should.equal(point.expected);
          });
        });
      });
    });

    describe('Shape with a hole part inside, part outside', function () {
      describe('Random points all over the polygon', function () {
        let indexed;
        const points = [];

        before(function() {
          indexed = new IndexedPolygon(paris3);
          const minX = indexed.minX;
          const minY = indexed.minY;
          const maxX = indexed.maxX;
          const maxY = indexed.maxY;

          for (let i = 0; i < (ITERATIONS / 4); i++) {
            const point = [minY + Math.random() * (maxY - minY), minX + Math.random() * (maxX - minX)];
            const expected = paris3.geometry.coordinates.reduce((memo, coordinates) => {
              return pointInPolygon(point, coordinates) ? !memo : memo;
            }, false);
            points.push({
              point,
              expected
            });
          }
        });

        it('should return the same as point-in-polygon', () => {
          points.forEach(point => {
            if (indexed.intersects(point.point) !== point.expected) {
              console.log(point);
            }
            indexed.intersects(point.point).should.equal(point.expected);
          });
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
        cacheStats.i.should.be.greaterThan(0).and.greaterThan(cacheStats.x);
        cacheStats.o.should.be.greaterThan(0).and.greaterThan(cacheStats.x);
        cacheStats.x.should.be.greaterThan(0);
        cacheStats.xRatio.should.be.lessThan(0.33);
      });
    });
  });
});

// TESTS SHOULD RETURN THE SAME VALUE, WITH DIFFERENT GRANULARITIES
// TRY TO REPLACE LETTERS O, I, X BY NUMBER 0, 1, 2
