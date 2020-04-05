const FS = require('fs');
const Glob = require('glob');
const YAML = require('js-yaml');
var Validator = require('jsonschema').Validator;

const validator = new Validator();
let pass = true;

const schema = YAML.safeLoad(FS.readFileSync('./schema.yaml'));

['attractions', 'campsites', 'parks', 'routes'].forEach(category => {
    Glob.sync(`./${category}/**/*.yaml`).forEach(filePath => {
        const doc = YAML.safeLoad(FS.readFileSync(filePath));
        const result = validator.validate(doc, schema, { throwError: false });
        if (result.errors.length === 0) {
            console.log(`OK: ${filePath}`);
        } else {
            pass = false;
            console.log(`FAIL: ${filePath}`);
            console.log(result.errors);
        }
    });
});

if (!pass) throw "There were document validation errors!";
