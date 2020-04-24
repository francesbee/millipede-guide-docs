import fs from 'fs';
import cheerio from 'cheerio';
import YAML from 'js-yaml';
import slugify from 'underscore.string/slugify.js';
import path from 'path';
import mkdirp from 'mkdirp';
import { get } from './get.mjs';
import { dms } from './dms.mjs';

const local = process.argv.indexOf('--fetch') === -1;
const sourceUrl = 'https://en.wikipedia.org/wiki/List_of_national_parks_of_Australia';

const run = (html) => {
    if (html === null) return;
    const $ = cheerio.load(html);
    $('.wikitable').each((tableIndex, table) => {
        const region = $(table).prevAll('h2').first().find('.mw-headline').text();
        if (region) {
            $(table)
                .find('tr')
                .each((rowIndex, row) => {
                    if ($(row).find('td').length === 6) {
                        const cols = $(row).find('td');
                        const name = cols
                            .eq(0)
                            .find('a')
                            .attr('title')
                            .replace(' (page does not exist)', '');
                        const href = cols.eq(0).find('a').attr('href');
                        const lat = dms(cols.eq(1).find('span.latitude').text());
                        const lon = dms(cols.eq(1).find('span.longitude').text());
                        const osm = cols
                            .eq(2)
                            .html()
                            .split('<br>')
                            .map((s) => cheerio.load(s).text())
                            .map((s) => s.trim())
                            .map((s) => parseInt(s, 10))
                            .filter(Number);

                        if (lat && lon) {
                            const fileDir = path.join(
                                'parks',
                                'australia',
                                slugify(region).replace(/[-]/g, '_'),
                            );
                            mkdirp.sync(fileDir);
                            const filePath = path.join(
                                fileDir,
                                `${slugify(name).replace(/[-]/g, '_')}.yaml`,
                            );
                            console.log(filePath);
                            let doc = { draft: 't' };
                            if (fs.existsSync(filePath)) {
                                doc = YAML.safeLoad(fs.readFileSync(filePath));
                            }
                            doc.name = name;
                            doc.country = 'Australia';
                            doc.region = region;
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
    run(fs.readFileSync('./scripts/scrapers/sources/wikipedia_national_parks_australia.html'));
} else {
    get(sourceUrl).then((html) => run(html));
}
