'use strict';

const pointInPolygon = require('point-in-polygon');

module.exports = class IndexedPolygon {
  /*
   * Create the polygon's index (called cache)
   * @constructor
   * @param {Object} feature - A GeoJSON Feature the geometry of which is a Polygon
   */
  constructor (feature) {
    if (feature.geometry.type !== 'Polygon') {
      throw new Error(`Expected Feature to be of type "Polygon", "${feature.geometry.type}" found instead`);
    }

    const bounds = this.getPolygonBounds(feature);
    const minX = bounds.minX;
    const maxX = bounds.maxX;
    const minY = bounds.minY;
    const maxY = bounds.maxY;

    const baseUnit = 20;
    const tileX = (maxX - minX)/baseUnit;
    const tileY = (maxY - minY)/baseUnit;
    let cache = this.buildInclusionCache(feature.geometry.coordinates[0], { bounds, baseUnit, tileX, tileY });

    if (feature.geometry.coordinates.length > 1) {
      cache = this.buildExclusionCache(feature.geometry.coordinates.slice(1), cache, { bounds, baseUnit, tileX, tileY });
    }

    this.originalFeature = feature;
    this.minX = minX;
    this.maxX = maxX;
    this.minY = minY;
    this.maxY = maxY;
    this.baseUnit = baseUnit;
    this.tileX = tileX;
    this.tileY = tileY;
    this.cache = cache;
  }

  /*
   * Returns true or false depending on whether a point intersects with an indexed polygon
   * @param {Array[Number]} point - A pair of latitude and longitude that describe a point
   * @returns {Boolean}
   */
  intersects(point) {
    if (point[0] < this.minY || point[0] > this.maxY || point[1] < this.minX || point[1] > this.maxX) {
      return false;
    }

    const offsetY = Math.floor((point[0] - this.minY) / this.tileY);
    const offsetX = Math.floor((point[1] - this.minX) / this.tileX);
    if (this.cache[offsetY + '-' + offsetX] === 'i') {
      return true;
    } else if (this.cache[offsetY + '-' + offsetX] === 'o') {
      return false;
    } else {
      return this.originalFeature.geometry.coordinates.reduce((isInside, coordinates) => {
        return pointInPolygon(point, coordinates) ? !isInside : isInside;
      }, false);
    }
  }

  getPolygonBounds(feature) {
    let bounds = {
      minX: +Infinity,
      maxX: -Infinity,
      minY: +Infinity,
      maxY: -Infinity
    };

    feature.geometry.coordinates.forEach(coords => {
      coords.forEach(coord => {
        if (coord[0] < bounds.minY) bounds.minY = coord[0];
        if (coord[0] > bounds.maxY) bounds.maxY = coord[0];
        if (coord[1] < bounds.minX) bounds.minX = coord[1];
        if (coord[1] > bounds.maxX) bounds.maxX = coord[1];
      });
    });

    return bounds;
  }

  buildInclusionCache(polygon, params) {
    const minX = params.bounds.minX;
    const maxX = params.bounds.maxX;
    const minY = params.bounds.minY;
    const maxY = params.bounds.maxY;
    const baseUnit = params.baseUnit;
    const tileX = params.tileX;
    const tileY = params.tileY;

    const cache = {};
    const pointCache = {};
    // Let's index the first array (the "filled" area) 
    for (let i = 0; i <= baseUnit; i++) {
      for (let j = 0; j <= baseUnit; j++) {
        let pointsInside = 0;
        [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].forEach(comb => {
          if (pointCache[comb[0] + '-' + comb[1]]) {
            pointsInside++;
          } else if (pointCache[comb[0] + '-' + comb[1]] === false) {
            // Do nothing
          } else {
            if (pointInPolygon([minY + tileY * comb[0], minX + tileX * comb[1]], polygon)) {
              pointsInside++;
              pointCache[comb[0] + '-' + comb[1]] = true;
            } else {
              pointCache[comb[0] + '-' + comb[1]] = false;
            }
          }
        });
        // If all points of the tile are inside the polygon,
        // or all points are outside then we need to check
        // that no point of the polygon is inside the tile.
        if (!pointsInside || pointsInside === 4) {
          const pointOfPolygonInsideTile = polygon.some(point => {
            return (point[0] >= (minY + tileY * i) &&
                point[0] <= (minY + tileY * (i + 1)) &&
                point[1] >= (minX + tileX * j) &&
                point[1] <= (minX + tileX * (j + 1)));
          });
          if (!pointOfPolygonInsideTile) {
            // If no point of the polygon is inside the tile
            // and no point of the tile is inside the
            // polygon, then the tile is completely outside.
            if (!pointsInside) {
              cache[i + '-' + j] = 'o';
            }
            // If no point of the polygon is inside the tile
            // and all points of the tile are outside the
            // polygon, then the tile is completely outside.
            if (pointsInside === 4) {
              cache[i + '-' + j] = 'i';
            }
          } else {
            cache[i + '-' + j] = 'x';
          }
        } else {
          // If some point are inside, and others outside, then
          // the tile is marked as uncertain. We'll need to
          // use pointInPolygon if a request falls inside it.
          cache[i + '-' + j] = 'x';
        }
      }
    }

    return cache;
  }

  buildExclusionCache(polygons, cache, params) {
    const minX = params.bounds.minX;
    const maxX = params.bounds.maxX;
    const minY = params.bounds.minY;
    const maxY = params.bounds.maxY;
    const baseUnit = params.baseUnit;
    const tileX = params.tileX;
    const tileY = params.tileY;

    // Then let's index the other arrays (the "empty" areas)
    polygons.forEach(polygon => {
      for (let i = 0; i <= baseUnit; i++) {
        for (let j = 0; j <= baseUnit; j++) {
          // If the tile is already uncertain, there is nothing we can do
          if (cache[i + '-' + j] === 'x') {
            continue;
          }

          // We first need to check whether the empty area
          // is smaller and inside a tile. If so, the tile
          // should be uncertain.
          const emptyAreaWithinTile = polygon.every(coord => {
            if (coord[0] < (minY + tileY * i) ||
                coord[0] > (minY + tileY * (i + 1)) ||
                coord[1] < (minX + tileX * j) ||
                coord[1] > (minX + tileX * (j + 1))) {
              return false;
            }
            return true;
          });
          if (emptyAreaWithinTile) {
            cache[i + '-' + j] = 'x';
            continue;
          }

          // At this point, each tile either intersects the empty area,
          // or is fully within it.
          let pointsOutside = 0;
          [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].forEach(comb => {
            if (pointInPolygon([minY + tileY * comb[0], minX + tileX * comb[1]], polygon)) {
              pointsOutside++;
            }
          });
          if (pointsOutside === 4) {
            // If the whole tile is within the empty area,
            // and if the whole tile was totally inside
            // or totally outside the filled area,
            // it is now the opposite of that.
            cache[i + '-' + j] = (cache[i + '-' + j] === 'o' ? 'i' : 'o');
          } else if (!pointsOutside) {
            // If the tile is outside the empty area,
            // then nothing should be done.
          } else {
            // Else, the tile should now belong to
            // the uncertain area.
            cache[i + '-' + j] = 'x';
          }
        }
      }
    });

    return cache;
  }

  getCacheStats() {
    const stats = {
      i: 0,
      o: 0,
      x: 0
    };

    for (let key in this.cache) {
      stats[this.cache[key]]++;
    }

    stats.xRatio = stats.x / (stats.i + stats.o);

    return stats;
  }
}
