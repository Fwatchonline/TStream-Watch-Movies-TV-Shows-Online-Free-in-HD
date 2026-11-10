import React, { useState } from 'react';

// Maps language code / ISO-639 or regional tags to standard ISO 3166-1 alpha-2 country codes
const LANG_TO_COUNTRY: Record<string, string> = {
  // Ex-Yu & Balkans
  sr: 'rs',
  srp: 'rs',
  srb: 'rs',
  scc: 'rs',
  serbian: 'rs',
  hr: 'hr',
  hrv: 'hr',
  scr: 'hr',
  croatian: 'hr',
  bs: 'ba',
  bos: 'ba',
  bosnian: 'ba',
  bhs: 'rs',
  sl: 'si',
  slv: 'si',
  slovenian: 'si',
  mk: 'mk',
  mkd: 'mk',
  macedonian: 'mk',
  sq: 'al',
  alb: 'al',
  sqi: 'al',
  albanian: 'al',
  me: 'me',
  montenegrin: 'me',

  // Western & Northern Europe
  en: 'gb',
  eng: 'gb',
  english: 'gb',
  de: 'de',
  deu: 'de',
  ger: 'de',
  german: 'de',
  fr: 'fr',
  fra: 'fr',
  fre: 'fr',
  french: 'fr',
  it: 'it',
  ita: 'it',
  italian: 'it',
  es: 'es',
  spa: 'es',
  spanish: 'es',
  pt: 'pt',
  por: 'pt',
  portuguese: 'pt',
  pob: 'br', // Portuguese (Brazil)
  nl: 'nl',
  nld: 'nl',
  dut: 'nl',
  dutch: 'nl',
  sv: 'se',
  swe: 'se',
  swedish: 'se',
  no: 'no',
  nor: 'no',
  norwegian: 'no',
  da: 'dk',
  dan: 'dk',
  danish: 'dk',
  fi: 'fi',
  fin: 'fi',
  finnish: 'fi',

  // Eastern & Central Europe
  pl: 'pl',
  pol: 'pl',
  polish: 'pl',
  cs: 'cz',
  ces: 'cz',
  cze: 'cz',
  czech: 'cz',
  hu: 'hu',
  hun: 'hu',
  hungarian: 'hu',
  ro: 'ro',
  ron: 'ro',
  rum: 'ro',
  romanian: 'ro',
  bg: 'bg',
  bul: 'bg',
  bulgarian: 'bg',
  el: 'gr',
  ell: 'gr',
  gre: 'gr',
  greek: 'gr',
  ru: 'ru',
  rus: 'ru',
  russian: 'ru',
  uk: 'ua',
  ukr: 'ua',
  ukrainian: 'ua',
  tr: 'tr',
  tur: 'tr',
  turkish: 'tr',

  // Asia, Middle East & Americas
  ar: 'sa',
  ara: 'sa',
  arabic: 'sa',
  he: 'il',
  heb: 'il',
  hebrew: 'il',
  hi: 'in',
  hin: 'in',
  hindi: 'in',
  id: 'id',
  ind: 'id',
  indonesian: 'id',
  ms: 'my',
  may: 'my',
  malay: 'my',
  zh: 'cn',
  chi: 'cn',
  zho: 'cn',
  chinese: 'cn',
  ja: 'jp',
  jpn: 'jp',
  japanese: 'jp',
  ko: 'kr',
  kor: 'kr',
  korean: 'kr',
  vi: 'vn',
  vie: 'vn',
  vietnamese: 'vn',
  th: 'th',
  tha: 'th',
  thai: 'th',
  us: 'us',
  usa: 'us',
  ca: 'ca',
  br: 'br',
  mx: 'mx',
  au: 'au'
};

export interface LanguageFlagProps {
  code?: string;
  countryCode?: string;
  name?: string;
  className?: string;
}

/**
 * High-definition country flag image component.
 * Replaces OS-dependent Unicode emojis (which render as monochrome "HR", "GB", "ES" text glyphs on Windows)
 * with authentic full-color national flags across all devices.
 */
export const LanguageFlag: React.FC<LanguageFlagProps> = ({
  code,
  countryCode,
  name,
  className = 'w-5 h-3.5'
}) => {
  const [loadFailed, setLoadFailed] = useState(false);

  let targetCountry = (countryCode || '').toLowerCase().trim();

  if (!targetCountry && code) {
    const rawCode = code.toLowerCase().trim();
    // Handle regional tags like pt-br, en-us, es-mx
    if (rawCode.includes('-') || rawCode.includes('_')) {
      const parts = rawCode.split(/[-_]/);
      const subRegion = parts[1]?.toLowerCase();
      if (subRegion && subRegion.length === 2) {
        targetCountry = subRegion;
      } else {
        const langPart = parts[0]?.toLowerCase();
        targetCountry = LANG_TO_COUNTRY[langPart] || langPart;
      }
    } else {
      const isBr = (name || '').toLowerCase().includes('(br)') || rawCode === 'pob';
      targetCountry = isBr
        ? 'br'
        : (LANG_TO_COUNTRY[rawCode] || (rawCode.length === 2 ? rawCode : 'un'));
    }
  }

  // Also check if language name contains hints (e.g. "Croatian", "Serbian", "English")
  if ((!targetCountry || targetCountry === 'un') && name) {
    const lowerName = name.toLowerCase().trim();
    if (lowerName.includes('croatian') || lowerName.includes('hrvatski')) targetCountry = 'hr';
    else if (lowerName.includes('serbian') || lowerName.includes('srpski')) targetCountry = 'rs';
    else if (lowerName.includes('bosnian') || lowerName.includes('bosanski')) targetCountry = 'ba';
    else if (lowerName.includes('english')) targetCountry = 'gb';
    else if (lowerName.includes('spanish') || lowerName.includes('español')) targetCountry = 'es';
    else if (lowerName.includes('french') || lowerName.includes('français')) targetCountry = 'fr';
    else if (lowerName.includes('german') || lowerName.includes('deutsch')) targetCountry = 'de';
    else if (lowerName.includes('italian') || lowerName.includes('italiano')) targetCountry = 'it';
    else if (lowerName.includes('portuguese') && lowerName.includes('br')) targetCountry = 'br';
    else if (lowerName.includes('portuguese')) targetCountry = 'pt';
    else if (lowerName.includes('russian') || lowerName.includes('русский')) targetCountry = 'ru';
    else if (lowerName.includes('turkish') || lowerName.includes('türkçe')) targetCountry = 'tr';
    else if (lowerName.includes('slovenian')) targetCountry = 'si';
    else if (lowerName.includes('macedonian')) targetCountry = 'mk';
    else if (lowerName.includes('albanian')) targetCountry = 'al';
    else if (lowerName.includes('hindi')) targetCountry = 'in';
    else if (lowerName.includes('arabic')) targetCountry = 'sa';
  }

  if (!targetCountry || targetCountry === 'un' || targetCountry === 'other' || loadFailed) {
    return (
      <span
        className={`inline-flex items-center justify-center bg-white/10 rounded-[2px] text-[10px] text-zinc-400 font-mono select-none border border-white/10 ${className}`}
        title={name || 'Unknown'}
      >
        🌐
      </span>
    );
  }

  return (
    <img
      src={`https://flagcdn.com/w40/${targetCountry}.png`}
      srcSet={`https://flagcdn.com/w80/${targetCountry}.png 2x`}
      alt={name || targetCountry.toUpperCase()}
      title={name || targetCountry.toUpperCase()}
      loading="lazy"
      onError={() => setLoadFailed(true)}
      className={`${className} object-cover rounded-[2px] shadow-sm shrink-0 border border-white/15 align-middle inline-block`}
    />
  );
};
