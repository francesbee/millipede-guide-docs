export default (doc) => {
    ['toilets', 'water', 'transport', 'parking', 'shelter', 'information'].forEach((key) => {
        if (key in doc) {
            const obj = doc[key];
            delete doc[key];
            if (doc.infrastructure === undefined) doc.infrastructure = {};
            doc.infrastructure[key] = obj;
        }
    });
    return doc;
};
