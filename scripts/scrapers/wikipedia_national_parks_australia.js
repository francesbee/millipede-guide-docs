/* eslint-disable no-console */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable import/no-unresolved */

const fs = require('fs');
const cheerio = require('cheerio');
const YAML = require('js-yaml');
const _string = require('underscore.string');
const path = require('path');
const mkdirp = require('mkdirp');
const { get } = require('./get.js');
const { dms } = require('./dms.js');

const local = true;
const sourceUrl = 'https://en.wikipedia.org/wiki/List_of_national_parks_of_Australia';

const regions = {
    'Australian Capital Territory': 'ACT',
    'New South Wales': 'NSW',
    'Northern Territory': 'NT',
    Queensland: 'Qld',
    'South Australia': 'SA',
    Tasmania: 'Tas',
    Victoria: 'Vic',
    'Western Australia': 'WA',
};

const process = html => {
    if (html === null) return;
    const $ = cheerio.load(html);
    $('.wikitable').each((index, table) => {
        const region = $(table)
            .prevAll('h2')
            .first()
            .find('.mw-headline')
            .text();
        if (region in regions) {
            console.log(regions[region]);
            $(table)
                .find('tr')
                .each((index, row) => {
                    if ($(row).find('td').length === 6) {
                        const cols = $(row).find('td');
                        const name = cols
                            .eq(0)
                            .find('a')
                            .attr('title')
                            .replace(' (page does not exist)', '');
                        const href = cols
                            .eq(0)
                            .find('a')
                            .attr('href');
                        const lat = dms(
                            cols
                                .eq(1)
                                .find('span.latitude')
                                .text(),
                        );
                        const lon = dms(
                            cols
                                .eq(1)
                                .find('span.longitude')
                                .text(),
                        );
                        if (lat && lon) {
                            const osm = cols
                                .eq(2)
                                .html()
                                .split('<br>')
                                .map(s => cheerio.load(s).text())
                                .map(s => s.trim())
                                .map(s => parseInt(s, 10))
                                .filter(Number);
                            const fileDir = path.join(
                                'parks',
                                'australia',
                                regions[region].toLowerCase(),
                            );
                            mkdirp(fileDir);
                            const filePath = path.join(
                                fileDir,
                                `${_string.slugify(name).replace(/[-]/g, '_')}.yaml`,
                            );
                            console.log(filePath);
                            let doc = { draft: 'y' };
                            if (fs.existsSync(filePath)) {
                                doc = YAML.safeLoad(fs.readFileSync(filePath));
                            }
                            doc.name = name;
                            doc.country = 'Australia';
                            doc.region = regions[region];
                            doc.location = [lat, lon];
                            if (osm.length > 0) {
                                if (!('osm' in doc)) doc.osm = {};
                                doc.osm.relation = osm;
                            }
                            if (!('features' in doc)) doc.features = {};
                            doc.features.national_park = true;
                            if (href) {
                                if (!('links' in doc)) doc.links = {};
                                doc.links.wikipedia = `https://en.wikipedia.org${href}`;
                            }
                            if (doc.copyright === undefined) {
                                doc.copyright = ['Wikipedia'];
                            }
                            doc.license = 'CC BY-NC-SA 4.0';
                            fs.writeFileSync(
                                filePath,
                                YAML.safeDump(doc, { noRefs: true, lineWidth: 1000 }),
                            );
                        }
                    }
                });
        }
    });
};

if (local) {
    process(fs.readFileSync('./scripts/scrapers/sources/wikipedia_national_parks_australia.html'));
} else {
    get(sourceUrl).then(html => process(html));
}
