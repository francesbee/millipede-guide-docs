const FS = require('fs');
const Glob = require('glob');
const YAML = require('js-yaml');
var Validator = require('jsonschema').Validator;

const validator = new Validator();
let pass = true;

const schema = YAML.safeLoad(FS.readFileSync('./schema.yaml'));

['attractions', 'campsites', 'parks', 'routes'].forEach(category => {
    Glob.sync(`./${category}/**/*.yaml`).forEach(filePath => {
        console.log(filePath);
        const doc = YAML.safeLoad(FS.readFileSync(filePath));
        validator.validate(doc, schema, { throwError: true });
    });
});
