export default (doc) => {
    if (doc.features) {
        const rename = {
            stairs: 'steps',
            lookout: 'viewpoint',
        };
        Object.keys(rename).forEach((k) => {
            const i = doc.features[k];
            if (i) {
                delete doc.features[k];
                doc.features[rename[k]] = i;
            }
        });
    }
    return doc;
};
