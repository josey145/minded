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
        zh: 'zh-CN'
    };
    const language = languageCodes[window.appPreferredLanguage] ? window.appPreferredLanguage : 'en';
    const targetLanguage = languageCodes[language];
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';

    if (language === 'en') {
        document.cookie = 'googtrans=; Max-Age=0; path=/; SameSite=Lax' + secure;
    } else {
        document.cookie = 'googtrans=/en/' + targetLanguage + '; path=/; SameSite=Lax' + secure;
    }

    document.querySelectorAll('.lang-picker select[name="language"]').forEach(selector => {
        selector.addEventListener('change', () => {
            const selectedLanguage = languageCodes[selector.value];
            const selectedSecure = window.location.protocol === 'https:' ? '; Secure' : '';

            if (selector.value === 'en') {
                document.cookie = 'googtrans=; Max-Age=0; path=/; SameSite=Lax' + selectedSecure;
            } else if (selectedLanguage) {
                document.cookie = 'googtrans=/en/' + selectedLanguage + '; path=/; SameSite=Lax' + selectedSecure;
            }

            selector.form.submit();
        });
    });

    const translationElement = document.createElement('div');
    translationElement.id = 'google_translate_element';
    translationElement.className = 'notranslate';
    translationElement.setAttribute('translate', 'no');
    translationElement.setAttribute('aria-hidden', 'true');
    document.body.appendChild(translationElement);

    const style = document.createElement('style');
    style.textContent = '.goog-te-banner-frame.skiptranslate{display:none!important}body{top:0!important}#google_translate_element{position:fixed;left:-10000px;top:-10000px}';
    document.head.appendChild(style);

    window.googleTranslateElementInit = () => {
        new window.google.translate.TranslateElement({
            pageLanguage: 'en',
            includedLanguages: 'es,fr,pt,ar,de,zh-CN',
            autoDisplay: false
        }, 'google_translate_element');
    };

    const script = document.createElement('script');
    script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    script.async = true;
    document.head.appendChild(script);
})();
