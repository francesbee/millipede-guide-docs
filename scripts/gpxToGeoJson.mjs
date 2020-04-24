import ToGeoJson from '@mapbox/togeojson';
import FS from 'fs';
import Glob from 'glob';
import jsdom from 'jsdom';

Glob.sync('./**/*.gpx').forEach((inPath) => {
    console.log(inPath);
    const outPath = inPath.replace('.gpx', '.geo.json');
    if (FS.existsSync(outPath)) {
        console.log('  -> exists');
    } else {
        console.log('  -> convert');
        const gpx = FS.readFileSync(inPath).toString();
        const document = new jsdom.JSDOM(gpx).window.document;
        const geoJSON = ToGeoJson.gpx(document);
        FS.writeFileSync(outPath, JSON.stringify(geoJSON, null, 4));
    }
});
