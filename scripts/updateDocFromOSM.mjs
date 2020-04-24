import query_overpass from 'query-overpass';
import FS from 'fs';
import YAML from 'js-yaml';
import geoJSONUtils from 'geojson-utils'; // https://github.com/maxogden/geojson-js-utils/blob/master/geojson-utils.js

const allowCache = false;
const filePath = process.argv[2];

const features = {
    'public_transport=station': ['transport', 500, ['network', 'operator']],
    'highway=bus_stop': ['transport', 250, []],
    'amenity=parking': ['parking', 250, ['surface', 'capacity', 'access']],
    'amenity=shelter': ['shelter', 100, []],
    'amenity=toilets': [
        'toilets',
        200,
        [
            'access',
            'wheelchair',
            'changing_table',
            'fee',
            'toilets:disposal',
            'toilets:position',
            'unisex',
            'drinking_water',
        ],
    ],
    'amenity=drinking_water': ['water', 200, []],
    'information=visitor_centre': ['information', 5000, []],
    'information=office': ['information', 5000, []],
};

// const getCentre = (geometry) => geoJSONUtils.centroid(geometry).coordinates;
// const getCentre = (geometry) => geometry.coordinates[0][0];
const getCentre = (geometry) => {
    const coordinates = geometry.coordinates[0];
    const sum = coordinates.reduce(([x1, y1], [x2, y2]) => [x1 + x2, y1 + y2], [0, 0]);
    return [sum[0] / coordinates.length, sum[1] / coordinates.length];
};

const getArea = (geometry) => Math.round(geoJSONUtils.area(geometry) * 100000000);

const areaSize = (area) => (area > 100 && 'large') || (area > 50 && 'medium') || 'small';

const queryOverpassToFile = (query, cacheFilePath) => {
    console.log(query);
    console.log(' -> ', cacheFilePath);
    const useCache = allowCache && FS.existsSync(cacheFilePath);
    return new Promise((resolve) => {
        if (useCache) {
            console.log('CACHED');
            resolve(JSON.parse(FS.readFileSync(cacheFilePath)));
        } else {
            console.log('QUERY API');
            query_overpass(query, (error, data) => {
                if (error) {
                    console.log('ERROR!');
                    resolve({
                        type: 'FeatureCollection',
                        features: [],
                    });
                } else {
                    if (!useCache) {
                        FS.writeFileSync(cacheFilePath, JSON.stringify(data, null, 4));
                    }
                    resolve(data);
                }
            });
        }
    });
};

console.log(filePath);

const document = YAML.safeLoad(FS.readFileSync(filePath));

if (typeof document.osm === 'object') {
    const source = ['relation', 'way', 'node']
        .map((i) => {
            if (i in document.osm) {
                const ids = document.osm[i];
                return `${i}(id:${typeof ids === 'number' ? ids : ids.join(',')});`;
            } else {
                return null;
            }
        })
        .filter(Boolean);

    const baseQuery = `
        ${source[0]}
        (._;>;);
        out;
    `;

    const nodesAndWays = Object.keys(features).map((key) =>
        [
            `node(around.track:${features[key][1]})[${key}];`,
            `(way(around.track:${features[key][1]})[${key}]; >;);`,
        ].join('\n          '),
    );

    const featuresQuery = `
        ${source[0]}
        (._;>;)->.track;
        (
          ${nodesAndWays.join('\n          ')}
        );
        out;
    `;

    queryOverpassToFile(baseQuery, filePath.replace('.yaml', '.osm.base.geo.json')).then((data) => {
        console.log(
            'LineString: ',
            data.features.filter((f) => f.geometry.type === 'LineString').length,
        );

        queryOverpassToFile(
            featuresQuery,
            filePath.replace('.yaml', '.osm.features.geo.json'),
        ).then((data) => {
            data.features.forEach((feature) => {
                if (feature.geometry.type !== 'LineString') {
                    const [type, tagsFilter] = Object.keys(feature.properties.tags).reduce(
                        (acc, key) => {
                            if (acc === null) {
                                const tag = `${key}=${feature.properties.tags[key]}`;
                                if (tag in features) {
                                    return [features[tag][0], features[tag][2]];
                                }
                            }
                            return acc;
                        },
                        null,
                    ) || [null, []];

                    if (type) {
                        const node = feature.properties.type;
                        const id = parseInt(feature.properties.id, 10);
                        const location =
                            feature.geometry.type === 'Point'
                                ? feature.geometry.coordinates
                                : getCentre(feature.geometry);
                        const area =
                            feature.geometry.type === 'Point' ? 0 : getArea(feature.geometry);

                        location.reverse();

                        if (document[type] === undefined) document[type] = [];

                        const [docItem, found] = document[type].reduce((acc, docItem) => {
                            if (docItem.osm && docItem.osm[node] === id) {
                                if (acc === null) {
                                    return [docItem, true];
                                } else {
                                    console.log('DUPLICATE!', node, id);
                                    docItem.enabled = false;
                                    docItem.name = 'duplicate';
                                }
                            }
                            return acc;
                        }, null) || [{}, false];

                        if (!found) {
                            docItem.osm = { [node]: id };
                            document[type].push(docItem);
                        }

                        docItem.location = location.map((i) => parseFloat(i.toFixed(6), 10));

                        if (feature.properties.tags.name)
                            docItem.name = feature.properties.tags.name;

                        if (docItem.tags === undefined) docItem.tags = {};

                        if (type === 'parking' && area > 0) docItem.tags.size = areaSize(area);

                        tagsFilter.forEach((tag) => {
                            if (tag in feature.properties.tags)
                                docItem.tags[tag.replace(`${type}:`, '')] =
                                    feature.properties.tags[tag];
                        });

                        if (Object.keys(docItem.tags).length === 0) delete docItem.tags;

                        if (!found) {
                            docItem.show = false;
                        }

                        console.log(type, feature.id, location, area, found);
                    }
                }
            });

            const yaml = YAML.safeDump(document, { lineWidth: 1000, noRefs: true });
            // console.log(yaml);
            FS.writeFileSync(filePath, yaml);
        });
    });
}
