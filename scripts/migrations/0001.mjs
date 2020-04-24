const keysAllowed = ['show', 'osm', 'location', 'name', 'photos', 'tags'];

export default (doc) => {
    ['toilets', 'water', 'transport', 'parking', 'shelter'].forEach((key) => {
        if (key in doc) {
            doc[key] = doc[key].map((item) => {
                const tags = item.tags || {};
                const newItem = {};
                Object.keys(item).forEach((itemKey) => {
                    if (keysAllowed.indexOf(itemKey) !== -1) {
                        newItem[itemKey] = item[itemKey];
                    } else {
                        if (key === 'parking' && itemKey === 'sealed_surface') {
                            tags.surface = 'asphalt';
                        } else if (key === 'toilets' && itemKey === 'type') {
                            tags.disposal = item[itemKey];
                        } else if (key === 'toilets' && itemKey === 'accessible') {
                            tags.wheelchair = item[itemKey];
                        } else {
                            tags[itemKey] = item[itemKey];
                        }
                    }
                });
                if (Object.keys(tags).length !== 0) {
                    newItem.tags = tags;
                }
                return newItem;
            });
        }
    });
    return doc;
};
