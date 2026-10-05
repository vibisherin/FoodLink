import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DICT } from "./translations";

const I18nContext = createContext(null);
const KEY = "foodlink.lang";

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const saved = localStorage.getItem(KEY);
    return saved && DICT[saved] ? saved : "en";
  });

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const setLang = useCallback((l) => {
    if (!DICT[l]) return;
    localStorage.setItem(KEY, l);
    setLangState(l);
  }, []);

  const t = useCallback((key, vars) => {
    let s = DICT[lang][key] ?? DICT.en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
    return s;
  }, [lang]);

  // "5h 20m" / "2d 3h" / "Expired", localised.
  const timeLeft = useCallback((iso) => {
    const mins = Math.floor((new Date(iso).getTime() - Date.now()) / 60000);
    if (mins <= 0) return t("time.expired");
    if (mins >= 2880) return t("time.d", { d: Math.floor(mins / 1440), h: Math.floor((mins % 1440) / 60) });
    if (mins >= 60) return t("time.hm", { h: Math.floor(mins / 60), m: mins % 60 });
    return t("time.m", { m: mins });
  }, [t]);

  const value = useMemo(() => ({ lang, setLang, t, timeLeft }), [lang, setLang, t, timeLeft]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
