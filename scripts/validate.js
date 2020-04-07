const FS = require('fs');
const Glob = require('glob');
const YAML = require('js-yaml');
const Path = require('path');
var Validator = require('jsonschema').Validator;

const validator = new Validator();
let pass = true;

const document_schema = YAML.safeLoad(FS.readFileSync('./schemas/document.yaml'));
const geojson_schema = JSON.parse(FS.readFileSync('./schemas/geo.json'));

['attractions', 'campsites', 'parks', 'routes'].forEach(category => {
    Glob.sync(`./${category}/**/*.*`).forEach(filePath => {
        const ext = Path.extname(filePath);
        let schema = null;
        let content = null;
        if (ext === '.yaml') {
            schema = document_schema;
            content = YAML.safeLoad(FS.readFileSync(filePath));
        } else if (ext === '.json') {
            schema = geojson_schema;
            content = JSON.parse(FS.readFileSync(filePath));
        } else {
            pass = false;
            console.log(`FAIL: ${filePath}`);
            console.log(` => Unknown file type!`)
        }
        if (content) {
            const result = validator.validate(content, schema, { throwError: false });
            if (result.errors.length === 0) {
                console.log(`OK: ${filePath}`);
            } else {
                pass = false;
                console.log(`FAIL: ${filePath}`);
                result.errors.forEach(e => console.log(' => ', e.stack));
            }
        }
    });
});

if (!pass) throw "There were document validation errors!";
