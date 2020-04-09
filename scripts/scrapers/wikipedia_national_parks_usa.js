/* eslint-disable no-console */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable import/no-unresolved */

const fs = require('fs');
const cheerio = require('cheerio');
const YAML = require('js-yaml');
const _string = require('underscore.string');
const path = require('path');
const mkdirp = require('mkdirp').sync;
const { get } = require('./get.js');

const local = process.argv.indexOf('--fetch') === -1;

const sourceUrl = 'https://en.wikipedia.org/wiki/List_of_national_parks_of_the_United_States';

const country = 'USA';

const dd = str => {
    const b = str[str.length - 1];
    return (b === 'W' || b === 'S' ? -1 : 1) * parseFloat(str);
};

const run = html => {
    if (html === null) return;
    const $ = cheerio.load(html);
    $('.wikitable').each((tableIndex, table) => {
        $(table)
            .find('tr')
            .slice(1)
            .each((rowIndex, row) => {
                const $cols = $(row).find($('th, td'));

                if ($cols.length === 7) {
                    const name = $cols
                        .eq(0)
                        .find('a')
                        .attr('title');
                    const href = $cols
                        .eq(0)
                        .find('a')
                        .attr('href');

                    const imgSrc = $cols
                        .eq(1)
                        .find('img')
                        .attr('src');
                    const imgHref = $cols
                        .eq(1)
                        .find('a.image')
                        .attr('href');

                    const region = $cols
                        .eq(2)
                        .find('a')
                        .first()
                        .attr('title');

                    const ll = $cols
                        .eq(2)
                        .find('.geo-dec')
                        .text();
                    const lat = dd(ll.split(' ')[0]);
                    const lon = dd(ll.split(' ')[1]);

                    const osm = $cols
                        .eq(2)
                        .html()
                        .split('<br>')
                        .map(s => cheerio.load(s).text())
                        .map(s => s.trim())
                        .map(s => parseInt(s, 10))
                        .filter(Number);

                    console.log(rowIndex, [name, region, lat, lon].join(', '));

                    if (name && region && lat && lon) {
                        const fileDir = path.join(
                            'parks',
                            country.toLowerCase(),
                            _string.slugify(region).replace(/[-]/g, '_'),
                        );
                        mkdirp(fileDir);

                        const filePath = path.join(
                            fileDir,
                            `${_string.slugify(name).replace(/[-]/g, '_')}.yaml`,
                        );
                        console.log(filePath);

                        let doc = { draft: 't' };

                        if (fs.existsSync(filePath)) {
                            doc = YAML.safeLoad(fs.readFileSync(filePath));
                        }

                        doc.name = name;
                        doc.country = country;
                        doc.region = region;
                        doc.location = [lat, lon];

                        if (osm.length > 0) {
                            if (!('osm' in doc)) doc.osm = {};
                            doc.osm.relation = osm;
                        }

                        if (!('features' in doc)) doc.features = {};
                        doc.features.national_park = true;

                        if (doc.photos === undefined || doc.photos.length === 0) {
                            doc.photos = [
                                {
                                    src: `https:${imgSrc}`,
                                    href: `https://en.wikipedia.org${imgHref}`,
                                    attr: 'Wikipedia',
                                    license: '?',
                                },
                            ];
                        }

                        if (href) {
                            if (!('links' in doc)) doc.links = {};
                            doc.links.wikipedia = `https://en.wikipedia.org${href}`;
                        }

                        if (doc.copyright === undefined) {
                            doc.copyright = ['Wikipedia'];
                        }

                        doc.license = 'CC BY-NC-SA 4.0';

                        // console.log(doc);

                        fs.writeFileSync(
                            filePath,
                            YAML.safeDump(doc, { noRefs: true, lineWidth: 1000 }),
                        );
                    }
                }
            });
    });
};

if (local) {
    run(fs.readFileSync('./scripts/scrapers/sources/wikipedia_national_parks_usa.html'));
} else {
    get(sourceUrl).then(html => run(html));
}
