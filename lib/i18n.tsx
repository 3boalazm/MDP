"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Locale = "ar" | "en";

const en = {
  common: {
    languageName: "English",
    switchTo: "العربية",
  },
  header: {
    brand: "Stem Studio",
    nav: { howItWorks: "How it works", faq: "FAQ", privacy: "Privacy" },
    cta: "Start separating",
  },
  install: {
    button: "Install App",
    iosTitle: "Install on iPhone / iPad",
    iosBody: "Tap the Share icon in Safari's toolbar, then choose Add to Home Screen.",
    gotIt: "Got it",
  },
  hero: {
    eyebrow: "Local audio separation",
    title: "Turn one track into four clean stems.",
    subtitle:
      "Separate vocals, drums, bass, and other instruments directly in your browser. Nothing you upload here — because nothing gets uploaded.",
    primaryCta: "Choose a file",
    secondaryCta: "See how it works",
    trust: { noUpload: "No upload", onDevice: "Runs on your device", formats: "MP3 · WAV · M4A" },
  },
  steps: {
    title: "How it works",
    items: [
      { n: "01", title: "Drop your song", body: "Choose an MP3, WAV, or M4A file. It never leaves your device." },
      {
        n: "02",
        title: "Separate locally",
        body: "An AI model runs in your browser, isolating vocals, drums, bass & other.",
      },
      {
        n: "03",
        title: "Preview & download",
        body: "Play each stem, mute or solo, and export the WAV files you need.",
      },
    ],
  },
  workspace: {
    eyebrow: "Workspace",
    privacyNote: "Your audio is processed locally in your browser. No audio is uploaded to a server.",
    serverNote: "Fast Mode uploads your audio to our GPU server for processing.",
    dropzone: {
      idleLabel: "Drop your song here",
      dragLabel: "Drop to separate",
      or: "or",
      chooseFile: "Choose file",
      limits: (maxMb: number, maxMin: number) => `MP3, WAV, or M4A · up to ${maxMb}MB · ${maxMin} min`,
      modelsNote: "Up to 4 specialist AI models (~650MB total), cached after first download.",
    },
    fileSummary: { changeFile: "Change file" },
    modeToggle: { onDevice: "On-device", fastMode: "Fast Mode" },
    specialists: {
      intro:
        "Turn off any specialist you don't need — each one skipped means one less model to download and one less pass to process, so it finishes faster.",
      vocals: "Enhance Vocals",
      vocalsHint: "always on — main model",
      drums: "Enhance Drums",
      bass: "Enhance Bass",
      other: "Enhance Other",
      onlyMainNote:
        "Only the main model will run — drums/bass/other will use its standard (not specialist) quality. Fastest option.",
    },
    fastModeNote:
      "Fast Mode always computes all 4 stems at full specialist quality on our GPU server — much quicker than on-device, at the cost of uploading your audio.",
    startButton: "Start separation",
    progress: {
      passLabel: { main: "main model", drums: "drums specialist", bass: "bass specialist", other: "other specialist" },
      passCounter: (n: number, total: number, label: string) => `Pass ${n}/${total}: ${label}`,
      stage: (stage: string, passLabel: string, isMain: boolean): string => {
        switch (stage) {
          case "validating":
            return "Validating file…";
          case "decoding":
            return "Decoding audio…";
          case "loading-model":
            return isMain ? "Loading AI model…" : `Loading ${passLabel} model…`;
          case "loading-session":
            return isMain ? "Starting AI engine…" : `Starting ${passLabel} engine…`;
          case "processing":
            return isMain ? "Separating vocals, drums, bass & other…" : `Improving ${passLabel}…`;
          case "finalizing":
            return "Reconstructing output…";
          default:
            return "Working…";
        }
      },
      modelDownloadNote: "Preparing the separation engine — this first download is cached, so future runs skip it.",
      chunkProgress: (current: number, total: number) => `Chunk ${current}/${total}`,
      elapsed: (elapsed: string) => `Elapsed ${elapsed}`,
      eta: (eta: string) => `ETA ${eta}`,
      gpu: (backend: string) => `GPU acceleration: ${backend}`,
      cancel: "Cancel",
    },
    serverProgress: {
      stage: (stage: string): string => {
        switch (stage) {
          case "validating":
            return "Validating file…";
          case "uploading":
            return "Uploading…";
          case "processing":
            return "Separating on the server…";
          case "finalizing":
            return "Decoding result…";
          default:
            return "Working…";
        }
      },
    },
    cancelled: "Cancelled.",
    newSeparation: "New separation",
    useOnDeviceInstead: "Use on-device instead",
    useFallbackInstead: "Use basic fallback instead (lower quality, not AI)",
    done: {
      aiBanner: "AI model loaded — vocals, drums, bass & other separated",
      serverBanner: "Fast Mode complete — vocals, drums, bass & other separated",
      engineLine: (engine: string, model: string, elapsed: string) =>
        `Engine: AI source separation (${engine}) · Model: ${model} · Elapsed ${elapsed}`,
      serverEngineLine: (elapsed: string) => `Engine: server-side GPU (HT-Demucs FT) · Elapsed ${elapsed}`,
      monoWarning: "This file is mono. The model still ran, but without real stereo information its accuracy is reduced.",
      failedSpecialistsWarning: (names: string, plural: boolean) =>
        `${names} specialist pass${plural ? "es" : ""} couldn't run on this device — that stem came from the main model instead (standard, not enhanced, quality).`,
    },
    fallback: {
      banner: "⚠ Fallback mode: phase cancellation, not AI. Quality is noticeably lower than the AI engine.",
      processing: "Processing…",
      removalStrength: "Removal strength",
      monoNote: "This file is mono, so there's no stereo separation to exploit — the output is unchanged from the original.",
      instrumentalLabel: "Instrumental",
      downloadLabel: (label: string) => `Download ${label}`,
    },
  },
  stems: {
    label: { vocals: "Vocals", drums: "Drums", bass: "Bass", other: "Other" },
    ready: "Ready",
    mute: "Mute",
    solo: "Solo",
    combine: "Combine",
    downloadWav: "Download WAV",
    yourStems: "Your stems",
    downloadAll: "Download all stems",
    combineHint: "Check “Combine” on one more stem to mix and save them together.",
    saveCombined: "Save combined WAV",
  },
  faq: {
    title: "FAQ",
    items: [
      {
        q: "Does my audio ever leave my device?",
        a: "No, not in the default on-device mode. The AI models are downloaded once and cached in your browser, then every separation runs locally — your audio file is never sent anywhere.",
      },
      {
        q: "What file formats and limits are supported?",
        a: "MP3, WAV, and M4A, up to 100MB and 12 minutes per file. Stereo files give the model real left/right information to work with, so they separate more accurately than mono.",
      },
      {
        q: "How long does separation take?",
        a: "It depends on your device and which specialist models you enable. The first run also downloads the models (up to ~650MB total), which are cached afterward so later runs skip straight to processing.",
      },
      {
        q: "What happens if the AI engine can't run on my device?",
        a: "You'll be offered a basic fallback that uses phase cancellation instead of AI. It's noticeably lower quality, but still fully local — nothing is uploaded.",
      },
    ],
    serverItem: {
      q: "What does Fast Mode change about privacy?",
      a: "Fast Mode trades privacy for speed: your audio is uploaded to a GPU server for processing instead of running in your browser. Use on-device mode if keeping your audio local matters to you.",
    },
  },
  footer: {
    tagline: "Your audio stays yours.",
    privacyBody:
      "On-device separation runs entirely in your browser via onnxruntime-web. Model files are cached locally after the first download and can be cleared anytime from your browser's site data settings — nothing about your audio is stored or sent to a server.",
    engineBody:
      "Primary engine: four HT-Demucs FT specialist models (MIT licensed), run entirely on-device via onnxruntime-web — one per stem (vocals, drums, bass, other). Phase cancellation is used only as a fallback if the models can't run on this device.",
    nav: { howItWorks: "How it works", faq: "FAQ", newSeparation: "New separation" },
  },
};

type Dict = typeof en;

const ar: Dict = {
  common: {
    languageName: "العربية",
    switchTo: "English",
  },
  header: {
    brand: "استوديو التراكس",
    nav: { howItWorks: "طريقة الاستخدام", faq: "الأسئلة الشائعة", privacy: "الخصوصية" },
    cta: "ابدأ الفصل",
  },
  install: {
    button: "تثبيت التطبيق",
    iosTitle: "التثبيت على آيفون / آيباد",
    iosBody: "اضغط على أيقونة المشاركة في شريط أدوات سفاري، ثم اختر “Add to Home Screen”.",
    gotIt: "تمام",
  },
  hero: {
    eyebrow: "فصل صوتي محلي بالكامل",
    title: "حوّل أي تراك لأربع مسارات صافية.",
    subtitle:
      "افصل الغناء والطبول والباص وباقي الآلات جوه متصفحك مباشرة. مفيش رفع لأي سيرفر — لأن مفيش حاجة بتتبعت أصلًا.",
    primaryCta: "اختر ملف",
    secondaryCta: "شوف طريقة الاستخدام",
    trust: { noUpload: "بدون رفع", onDevice: "شغال على جهازك", formats: "MP3 · WAV · M4A" },
  },
  steps: {
    title: "طريقة الاستخدام",
    items: [
      { n: "01", title: "ارفع الأغنية", body: "اختر ملف MP3 أو WAV أو M4A. الملف مش بيسيب جهازك خالص." },
      {
        n: "02",
        title: "الفصل يتم محليًا",
        body: "نموذج ذكاء اصطناعي بيشتغل جوه المتصفح، وبيفصل الغناء والطبول والباص وباقي الآلات.",
      },
      {
        n: "03",
        title: "استمع ونزّل",
        body: "شغّل كل مسار، اعمل Mute أو Solo، وصدّر ملفات WAV اللي محتاجها.",
      },
    ],
  },
  workspace: {
    eyebrow: "مساحة العمل",
    privacyNote: "صوتك بيتعالج محليًا جوه متصفحك. مفيش أي صوت بيتبعت لأي سيرفر.",
    serverNote: "وضع السرعة (Fast Mode) بيرفع صوتك لسيرفر GPU عشان يعالجه.",
    dropzone: {
      idleLabel: "اسحب الأغنية هنا",
      dragLabel: "سيب الملف عشان يبدأ الفصل",
      or: "أو",
      chooseFile: "اختر ملف",
      limits: (maxMb: number, maxMin: number) => `MP3 أو WAV أو M4A · لحد ${maxMb}MB · ${maxMin} دقيقة`,
      modelsNote: "لحد 4 نماذج ذكاء اصطناعي متخصصة (~650MB إجمالي)، بتتخزن مؤقتًا بعد أول تحميل.",
    },
    fileSummary: { changeFile: "غيّر الملف" },
    modeToggle: { onDevice: "على الجهاز", fastMode: "وضع السرعة" },
    specialists: {
      intro:
        "قفّل أي نموذج متخصص مش محتاجه — كل نموذج بتقفله يعني تحميل أقل ومرحلة معالجة أقل، فالنتيجة بتطلع أسرع.",
      vocals: "تحسين الغناء",
      vocalsHint: "شغال دايمًا — النموذج الأساسي",
      drums: "تحسين الطبول",
      bass: "تحسين الباص",
      other: "تحسين باقي الآلات",
      onlyMainNote:
        "النموذج الأساسي بس هو اللي هيشتغل — الطبول والباص وباقي الآلات هتطلع بجودة عادية مش متخصصة. أسرع خيار متاح.",
    },
    fastModeNote:
      "وضع السرعة دايمًا بيحسب الأربع مسارات بأعلى جودة متخصصة على سيرفر GPU — أسرع بكتير من المعالجة على الجهاز، مقابل رفع صوتك.",
    startButton: "ابدأ الفصل",
    progress: {
      passLabel: { main: "النموذج الأساسي", drums: "نموذج الطبول", bass: "نموذج الباص", other: "نموذج باقي الآلات" },
      passCounter: (n: number, total: number, label: string) => `المرحلة ${n} من ${total}: ${label}`,
      stage: (stage: string, passLabel: string, isMain: boolean) => {
        switch (stage) {
          case "validating":
            return "بيتأكد من الملف…";
          case "decoding":
            return "بيفك ترميز الصوت…";
          case "loading-model":
            return isMain ? "بيحمّل نموذج الذكاء الاصطناعي…" : `بيحمّل ${passLabel}…`;
          case "loading-session":
            return isMain ? "بيشغّل محرك الذكاء الاصطناعي…" : `بيشغّل ${passLabel}…`;
          case "processing":
            return isMain ? "بيفصل الغناء والطبول والباص وباقي الآلات…" : `بيحسّن ${passLabel}…`;
          case "finalizing":
            return "بيجمّع الناتج النهائي…";
          default:
            return "شغال…";
        }
      },
      modelDownloadNote: "بيجهّز محرك الفصل — التحميل ده بيتخزن مؤقتًا، فالمرات الجاية هتتخطاه.",
      chunkProgress: (current: number, total: number) => `الجزء ${current}/${total}`,
      elapsed: (elapsed: string) => `الوقت المنقضي ${elapsed}`,
      eta: (eta: string) => `المتبقي ${eta}`,
      gpu: (backend: string) => `تسريع GPU: ${backend}`,
      cancel: "إلغاء",
    },
    serverProgress: {
      stage: (stage: string): string => {
        switch (stage) {
          case "validating":
            return "بيتأكد من الملف…";
          case "uploading":
            return "بيرفع الملف…";
          case "processing":
            return "بيفصل الصوت على السيرفر…";
          case "finalizing":
            return "بيفك ترميز الناتج…";
          default:
            return "شغال…";
        }
      },
    },
    cancelled: "اتلغى.",
    newSeparation: "فصل جديد",
    useOnDeviceInstead: "استخدم المعالجة على الجهاز بدل كده",
    useFallbackInstead: "استخدم الوضع البديل (جودة أقل، مش ذكاء اصطناعي)",
    done: {
      aiBanner: "النموذج اشتغل بنجاح — الغناء والطبول والباص وباقي الآلات اتفصلوا",
      serverBanner: "وضع السرعة خلّص — الغناء والطبول والباص وباقي الآلات اتفصلوا",
      engineLine: (engine: string, model: string, elapsed: string) =>
        `المحرك: فصل صوتي بالذكاء الاصطناعي (${engine}) · النموذج: ${model} · الوقت المنقضي ${elapsed}`,
      serverEngineLine: (elapsed: string) => `المحرك: GPU على السيرفر (HT-Demucs FT) · الوقت المنقضي ${elapsed}`,
      monoWarning: "الملف ده مونو. النموذج اشتغل عادي، بس من غير معلومات ستيريو حقيقية هتقل دقة الفصل شوية.",
      failedSpecialistsWarning: (names: string, plural: boolean) =>
        `نموذج ${names} المتخصص${plural ? "ين" : ""} ما اشتغلش على جهازك — المسار ده طلع من النموذج الأساسي بدل كده (جودة عادية مش متخصصة).`,
    },
    fallback: {
      banner: "⚠ الوضع البديل: إلغاء طور صوتي (Phase Cancellation)، مش ذكاء اصطناعي. الجودة هتكون أقل بوضوح من محرك الذكاء الاصطناعي.",
      processing: "جاري المعالجة…",
      removalStrength: "قوة الإزالة",
      monoNote: "الملف ده مونو، يعني مفيش فرق ستيريو نقدر نستغله — الناتج زي الملف الأصلي بالظبط.",
      instrumentalLabel: "الموسيقى بدون غناء",
      downloadLabel: (label: string) => `نزّل ${label}`,
    },
  },
  stems: {
    label: { vocals: "الغناء", drums: "الطبول", bass: "الباص", other: "أخرى" },
    ready: "جاهز",
    mute: "كتم",
    solo: "منفرد",
    combine: "دمج",
    downloadWav: "تنزيل WAV",
    yourStems: "المسارات بتاعتك",
    downloadAll: "نزّل كل المسارات",
    combineHint: "علّم على “دمج” لمسار واحد كمان عشان تمزجهم وتحفظهم مع بعض.",
    saveCombined: "احفظ المزيج",
  },
  faq: {
    title: "الأسئلة الشائعة",
    items: [
      {
        q: "صوتي بيسيب جهازي؟",
        a: "لأ، مش في وضع المعالجة على الجهاز. نماذج الذكاء الاصطناعي بتتحمّل مرة واحدة وبتتخزن مؤقتًا في المتصفح، وبعدين كل عملية فصل بتتم محليًا — ملف الصوت بتاعك ما بيتبعتش لأي مكان خالص.",
      },
      {
        q: "إيه الصيغ والحدود المدعومة؟",
        a: "MP3 وWAV وM4A، لحد 100MB و12 دقيقة للملف الواحد. الملفات الستيريو بتديّ النموذج معلومات يمين/شمال حقيقية، فبتتفصل بدقة أعلى من الملفات المونو.",
      },
      {
        q: "الفصل بياخد وقت قد إيه؟",
        a: "بيعتمد على جهازك وعدد النماذج المتخصصة اللي شغّالها. أول مرة كمان بيتحمّل فيها النماذج (لحد ~650MB إجمالي)، وبعدين بتتخزن مؤقتًا فالمرات الجاية بتروح للمعالجة على طول.",
      },
      {
        q: "لو محرك الذكاء الاصطناعي ما اشتغلش على جهازي؟",
        a: "هيتعرض عليك وضع بديل بسيط بيستخدم إلغاء الطور الصوتي بدل الذكاء الاصطناعي. جودته أقل بوضوح، بس برضه محلي بالكامل — مفيش حاجة بتترفع.",
      },
    ],
    serverItem: {
      q: "وضع السرعة بيأثر على الخصوصية إزاي؟",
      a: "وضع السرعة بيضحي بالخصوصية عشان السرعة: صوتك بيتبعت لسيرفر GPU للمعالجة بدل ما يشتغل جوه متصفحك. استخدم وضع الجهاز لو خصوصية صوتك مهمة بالنسبالك.",
    },
  },
  footer: {
    tagline: "صوتك بيفضل ملكك.",
    privacyBody:
      "الفصل على الجهاز بيشتغل بالكامل جوه متصفحك عن طريق onnxruntime-web. ملفات النماذج بتتخزن محليًا بعد أول تحميل، وتقدر تمسحها في أي وقت من إعدادات بيانات الموقع في متصفحك — مفيش أي حاجة عن صوتك بتتخزن أو بتتبعت لسيرفر.",
    engineBody:
      "المحرك الأساسي: أربع نماذج HT-Demucs FT متخصصة (رخصة MIT)، بتشتغل بالكامل على الجهاز عن طريق onnxruntime-web — نموذج لكل مسار (الغناء، الطبول، الباص، أخرى). إلغاء الطور الصوتي بيتستخدم بس كوضع بديل لو النماذج ما قدرتش تشتغل على الجهاز.",
    nav: { howItWorks: "طريقة الاستخدام", faq: "الأسئلة الشائعة", newSeparation: "فصل جديد" },
  },
};

const dictionaries: Record<Locale, Dict> = { en, ar };

interface LocaleContextValue {
  locale: Locale;
  dir: "ltr" | "rtl";
  t: Dict;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

const STORAGE_KEY = "stem-studio-locale";

export function LocaleProvider({
  initialLocale = "ar",
  children,
}: {
  initialLocale?: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // Reads a client-only persisted preference after the SSR-safe default has
  // already painted, so server and first-paint client markup match — a
  // hydration-mismatch guard, not state derived from props/state.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === "ar" || stored === "en") setLocaleState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "ar" ? "ar" : "en";
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    document.title = locale === "ar" ? "استوديو التراكس" : "Stem Studio";
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocaleState((prev) => {
      const next = prev === "ar" ? "en" : "ar";
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      dir: locale === "ar" ? "rtl" : "ltr",
      t: dictionaries[locale],
      setLocale,
      toggleLocale,
    }),
    [locale, setLocale, toggleLocale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within a LocaleProvider");
  return ctx;
}
