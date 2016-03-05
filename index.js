'use strict';

const pointInPolygon = require('point-in-polygon');

module.exports = class IndexedPolygon {
  /*
   * Create the polygon's index (called cache)
   * @constructor
   * @param {Object} feature - A GeoJSON Feature the geometry of which is a Polygon
   */
  constructor (feature, options) {
    if (feature.geometry.type !== 'Polygon') {
      throw new Error(`Expected Feature to be of type "Polygon", "${feature.geometry.type}" found instead`);
    }
    options = options || {};

    this.originalFeature = feature;

    const bounds = this.computePolygonBounds(feature);
    this.minX = bounds.minX;
    this.maxX = bounds.maxX;
    this.minY = bounds.minY;
    this.maxY = bounds.maxY;

    this.baseUnit = options.granularity || 20;
    this.tileX = (this.maxX - this.minX) / this.baseUnit;
    this.tileY = (this.maxY - this.minY) / this.baseUnit;

    this.cache = {};
    this.buildInclusionCache(feature.geometry.coordinates[0]);

    if (feature.geometry.coordinates.length > 1) {
      this.buildExclusionCache(feature.geometry.coordinates.slice(1));
    }
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

  computePolygonBounds(feature) {
    let minX = +Infinity;
    let maxX = -Infinity;
    let minY = +Infinity;
    let maxY = -Infinity;

    feature.geometry.coordinates.forEach(coords => {
      coords.forEach(coord => {
        if (coord[0] < minY) minY = coord[0];
        if (coord[0] > maxY) maxY = coord[0];
        if (coord[1] < minX) minX = coord[1];
        if (coord[1] > maxX) maxX = coord[1];
      });
    });

    return {
      minX,
      maxX,
      minY,
      maxY
    };
  }

  getTileUnderPoint(point) {
    return {
      y: Math.floor((point[0] - this.minY) / this.tileY),
      x: Math.floor((point[1] - this.minX) / this.tileX)
    };
  }

  buildInclusionCache(polygon) {
    // Let's index the first array (the "filled" area) 
    const minX = this.minX;
    const maxX = this.maxX;
    const minY = this.minY;
    const maxY = this.maxY;
    const baseUnit = this.baseUnit;
    const tileX = this.tileX;
    const tileY = this.tileY;
    const cache = this.cache;

    // First, let get all the tiles which contain a point of the polygon.
    // Those tiles should be marked "x" (uncertain).
    polygon.forEach(point => {
      const tile = this.getTileUnderPoint(point);
      if (!cache[tile.y + '-' + tile.x]) {
        cache[tile.y + '-' + tile.x] = 'x';
      }
    });

    const pointCache = {};
    for (let i = 0; i < baseUnit; i++) {
      for (let j = 0; j < baseUnit; j++) {
        if (cache[i + '-' + j] === 'x') {
          continue;
        }

        let pointsInside = 0;
        // Then for every tile, we check whether none of its point
        // or all of them are inside the polygon. We cache this information
        // to get around all tiles faster.

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
          // If some point are inside, and others outside, then
          // the tile is marked as uncertain. We'll need to
          // use pointInPolygon if a request falls inside it.
          cache[i + '-' + j] = 'x';
        }
      }
    }

    return cache;
  }

  buildExclusionCache(polygons) {
    const minX = this.minX;
    const maxX = this.maxX;
    const minY = this.minY;
    const maxY = this.maxY;
    const baseUnit = this.baseUnit;
    const tileX = this.tileX;
    const tileY = this.tileY;
    const cache = this.cache;

    // Then let's index the other arrays (the "empty" areas)
    polygons.forEach(polygon => {
      for (let i = 0; i < baseUnit; i++) {
        for (let j = 0; j < baseUnit; j++) {
          // If the tile is already uncertain, there is nothing we can do
          if (cache[i + '-' + j] === 'x') {
            continue;
          }

          // We first need to check whether the empty area
          // is smaller and inside a tile. If so, the tile
          // should be uncertain.
          const emptyAreaWithinTile = polygon.some(coord => {
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
