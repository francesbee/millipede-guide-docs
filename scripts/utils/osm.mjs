// https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL
// http://overpass-turbo.eu/
// https://github.com/maxogden/geojson-js-utils/blob/master/geojson-utils.js

import FS from 'fs';
import query_overpass from 'query-overpass';

let queryDelay = 0;

const osmQueryToGeoJson = async (query, cache, cacheFilePath) => {
    console.log(query);
    console.log(' -> ', cacheFilePath);
    const useCache = cache && FS.existsSync(cacheFilePath);
    return await new Promise((resolve) => {
        if (useCache) {
            console.log('CACHED');
            queryDelay = 0;
            resolve(JSON.parse(FS.readFileSync(cacheFilePath)));
        } else {
            console.log('QUERY API');
            setTimeout(() => {
                // Delay: Be nice to OSM server
                queryDelay = 10;
                query_overpass(query, (error, data) => {
                    if (error) {
                        console.log('ERROR!', JSON.stringify(error));
                        resolve({
                            type: 'FeatureCollection',
                            features: [],
                        });
                    } else {
                        if (data.copyright === undefined) {
                            data.copyright =
                                'The data included in this document is from www.openstreetmap.org. The data is made available under ODbL.';
                        }
                        FS.writeFileSync(cacheFilePath, JSON.stringify(data, null, 4));
                        resolve(data);
                    }
                });
            }, queryDelay * 1000);
        }
    });
};

const osmSource = (osm) =>
    ['relation', 'way', 'node']
        .map((i) => {
            if (i in osm) {
                const ids = osm[i];
                return `${i}(id:${typeof ids === 'number' ? ids : ids.join(',')});`;
            } else {
                return null;
            }
        })
        .filter(Boolean);

export const osmBaseLayerQuery = async (osm, cache, filePath) => {
    const query = `
        (${osmSource(osm).join(' ')});
        (._;>;);
        out;
    `;

    return await osmQueryToGeoJson(query, cache, filePath);
};

const osmFilterQuery = (osmTags, filter) =>
    Object.keys(osmTags).map(
        // filter='around' etc
        // https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL#Relative_to_other_elements_.28around.29
        (key) =>
            [
                `node(${filter}.track:${osmTags[key][1]})[${key}];`,
                `(way(${filter}.track:${osmTags[key][1]})[${key}]; >;);`,
            ].join('\n          '),
    );

export const osmFeaturesQuery = async (osm, tags, cache, filePath) => {
    const query = `
        (${osmSource(osm).join(' ')});
        (._;>;)->.track;
        (
          ${osmFilterQuery(tags, 'around').join('\n          ')}
        );
        out;
    `;

    return await osmQueryToGeoJson(query, cache, filePath);
};
