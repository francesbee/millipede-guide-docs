// https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL
// http://overpass-turbo.eu/
// https://github.com/maxogden/geojson-js-utils/blob/master/geojson-utils.js

import query_overpass from 'query-overpass';
import FS from 'fs';
import YAML from 'js-yaml';
import geoJSONUtils from 'geojson-utils';

const allowCache = process.argv.indexOf('--cache') !== -1;
const noShow = process.argv.indexOf('--noshow') !== -1;
const filePath = process.argv[process.argv.length - 1];

const osmTags = {
    'public_transport=station': ['infrastructure.transport', 500, ['network', 'operator']],
    'highway=bus_stop': ['infrastructure.transport', 250, []],
    'amenity=parking': ['infrastructure.parking', 250, ['surface', 'capacity', 'access']],
    'amenity=shelter': ['infrastructure.shelter', 100, []],
    'amenity=toilets': [
        'infrastructure.toilets',
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
    'amenity=drinking_water': ['infrastructure.water', 200, []],
    'information=visitor_centre': ['infrastructure.information', 10000, []],
    'information=office': ['infrastructure.information', 10000, []],
    'tourism=museum': ['infrastructure.information', 5000, []],
    'tourism=viewpoint': ['natural.viewpoint', 50, [], 'viewpoint'],
    'natural=peak': ['natural.moutain_peak', 100, [], 'mountain_peak'],
    'waterway=waterfall': ['natural.waterfall', 100, [], 'waterfall'],
    'ford=yes': ['natural.water_crossing', 10, [], 'water_crossing'],
    'natural=cliff': [null, 100, [], 'cliff_edges'],
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

const reorder = (document, keys) => {
    keys.forEach((k) => {
        if (k in document) {
            const temp = document[k];
            delete document[k];
            document[k] = temp;
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

    // TODO: Search for junctions with other tracks:
    const baseQuery = `
        (${source.join(' ')});
        (._;>;);
        out;
    `;

    const nodesAndWays = Object.keys(osmTags).map((key) =>
        [
            `node(around.track:${osmTags[key][1]})[${key}];`,
            `(way(around.track:${osmTags[key][1]})[${key}]; >;);`,
        ].join('\n          '),
    );

    const featuresQuery = `
        (${source.join(' ')});
        (._;>;)->.track;
        (
          ${nodesAndWays.join('\n          ')}
        );
        out;
    `;

    queryOverpassToFile(baseQuery, filePath.replace('.yaml', '.osm.base.geo.json')).then(
        (baseData) => {
            console.log(
                'LineString: ',
                baseData.features.filter((f) => f.geometry.type === 'LineString').length,
            );

            queryOverpassToFile(
                featuresQuery,
                filePath.replace('.yaml', '.osm.features.geo.json'),
            ).then((data) => {
                const docFeatures = Object.keys(osmTags).reduce((obj, tag) => {
                    const [, , , k] = osmTags[tag];
                    if (k) {
                        const [t, v] = tag.split('=');
                        if (data.features.filter((i) => i.properties.tags[t] === v).length > 0) {
                            console.log(tag, '->', k);
                            return { ...obj, [k]: true };
                        }
                    }
                    return obj;
                }, {});

                if (
                    baseData.features.filter((i) => i.properties.tags.highway === 'steps').length >
                    0
                ) {
                    docFeatures.steps = true;
                }

                if (Object.keys(docFeatures).length > 0) {
                    document.features = { ...docFeatures, ...(document.features || {}) };
                }

                data.features.forEach((feature) => {
                    if (feature.geometry.type !== 'LineString') {
                        const [type, tagsFilter] = Object.keys(feature.properties.tags).reduce(
                            (acc, key) => {
                                if (acc === null) {
                                    const tag = `${key}=${feature.properties.tags[key]}`;
                                    if (tag in osmTags) {
                                        return [osmTags[tag][0], osmTags[tag][2]];
                                    }
                                }
                                return acc;
                            },
                            null,
                        ) || [null, []];

                        if (type !== null) {
                            const node = feature.properties.type;
                            const id = parseInt(feature.properties.id, 10);
                            const location =
                                feature.geometry.type === 'Point'
                                    ? feature.geometry.coordinates
                                    : getCentre(feature.geometry);
                            const area =
                                feature.geometry.type === 'Point' ? 0 : getArea(feature.geometry);

                            location.reverse();

                            const [subtype, target] = type.split('.').reduce(
                                ([, tgt], key, idx, src) => {
                                    if (tgt[key] === undefined) {
                                        console.log('NEW: ', key);
                                        tgt[key] = src.length - 1 === idx ? [] : {};
                                    }
                                    return [key, tgt[key]];
                                },
                                [null, document],
                            );

                            const [docItem, found] = target.reduce((acc, docItem) => {
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
                                target.push(docItem);
                            }

                            docItem.location = location.map((i) => parseFloat(i.toFixed(6), 10));

                            if (feature.properties.tags.name)
                                docItem.name = feature.properties.tags.name;

                            if (docItem.tags === undefined) docItem.tags = {};

                            if (subtype === 'parking' && area > 0)
                                docItem.tags.size = areaSize(area);

                            tagsFilter.forEach((tag) => {
                                if (tag in feature.properties.tags)
                                    docItem.tags[tag.replace(`${subtype}:`, '')] =
                                        feature.properties.tags[tag];
                            });

                            if (Object.keys(docItem.tags).length === 0) delete docItem.tags;

                            if (!found) {
                                docItem.show = !noShow;
                            }

                            console.log(type, feature.id, location, area, found);
                        }
                    }
                });

                reorder(document, ['copyright', 'license']);

                const yaml = YAML.safeDump(document, { lineWidth: 1000, noRefs: true });
                // console.log(yaml);
                FS.writeFileSync(filePath, yaml);
            });
        },
    );
}
