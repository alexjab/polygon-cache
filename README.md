# polygon-cache
Faster point-in-polygon through caching. Inspired by uber/in-n-out.

[![Circle CI](https://circleci.com/gh/alexjab/polygon-cache.svg?style=svg)](https://circleci.com/gh/alexjab/polygon-cache)

##TL;DR
```
npm install alexjab/polygon-cache
```

```
'use strict';

const PolygonCache = require('polygon-cache');

let cached = new PolygonCache({
  "type": "Feature",
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [ 0, 0 ],
        [ 2, 0 ],
        [ 2, 2 ],
        [ 0, 2 ],
        [ 0, 0 ]
      ]
    ]
  }
});

cached.intersects([ 0.5, 0.5 ]);
// => true

cached.intersects([ 2.5, 2.5 ]);
// => false

// Hollow Polygons are also supported
cached = new PolygonCache({
  "type": "Feature",
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [ 0, 0 ],
        [ 2, 0 ],
        [ 2, 2 ],
        [ 0, 2 ],
        [ 0, 0 ]
      ],
      [
        [ 0.5, 0.5 ],
        [ 0.5, 1.5 ],
        [ 1.5, 1.5 ],
        [ 1.5, 0.5 ],
        [ 0.5, 0.5 ]
      ],
      [
        [ 0.80, 0.80 ],
        [ 0.80, 1.20 ],
        [ 1.20, 1.20 ],
        [ 1.20, 0.80 ],
        [ 0.80, 0.80 ]
      ]
    ]
  }
});

cached.intersects([ 0.75, 0.75 ]);
// => false

cached.intersects([ 1.75, 1.75 ]);
// => true

cached.intersects([ 1, 1 ]);
// => true

cached.intersects([ 2.25, 2.25 ]);
// => false
```
