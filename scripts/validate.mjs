import FS from 'fs';
import Glob from 'glob';
import YAML from 'js-yaml';
import Path from 'path';
import jsonschema from 'jsonschema';

const validator = new jsonschema.Validator();
let pass = true;

const documentSchema = YAML.safeLoad(FS.readFileSync('./schemas/document.yaml'));
const geoJsonSchema = JSON.parse(FS.readFileSync('./schemas/geo.json'));

['attractions', 'campsites', 'parks', 'routes'].forEach((category) => {
    Glob.sync(`./${category}/**/*.*`).forEach((filePath) => {
        const ext = Path.extname(filePath);
        let schema = null;
        let content = null;
        if (ext === '.yaml') {
            schema = documentSchema;
            content = YAML.safeLoad(FS.readFileSync(filePath));
        } else if (ext === '.json') {
            schema = geoJsonSchema;
            content = JSON.parse(FS.readFileSync(filePath));
        } else {
            pass = false;
            console.log(`FAIL: ${filePath}`);
            console.log(` => Unknown file type!`);
        }
        if (content) {
            const result = validator.validate(content, schema, { throwError: false });
            if (result.errors.length === 0) {
                // console.log(`OK: ${filePath}`);
            } else {
                pass = false;
                console.log(`FAIL: ${filePath}`);
                result.errors.forEach((e) => console.log(' => ', e.stack));
            }
        }
    });
});

if (pass) {
    console.log('Validation passed OK.');
} else {
    throw new Error('Validation failed!');
}
