import fetch from 'isomorphic-unfetch';

export const get = async (url) => {
    let content = null;
    const response = await fetch(url);
    if (response.ok) {
        await new Promise((resolve) => {
            response
                .text()
                .catch(() => {
                    resolve();
                })
                .then((text) => {
                    content = text;
                    resolve();
                });
        });
    }
    return content;
};
