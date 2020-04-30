import FS from 'fs';
import YAML from 'js-yaml';
import Glob from 'glob';
import migrate from './migrations/0004.mjs';

['attractions', 'campsites', 'parks', 'routes'].forEach((category) => {
    Glob.sync(`./${category}/**/*.yaml`).forEach((filePath) => {
        console.log(filePath);
        FS.writeFileSync(
            filePath,
            YAML.safeDump(migrate(YAML.safeLoad(FS.readFileSync(filePath))), {
                lineWidth: 1000,
                noRefs: true,
            }),
        );
    });
});
