const localeFiles = {
    en: require('../public/locales/en.json'),
    es: require('../public/locales/es.json'),
    fr: require('../public/locales/fr.json'),
    pt: require('../public/locales/pt.json'),
    ar: require('../public/locales/ar.json'),
    de: require('../public/locales/de.json'),
    zh: require('../public/locales/zh.json')
};

function getText(language, key, fallback) {
    const locale = localeFiles[language] || localeFiles.en;
    return locale.keys[key] || localeFiles.en.keys[key] || fallback || key;
}

module.exports = { translations: localeFiles, getText };
