export default (doc) => {
    const copyright = doc.copyright;
    const license = doc.license;
    delete doc.copyright;
    delete doc.license;
    doc.copyright = copyright;
    doc.license = license;
    return doc;
};
