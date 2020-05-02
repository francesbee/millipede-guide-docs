import FS from 'fs';
import YAML from 'js-yaml';
import geoJSONUtils from 'geojson-utils';
import { osmBaseLayerQuery, osmFeaturesQuery } from './utils/osm.mjs';

const useCache = process.argv.indexOf('--cache') !== -1;
const noShow = process.argv.indexOf('--noshow') !== -1;
const updateLocation = process.argv.indexOf('--location') !== -1;
const filePath = process.argv[process.argv.length - 1];
const getBase = process.argv.indexOf('--base') !== -1;
const getInfrastructure = process.argv.indexOf('--infra') !== -1;
const getNaturalFeatures = process.argv.indexOf('--natural') !== -1;
const useBaseLayer = process.argv.indexOf('--baselayer') !== -1;

const getCentre = (geometry) => {
    const coordinates = geometry.coordinates[0];
    const sum = coordinates.reduce(([x1, y1], [x2, y2]) => [x1 + x2, y1 + y2], [0, 0]);
    return [sum[0] / coordinates.length, sum[1] / coordinates.length];
};

const getArea = (geometry) => Math.round(geoJSONUtils.area(geometry) * 100000000);

const parkingSize = (area) => (area > 100 && 'large') || (area > 50 && 'medium') || 'small';

const deleteEmptyObjects = (doc) => {
    Object.keys(doc).forEach((key) => {
        const val = doc[key];
        if (
            typeof val === 'object' &&
            val.constructor === Object &&
            Object.keys(val).length === 0
        ) {
            delete doc[key];
        }
    });
};

const reorder = (doc, keys) => {
    keys.forEach((k) => {
        if (k in doc) {
            const temp = doc[k];
            delete doc[k];
            doc[k] = temp;
        }
    });
};

const tagOpt = (docProperty, distanceAround, tagsFilter, featureProperty) => ({
    prop: docProperty || null,
    around: distanceAround || null,
    tags: tagsFilter || null,
    feat: featureProperty || null,
});

const applyDocumentFeatures = (obj, tags, geo) => {
    Object.keys(tags).forEach((tag) => {
        const key = tags[tag].feat;
        if (key) {
            const [k, v] = tag.split('=');
            if (geo.features.filter((i) => i.properties.tags[k] === v).length > 0) {
                if (obj[key] !== false) {
                    obj[key] = true;
                    console.log(' >>', tag, '->', key);
                }
            }
        }
    });

    return obj;
};

const findItemByOSM = (arr, type, id) => {
    return (
        arr.reduce((acc, item) => {
            // console.log(item);
            if (item.osm && parseInt(item.osm[type], 10) === parseInt(id, 10)) {
                if (acc === null) {
                    return [item, true];
                } else {
                    console.log('DUPLICATE!', type, id);
                    item.enabled = false;
                    item.name = 'duplicate';
                }
            }
            return acc;
        }, null) || [
            {
                osm: {
                    [type]: parseInt(id, 10),
                },
            },
            false,
        ]
    );
};

const geoCoordinates = (geometry) => {
    const arr = (geometry.type === 'Point' ? geometry.coordinates : getCentre(geometry)).map((i) =>
        parseFloat(i.toFixed(6), 10),
    );
    return [arr[1], arr[0]];
};

const applyDocumentItems = (obj, tags, geo) => {
    Object.keys(tags).forEach((tag) => {
        const key = tags[tag].prop;
        const tagsFilter = tags[tag].tags;
        if (key) {
            const [k, v] = tag.split('=');
            geo.features
                .filter((i) => i.properties.tags[k] === v)
                .forEach(({ geometry, properties }) => {
                    if (obj[key] === undefined) obj[key] = [];
                    const [item, update] = findItemByOSM(obj[key], properties.type, properties.id);
                    if (!update) obj[key].push(item);
                    item.location = geoCoordinates(geometry);
                    if (properties.tags.name) item.name = properties.tags.name;
                    if (item.tags === undefined) item.tags = {};
                    if (key === 'parking' && geometry.type === 'Polygon') {
                        const area = getArea(geometry);
                        item.tags.size = parkingSize(area);
                    }
                    tagsFilter.forEach((t) => {
                        if (t in properties.tags) {
                            item.tags[t.replace(`${key}:`, '')] = properties.tags[t];
                        }
                    });
                    if (Object.keys(item.tags).length === 0) delete item.tags;
                    if (!update) {
                        item.show = !noShow;
                    }
                    console.log(
                        ' >>',
                        tag,
                        '->',
                        properties.type,
                        properties.id,
                        update ? '[UPDATE]' : '[NEW]',
                    );
                });
        }
    });

    return obj;
};

const updateBaseLayer = async (doc) => {
    const geo = await osmBaseLayerQuery(
        doc.osm,
        useCache,
        filePath.replace('.yaml', `${useBaseLayer ? '' : '.osm.base'}.geo.json`),
    );

    console.log(
        'Base LineStrings: ',
        geo.features.filter((f) => f.geometry.type === 'LineString').length,
    );

    console.log('Base Points: ', geo.features.filter((f) => f.geometry.type === 'Point').length);

    if (updateLocation && geo.features.length === 1 && geo.features[0].geometry.type === 'Point') {
        doc.location = [
            geo.features[0].geometry.coordinates[1],
            geo.features[0].geometry.coordinates[0],
        ];
    }

    // todo: iucn_level

    const tags = {
        'highway=steps': tagOpt(null, null, null, 'steps'),
    };

    doc.features = applyDocumentFeatures(doc.features || {}, tags, geo);
};

const updateNaturalFeatures = async (doc) => {
    const tags = {
        'tourism=viewpoint': tagOpt('viewpoint', 50, [], 'viewpoint'),
        'natural=peak': tagOpt('moutain_peak', 100, [], 'mountain_peak'),
        'waterway=waterfall': tagOpt('waterfall', 100, [], 'waterfall'),
        'ford=yes': tagOpt('water_crossing', 10, [], 'water_crossing'),
        'natural=cliff': tagOpt(null, 100, [], 'cliff_edges'),
        'natural=coastline': tagOpt(null, 500, [], 'coastal'),
        'natural=beach': tagOpt(null, 200, [], 'beach'),
    };

    const geo = await osmFeaturesQuery(
        doc.osm,
        tags,
        useCache,
        filePath.replace('.yaml', '.osm.features.geo.json'),
    );

    doc.features = applyDocumentFeatures(doc.features || {}, tags, geo);
    doc.natural = applyDocumentItems(doc.natural || {}, tags, geo);
};

const updateInfrastructure = async (doc) => {
    const tags = {
        'public_transport=station': tagOpt('transport', 500, ['network', 'operator']),
        'highway=bus_stop': tagOpt('transport', 250, []),
        'amenity=parking': tagOpt('parking', 250, ['surface', 'capacity', 'access']),
        'amenity=shelter': tagOpt('shelter', 100, []),
        'amenity=toilets': tagOpt('toilets', 200, [
            'access',
            'wheelchair',
            'changing_table',
            'fee',
            'toilets:disposal',
            'toilets:position',
            'unisex',
            'drinking_water',
        ]),
        'amenity=drinking_water': tagOpt('water', 200, ['drinking_water']),
        'information=visitor_centre': tagOpt('information', 10000, []),
        'information=office': tagOpt('information', 10000, []),
        'tourism=museum': tagOpt('information', 5000, []),
        'tourism=camp_site': tagOpt('campsite', 250, [], 'campsite'),
    };

    const geo = await osmFeaturesQuery(
        doc.osm,
        tags,
        useCache,
        filePath.replace('.yaml', '.osm.infrastructure.geo.json'),
    );

    doc.features = applyDocumentFeatures(doc.features || {}, tags, geo);
    doc.infrastructure = applyDocumentItems(doc.infrastructure || {}, tags, geo);
};

const updateDocument = async () => {
    const doc = YAML.safeLoad(FS.readFileSync(filePath));
    if (getBase || useBaseLayer) {
        await updateBaseLayer(doc);
    }
    if (getNaturalFeatures) {
        await updateNaturalFeatures(doc);
    }
    if (getInfrastructure) {
        await updateInfrastructure(doc);
    }
    reorder(doc, ['copyright', 'license']);
    deleteEmptyObjects(doc);
    const yaml = YAML.safeDump(doc, { lineWidth: 1000, noRefs: true });
    // console.log(yaml);
    FS.writeFileSync(filePath, yaml);
};

updateDocument().then(() => console.log('Done.'));
