(() => {
    if (window.appPageTranslationLoaded) return;
    window.appPageTranslationLoaded = true;

    const languageCodes = {
        en: 'en',
        es: 'es',
        fr: 'fr',
        pt: 'pt',
        ar: 'ar',
        de: 'de',
        zh: 'zh'
    };
    const localeTags = {
        en: 'en',
        es: 'es',
        fr: 'fr',
        pt: 'pt-PT',
        ar: 'ar',
        de: 'de',
        zh: 'zh-CN'
    };
    const language = languageCodes[window.appPreferredLanguage] ? window.appPreferredLanguage : 'en';
    const localeTag = localeTags[language];
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';

    document.querySelectorAll('.lang-picker select[name="language"]').forEach(selector => {
        selector.addEventListener('change', () => {
            selector.form.submit();
        });
    });

    if (language === 'en') return;

    const ignoredTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA', 'INPUT', 'SELECT']);
    let phraseReplacements = [];

    const applyPhrase = (value, phrases) => {
        const trimmed = value.trim();
        const translated = phrases[trimmed];
        const start = value.match(/^\s*/)[0];
        const end = value.match(/\s*$/)[0];
        if (translated) return start + translated + end;

        let result = value;
        for (const { pattern, translated } of phraseReplacements) {
            result = result.replace(pattern, (_match, prefix) => prefix + translated);
        }
        return result;
    };

    Promise.all([
        fetch(`/locales/${language}.json`),
        fetch('/locales/en.json')
    ])
        .then(async ([localeResponse, englishResponse]) => {
            if (!localeResponse.ok || !englishResponse.ok) {
                throw new Error('A local language file could not be loaded');
            }
            return Promise.all([localeResponse.json(), englishResponse.json()]);
        })
        .then(([locale, englishLocale]) => {
            if (!locale || !englishLocale || typeof locale.phrases !== 'object' ||
                typeof locale.keys !== 'object' || typeof englishLocale.keys !== 'object') {
                throw new Error('Locale file has an invalid format');
            }
            const phrases = { ...locale.phrases };
            for (const [key, englishText] of Object.entries(englishLocale.keys)) {
                const translatedText = locale.keys[key];
                if (translatedText && englishText !== translatedText) {
                    phrases[englishText] = translatedText;
                }
            }
            phraseReplacements = Object.entries(phrases)
                .filter(([phrase]) => phrase.length > 2)
                .sort(([first], [second]) => second.length - first.length)
                .map(([phrase, translated]) => {
                    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    return {
                        pattern: new RegExp(`(^|[^A-Za-z0-9_])(${escaped})(?=$|[^A-Za-z0-9_])`, 'g'),
                        translated
                    };
                });

            const translateAttributes = root => {
                const elements = [];
                if (root.nodeType === Node.ELEMENT_NODE) elements.push(root);
                if (root.querySelectorAll) {
                    elements.push(...root.querySelectorAll('title,[placeholder],[title],[aria-label],[alt]'));
                }
                for (const element of elements) {
                    if (element.closest('.notranslate,[translate="no"]')) continue;
                    for (const attribute of ['placeholder', 'title', 'aria-label', 'alt']) {
                        if (element.hasAttribute(attribute)) {
                            element.setAttribute(attribute, applyPhrase(element.getAttribute(attribute), phrases));
                        }
                    }
                    if (element.tagName === 'TITLE') {
                        element.textContent = applyPhrase(element.textContent, phrases);
                    }
                }
            };
            translateAttributes(document);

            const translateAddedNode = node => {
                if (node.nodeType === Node.TEXT_NODE) {
                    const parent = node.parentElement;
                    if (parent && !ignoredTags.has(parent.tagName) &&
                        !parent.closest('.notranslate,[translate="no"],[contenteditable="true"]')) {
                        node.nodeValue = applyPhrase(node.nodeValue, phrases);
                    }
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
                        acceptNode(textNode) {
                            const parent = textNode.parentElement;
                            if (!textNode.nodeValue.trim() || !parent || ignoredTags.has(parent.tagName) ||
                                parent.closest('.notranslate,[translate="no"],[contenteditable="true"]')) {
                                return NodeFilter.FILTER_REJECT;
                            }
                            return NodeFilter.FILTER_ACCEPT;
                        }
                    });
                    while (walker.nextNode()) {
                        const textNode = walker.currentNode;
                        textNode.nodeValue = applyPhrase(textNode.nodeValue, phrases);
                    }
                    translateAttributes(node);
                }
            };
            const observer = new MutationObserver(records => {
                for (const record of records) {
                    for (const node of record.addedNodes) translateAddedNode(node);
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
            translateAddedNode(document.body);

            try {
                const regionNames = new Intl.DisplayNames([localeTag], { type: 'region' });
                document.querySelectorAll('#s1-country option[value]').forEach(option => {
                    const countryCode = option.value.toUpperCase();
                    if (/^[A-Z]{2}$/.test(countryCode)) {
                        const localizedName = regionNames.of(countryCode);
                        if (localizedName && localizedName !== countryCode) {
                            option.textContent = localizedName;
                        }
                    }
                });

                const currencyNames = new Intl.DisplayNames([localeTag], { type: 'currency' });
                document.querySelectorAll('#s1-currency option[value],select[name="currency"] option[value]').forEach(option => {
                    const currencyCode = option.value.toUpperCase();
                    if (!/^[A-Z]{3}$/.test(currencyCode)) return;

                    const localizedName = currencyNames.of(currencyCode);
                    if (!localizedName || localizedName === currencyCode) return;

                    const original = option.textContent.trim();
                    if (!/[—-]/.test(original)) return;
                    const symbol = original.match(/\(([^)]*)\)\s*$/)?.[1];
                    option.textContent = `${currencyCode} — ${localizedName}${symbol ? ` (${symbol})` : ''}`;
                });
            } catch (error) {
                console.error('Locale-aware country/currency names could not be formatted:', error);
            }
        })
        .catch(error => {
            console.error('Local language file could not be loaded:', error);
        });
})();
