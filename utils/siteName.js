const DEFAULT_SITE_NAME = 'TADAWU LX';
const LEGACY_SITE_NAMES = /^(?:maximum|cue[\s-]?action|tadawulx)$/i;

const normalizeSiteName = (name) => {
    if (typeof name !== 'string' || !name.trim()) {
        return DEFAULT_SITE_NAME;
    }

    const trimmedName = name.trim();
    return LEGACY_SITE_NAMES.test(trimmedName) ? DEFAULT_SITE_NAME : trimmedName;
};

module.exports = { DEFAULT_SITE_NAME, normalizeSiteName };
