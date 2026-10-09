import React, { useEffect, useRef, useState } from 'react';
import { useLang } from '../../i18n/translations';
import { getCachedPresentationText, localizePresentationText } from '../../services/chatTranslation';

export function LocalizedNarrative({ text, language, sourceLocale = 'auto', protectedNames = [] }) {
  const uiLanguage = useLang();
  const locale = language || uiLanguage;
  const ref = useRef(null);
  const [resolved, setResolved] = useState(null);
  const namesKey = JSON.stringify(protectedNames);
  useEffect(() => {
    let active = true;
    const resolve = () => localizePresentationText({ text, targetLocale: locale, sourceLocale, protectedNames: JSON.parse(namesKey) })
      .then(value => { if (active) setResolved(value); }).catch(() => {});
    let observer;
    if (typeof IntersectionObserver === 'function' && ref.current) {
      observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); void resolve(); } });
      observer.observe(ref.current);
    } else void resolve();
    return () => { active = false; observer?.disconnect(); };
  }, [text, locale, sourceLocale, namesKey]);
  const valid = resolved?.sourceText === String(text ?? '') && resolved?.targetLocale === String(locale).slice(0, 2).toLowerCase();
  const displayed = valid ? resolved.translatedText : getCachedPresentationText(text, locale);
  const translated = displayed !== text;
  const originalLabel = String(locale).startsWith('pt') ? 'Texto original' : String(locale).startsWith('es') ? 'Texto original' : 'Original text';
  return <span ref={ref} title={translated ? `${originalLabel}: ${text}` : undefined} data-presentation-translated={translated ? 'true' : 'false'}>{displayed}</span>;
}
