const T = {
  paper: "#F2F1EA", panel: "#FBFAF5",
  ink: "#1B201D", inkSoft: "#4A5350", inkFaint: "#7C847F",
  green: "#11402F", greenDeep: "#0B2C20",
  brass: "#A87B22", brassSoft: "#C9A45A",
  line: "#DDD9CB",
  compliant: "#1F7A4D", partial: "#B8861B", gap: "#B23A2E",
  na: "#8E9088", unassessed: "#A9ADA6", sama: "#6B4516",
};

const hasArabic = (s) => /[\u0600-\u06FF]/.test(s || "");
const fontFor = (lang) => lang === "ar"
  ? "'IBM Plex Sans Arabic','IBM Plex Sans',sans-serif"
  : "'IBM Plex Sans','IBM Plex Sans Arabic',sans-serif";

/* ── i18n ───────────────────────────────────────────────────────────────── */

const STR = {
  en: {
    tagline: "Compliance command for Saudi regulated entities",
    onboardSub: "Choose the regulatory scope. Current framework versions are discovered from official sources and cached on this device.",
    orgPh: "Organization name (optional)",
    loadBtn: "Load control catalogs",
    preserveNote: "Existing assessment data is preserved when scope changes.",
    loading: "Retrieving control catalogs",
    discovering: "Verifying current versions from official sources",
    loadFail: "Catalog retrieval failed",
    loadHint: "steps · official-source discovery, then parallel fetch",
    retryDomains: "Retry failed steps",
    preparing: "Preparing…",
    orgFallback: "Your organization",
    countsLine: "{t} controls · {c} compliant · {g} gaps",
    overdueN: "{n} overdue remediations",
    assessRemaining: "Assess {n} remaining",
    overall: "Overall",
    applicable: "{n} applicable controls",
    gapsUn: "{g} gaps · {u} unassessed",
    singleScope: "Single-framework scope. Add the second framework in Settings to compare posture side by side.",
    trendHint: "Snapshots are recorded automatically as statuses change. The trend appears after the second snapshot.",
    activityEmpty: "Status changes will appear here with a full audit trail.",
    gapsEmpty: "No controls are marked non-compliant. Mark statuses in the Controls register to populate this list.",
    viewAll: "View all →",
    due: "due {d}",
    regCount: "{x} of {y} controls",
    regHint: "Click a control to open its evidence record. Use \"Set all\" to bulk-mark a subdomain.",
    searchPh: "Search ID, title, subdomain…",
    allFw: "All frameworks", allSt: "All statuses",
    setAll: "Set all…",
    noMatch: "No controls match these filters. Clear the search or widen the status filter.",
    riskTitle: "Risk heatmap",
    riskFormula: "Risk = gaps ×1.0, partials ×0.5, unassessed ×0.35, normalized per subdomain. Hottest first.",
    gapsOf: "{g} gaps / {n} controls",
    heatTags: ["Critical exposure", "Elevated", "Managed", "Controlled"],
    advTitle: "Ask, or attach evidence",
    advEmpty: "Ask for implementation guidance, acceptable evidence, gap remediation plans, or NCA↔SAMA mapping — in English or Arabic; replies follow your language. Attach a PDF, image, or text file and Burhan will analyze it as evidence, link it to matching controls, and surface it on the dashboard.",
    advSuggestions: [
      "Evidence checklist for identity & access management",
      "ما الأدلة المطلوبة لإثبات الالتزام بضوابط النسخ الاحتياطي؟",
      "90-day remediation plan for my top gaps",
    ],
    inputPh: "Write in English or Arabic, or attach evidence…",
    thinking: "Drafting guidance…",
    analyzing: "Analyzing evidence…",
    clearThread: "Clear thread",
    ground: "Ground in my assessment data",
    groundTip: "Sends your live posture summary (scores and top gaps) with each question.",
    copied: "Copied",
    regen: "Regenerate",
    retry: "Retry",
    advFail: "Request failed — check connectivity and retry.",
    attach: "Attach evidence file",
    fileTooBig: "File too large (max 4 MB)",
    fileType: "Unsupported type — PDF, PNG, JPG, TXT, CSV, MD",
    linkedTo: "Linked to {n} controls",
    noLinks: "No matching controls identified — stored as unlinked evidence",
    evQuality: { strong: "Strong", adequate: "Adequate", weak: "Weak" },
    status: "Status", owner: "Owner", dueLbl: "Due", evidenceLbl: "Evidence / notes",
    ownerPh: "e.g. IT Security",
    notePh: "Evidence references, audit findings, remediation notes…",
    saveAssess: "Save assessment",
    guidanceLbl: "AI implementation guidance",
    guidanceHint: "Generates steps and auditor-acceptable evidence for this control. Cached after first run.",
    generate: "Generate",
    openAdvisor: "Open in advisor for follow-up →",
    historyLbl: "Change history",
    linkedEvidence: "Linked evidence",
    maturityLbl: "Maturity (SAMA 0–5)",
    maturityNone: "Not rated",
    pendingBadge: "Pending approval",
    rejectedBadge: "Rejected",
    settingsTitle: "Scope & data",
    scopeLbl: "Regulatory scope", activeLbl: "Active",
    changeFw: "Change frameworks",
    cacheLbl: "Catalog cache", notLoaded: "not loaded",
    cachedAt: "{v} · cached {d} · {n} controls",
    refetch: "Re-fetch catalogs from official sources",
    refetchNote: "Assessments, evidence, audit trail, and snapshots are preserved on refresh.",
    auditData: "Audit & data", auditN: "{n} audit entries recorded.",
    diagTitle: "Diagnostics",
    diagRun: "Run self-tests", diagRunning: "Running…",
    diagHint: "Verifies the live stack from inside the app: persistent storage, the Anthropic API, official-source web search, the JSON repair parser, and cached catalog integrity.",
    diagStorage: "Persistent storage round-trip",
    diagApi: "Anthropic API connectivity",
    diagApiSearch: "Official-source web search (nca.gov.sa)",
    diagParser: "JSON repair parser",
    diagCatalog: "Catalog integrity (IDs, version, Arabic)",
    resetBtn: "Reset all data…",
    resetConfirm: "Deletes users, assessments, evidence, audit, snapshots, and caches. Sure?",
    yesReset: "Yes, reset", cancel: "Cancel",
    langBtn: "العربية",
    toastSaved: "Assessment saved",
    toastPending: "Submitted for approval",
    toastCsv: "CSV exported", toastJson: "JSON exported",
    toastCat: "Catalogs ready and cached",
    toastBulk: "{n} controls set to {s}",
    toastEv: "Evidence stored",
    toastImport: "{a} imported · {k} skipped",
    toastReport: "Report downloaded",
    toastUser: "User saved",
    toastApproved: "Approved", toastRejected: "Rejected and reverted",
    railNote: "Official-source catalogs, cached locally.",
    statusLabels: { compliant: "Compliant", partial: "Partially compliant", gap: "Non-compliant", na: "Not applicable", unassessed: "Not assessed" },
    nav: { dash: "Dashboard", controls: "Controls", risk: "Risk", evidence: "Evidence", approvals: "Approvals", advisor: "Advisor", users: "Users", settings: "Settings" },
    roles: { admin: "Administrator", manager: "Manager", assessor: "Assessor", viewer: "Viewer" },
    firstRunTitle: "Create the administrator account",
    firstRunSub: "Burhan stores its user database in this device's persistent storage with salted password hashes. The first account is the administrator.",
    signIn: "Sign in", signOut: "Sign out",
    nameLbl: "Full name", emailLbl: "Email", pwLbl: "Password", pw2Lbl: "Confirm password",
    createAdmin: "Create administrator",
    pwMismatch: "Passwords do not match", pwShort: "Password must be at least 8 characters",
    wrongCreds: "Invalid email or password", userInactive: "Account is deactivated",
    welcomeBack: "Sign in to continue",
    usersTitle: "User management",
    addUser: "Add user",
    roleLbl: "Role",
    active: "Active", inactive: "Deactivated",
    deactivate: "Deactivate", activate: "Activate",
    resetPw: "Set new password",
    you: "you",
    lastSeen: "created {d}",
    permDenied: "Your role does not permit this action",
    roViewer: "Read-only role — statuses are locked",
    approvalsTitle: "Approval queue",
    noPending: "No changes awaiting approval.",
    approve: "Approve", reject: "Reject & revert",
    pendingBy: "by {u}",
    fromTo: "{a} → {b}",
    evidenceTitle: "Evidence registry",
    evidenceEmpty: "No evidence yet. Attach files in the Advisor chat and they will be analyzed, linked to controls, and listed here.",
    evidenceCoverage: "Evidence coverage",
    evCoverageSub: "{p}% of compliant/partial controls have linked evidence",
    evByType: "Evidence by type",
    recentEv: "Recent evidence",
    notRetained: "Original file is analyzed, not retained — only the AI summary, quality grade, and control links are stored.",
    unlink: "Unlink", deleteEv: "Delete",
    importBtn: "Import CSV",
    importTitle: "Bulk import assessments",
    importHint: "CSV with header row. Required column: control_id. Optional: status, owner, due, evidence_note. Status accepts English or Arabic labels, or keys (compliant/partial/gap/na/unassessed). Matching is against official control IDs of the loaded catalogs.",
    chooseFile: "Choose CSV file",
    previewN: "{n} rows parsed · {m} match loaded controls",
    applyImport: "Apply import",
    badCsv: "Could not parse CSV",
    reportBtn: "Executive report",
    avgMaturity: "Avg maturity {m}/5",
    maturityCard: "SAMA maturity",
  },
  ar: {
    tagline: "منصة قيادة الامتثال للجهات الخاضعة للتنظيم في السعودية",
    onboardSub: "اختر النطاق التنظيمي. تُكتشف الإصدارات الحالية من المصادر الرسمية وتُخزَّن محليًا على هذا الجهاز.",
    orgPh: "اسم المنشأة (اختياري)",
    loadBtn: "تحميل كتالوجات الضوابط",
    preserveNote: "تُحفظ بيانات التقييم الحالية عند تغيير النطاق.",
    loading: "جارٍ جلب كتالوجات الضوابط",
    discovering: "جارٍ التحقق من الإصدارات الحالية من المصادر الرسمية",
    loadFail: "فشل جلب الكتالوجات",
    loadHint: "خطوات · اكتشاف من المصدر الرسمي ثم جلب متوازٍ",
    retryDomains: "إعادة محاولة الخطوات المتعثرة",
    preparing: "جارٍ التحضير…",
    orgFallback: "منشأتك",
    countsLine: "{t} ضابطًا · {c} ملتزم · {g} فجوات",
    overdueN: "{n} معالجات متأخرة",
    assessRemaining: "قيّم {n} المتبقية",
    overall: "الإجمالي",
    applicable: "{n} ضابطًا منطبقًا",
    gapsUn: "{g} فجوات · {u} لم تُقيَّم",
    singleScope: "النطاق يقتصر على إطار واحد. أضف الإطار الثاني من الإعدادات لمقارنة الجاهزية.",
    trendHint: "تُسجَّل اللقطات تلقائيًا عند تغيُّر الحالات. يظهر المسار بعد اللقطة الثانية.",
    activityEmpty: "ستظهر تغييرات الحالات هنا مع سجل تدقيق كامل.",
    gapsEmpty: "لا توجد ضوابط غير ملتزمة حاليًا. حدّد الحالات في سجل الضوابط لتعبئة هذه القائمة.",
    viewAll: "عرض الكل ←",
    due: "الاستحقاق {d}",
    regCount: "{x} من {y} ضابطًا",
    regHint: "انقر أي ضابط لفتح سجل الأدلة. استخدم «تعيين الكل» لتحديد حالة نطاق فرعي كامل.",
    searchPh: "ابحث بالمعرّف أو العنوان أو النطاق الفرعي…",
    allFw: "كل الأطر", allSt: "كل الحالات",
    setAll: "تعيين الكل…",
    noMatch: "لا توجد ضوابط مطابقة. امسح البحث أو وسّع مرشح الحالة.",
    riskTitle: "خريطة المخاطر",
    riskFormula: "المخاطر = الفجوات ×١٫٠ + الجزئي ×٠٫٥ + غير المُقيَّم ×٠٫٣٥، معيارية لكل نطاق فرعي. الأعلى أولًا.",
    gapsOf: "{g} فجوات / {n} ضابطًا",
    heatTags: ["تعرّض حرج", "مرتفع", "مُدار", "مضبوط"],
    advTitle: "اسأل أو أرفق دليلًا",
    advEmpty: "اطلب إرشادات التنفيذ، أو الأدلة المقبولة، أو خطط معالجة الفجوات، أو مواءمة NCA↔SAMA — بالعربية أو الإنجليزية؛ يجيب المستشار بلغة سؤالك. أرفق ملف PDF أو صورة أو ملفًا نصيًا وسيحلله «برهان» كدليل، ويربطه بالضوابط المطابقة، ويعرضه في اللوحة.",
    advSuggestions: [
      "ما الأدلة المطلوبة لضوابط إدارة الهويات والصلاحيات؟",
      "خطة معالجة لأهم الفجوات خلال ٩٠ يومًا",
      "Map ECC 2-9 to SAMA CSF equivalents",
    ],
    inputPh: "اكتب بالعربية أو الإنجليزية، أو أرفق دليلًا…",
    thinking: "جارٍ إعداد الإرشادات…",
    analyzing: "جارٍ تحليل الدليل…",
    clearThread: "مسح المحادثة",
    ground: "الاستناد إلى بيانات التقييم",
    groundTip: "يُرسل ملخص الجاهزية الحي (النتائج وأهم الفجوات) مع كل سؤال.",
    copied: "تم النسخ",
    regen: "إعادة التوليد",
    retry: "إعادة المحاولة",
    advFail: "تعذّر الطلب — تحقق من الاتصال وأعد المحاولة.",
    attach: "إرفاق ملف دليل",
    fileTooBig: "الملف كبير جدًا (الحد ٤ م.ب)",
    fileType: "نوع غير مدعوم — PDF أو PNG أو JPG أو TXT أو CSV أو MD",
    linkedTo: "رُبط بـ {n} من الضوابط",
    noLinks: "لم تُحدَّد ضوابط مطابقة — حُفظ كدليل غير مرتبط",
    evQuality: { strong: "قوي", adequate: "مقبول", weak: "ضعيف" },
    status: "الحالة", owner: "المسؤول", dueLbl: "الاستحقاق", evidenceLbl: "الأدلة / الملاحظات",
    ownerPh: "مثال: أمن تقنية المعلومات",
    notePh: "مراجع الأدلة، ملاحظات التدقيق، خطط المعالجة…",
    saveAssess: "حفظ التقييم",
    guidanceLbl: "إرشادات التنفيذ بالذكاء الاصطناعي",
    guidanceHint: "يولّد خطوات التنفيذ والأدلة المقبولة لدى المدقق. تُخزَّن بعد أول توليد.",
    generate: "توليد",
    openAdvisor: "فتح في المستشار للمتابعة ←",
    historyLbl: "سجل التغييرات",
    linkedEvidence: "الأدلة المرتبطة",
    maturityLbl: "النضج (SAMA ٠–٥)",
    maturityNone: "غير مُقيَّم",
    pendingBadge: "بانتظار الاعتماد",
    rejectedBadge: "مرفوض",
    settingsTitle: "النطاق والبيانات",
    scopeLbl: "النطاق التنظيمي", activeLbl: "النشط",
    changeFw: "تغيير الأطر",
    cacheLbl: "ذاكرة الكتالوجات", notLoaded: "غير محمّل",
    cachedAt: "{v} · خُزِّن {d} · {n} ضابطًا",
    refetch: "إعادة الجلب من المصادر الرسمية",
    refetchNote: "تُحفظ التقييمات والأدلة وسجل التدقيق واللقطات عند إعادة الجلب.",
    auditData: "التدقيق والبيانات", auditN: "{n} قيدًا في سجل التدقيق.",
    diagTitle: "الفحص الذاتي",
    diagRun: "تشغيل الاختبارات", diagRunning: "جارٍ التشغيل…",
    diagHint: "يتحقق من المنظومة الحية من داخل التطبيق: التخزين الدائم، واجهة Anthropic البرمجية، البحث في المصادر الرسمية، محلل إصلاح JSON، وسلامة الكتالوجات المخزَّنة.",
    diagStorage: "اختبار التخزين الدائم",
    diagApi: "الاتصال بواجهة Anthropic",
    diagApiSearch: "البحث في المصدر الرسمي (nca.gov.sa)",
    diagParser: "محلل إصلاح JSON",
    diagCatalog: "سلامة الكتالوج (المعرّفات، الإصدار، العربية)",
    resetBtn: "إعادة تعيين كل البيانات…",
    resetConfirm: "سيحذف المستخدمين والتقييمات والأدلة والتدقيق واللقطات والذاكرة المؤقتة. متأكد؟",
    yesReset: "نعم، أعد التعيين", cancel: "إلغاء",
    langBtn: "English",
    toastSaved: "تم حفظ التقييم",
    toastPending: "أُرسل للاعتماد",
    toastCsv: "تم تصدير CSV", toastJson: "تم تصدير JSON",
    toastCat: "الكتالوجات جاهزة ومخزَّنة",
    toastBulk: "تم تعيين {n} ضابطًا إلى {s}",
    toastEv: "تم حفظ الدليل",
    toastImport: "استيراد {a} · تخطّي {k}",
    toastReport: "تم تنزيل التقرير",
    toastUser: "تم حفظ المستخدم",
    toastApproved: "تم الاعتماد", toastRejected: "رُفض وأُعيدت الحالة",
    railNote: "كتالوجات من المصادر الرسمية، مخزَّنة محليًا.",
    statusLabels: { compliant: "ملتزم", partial: "التزام جزئي", gap: "غير ملتزم", na: "لا ينطبق", unassessed: "لم يُقيَّم" },
    nav: { dash: "اللوحة", controls: "الضوابط", risk: "المخاطر", evidence: "الأدلة", approvals: "الاعتمادات", advisor: "المستشار", users: "المستخدمون", settings: "الإعدادات" },
    roles: { admin: "مدير النظام", manager: "مدير", assessor: "مُقيِّم", viewer: "مُطّلع" },
    firstRunTitle: "إنشاء حساب مدير النظام",
    firstRunSub: "يخزّن «برهان» قاعدة المستخدمين في التخزين الدائم لهذا الجهاز مع تجزئة كلمات المرور المُملّحة. الحساب الأول هو مدير النظام.",
    signIn: "تسجيل الدخول", signOut: "تسجيل الخروج",
    nameLbl: "الاسم الكامل", emailLbl: "البريد الإلكتروني", pwLbl: "كلمة المرور", pw2Lbl: "تأكيد كلمة المرور",
    createAdmin: "إنشاء مدير النظام",
    pwMismatch: "كلمتا المرور غير متطابقتين", pwShort: "كلمة المرور ٨ أحرف على الأقل",
    wrongCreds: "بريد أو كلمة مرور غير صحيحة", userInactive: "الحساب موقوف",
    welcomeBack: "سجّل الدخول للمتابعة",
    usersTitle: "إدارة المستخدمين",
    addUser: "إضافة مستخدم",
    roleLbl: "الدور",
    active: "نشط", inactive: "موقوف",
    deactivate: "إيقاف", activate: "تفعيل",
    resetPw: "تعيين كلمة مرور جديدة",
    you: "أنت",
    lastSeen: "أُنشئ {d}",
    permDenied: "دورك لا يسمح بهذا الإجراء",
    roViewer: "دور للاطلاع فقط — الحالات مقفلة",
    approvalsTitle: "قائمة الاعتمادات",
    noPending: "لا توجد تغييرات بانتظار الاعتماد.",
    approve: "اعتماد", reject: "رفض وإرجاع",
    pendingBy: "بواسطة {u}",
    fromTo: "{a} ← {b}",
    evidenceTitle: "سجل الأدلة",
    evidenceEmpty: "لا توجد أدلة بعد. أرفق الملفات في محادثة المستشار وسيتم تحليلها وربطها بالضوابط وعرضها هنا.",
    evidenceCoverage: "تغطية الأدلة",
    evCoverageSub: "{p}% من الضوابط الملتزمة/الجزئية لها أدلة مرتبطة",
    evByType: "الأدلة حسب النوع",
    recentEv: "أحدث الأدلة",
    notRetained: "يُحلَّل الملف الأصلي ولا يُحتفظ به — تُخزَّن فقط خلاصة الذكاء الاصطناعي ودرجة الجودة وروابط الضوابط.",
    unlink: "فك الربط", deleteEv: "حذف",
    importBtn: "استيراد CSV",
    importTitle: "استيراد التقييمات دفعة واحدة",
    importHint: "ملف CSV بصف عناوين. العمود المطلوب: control_id. اختياري: status, owner, due, evidence_note. تُقبل حالات بالعربية أو الإنجليزية أو بالمفاتيح (compliant/partial/gap/na/unassessed). تتم المطابقة مع المعرّفات الرسمية للكتالوجات المحمّلة.",
    chooseFile: "اختر ملف CSV",
    previewN: "حُلِّل {n} صفًا · {m} يطابق الضوابط المحمّلة",
    applyImport: "تطبيق الاستيراد",
    badCsv: "تعذّر تحليل CSV",
    reportBtn: "التقرير التنفيذي",
    avgMaturity: "متوسط النضج {m}/٥",
    maturityCard: "نضج SAMA",
  },
};

const tt = (lang, key, vars) => {
  let s = (STR[lang] || STR.en)[key];
  if (s === undefined) s = STR.en[key];
  if (s === undefined) return key;
  if (vars && typeof s === "string") for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
};
const stLabel = (lang, k) => (STR[lang] || STR.en).statusLabels[k] || STR.en.statusLabels[k] || k;

/* Framework identity. Versions and domain structures are NOT trusted from
   here at runtime — they are discovered from official sources. Fallbacks
   reflect verified current structures (ECC-2:2024; SAMA CSF v1.0/2017). */
const FRAMEWORKS = {
  ncaecc: {
    key: "ncaecc", short: "NCA ECC",
    name: "Essential Cybersecurity Controls", nameAr: "الضوابط الأساسية للأمن السيبراني",
    regulator: "National Cybersecurity Authority", regulatorAr: "الهيئة الوطنية للأمن السيبراني",
    officialSource: "nca.gov.sa", accent: "#11402F",
    fallbackVersion: "ECC-2:2024",
    fallbackDomains: [
      { n: 1, en: "Cybersecurity Governance", ar: "حوكمة الأمن السيبراني" },
      { n: 2, en: "Cybersecurity Defence", ar: "تعزيز الأمن السيبراني" },
      { n: 3, en: "Cybersecurity Resilience", ar: "صمود الأمن السيبراني" },
      { n: 4, en: "Third-Party & Cloud Computing Cybersecurity", ar: "الأمن السيبراني المتعلق بالأطراف الخارجية والحوسبة السحابية" },
    ],
  },
  samacsf: {
    key: "samacsf", short: "SAMA CSF",
    name: "Cyber Security Framework", nameAr: "إطار الأمن السيبراني",
    regulator: "Saudi Central Bank (SAMA)", regulatorAr: "البنك المركزي السعودي",
    officialSource: "rulebook.sama.gov.sa", accent: "#6B4516",
    fallbackVersion: "v1.0 (May 2017)",
    fallbackDomains: [
      { n: 1, en: "Cyber Security Leadership & Governance", ar: "قيادة وحوكمة الأمن السيبراني" },
      { n: 2, en: "Cyber Security Risk Management & Compliance", ar: "إدارة مخاطر الأمن السيبراني والالتزام" },
      { n: 3, en: "Cyber Security Operations & Technology", ar: "عمليات وتقنية الأمن السيبراني" },
      { n: 4, en: "Third Party Cyber Security", ar: "الأمن السيبراني للأطراف الخارجية" },
    ],
  },
};

/* ── RBAC ──────────────────────────────────────────────────────────────── */

const PERMS = ["manageUsers", "manageScope", "resetData", "refetch", "assess", "approve", "bulk", "importData", "evidence", "advisor", "exportData", "diagnostics"];
const ROLE_MATRIX = {
  admin:    { manageUsers: 1, manageScope: 1, resetData: 1, refetch: 1, assess: 1, approve: 1, bulk: 1, importData: 1, evidence: 1, advisor: 1, exportData: 1, diagnostics: 1 },
  manager:  { manageUsers: 0, manageScope: 0, resetData: 0, refetch: 1, assess: 1, approve: 1, bulk: 1, importData: 1, evidence: 1, advisor: 1, exportData: 1, diagnostics: 1 },
  assessor: { manageUsers: 0, manageScope: 0, resetData: 0, refetch: 0, assess: 1, approve: 0, bulk: 1, importData: 0, evidence: 1, advisor: 1, exportData: 1, diagnostics: 0 },
  viewer:   { manageUsers: 0, manageScope: 0, resetData: 0, refetch: 0, assess: 0, approve: 0, bulk: 0, importData: 0, evidence: 0, advisor: 1, exportData: 0, diagnostics: 0 },
};
const ROLES = Object.keys(ROLE_MATRIX);
const can = (role, perm) => !!(ROLE_MATRIX[role] && ROLE_MATRIX[role][perm]);

/* ── Auth: salted SHA-256 via WebCrypto ────────────────────────────────── */

function randomSalt() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function verifyPassword(password, salt, hash) {
  return (await hashPassword(password, salt)) === hash;
}
const normEmail = (e) => String(e || "").trim().toLowerCase();

/* ── Tolerant JSON: strips fences/preamble, repairs truncated tails. ───── */
/* Last-resort repair: drop a trailing partial string / dangling key, then
   close every bracket still open. Covers truncations with no close chars. */
function repairTail(s) {
  let inStr = false, esc = false, strStart = -1;
  const open = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') { if (!inStr) { inStr = true; strStart = i; } else inStr = false; continue; }
    if (inStr) continue;
    if (c === "{") open.push("}");
    else if (c === "[") open.push("]");
    else if (c === "}" || c === "]") open.pop();
  }
  let cut = (inStr ? s.slice(0, strStart) : s).replace(/\s+$/, "");
  cut = cut.replace(/,?\s*"(?:[^"\\]|\\.)*"\s*:\s*$/, ""); // dangling "key":
  cut = cut.replace(/,\s*$/, "");
  for (let i = open.length - 1; i >= 0; i--) cut += open[i];
  return cut;
}

function parseLooseJSON(text) {
  let s = String(text || "").replace(/```json|```/g, "").trim();
  const io = s.indexOf("{"), ia = s.indexOf("[");
  const start = io >= 0 && (ia < 0 || io < ia) ? io : ia;
  if (start > 0) s = s.slice(start);
  if (start < 0) throw new Error("No JSON found");
  try { return JSON.parse(s); } catch {}
  let inStr = false, esc = false, depth = 0, lastGood = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{" || c === "[") depth++;
    if (c === "}" || c === "]") { depth--; lastGood = i; }
  }
  if (lastGood > 0) {
    let cut = s.slice(0, lastGood + 1);
    const open = []; let str = false, e2 = false;
    for (let i = 0; i < cut.length; i++) {
      const c = cut[i];
      if (e2) { e2 = false; continue; }
      if (c === "\\") { e2 = true; continue; }
      if (c === '"') { str = !str; continue; }
      if (str) continue;
      if (c === "{") open.push("}");
      if (c === "[") open.push("]");
      if (c === "}" || c === "]") open.pop();
    }
    while (open.length) cut += open.pop();
    try { return JSON.parse(cut); } catch {}
  }
  try { return JSON.parse(repairTail(s)); } catch {}
  throw new Error("Unparseable JSON from API");
}

/* ── Catalog prompts (official-source discovery) ───────────────────────── */

function metaPrompt(fwKey) {
  const fw = FRAMEWORKS[fwKey];
  return `State the official published version designation of the ${fw.regulator} "${fw.name}" (${fw.short}) and its main domain structure, per the official source ${fw.officialSource}.
Respond with ONLY minified JSON, no prose, no citations, no markdown, schema:
{"version":"official version designation, e.g. ECC-2:2024","domains":[{"n":1,"en":"domain name","ar":"الاسم الرسمي بالعربية"}]}
List ALL main domains in official order.`;
}

function catalogPrompt(fwKey, domain, version) {
  const fw = FRAMEWORKS[fwKey];
  const idHint = fwKey === "ncaecc" ? `${domain.n}-1` : `3.${domain.n}.1`;
  const cidHint = fwKey === "ncaecc" ? `${domain.n}-1-1` : `3.${domain.n}.1.a`;
  return `You are an expert on ${fw.regulator} ${fw.short} ${version}, per the official source ${fw.officialSource}. Give the official structure of Main Domain ${domain.n} ("${domain.en}") in ${version}: its subdomains and controls with official numbering.
Respond with ONLY minified JSON, no prose, no citations, no markdown, schema:
{"subdomains":[{"id":"${idHint}","en":"subdomain name","ar":"الاسم الرسمي بالعربية","controls":[{"id":"${cidHint}","t":"control title, max 9 words"}]}]}
Cover ALL subdomains of this domain in ${version}. Keep output under 900 tokens; compress titles if needed.`;
}

/* Evidence analysis prompt — attached file goes alongside this text. */
function evidencePrompt(selected, version) {
  const scope = selected.map((f) => `${FRAMEWORKS[f].short} ${(version && version[f]) || ""}`.trim()).join(" and ");
  return `You are a Saudi GRC auditor. The attached file is candidate compliance evidence for ${scope}.
Analyze it and respond with ONLY minified JSON, no prose, no markdown, schema:
{"summary":"what this document evidences, max 60 words","quality":"strong|adequate|weak","control_ids":["official control IDs this file evidences, e.g. 1-3-1 or 3.3.5","..."],"doc_type":"policy|log|report|config|screenshot|minutes|certificate|other"}
Only include control IDs you are confident the document actually evidences (max 8). Use official numbering of the frameworks above.`;
}

/* ── Concurrency pool ──────────────────────────────────────────────────── */
async function runPool(tasks, n = 3) {
  let i = 0;
  const workers = Array(Math.min(n, tasks.length)).fill(0).map(async () => {
    while (i < tasks.length) { const idx = i++; await tasks[idx](); }
  });
  await Promise.all(workers);
}

/* ── Normalizers ───────────────────────────────────────────────────────── */

function normalizeMeta(parsed, fwKey) {
  const fw = FRAMEWORKS[fwKey];
  const domains = Array.isArray(parsed?.domains)
    ? parsed.domains
        .filter((d) => d && Number.isFinite(Number(d.n)) && d.en)
        .map((d) => ({ n: Number(d.n), en: String(d.en).slice(0, 90), ar: String(d.ar || "").slice(0, 90) }))
        .sort((a, b) => a.n - b.n)
    : [];
  const version = typeof parsed?.version === "string" && parsed.version.trim()
    ? parsed.version.trim().slice(0, 40) : null;
  if (!version || domains.length < 2 || domains.length > 8) return null;
  return { version, domains, source: fw.officialSource };
}

function normalizeDomain(parsed, d) {
  return {
    n: d.n, en: d.en, ar: d.ar || "",
    subdomains: (parsed.subdomains || [])
      .filter((s) => s && s.id && Array.isArray(s.controls) && s.controls.length)
      .map((s) => ({
        id: String(s.id), en: String(s.en || "").slice(0, 90), ar: String(s.ar || "").slice(0, 90),
        controls: s.controls.filter((c) => c && c.id && c.t)
          .map((c) => ({ id: String(c.id), t: String(c.t).slice(0, 140) })),
      })),
  };
}

/* Evidence normalization: keep only control IDs that exist in loaded catalogs. */
function normalizeEvidence(parsed, validKeysByFw, file, userName) {
  const q = ["strong", "adequate", "weak"].includes(parsed?.quality) ? parsed.quality : "adequate";
  const ids = Array.isArray(parsed?.control_ids) ? parsed.control_ids.map(String).slice(0, 12) : [];
  const keys = [];
  for (const id of ids) {
    for (const fw of Object.keys(validKeysByFw)) {
      const key = `${fw}:${id.replace(/^(ECC|CSF|SAMA)\s*/i, "").trim()}`;
      if (validKeysByFw[fw].has(key)) keys.push(key);
    }
  }
  return {
    id: `ev_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    name: String(file.name || "file").slice(0, 120),
    fileType: file.kind, size: file.size || 0,
    docType: ["policy", "log", "report", "config", "screenshot", "minutes", "certificate", "other"].includes(parsed?.doc_type) ? parsed.doc_type : "other",
    summary: String(parsed?.summary || "").slice(0, 500),
    quality: q,
    controls: [...new Set(keys)],
    by: userName, t: Date.now(),
  };
}

/* ── CSV: parse + bulk import ──────────────────────────────────────────── */

function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  const src = String(text || "").replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQ) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.length > 1 || row[0] !== "") rows.push(row); }
  return rows;
}

function statusFromLabel(raw) {
  const v = String(raw || "").trim().toLowerCase();
  if (!v) return null;
  for (const k of ["compliant", "partial", "gap", "na", "unassessed"]) {
    if (v === k) return k;
    if (STR.en.statusLabels[k].toLowerCase() === v) return k;
    if (STR.ar.statusLabels[k] === raw.trim()) return k;
  }
  if (v === "non-compliant" || v === "noncompliant" || v === "non compliant") return "gap";
  if (v === "partially compliant" || v === "partial compliance") return "partial";
  if (v === "not applicable" || v === "n/a") return "na";
  if (v === "not assessed") return "unassessed";
  return null;
}

/* Map parsed CSV rows to assessment updates against loaded catalogs. */
function buildImport(rows, keysByCid) {
  if (!rows.length) return { updates: [], skipped: 0, matched: 0 };
  const header = rows[0].map((h) => String(h).trim().toLowerCase());
  const col = (n) => header.indexOf(n);
  const iCid = col("control_id");
  if (iCid < 0) return { updates: [], skipped: rows.length - 1, matched: 0, error: "missing control_id column" };
  const iSt = col("status"), iOw = col("owner"), iDue = col("due"), iNote = col("evidence_note");
  const updates = [];
  let skipped = 0;
  for (let r = 1; r < rows.length; r++) {
    const cid = String(rows[r][iCid] || "").trim();
    const keys = keysByCid.get(cid);
    if (!cid || !keys || !keys.length) { skipped++; continue; }
    const st = iSt >= 0 ? statusFromLabel(rows[r][iSt]) : null;
    const upd = {
      s: st || undefined,
      owner: iOw >= 0 ? String(rows[r][iOw] || "").trim() || undefined : undefined,
      due: iDue >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(String(rows[r][iDue] || "").trim()) ? String(rows[r][iDue]).trim() : undefined,
      note: iNote >= 0 ? String(rows[r][iNote] || "").trim() || undefined : undefined,
    };
    if (upd.s === undefined && upd.owner === undefined && upd.due === undefined && upd.note === undefined) { skipped++; continue; }
    for (const key of keys) updates.push({ key, ...upd });
  }
  return { updates, skipped, matched: updates.length };
}

/* ── Approval workflow transitions ─────────────────────────────────────── */
/* Assessor changes carry review:"pending" + prevS (for revert). Manager/admin
   changes are auto-approved. */
function makeRecord(prev, patch, actor) {
  const auto = can(actor.role, "approve");
  const next = { ...(prev || {}), ...patch, t: Date.now(), byId: actor.id, by: actor.name };
  if (patch.s !== undefined && patch.s !== (prev?.s || "unassessed") && !auto) {
    next.review = "pending";
    next.prevS = prev?.s || "unassessed";
  } else if (auto) {
    next.review = "approved";
    delete next.prevS;
  }
  return next;
}
function approveRecord(rec, approver) {
  const n = { ...rec, review: "approved", reviewBy: approver.name, reviewT: Date.now() };
  delete n.prevS;
  return n;
}
function rejectRecord(rec, approver) {
  return { ...rec, s: rec.prevS || "unassessed", review: "rejected", reviewBy: approver.name, reviewT: Date.now(), prevS: undefined };
}

/* ── Metrics ───────────────────────────────────────────────────────────── */

function flattenControls(catalogs, selected) {
  const rows = [];
  for (const fwKey of selected) {
    const cat = catalogs[fwKey];
    if (!cat) continue;
    for (const d of cat.domains)
      for (const sd of d.subdomains)
        for (const c of sd.controls)
          rows.push({ fw: fwKey, domainN: d.n, domain: d.en, domainAr: d.ar, sub: sd, control: c, key: `${fwKey}:${c.id}` });
  }
  return rows;
}

function scoreOf(rows, assess) {
  let pts = 0, denom = 0;
  const counts = { compliant: 0, partial: 0, gap: 0, na: 0, unassessed: 0 };
  for (const r of rows) {
    const st = (assess[r.key] && assess[r.key].s) || "unassessed";
    counts[st] = (counts[st] || 0) + 1;
    if (st === "na") continue;
    denom++;
    if (st === "compliant") pts += 1;
    else if (st === "partial") pts += 0.5;
  }
  return { pct: denom ? Math.round((pts / denom) * 100) : 0, counts, total: rows.length, denom };
}

/* Evidence coverage: share of compliant/partial controls with ≥1 linked item. */
function evidenceCoverage(rows, assess, evidence) {
  const linked = new Set();
  for (const ev of Object.values(evidence)) for (const k of ev.controls || []) linked.add(k);
  let need = 0, have = 0;
  for (const r of rows) {
    const st = assess[r.key]?.s;
    if (st === "compliant" || st === "partial") { need++; if (linked.has(r.key)) have++; }
  }
  return { pct: need ? Math.round((have / need) * 100) : 0, need, have, linkedTotal: linked.size };
}

function avgMaturity(rows, assess) {
  let sum = 0, n = 0;
  for (const r of rows) {
    const m = assess[r.key]?.m;
    if (Number.isFinite(m)) { sum += m; n++; }
  }
  return n ? Math.round((sum / n) * 10) / 10 : null;
}

function buildPostureSummary(allRows, assess, selected, versions) {
  if (!allRows.length) return "";
  const overall = scoreOf(allRows, assess);
  const fwLines = selected.map((f) => {
    const s = scoreOf(allRows.filter((r) => r.fw === f), assess);
    const short = (FRAMEWORKS[f] && FRAMEWORKS[f].short) || f;
    return `${short} ${(versions && versions[f]) || ""}: ${s.pct}% (${s.counts.gap} gaps, ${s.counts.partial} partial, ${s.counts.unassessed} unassessed)`;
  });
  const gaps = allRows.filter((r) => assess[r.key] && assess[r.key].s === "gap").slice(0, 6)
    .map((r) => `${r.control.id} "${r.control.t.slice(0, 55)}"`);
  return [
    `Overall posture ${overall.pct}% across ${overall.total} controls.`,
    ...fwLines,
    gaps.length ? `Top open gaps: ${gaps.join("; ")}.` : "No controls currently marked non-compliant.",
  ].join("\n");
}

/* ── CSV export lines (BOM so Arabic opens correctly in Excel) ─────────── */
function csvLines(rows, assess, label) {
  const esc = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const head = ["framework", "control_id", "title", "domain", "subdomain_en", "subdomain_ar", "status", "owner", "due", "evidence_note", "maturity", "review", "last_updated_by", "last_updated"];
  const lines = ["\uFEFF" + head.join(",")];
  for (const r of rows) {
    const a = assess[r.key] || {};
    lines.push([
      (FRAMEWORKS[r.fw] && FRAMEWORKS[r.fw].short) || r.fw, r.control.id, r.control.t, r.domain, r.sub.en, r.sub.ar,
      label(a.s || "unassessed"), a.owner || "", a.due || "", a.note || "",
      Number.isFinite(a.m) ? a.m : "", a.review || "", a.by || "",
      a.t ? new Date(a.t).toISOString() : "",
    ].map(esc).join(","));
  }
  return lines;
}

/* ── Executive HTML report ─────────────────────────────────────────────── */
function reportHTML({ org, lang, selected, versions, overall, perFw, domainRows, gaps, evCov, evCount, maturity, generatedBy }) {
  const isAr = lang === "ar";
  const t = (k, v) => tt(lang, k, v);
  const dir = isAr ? "rtl" : "ltr";
  const row = (cells, tag = "td") => `<tr>${cells.map((c) => `<${tag}>${c}</${tag}>`).join("")}</tr>`;
  return `<!doctype html><html dir="${dir}" lang="${lang}"><head><meta charset="utf-8">
<title>Burhan — ${org || "GRC"} </title>
<style>
body{font-family:'IBM Plex Sans','IBM Plex Sans Arabic',sans-serif;color:#1B201D;background:#fff;margin:40px;line-height:1.6}
h1{font-size:24px;margin:0} h2{font-size:15px;margin:26px 0 8px;color:#11402F;border-bottom:2px solid #C9A45A;padding-bottom:4px}
.meta{color:#7C847F;font-size:12px}
.kpi{display:inline-block;border:1px solid #DDD9CB;border-radius:10px;padding:10px 18px;margin:6px 8px 6px 0;text-align:center}
.kpi b{font-size:26px;display:block;color:#11402F}
table{border-collapse:collapse;width:100%;font-size:12.5px}
td,th{border:1px solid #DDD9CB;padding:6px 9px;text-align:start} th{background:#F2F1EA}
.gap{color:#B23A2E;font-weight:600}
.foot{margin-top:30px;font-size:11px;color:#7C847F}
@media print{body{margin:14mm}}
</style></head><body>
<div class="meta">برهان · BURHAN — ${new Date().toLocaleString(isAr ? "ar-SA" : undefined)}</div>
<h1>${org || t("orgFallback")}</h1>
<div class="meta">${selected.map((f) => `${FRAMEWORKS[f].short} ${versions[f] || ""}`).join(" · ")} · ${generatedBy}</div>
<h2>${isAr ? "الجاهزية" : "Posture"}</h2>
<div class="kpi"><b>${overall.pct}%</b>${t("overall")}</div>
${perFw.map((p) => `<div class="kpi"><b>${p.pct}%</b>${FRAMEWORKS[p.fw].short}</div>`).join("")}
<div class="kpi"><b>${evCov.pct}%</b>${t("evidenceCoverage")}</div>
${maturity != null ? `<div class="kpi"><b>${maturity}/5</b>${t("maturityCard")}</div>` : ""}
<h2>${isAr ? "الجاهزية حسب النطاق" : "Domain readiness"}</h2>
<table>${row([isAr ? "النطاق" : "Domain", "%", isAr ? "فجوات" : "Gaps"], "th")}
${domainRows.map((d) => row([d.full, `${d.pct}%`, d.gaps])).join("")}</table>
<h2>${isAr ? "الفجوات المفتوحة" : "Open gaps"}</h2>
${gaps.length ? `<table>${row(["ID", isAr ? "الضابط" : "Control", t("owner"), t("dueLbl")], "th")}
${gaps.map((g) => row([`<span class="gap">${g.id}</span>`, g.t, g.owner || "—", g.due || "—"])).join("")}</table>` : `<div class="meta">${t("gapsEmpty")}</div>`}
<div class="foot">${isAr ? "أُنشئ بواسطة منصة برهان. الكتالوجات من المصادر الرسمية" : "Generated by Burhan. Catalogs sourced from official publications"} (nca.gov.sa · rulebook.sama.gov.sa). ${evCount} ${isAr ? "دليلًا مسجلًا" : "evidence items on record"}.</div>
</body></html>`;
}

/* ── Control-ID detection (split regex global; tester rebuilt per call) ── */
const CID_SRC = "(?:ECC|CSF|SAMA)?\\s?\\b\\d-\\d{1,2}(?:-\\d{1,2}){0,2}\\b|\\b3\\.\\d\\.\\d+(?:\\.[\\w]+)?\\b";
const CID_SPLIT = new RegExp(`(${CID_SRC})`, "g");
const isCid = (s) => new RegExp(`^\\s*(?:${CID_SRC})\\s*$`).test(s);


export { T, STR, tt, stLabel, FRAMEWORKS, PERMS, ROLE_MATRIX, ROLES, can,
  randomSalt, hashPassword, verifyPassword, normEmail, parseLooseJSON,
  metaPrompt, catalogPrompt, evidencePrompt, runPool,
  normalizeMeta, normalizeDomain, normalizeEvidence,
  parseCSV, statusFromLabel, buildImport,
  makeRecord, approveRecord, rejectRecord,
  flattenControls, scoreOf, evidenceCoverage, avgMaturity, buildPostureSummary,
  csvLines, reportHTML, CID_SRC, CID_SPLIT, isCid, hasArabic };
