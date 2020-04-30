import FS from 'fs';
import cheerio from 'cheerio';
import YAML from 'js-yaml';
import { get } from './get.mjs';

const photos = async (items) => {
    for (const i of items) {
        if (i.href && i.href.indexOf('commons.wikimedia.org') !== -1) {
            if ([i.src, i.attr, i.license].indexOf(undefined) !== -1) {
                console.log(i.href);
                const html = await get(i.href);
                if (html !== null) {
                    const $ = cheerio.load(html);
                    console.log(' > ok');
                    i.src = $('.mw-filepage-other-resolutions > a').eq(-1).attr('href').trim();
                    i.attr = $('#creator').text().trim();
                    i.license = $('.licensetpl_short').text().trim();
                    console.log(i);
                }
            }
        }
    }
    return true;
};

const traverse = async (item) => {
    if (typeof item === 'object') {
        if (Array.isArray(item)) {
            for (const i of item) {
                await traverse(i);
            }
        } else {
            for (const k in item) {
                if (k === 'photos') {
                    await photos(item.photos);
                } else {
                    await traverse(item[k]);
                }
            }
        }
    }
};

const run = async (filePath) => {
    const document = YAML.safeLoad(FS.readFileSync(filePath));
    await traverse(document);
    return [document, filePath];
};

run(process.argv[process.argv.length - 1]).then(([document, filePath]) => {
    const yaml = YAML.safeDump(document, { lineWidth: 1000, noRefs: true });
    // console.log(yaml);
    FS.writeFileSync(filePath, yaml);
});
