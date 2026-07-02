import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, AreaChart, Area,
} from "recharts";
import {
  LayoutDashboard, ListChecks, Flame, Sparkles, RefreshCw,
  Search, ChevronDown, ShieldCheck, AlertTriangle, CircleDashed,
  MinusCircle, Send, Loader2, Settings2, Database, X,
  FileJson, FileSpreadsheet, History, User, CalendarClock, Wand2,
  CheckCheck, Trash2, Copy, RotateCcw, Languages, Anchor,
  LogOut, Users as UsersIcon, FileCheck2, Paperclip, Upload,
  ClipboardCheck, FileText, Image as ImageIcon, FileDown, Gauge as GaugeIcon,
  KeyRound, UserPlus, Ban, BadgeCheck, Eye, ShieldQuestion, Smartphone, ListTodo,
} from "lucide-react";
import QRCode from "qrcode";
import { api } from "./api.js";
import { parseBlocks } from "./markdown.js";
import {
  ACTION_STATUSES, ACTION_PRIORITIES, isOverdue, isDueSoon, actionEditScope,
  canTransition, canAssignOwner, canCreateAction, canArchiveAction, closureGuard, isManagerial,
} from "../api/_lib/poam.js";

/* ────────────────────────────────────────────────────────────────────────────
   BURHAN · برهان — Saudi GRC Command Platform (v4)
   NCA ECC / SAMA CSF · versions discovered live from official sources
   (nca.gov.sa, rulebook.sama.gov.sa) and cached. Nothing hardcoded.

   v4 adds: login + RBAC (admin/manager/assessor/viewer) backed by a user
   database in persistent storage (salted SHA-256), approval workflow for
   assessor changes, evidence pipeline (upload in Advisor chat → AI analysis
   → linked to controls → dashboard visualization), CSV bulk import,
   executive HTML report, SAMA maturity (0–5) tracking, per-user audit.
──────────────────────────────────────────────────────────────────────────── */

const T = {
  paper: "#F2F1EA", panel: "#FBFAF5",
  ink: "#1B201D", inkSoft: "#4A5350", inkFaint: "#7C847F",
  green: "#11402F", greenDeep: "#0B2C20",
  emerald: "#168F5B", // batch-feature accent (POA&M, upload links, advisor tables)
  brass: "#A87B22", brassSoft: "#C9A45A",
  line: "#DDD9CB",
  compliant: "#1F7A4D", partial: "#B8861B", gap: "#B23A2E",
  amber: "#B8861B", red: "#B23A2E", // status-only (due-soon/blocked · overdue/expired/revoked)
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
    nav: { dash: "Dashboard", controls: "Controls", risk: "Risk", evidence: "Evidence", actions: "Corrective actions", approvals: "Approvals", advisor: "Advisor", users: "Users", settings: "Settings" },
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
    /* users: remove + self password */
    confirm: "Confirm",
    removeConfirm: "Deactivate {n}? Sign-in is blocked immediately; historical records remain.",
    pwChangeTitle: "Change password",
    pwCurrentLbl: "Current password",
    pwNewLbl: "New password",
    pwChanged: "Password updated",
    /* evidence: control popover */
    ctrlSource: "Source",
    ctrlNoMap: "No mapping for this code in the loaded catalogs.",
    /* evidence: external upload links */
    genLink: "Generate upload link",
    linkReqName: "Evidence title (shown to the uploader)",
    linkReqHint: "Creates an evidence-request entry in the registry. Anyone with the link can upload files to it — no account needed. Copy the link and send it yourself.",
    linkExpiry: "Expiry (days)",
    linkUses: "Max uses",
    linkOnce: "This link is shown once — copy it now. Only a hash is kept on the server.",
    copyLink: "Copy link",
    uploadLinks: "Upload links",
    usesLeft: "{n} of {m} uses left",
    revoke: "Revoke",
    linkState: { active: "Active", expired: "Expired", revoked: "Revoked", used_up: "Used up" },
    extUpload: "External upload",
    pubUploadTitle: "Submit evidence",
    pubUploadFor: "Upload file(s) for:",
    pubYourName: "Your name (optional)",
    pubNote: "Note (optional)",
    pubSubmit: "Upload",
    pubDone: "Received. Thank you — you can close this page.",
    pubInvalid: "This upload link is invalid, expired, or has been used.",
    pubLimits: "Accepted: {ext} · max {mb} MB per file · up to {n} files",
    /* corrective actions (POA&M) */
    poamTitle: "Corrective actions",
    newAction: "New corrective action",
    createFromGap: "Create corrective action",
    actTitleLbl: "Title",
    actDescLbl: "Description",
    priorityLbl: "Priority",
    actStatus: { "Open": "Open", "In Progress": "In progress", "Blocked": "Blocked", "Closed": "Closed" },
    actPriority: { Low: "Low", Medium: "Medium", High: "High", Critical: "Critical" },
    overdueLbl: "Overdue",
    dueSoonLbl: "Due soon",
    allOwners: "All owners",
    onlyOverdue: "Overdue only",
    requestClosure: "Request closure",
    closureRequested: "Closure requested",
    approveClose: "Approve & close",
    reopen: "Reopen",
    closureNoteLbl: "Closure note",
    closureNeeds: "Closing requires ≥1 linked evidence item and a closure note",
    linkEvidenceLbl: "Linked evidence",
    linkControlsLbl: "Linked controls",
    openCount: "Open",
    byOwner: "By owner",
    byFramework: "By framework",
    timelineLbl: "Timeline",
    noActions: "No corrective actions yet. Create one from a gap control or with the button above.",
    archiveBtn: "Archive",
    saveBtn: "Save",
    createBtn: "Create",
    unassigned: "Unassigned",
    toastAction: "Corrective action saved",
    closedBadge: "Closed",
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
    nav: { dash: "اللوحة", controls: "الضوابط", risk: "المخاطر", evidence: "الأدلة", actions: "خطط المعالجة", approvals: "الاعتمادات", advisor: "المستشار", users: "المستخدمون", settings: "الإعدادات" },
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
    /* المستخدمون: الإزالة وكلمة المرور الذاتية */
    confirm: "تأكيد",
    removeConfirm: "إيقاف {n}؟ يُمنع تسجيل الدخول فورًا وتبقى السجلات التاريخية.",
    pwChangeTitle: "تغيير كلمة المرور",
    pwCurrentLbl: "كلمة المرور الحالية",
    pwNewLbl: "كلمة المرور الجديدة",
    pwChanged: "تم تحديث كلمة المرور",
    /* الأدلة: نافذة الضابط */
    ctrlSource: "المصدر",
    ctrlNoMap: "لا يوجد ضابط مطابق لهذا الرمز في الكتالوجات المحمّلة.",
    /* الأدلة: روابط الرفع الخارجية */
    genLink: "إنشاء رابط رفع",
    linkReqName: "عنوان الدليل (يظهر لمن يرفع)",
    linkReqHint: "يُنشئ طلب دليل في السجل. يمكن لأي شخص لديه الرابط رفع الملفات إليه دون حساب. انسخ الرابط وأرسله بنفسك.",
    linkExpiry: "الصلاحية (أيام)",
    linkUses: "الحد الأقصى للاستخدام",
    linkOnce: "يُعرض هذا الرابط مرة واحدة — انسخه الآن. يُخزَّن على الخادم كتجزئة فقط.",
    copyLink: "نسخ الرابط",
    uploadLinks: "روابط الرفع",
    usesLeft: "متبقٍ {n} من {m}",
    revoke: "إبطال",
    linkState: { active: "نشط", expired: "منتهٍ", revoked: "مُبطل", used_up: "مستنفد" },
    extUpload: "رفع خارجي",
    pubUploadTitle: "إرسال دليل",
    pubUploadFor: "ارفع ملفًا/ملفات لـ:",
    pubYourName: "اسمك (اختياري)",
    pubNote: "ملاحظة (اختياري)",
    pubSubmit: "رفع",
    pubDone: "تم الاستلام. شكرًا — يمكنك إغلاق الصفحة.",
    pubInvalid: "رابط الرفع غير صالح أو منتهٍ أو مستنفد.",
    pubLimits: "المقبول: {ext} · بحد أقصى {mb} م.ب للملف · حتى {n} ملفات",
    /* خطط المعالجة (POA&M) */
    poamTitle: "خطط المعالجة",
    newAction: "إجراء تصحيحي جديد",
    createFromGap: "إنشاء إجراء تصحيحي",
    actTitleLbl: "العنوان",
    actDescLbl: "الوصف",
    priorityLbl: "الأولوية",
    actStatus: { "Open": "مفتوح", "In Progress": "قيد التنفيذ", "Blocked": "متعثر", "Closed": "مغلق" },
    actPriority: { Low: "منخفضة", Medium: "متوسطة", High: "عالية", Critical: "حرجة" },
    overdueLbl: "متأخر",
    dueSoonLbl: "يستحق قريبًا",
    allOwners: "كل المسؤولين",
    onlyOverdue: "المتأخر فقط",
    requestClosure: "طلب الإغلاق",
    closureRequested: "طُلب الإغلاق",
    approveClose: "اعتماد وإغلاق",
    reopen: "إعادة فتح",
    closureNoteLbl: "ملاحظة الإغلاق",
    closureNeeds: "يتطلب الإغلاق دليلًا مرتبطًا واحدًا على الأقل وملاحظة إغلاق",
    linkEvidenceLbl: "الأدلة المرتبطة",
    linkControlsLbl: "الضوابط المرتبطة",
    openCount: "مفتوح",
    byOwner: "حسب المسؤول",
    byFramework: "حسب الإطار",
    timelineLbl: "السجل الزمني",
    noActions: "لا توجد إجراءات تصحيحية بعد. أنشئ إجراءً من ضابط فجوة أو بالزر أعلاه.",
    archiveBtn: "أرشفة",
    saveBtn: "حفظ",
    createBtn: "إنشاء",
    unassigned: "غير مُسند",
    toastAction: "تم حفظ الإجراء التصحيحي",
    closedBadge: "مغلق",
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

const PERMS = ["manageUsers", "manageScope", "resetData", "refetch", "assess", "approve", "bulk", "importData", "evidence", "shareEvidence", "poam", "advisor", "exportData", "diagnostics"];
const ROLE_MATRIX = {
  admin:    { manageUsers: 1, manageScope: 1, resetData: 1, refetch: 1, assess: 1, approve: 1, bulk: 1, importData: 1, evidence: 1, shareEvidence: 1, poam: 1, advisor: 1, exportData: 1, diagnostics: 1 },
  manager:  { manageUsers: 0, manageScope: 0, resetData: 0, refetch: 1, assess: 1, approve: 1, bulk: 1, importData: 1, evidence: 1, shareEvidence: 1, poam: 1, advisor: 1, exportData: 1, diagnostics: 1 },
  assessor: { manageUsers: 0, manageScope: 0, resetData: 0, refetch: 0, assess: 1, approve: 0, bulk: 1, importData: 0, evidence: 1, shareEvidence: 1, poam: 1, advisor: 1, exportData: 1, diagnostics: 0 },
  viewer:   { manageUsers: 0, manageScope: 0, resetData: 0, refetch: 0, assess: 0, approve: 0, bulk: 0, importData: 0, evidence: 0, shareEvidence: 0, poam: 0, advisor: 1, exportData: 0, diagnostics: 0 },
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
  return `Use web search to verify, from the official source ${fw.officialSource}, the CURRENT published version of the ${fw.regulator} "${fw.name}" (${fw.short}) and its main domain structure as of today. Do not rely on memory for the version number.
Then respond with ONLY minified JSON, no prose, no citations, no markdown, schema:
{"version":"official version designation, e.g. ECC-2:2024","domains":[{"n":1,"en":"domain name","ar":"الاسم الرسمي بالعربية"}]}
List ALL main domains in official order.`;
}

function catalogPrompt(fwKey, domain, version) {
  const fw = FRAMEWORKS[fwKey];
  const idHint = fwKey === "ncaecc" ? `${domain.n}-1` : `3.${domain.n}.1`;
  const cidHint = fwKey === "ncaecc" ? `${domain.n}-1-1` : `3.${domain.n}.1.a`;
  return `You are an expert on ${fw.regulator} ${fw.short} ${version}. Use web search against ${fw.officialSource} if needed to confirm the official structure of Main Domain ${domain.n} ("${domain.en}") in ${version} — subdomains and controls with official numbering.
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

/* ════════════════════════════════════════════════════════════════════════
   @testable-end
══════════════════════════════════════════════════════════════════════════ */

const STATUS_META = {
  compliant: { color: T.compliant, Icon: ShieldCheck },
  partial: { color: T.partial, Icon: AlertTriangle },
  gap: { color: T.gap, Icon: Flame },
  na: { color: T.na, Icon: MinusCircle },
  unassessed: { color: T.unassessed, Icon: CircleDashed },
};
const STATUS_KEYS = Object.keys(STATUS_META);
const EV_TYPE_ICON = { pdf: FileText, image: ImageIcon, text: FileText, other: FileText };

/* ── API-backed catalog pipeline ───────────────────────────────────────────
   Auth, persistence, and AI calls now live server-side (see /api and src/api.js).
   Catalog discovery is phased so each serverless call stays short: discover
   version + domains, fetch each domain in parallel, then persist. The onTick
   contract is unchanged so CatalogLoader renders exactly as before. */
async function fetchCatalogs(frameworks, existing, force, onTick) {
  const result = {};
  const notes = [];
  const targets = frameworks.filter((f) => force || !existing[f]);
  for (const f of frameworks) if (!targets.includes(f) && existing[f]) result[f] = existing[f];
  if (!targets.length) return { catalogs: result, notes };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // One model call with bounded retries. Backs off on 429 (rate limit) and timeout,
  // which is what low-tier Anthropic accounts hit during the catalog burst.
  const callWithBackoff = async (fn, label, onWait) => {
    let lastErr = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      try { return await fn(attempt); }
      catch (e) {
        lastErr = e;
        const transient = e.status === 429 || /timeout|429|too long/i.test(e.message || "");
        if (!transient || attempt === 3) break;
        const wait = Math.round(2000 * 2 ** attempt + Math.random() * 800); // 2s, 4s, 8s (+jitter)
        if (onWait) onWait(label, wait);
        await sleep(wait);
      }
    }
    throw lastErr;
  };

  const metas = {};
  let step = 0;
  for (const f of targets) {
    const { meta } = await callWithBackoff(
      () => api.catalogMeta(f),
      `${FRAMEWORKS[f].short} version`,
      (lbl, ms) => onTick("discover", step, targets.length, `rate limited · retrying ${lbl} in ${Math.round(ms / 1000)}s`),
    );
    if (meta.source === "verified fallback") notes.push({ fw: f, version: meta.version });
    metas[f] = meta;
    step++;
    onTick("discover", step, targets.length, `${FRAMEWORKS[f].short} → ${meta.version}`);
  }

  const jobs = [];
  for (const f of targets) {
    result[f] = { fetchedAt: Date.now(), version: metas[f].version, source: metas[f].source, domains: [] };
    for (const d of metas[f].domains) jobs.push({ f, d });
  }

  // Serial (concurrency 1) so a low-tier account is fed a trickle, not a burst.
  let done = 0;
  const errors = [];
  for (let i = 0; i < jobs.length; i++) {
    const { f, d } = jobs[i];
    try {
      const { domain } = await callWithBackoff(
        (attempt) => api.catalogDomain(f, d, metas[f].version, attempt > 0), // web search only after first miss
        `${FRAMEWORKS[f].short} D${d.n}`,
        (lbl, ms) => onTick("domains", done, jobs.length, `rate limited · retrying ${lbl} in ${Math.round(ms / 1000)}s`),
      );
      result[f].domains.push(domain);
    } catch (e) {
      errors.push(e?.message || `${FRAMEWORKS[f].short} D${d.n}: failed`);
    }
    done++;
    onTick("domains", done, jobs.length, `${FRAMEWORKS[f].short} ${metas[f].version} · ${d.en}`);
    if (i < jobs.length - 1) await sleep(1200); // spacer: stay under low requests-per-minute caps
  }

  // Persist only frameworks that completed in full, so a retry skips them and
  // re-fetches only the ones still missing. Incomplete frameworks are not saved
  // and not returned, so they remain targets on the next attempt.
  const completed = {};
  for (const f of targets) {
    result[f].domains.sort((a, b) => a.n - b.n);
    const expected = metas[f].domains.length;
    if (expected > 0 && result[f].domains.length === expected) {
      try { await api.catalogSave(f, result[f]); completed[f] = result[f]; }
      catch (e) { errors.push(`${FRAMEWORKS[f].short}: save failed (${e.message})`); }
    }
  }
  for (const f of frameworks) if (!targets.includes(f) && existing[f]) completed[f] = existing[f];
  return { catalogs: completed, notes, errors };
}

/* ── Export ── */

function downloadBlob(name, mime, content) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function exportCSV(rows, assess, org, lang) {
  const lines = csvLines(rows, assess, (s) => stLabel(lang, s));
  downloadBlob(
    `burhan-${(org || "report").replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`,
    "text/csv;charset=utf-8", lines.join("\n"));
}

function exportJSON(catalogs, assess, settings, audit, snaps, evidence, users) {
  const safeUsers = Object.fromEntries(Object.entries(users || {}).map(([id, u]) => {
    const { salt, hash, ...rest } = u; return [id, rest];
  }));
  downloadBlob(`burhan-export-${new Date().toISOString().slice(0, 10)}.json`, "application/json",
    JSON.stringify({ exportedAt: new Date().toISOString(), settings, catalogs, assessments: assess, audit, snapshots: snaps, evidence, users: safeUsers }, null, 2));
}

/* ════════════════════════════════════════════════════════════════════════
   UI ATOMS
══════════════════════════════════════════════════════════════════════════ */

const Eyebrow = ({ ar, en, lang }) => (
  <div className="flex items-baseline gap-2 select-none">
    {lang === "ar" ? (
      <>
        <span style={{ fontFamily: "'IBM Plex Sans Arabic'", color: T.ink, fontSize: 13, fontWeight: 700 }}>{ar}</span>
        <span style={{ color: T.inkFaint, fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>{en}</span>
      </>
    ) : (
      <>
        <span style={{ fontFamily: "'IBM Plex Sans Arabic'", color: T.brass, fontSize: 13, fontWeight: 600 }}>{ar}</span>
        <span style={{ color: T.inkFaint, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}>{en}</span>
      </>
    )}
  </div>
);

const Mono = ({ children, style }) => (
  <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, unicodeBidi: "isolate", ...style }}>{children}</span>
);

const StatusDot = ({ s, size = 8 }) => (
  <span style={{ width: size, height: size, borderRadius: 99, background: (STATUS_META[s] || STATUS_META.unassessed).color, display: "inline-block", flexShrink: 0 }} />
);

function Card({ children, className = "", style, onClick }) {
  return (
    <div onClick={onClick} className={`rounded-xl ${className}`} style={{ background: T.panel, border: `1px solid ${T.line}`, ...style }}>
      {children}
    </div>
  );
}

const inputStyle = {
  background: T.paper, border: `1px solid ${T.line}`, borderRadius: 8,
  fontSize: 13, color: T.ink, padding: "8px 10px", outline: "none", width: "100%",
};
const selStyle = { ...inputStyle, width: "auto", background: T.panel };

function Toasts({ toasts }) {
  return (
    <div className="fixed bottom-4 space-y-2" style={{ zIndex: 90, insetInlineEnd: 16 }}>
      {toasts.map((t) => (
        <div key={t.id} className="rounded-lg px-4 py-2.5 raqib-rise flex items-center gap-2"
          style={{
            background: t.kind === "error" ? "#3A1612" : T.greenDeep,
            color: t.kind === "error" ? "#F3C8C0" : "#DCE9E0",
            fontSize: 13, boxShadow: "0 8px 24px rgba(20,30,25,0.25)", maxWidth: 360,
          }}>
          {t.kind === "error" ? <AlertTriangle size={14} /> : <CheckCheck size={14} color={T.brassSoft} />}
          <span dir="auto">{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

/* Rich text for advisor replies (React elements only, no HTML injection). */
function RichLine({ line }) {
  const segs = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return segs.map((seg, i) => {
    const bold = seg.startsWith("**") && seg.endsWith("**");
    const text = bold ? seg.slice(2, -2) : seg;
    const parts = text.split(CID_SPLIT).filter((p) => p !== "");
    const inner = parts.map((p, j) =>
      isCid(p) && /\d/.test(p)
        ? <Mono key={j} style={{ fontWeight: 700, color: T.green, fontSize: "0.92em", background: "rgba(17,64,47,0.07)", borderRadius: 4, padding: "0 4px" }}>{p.trim()}</Mono>
        : <React.Fragment key={j}>{p}</React.Fragment>
    );
    return bold ? <b key={i}>{inner}</b> : <React.Fragment key={i}>{inner}</React.Fragment>;
  });
}

/* GFM table from the advisor, rendered as a real table: emerald header accent,
   off-white/white surfaces, horizontal scroll on narrow widths. Cells go
   through RichLine so control-ID chips and **bold** still work inside tables.
   parseBlocks (src/markdown.js) is streaming-safe: partial tables never throw. */
function MdTable({ block }) {
  const cellBase = { padding: "6px 10px", fontSize: 12.5, borderBottom: `1px solid ${T.line}`, whiteSpace: "nowrap" };
  return (
    <div style={{ overflowX: "auto", margin: "8px 0", borderRadius: 8, border: `1px solid ${T.line}`, background: "#FFFFFF" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 320 }}>
        <thead>
          <tr>
            {block.header.map((h, i) => (
              <th key={i} style={{ ...cellBase, textAlign: block.align[i] || "start", color: "#FFFFFF", background: T.emerald, fontWeight: 700, borderBottom: "none" }}>
                <RichLine line={h} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((r, ri) => (
            <tr key={ri} style={{ background: ri % 2 ? "#FFFFFF" : T.panel }}>
              {r.map((c, ci) => (
                <td key={ci} style={{ ...cellBase, textAlign: block.align[ci] || "start", color: T.ink }}>
                  <RichLine line={c} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RichText({ text }) {
  return parseBlocks(String(text)).map((block, i) => {
    if (block.type === "table") return <MdTable key={i} block={block} />;
    const line = block.text;
    const listM = line.match(/^(\s*)([-•]|\d+[\).\u060D.]|[\u0660-\u0669]+[\).\u060D.])\s+(.*)$/);
    if (listM) {
      return (
        <div key={i} style={{ display: "flex", gap: 7, marginTop: i ? 5 : 0, paddingInlineStart: 4 }}>
          <span style={{ color: T.brass, fontWeight: 700, flexShrink: 0, fontSize: "0.92em" }}>{listM[2]}</span>
          <span><RichLine line={listM[3]} /></span>
        </div>
      );
    }
    if (!line.trim()) return <div key={i} style={{ height: 7 }} />;
    return <div key={i} style={{ marginTop: i ? 3 : 0 }}><RichLine line={line} /></div>;
  });
}

/* ── Posture gauge ── */
function PostureGauge({ pct, label, sub, accent, big }) {
  const R = big ? 74 : 56, SW = big ? 11 : 9, size = (R + SW) * 2 + 8;
  const c = size / 2, a0 = 135, a1 = 405;
  const arc = (from, to, color, w) => {
    const rad = (deg) => ((deg - 90) * Math.PI) / 180;
    const x1 = c + R * Math.cos(rad(from)), y1 = c + R * Math.sin(rad(from));
    const x2 = c + R * Math.cos(rad(to)), y2 = c + R * Math.sin(rad(to));
    return <path d={`M ${x1} ${y1} A ${R} ${R} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`}
      fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" />;
  };
  const sweep = a0 + ((a1 - a0) * Math.max(pct, 0.5)) / 100;
  return (
    <div className="flex flex-col items-center raqib-rise">
      <svg width={size} height={size} role="img" aria-label={`${label} ${pct}%`}>
        {arc(a0, a1, T.line, SW)}
        {arc(a0, sweep, accent, SW)}
        <text x={c} y={c - (big ? 4 : 2)} textAnchor="middle"
          style={{ fontFamily: "'IBM Plex Sans Arabic'", fontWeight: 700, fontSize: big ? 36 : 26, fill: T.ink }}>
          {pct}<tspan style={{ fontSize: big ? 18 : 14, fill: T.inkFaint }}>%</tspan>
        </text>
        <text x={c} y={c + (big ? 20 : 16)} textAnchor="middle"
          style={{ fontSize: 11, letterSpacing: "0.1em", fill: T.inkFaint, fontWeight: 600 }}>
          {label}
        </text>
      </svg>
      {sub && <div style={{ fontSize: 12, color: T.inkSoft, marginTop: -6, textAlign: "center" }}>{sub}</div>}
    </div>
  );
}

function LangToggle({ lang, onToggle, dark }) {
  return (
    <button onClick={onToggle} className="rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 raqib-focus"
      style={{
        background: dark ? "rgba(255,255,255,0.1)" : "rgba(17,64,47,0.08)",
        color: dark ? T.brassSoft : T.green,
        fontFamily: lang === "en" ? "'IBM Plex Sans Arabic'" : "'IBM Plex Sans'",
      }}>
      <Languages size={13} /> {tt(lang, "langBtn")}
    </button>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   AUTH SCREENS — first-run admin creation, sign-in
══════════════════════════════════════════════════════════════════════════ */

function AuthShell({ children, lang, setLang }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-10" style={{ background: T.green }}>
      <div className="w-full" style={{ maxWidth: 440 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <div style={{ fontFamily: "'IBM Plex Sans Arabic'", color: T.brassSoft, fontSize: 40, fontWeight: 700, lineHeight: 1 }}>برهان</div>
            <div style={{ color: "#CFE0D6", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, marginTop: 4 }}>Burhan GRC</div>
          </div>
          <LangToggle lang={lang} onToggle={() => setLang(lang === "ar" ? "en" : "ar")} dark />
        </div>
        {children}
      </div>
    </div>
  );
}

const authInput = {
  width: "100%", borderRadius: 8, padding: "11px 13px", fontSize: 14, outline: "none",
  background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.22)", color: "#F1EFE6",
};
const FieldLbl = ({ children }) => (
  <div style={{ color: "#A9BDB2", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>{children}</div>
);

function FirstRun({ lang, onCreate }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr("");
    if (pw.length < 8) return setErr(tt(lang, "pwShort"));
    if (pw !== pw2) return setErr(tt(lang, "pwMismatch"));
    if (!name.trim() || !normEmail(email)) return setErr(tt(lang, "wrongCreds"));
    setBusy(true);
    await onCreate({ name: name.trim(), email: normEmail(email), password: pw });
    setBusy(false);
  };

  return (
    <div className="raqib-rise">
      <div style={{ color: "#F1EFE6", fontSize: 20, fontWeight: 700 }}>{tt(lang, "firstRunTitle")}</div>
      <div style={{ color: "#A9BDB2", fontSize: 13, marginTop: 6, lineHeight: 1.7 }}>{tt(lang, "firstRunSub")}</div>
      <div className="space-y-3 mt-6">
        <div><FieldLbl>{tt(lang, "nameLbl")}</FieldLbl>
          <input value={name} onChange={(e) => setName(e.target.value)} style={authInput} dir="auto" className="raqib-focus" /></div>
        <div><FieldLbl>{tt(lang, "emailLbl")}</FieldLbl>
          <input value={email} onChange={(e) => setEmail(e.target.value)} style={authInput} dir="ltr" type="email" className="raqib-focus" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><FieldLbl>{tt(lang, "pwLbl")}</FieldLbl>
            <input value={pw} onChange={(e) => setPw(e.target.value)} style={authInput} dir="ltr" type="password" className="raqib-focus" /></div>
          <div><FieldLbl>{tt(lang, "pw2Lbl")}</FieldLbl>
            <input value={pw2} onChange={(e) => setPw2(e.target.value)} style={authInput} dir="ltr" type="password"
              onKeyDown={(e) => e.key === "Enter" && submit()} className="raqib-focus" /></div>
        </div>
        {err && <div style={{ color: "#E5B9B2", fontSize: 13 }}>{err}</div>}
        <button onClick={submit} disabled={busy}
          className="w-full rounded-lg py-3 font-semibold raqib-focus flex items-center justify-center gap-2"
          style={{ background: T.brassSoft, color: T.greenDeep, fontSize: 15, opacity: busy ? 0.6 : 1 }}>
          {busy ? <Loader2 size={16} className="raqib-spin" /> : <KeyRound size={16} />} {tt(lang, "createAdmin")}
        </button>
      </div>
    </div>
  );
}

function Login({ lang, onLogin, onVerify }) {
  const [step, setStep] = useState("pw"); // pw | mfa
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const L = (ar, en) => (lang === "ar" ? ar : en);

  const submitPw = async () => {
    setErr(""); setBusy(true);
    const r = await onLogin(normEmail(email), pw);
    setBusy(false);
    if (r.error) return setErr(r.error);
    if (r.mfa) { setChallenge(r.challenge); setCode(""); setStep("mfa"); }
  };
  const submitCode = async () => {
    setErr(""); setBusy(true);
    const r = await onVerify(challenge, code.trim());
    setBusy(false);
    if (r.error) setErr(r.error);
  };

  if (step === "mfa") {
    return (
      <div className="raqib-rise">
        <div style={{ color: "#F1EFE6", fontSize: 20, fontWeight: 700 }}>{L("التحقق بخطوتين", "Two-factor verification")}</div>
        <div style={{ color: "#9DB1A7", fontSize: 13, marginTop: 6 }}>{L("أدخل الرمز من تطبيق المصادقة، أو استخدم رمز استرداد.", "Enter the code from your authenticator app, or use a recovery code.")}</div>
        <div className="space-y-3 mt-6">
          <input value={code} onChange={(e) => setCode(e.target.value)} style={{ ...authInput, letterSpacing: "0.3em", textAlign: "center", fontWeight: 700 }}
            dir="ltr" autoFocus placeholder="123456" onKeyDown={(e) => e.key === "Enter" && submitCode()} className="raqib-focus" />
          {err && <div style={{ color: "#E5B9B2", fontSize: 13 }}>{err}</div>}
          <button onClick={submitCode} disabled={busy} className="w-full rounded-lg py-3 font-semibold raqib-focus flex items-center justify-center gap-2"
            style={{ background: T.brassSoft, color: T.greenDeep, fontSize: 15, opacity: busy ? 0.6 : 1 }}>
            {busy ? <Loader2 size={16} className="raqib-spin" /> : <ShieldCheck size={16} />} {L("تحقق", "Verify")}
          </button>
          <button onClick={() => { setStep("pw"); setErr(""); }} className="raqib-focus" style={{ color: "#9DB1A7", fontSize: 12.5, width: "100%", textAlign: "center" }}>{L("رجوع", "Back")}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="raqib-rise">
      <div style={{ color: "#F1EFE6", fontSize: 20, fontWeight: 700 }}>{tt(lang, "welcomeBack")}</div>
      <div className="space-y-3 mt-6">
        <div><FieldLbl>{tt(lang, "emailLbl")}</FieldLbl>
          <input value={email} onChange={(e) => setEmail(e.target.value)} style={authInput} dir="ltr" type="email" autoFocus className="raqib-focus" /></div>
        <div><FieldLbl>{tt(lang, "pwLbl")}</FieldLbl>
          <input value={pw} onChange={(e) => setPw(e.target.value)} style={authInput} dir="ltr" type="password"
            onKeyDown={(e) => e.key === "Enter" && submitPw()} className="raqib-focus" /></div>
        {err && <div style={{ color: "#E5B9B2", fontSize: 13 }}>{err}</div>}
        <button onClick={submitPw} disabled={busy}
          className="w-full rounded-lg py-3 font-semibold raqib-focus flex items-center justify-center gap-2"
          style={{ background: T.brassSoft, color: T.greenDeep, fontSize: 15, opacity: busy ? 0.6 : 1 }}>
          {busy ? <Loader2 size={16} className="raqib-spin" /> : <KeyRound size={16} />} {tt(lang, "signIn")}
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   ONBOARDING & LOADING
══════════════════════════════════════════════════════════════════════════ */

function Onboarding({ onConfirm, initial, lang, setLang }) {
  const [sel, setSel] = useState({
    ncaecc: initial?.frameworks?.includes("ncaecc") ?? true,
    samacsf: initial?.frameworks?.includes("samacsf") ?? false,
  });
  const [org, setOrg] = useState(initial?.org || "");
  const any = sel.ncaecc || sel.samacsf;
  const isAr = lang === "ar";
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-10" style={{ background: T.green }}>
      <div className="w-full" style={{ maxWidth: 560 }}>
        <div className="flex justify-end mb-4"><LangToggle lang={lang} onToggle={() => setLang(isAr ? "en" : "ar")} dark /></div>
        <div className="raqib-rise">
          <div style={{ fontFamily: "'IBM Plex Sans Arabic'", color: T.brassSoft, fontSize: 44, fontWeight: 700, lineHeight: 1 }}>برهان</div>
          <div style={{ color: "#E9E6DA", fontSize: 22, fontWeight: 600, marginTop: 6 }}>
            {isAr ? tt(lang, "tagline") : `Burhan — ${tt(lang, "tagline")}`}
          </div>
          <div style={{ color: "#A9BDB2", fontSize: 14, marginTop: 8 }}>{tt(lang, "onboardSub")}</div>
        </div>
        <div className="grid grid-cols-1 gap-3 mt-8">
          {Object.values(FRAMEWORKS).map((fw, i) => {
            const on = sel[fw.key];
            return (
              <button key={fw.key} onClick={() => setSel((p) => ({ ...p, [fw.key]: !p[fw.key] }))}
                className="rounded-xl px-5 py-4 raqib-rise transition-transform duration-150 hover:scale-[1.01] raqib-focus"
                style={{
                  animationDelay: `${120 + i * 90}ms`, textAlign: "start",
                  background: on ? "#FBFAF5" : "rgba(255,255,255,0.06)",
                  border: `1px solid ${on ? T.brassSoft : "rgba(255,255,255,0.18)"}`,
                }}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span style={{ fontWeight: 700, fontSize: 17, color: on ? T.ink : "#F1EFE6" }}>{fw.short}</span>
                      <span style={{ fontSize: 11, color: on ? T.inkFaint : "#9DB1A7" }}>{isAr ? "الإصدار يُكتشف من المصدر الرسمي" : "version discovered from official source"}</span>
                    </div>
                    <div style={{ fontSize: 13, color: on ? T.inkSoft : "#A9BDB2", marginTop: 2 }}>
                      {isAr ? `${fw.nameAr} · ${fw.regulatorAr}` : `${fw.name} · ${fw.regulator}`}
                    </div>
                    <div style={{ fontFamily: isAr ? "'IBM Plex Sans'" : "'IBM Plex Sans Arabic'", fontSize: 13, color: on ? T.brass : T.brassSoft, marginTop: 2 }}>
                      {isAr ? fw.name : fw.nameAr}
                    </div>
                  </div>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                    border: `2px solid ${on ? T.green : "rgba(255,255,255,0.4)"}`,
                    background: on ? T.green : "transparent",
                  }}>
                    {on && <ShieldCheck size={16} color="#FBFAF5" style={{ margin: 1 }} />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-5 raqib-rise" style={{ animationDelay: "320ms" }}>
          <input value={org} onChange={(e) => setOrg(e.target.value)} placeholder={tt(lang, "orgPh")} dir="auto"
            className="w-full rounded-lg px-4 py-3 outline-none raqib-focus" style={authInput} />
        </div>
        <button disabled={!any} onClick={() => onConfirm(Object.keys(sel).filter((k) => sel[k]), org.trim())}
          className="mt-5 w-full rounded-lg py-3 font-semibold raqib-rise raqib-focus"
          style={{ animationDelay: "400ms", background: any ? T.brassSoft : "rgba(255,255,255,0.15)", color: any ? T.greenDeep : "#8AA094", fontSize: 15, cursor: any ? "pointer" : "not-allowed" }}>
          {tt(lang, "loadBtn")}
        </button>
        <div style={{ color: "#7E988B", fontSize: 12, marginTop: 10, textAlign: "center" }}>{tt(lang, "preserveNote")}</div>
      </div>
    </div>
  );
}

function CatalogLoader({ progress, error, onRetry, lang }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: T.green }}>
      <div className="w-full text-center" style={{ maxWidth: 480 }}>
        <Database size={28} color={T.brassSoft} className="mx-auto" />
        <div style={{ color: "#F1EFE6", fontSize: 18, fontWeight: 600, marginTop: 14 }}>
          {error ? tt(lang, "loadFail") : progress.kind === "discover" ? tt(lang, "discovering") : tt(lang, "loading")}
        </div>
        {!error && (
          <>
            <div style={{ color: "#A9BDB2", fontSize: 13, marginTop: 6, minHeight: 18 }} dir="ltr">
              {progress.label || tt(lang, "preparing")}
            </div>
            <div className="rounded-full mt-6 overflow-hidden" style={{ height: 6, background: "rgba(255,255,255,0.12)" }}>
              <div style={{ height: "100%", width: `${progress.pct}%`, background: T.brassSoft, transition: "width 350ms ease" }} />
            </div>
            <div style={{ color: "#7E988B", fontSize: 12, marginTop: 10 }}>
              {progress.done || 0}/{progress.total || "…"} {tt(lang, "loadHint")}
            </div>
          </>
        )}
        {error && (
          <>
            <div style={{ color: "#E5B9B2", fontSize: 13, marginTop: 8 }} dir="ltr">{error}</div>
            <button onClick={onRetry} className="mt-5 rounded-lg px-5 py-2.5 font-semibold inline-flex items-center gap-2 raqib-focus"
              style={{ background: T.brassSoft, color: T.greenDeep, fontSize: 14 }}>
              <RefreshCw size={15} /> {tt(lang, "retryDomains")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   AI ADVISOR — language-aware chat + evidence attachment pipeline
══════════════════════════════════════════════════════════════════════════ */

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.txt,.csv,.md";
function fileKind(file) {
  const n = (file.name || "").toLowerCase();
  if (file.type === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (/image\/(png|jpe?g)/.test(file.type) || /\.(png|jpe?g)$/.test(n)) return "image";
  if (/\.(txt|csv|md)$/.test(n) || file.type.startsWith("text/")) return "text";
  return null;
}
function readFileAs(file, mode) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(mode === "b64" ? String(r.result).split(",")[1] : String(r.result));
    r.onerror = () => rej(new Error("read failed"));
    mode === "b64" ? r.readAsDataURL(file) : r.readAsText(file);
  });
}

function MsgActions({ onCopy, onRegen, lang, copied }) {
  return (
    <div className="flex gap-1 mt-1.5">
      <button onClick={onCopy} className="rounded-md px-2 py-1 text-xs flex items-center gap-1 raqib-focus"
        style={{ color: T.inkFaint, background: "rgba(0,0,0,0.03)" }}>
        {copied ? <CheckCheck size={11} color={T.compliant} /> : <Copy size={11} />} {copied ? tt(lang, "copied") : ""}
      </button>
      {onRegen && (
        <button onClick={onRegen} className="rounded-md px-2 py-1 text-xs flex items-center gap-1 raqib-focus"
          style={{ color: T.inkFaint, background: "rgba(0,0,0,0.03)" }}>
          <RotateCcw size={11} /> {tt(lang, "regen")}
        </button>
      )}
    </div>
  );
}

function EvidenceResultCard({ ev, lang, onJump }) {
  const QC = { strong: T.compliant, adequate: T.partial, weak: T.gap };
  return (
    <div className="rounded-lg p-3 mt-2" style={{ background: "rgba(17,64,47,0.05)", border: `1px solid ${T.line}` }}>
      <div className="flex items-center gap-2 flex-wrap">
        <FileCheck2 size={14} color={T.green} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: T.ink }} dir="auto">{ev.name}</span>
        {ev.quality && (
          <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10.5, fontWeight: 700, background: `${QC[ev.quality]}1A`, color: QC[ev.quality] }}>
            {tt(lang, "evQuality")[ev.quality]}
          </span>
        )}
        <span style={{ fontSize: 10.5, color: T.inkFaint }}>{ev.docType}</span>
      </div>
      <div dir="auto" style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 5, lineHeight: 1.6 }}>{ev.summary}</div>
      <div className="flex gap-1.5 flex-wrap mt-2">
        {ev.controls.length ? ev.controls.map((k) => (
          <Mono key={k} style={{ background: "rgba(17,64,47,0.08)", color: T.green, fontWeight: 700, borderRadius: 4, padding: "1px 6px", fontSize: 11 }}>
            {k.split(":")[1]}
          </Mono>
        )) : <span style={{ fontSize: 11.5, color: T.inkFaint }}>{tt(lang, "noLinks")}</span>}
      </div>
      <div style={{ fontSize: 11, color: ev.controls.length ? T.compliant : T.inkFaint, fontWeight: 600, marginTop: 6 }}>
        {ev.controls.length ? tt(lang, "linkedTo", { n: ev.controls.length }) : ""}
        <button onClick={onJump} className="raqib-focus" style={{ color: T.green, fontWeight: 700, marginInlineStart: 8, fontSize: 11 }}>
          {tt(lang, "nav").evidence} ←
        </button>
      </div>
    </div>
  );
}

function AdvisorView({ msgs, setMsgs, pendingControl, clearPending, org, selected, toast, lang, postureSummary, versions, onEvidence, validKeysByFw, user, goEvidence, cid, onNewThread }) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [ground, setGround] = useState(true);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const endRef = useRef(null);
  const taRef = useRef(null);
  const fileRef = useRef(null);
  const loadedCidRef = useRef(null);
  const allowEv = can(user.role, "evidence");
  const [reqLink, setReqLink] = useState(false); // "request evidence" upload-link modal

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy, analyzing]);

  // Conversation memory: hydrate this chat's stored turns + evidence refs once per cid.
  useEffect(() => {
    if (!cid || loadedCidRef.current === cid) return;
    loadedCidRef.current = cid;
    (async () => {
      try {
        const { messages } = await api.advisorHistory(cid);
        if (messages && messages.length) {
          setMsgs(messages.map((m) => m.ev
            ? { role: "assistant", ev: m.ev, content: m.ev.summary || "", t: m.t }
            : { role: m.role, content: m.content, t: m.t }));
        }
      } catch { /* history is a convenience; chat still works without it */ }
    })();
  }, [cid, setMsgs]);

  useEffect(() => {
    if (pendingControl) {
      const r = pendingControl;
      setInput(lang === "ar"
        ? `كيف أحقق الالتزام بالضابط ${r.control.id} من ${FRAMEWORKS[r.fw].short} — "${r.control.t}"؟ أعطني خطوات التنفيذ والأدلة التي يقبلها المدقق.`
        : `How do I achieve compliance with ${FRAMEWORKS[r.fw].short} control ${r.control.id} — "${r.control.t}"? Give implementation steps and evidence an auditor would accept.`);
      clearPending();
      taRef.current?.focus();
    }
  }, [pendingControl, clearPending, lang]);

  const autoGrow = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
  };

  // The server rebuilds context from the stored conversation (turns + evidence
  // refs) — only the new message travels; history is never re-sent from here.
  const run = async (text, { regenerate: regen = false } = {}) => {
    setBusy(true);
    try {
      const { reply } = regen
        ? await api.advisorRegen(cid, ground, lang)
        : await api.advisorSend(cid, text, ground, lang);
      setMsgs((p) => [...p, { role: "assistant", content: reply, t: Date.now() }]);
    } catch (e) {
      toast(e.message || tt(lang, "advFail"), "error");
      setMsgs((p) => [...p, { role: "assistant", content: e.message || tt(lang, "advFail"), error: true, t: Date.now() }]);
    } finally { setBusy(false); }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy || analyzing || !cid) return;
    setMsgs([...msgs.filter((m) => !m.error), { role: "user", content: text, t: Date.now() }]);
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";
    await run(text);
  };

  const retryLast = async () => {
    if (busy || !cid) return;
    const clean = msgs.filter((m) => !m.error);
    setMsgs(clean);
    // A failed call never persisted the user turn server-side; re-send it.
    const lastUser = [...clean].reverse().find((m) => m.role === "user" && !m.attach && !m.ev);
    if (lastUser) await run(lastUser.content);
  };

  const regenerate = async (idx) => {
    if (busy || !cid) return;
    setMsgs(msgs.slice(0, idx).filter((m) => !m.error));
    await run(null, { regenerate: true });
  };

  const copyMsg = async (text, idx) => {
    try { await navigator.clipboard.writeText(text); setCopiedIdx(idx); setTimeout(() => setCopiedIdx(null), 1500); } catch {}
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const kind = fileKind(file);
    if (!kind) return toast(tt(lang, "fileType"), "error");
    if (file.size > 4 * 1024 * 1024) return toast(tt(lang, "fileTooBig"), "error");
    setAnalyzing(true);
    setMsgs((p) => [...p, { role: "user", content: file.name, attach: { name: file.name, kind, size: file.size }, t: Date.now() }]);
    try {
      const payload = { name: file.name, kind, size: file.size };
      if (kind === "text") payload.text = (await readFileAs(file, "text")).slice(0, 24000);
      else { payload.data = await readFileAs(file, "b64"); if (kind === "image") payload.mime = file.type || (file.name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg"); }
      const { evidence: ev } = await api.analyzeEvidence(payload, cid);
      onEvidence(ev);
      setMsgs((p) => [...p, { role: "assistant", ev, content: ev.summary, t: Date.now() }]);
      toast(tt(lang, "toastEv"));
    } catch (err) {
      toast(err.message || tt(lang, "advFail"), "error");
      setMsgs((p) => [...p, { role: "assistant", content: err.message || tt(lang, "advFail"), error: true, t: Date.now() }]);
    } finally { setAnalyzing(false); }
  };

  return (
    <div className="flex flex-col" style={{ height: "100vh" }}>
      <div className="p-4 md:p-6 pb-3 flex items-end justify-between flex-wrap gap-2">
        <div>
          <Eyebrow ar="المستشار" en="Compliance advisor" lang={lang} />
          <h1 style={{ fontSize: 24, fontWeight: 700, color: T.ink, marginTop: 4 }}>{tt(lang, "advTitle")}</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {can(user.role, "shareEvidence") && (
            <button onClick={() => setReqLink(true)}
              className="rounded-full px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 raqib-focus"
              style={{ background: "rgba(22,143,91,0.1)", border: `1px solid ${T.emerald}`, color: T.emerald }}>
              <Upload size={11} /> {tt(lang, "genLink")}
            </button>
          )}
          <button onClick={() => setGround((g) => !g)} title={tt(lang, "groundTip")}
            className="rounded-full px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 raqib-focus"
            style={{
              background: ground ? "rgba(17,64,47,0.1)" : T.panel,
              border: `1px solid ${ground ? T.green : T.line}`,
              color: ground ? T.green : T.inkFaint,
            }}>
            <Anchor size={11} /> {tt(lang, "ground")}
          </button>
          {msgs.length > 0 && (
            <button onClick={onNewThread} className="text-xs font-semibold flex items-center gap-1.5 raqib-focus" style={{ color: T.inkFaint }}>
              <Trash2 size={12} /> {tt(lang, "clearThread")}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-6 space-y-3 pb-4">
        {msgs.length === 0 && (
          <Card className="p-5" style={{ borderStyle: "dashed" }}>
            <div style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.7 }}>{tt(lang, "advEmpty")}</div>
            <div className="flex gap-2 flex-wrap mt-3">
              {(STR[lang] || STR.en).advSuggestions.map((s) => (
                <button key={s} dir="auto" onClick={() => { setInput(s); taRef.current?.focus(); }}
                  className="rounded-full px-3 py-1.5 text-xs raqib-focus"
                  style={{ background: "rgba(17,64,47,0.08)", color: T.green, fontWeight: 600, fontFamily: hasArabic(s) ? "'IBM Plex Sans Arabic'" : "inherit" }}>
                  {s}
                </button>
              ))}
            </div>
          </Card>
        )}

        {msgs.map((m, i) => {
          const mine = m.role === "user";
          const ar = hasArabic(m.content);
          const isLastAssistant = !mine && i === msgs.length - 1 && !busy && !m.ev;
          return (
            <div key={i} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <div dir="auto" className="rounded-xl px-4 py-3 raqib-rise" style={{
                maxWidth: "85%", fontSize: ar ? 14 : 13.5, lineHeight: ar ? 1.85 : 1.6,
                fontFamily: ar ? "'IBM Plex Sans Arabic','IBM Plex Sans',sans-serif" : "inherit",
                textAlign: "start",
                background: m.error ? "rgba(178,58,46,0.07)" : mine ? T.green : T.panel,
                color: m.error ? T.gap : mine ? "#F4F2E9" : T.ink,
                border: m.error ? `1px solid rgba(178,58,46,0.3)` : mine ? "none" : `1px solid ${T.line}`,
              }}>
                {m.attach ? (
                  <span className="flex items-center gap-2">
                    <Paperclip size={13} /> <b>{m.attach.name}</b>
                    <span style={{ opacity: 0.7, fontSize: 11 }}>{Math.round(m.attach.size / 1024)} KB</span>
                  </span>
                ) : m.ev ? (
                  <EvidenceResultCard ev={m.ev} lang={lang} onJump={goEvidence} />
                ) : mine || m.error ? (
                  <span style={{ whiteSpace: "pre-wrap" }}>{m.content}</span>
                ) : (
                  <RichText text={m.content} />
                )}
                {m.error && (
                  <button onClick={retryLast} className="mt-2 rounded-md px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 raqib-focus"
                    style={{ background: T.gap, color: "#FFF" }}>
                    <RotateCcw size={11} /> {tt(lang, "retry")}
                  </button>
                )}
              </div>
              {!mine && !m.error && !m.ev && (
                <MsgActions lang={lang} copied={copiedIdx === i}
                  onCopy={() => copyMsg(m.content, i)}
                  onRegen={isLastAssistant ? () => regenerate(i) : null} />
              )}
              {m.t && (
                <div style={{ fontSize: 10, color: T.inkFaint, marginTop: 2 }}>
                  {new Date(m.t).toLocaleTimeString(lang === "ar" ? "ar-SA" : undefined, { hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
            </div>
          );
        })}

        {(busy || analyzing) && (
          <div className="flex items-center gap-2" style={{ color: T.inkFaint, fontSize: 13 }}>
            <Loader2 size={15} className="raqib-spin" /> {analyzing ? tt(lang, "analyzing") : tt(lang, "thinking")}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="p-4" style={{ borderTop: `1px solid ${T.line}`, background: T.panel }}>
        <div className="flex gap-2 items-end">
          {allowEv && (
            <>
              <input ref={fileRef} type="file" accept={ACCEPT} onChange={onFile} style={{ display: "none" }} />
              <button onClick={() => fileRef.current?.click()} title={tt(lang, "attach")} disabled={analyzing}
                className="rounded-lg p-2.5 raqib-focus" style={{ background: "rgba(168,123,34,0.12)", color: T.brass }}>
                <Paperclip size={16} />
              </button>
            </>
          )}
          <textarea ref={taRef} value={input} dir="auto" rows={1}
            onChange={(e) => { setInput(e.target.value); autoGrow(); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={tt(lang, "inputPh")}
            className="flex-1 rounded-lg px-3 py-2.5 outline-none resize-none raqib-focus"
            style={{
              background: T.paper, border: `1px solid ${T.line}`, fontSize: 13.5, color: T.ink,
              fontFamily: hasArabic(input) || lang === "ar" ? "'IBM Plex Sans Arabic','IBM Plex Sans',sans-serif" : "inherit",
              lineHeight: 1.7, maxHeight: 140, textAlign: "start",
            }} />
          <button onClick={send} disabled={busy || analyzing || !input.trim()} aria-label="Send"
            className="rounded-lg px-4 py-2.5 font-semibold flex items-center gap-2 raqib-focus"
            style={{ background: input.trim() && !busy && !analyzing ? T.green : T.line, color: input.trim() && !busy && !analyzing ? "#F4F2E9" : T.inkFaint, fontSize: 14 }}>
            <Send size={15} style={{ transform: lang === "ar" ? "scaleX(-1)" : "none" }} />
          </button>
        </div>
      </div>

      {reqLink && (
        <RequestUploadLinkModal lang={lang} toast={toast} onClose={() => setReqLink(false)} onCreated={onEvidence} />
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   CONTROL DRAWER — evidence record, maturity, review state, AI guidance
══════════════════════════════════════════════════════════════════════════ */

function ControlDrawer({ row, assess, onSave, onClose, audit, guidance, onGuidance, onAskAI, lang, evidence, user, onCreateAction }) {
  const rec = assess[row.key] || {};
  const [note, setNote] = useState(rec.note || "");
  const [owner, setOwner] = useState(rec.owner || "");
  const [due, setDue] = useState(rec.due || "");
  const [st, setSt] = useState(rec.s || "unassessed");
  const [mat, setMat] = useState(Number.isFinite(rec.m) ? rec.m : -1);
  const [genBusy, setGenBusy] = useState(false);
  const trail = audit.filter((a) => a.key === row.key).slice(0, 5);
  const g = guidance[row.key];
  const isAr = lang === "ar";
  const canAssess = can(user.role, "assess");
  const linked = Object.values(evidence).filter((ev) => (ev.controls || []).includes(row.key));
  const QC = { strong: T.compliant, adequate: T.partial, weak: T.gap };

  const save = () => onSave(row.key, {
    s: st, note: note.trim(), owner: owner.trim(), due,
    ...(row.fw === "samacsf" && mat >= 0 ? { m: mat } : {}),
  });

  return (
    <div className="fixed inset-0 flex justify-end" style={{ zIndex: 80, background: "rgba(20,28,24,0.35)" }} onClick={onClose}>
      <div className="h-full overflow-y-auto raqib-drawer w-full" onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 440, background: T.panel, boxShadow: "0 0 40px rgba(15,25,20,0.3)" }}>
        <div className="p-5" style={{ background: T.green }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Mono style={{ color: T.brassSoft, fontWeight: 700, fontSize: 14 }}>{row.control.id}</Mono>
                {rec.review === "pending" && (
                  <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 700, background: "rgba(184,134,27,0.25)", color: "#F2D9A0" }}>
                    {tt(lang, "pendingBadge")}
                  </span>
                )}
                {rec.review === "rejected" && (
                  <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 700, background: "rgba(178,58,46,0.3)", color: "#F3C8C0" }}>
                    {tt(lang, "rejectedBadge")}
                  </span>
                )}
              </div>
              <div dir="auto" style={{ color: "#F1EFE6", fontSize: 16, fontWeight: 600, marginTop: 4, lineHeight: 1.4, textAlign: "start" }}>{row.control.t}</div>
              <div style={{ color: "#9DB1A7", fontSize: 12, marginTop: 6 }}>
                {FRAMEWORKS[row.fw].short} · {isAr ? row.domainAr : row.domain} · {isAr && row.sub.ar ? row.sub.ar : row.sub.en}
              </div>
              <div style={{ fontFamily: isAr ? "inherit" : "'IBM Plex Sans Arabic'", color: T.brassSoft, fontSize: 12, marginTop: 2 }}>
                {isAr ? row.sub.en : row.sub.ar}
              </div>
            </div>
            <button onClick={onClose} className="rounded-md p-1.5 raqib-focus" style={{ background: "rgba(255,255,255,0.12)" }}>
              <X size={16} color="#E9E6DA" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {!canAssess && (
            <div className="rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: "rgba(168,123,34,0.1)", color: T.brass, fontSize: 12, fontWeight: 600 }}>
              <Eye size={13} /> {tt(lang, "roViewer")}
            </div>
          )}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, marginBottom: 6 }}>{tt(lang, "status")}</div>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_KEYS.map((k) => (
                <button key={k} onClick={() => canAssess && setSt(k)} disabled={!canAssess}
                  className="rounded-lg px-3 py-2 flex items-center gap-2 raqib-focus"
                  style={{
                    border: `1px solid ${st === k ? STATUS_META[k].color : T.line}`,
                    background: st === k ? `${STATUS_META[k].color}14` : T.paper,
                    fontSize: 12.5, fontWeight: st === k ? 700 : 500, color: st === k ? STATUS_META[k].color : T.inkSoft,
                    textAlign: "start", opacity: canAssess ? 1 : 0.6, cursor: canAssess ? "pointer" : "not-allowed",
                  }}>
                  <StatusDot s={k} size={7} /> {stLabel(lang, k)}
                </button>
              ))}
            </div>
          </div>

          {row.fw === "samacsf" && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, marginBottom: 6 }}>
                <GaugeIcon size={11} style={{ display: "inline", marginInlineEnd: 4 }} />{tt(lang, "maturityLbl")}
              </div>
              <div className="flex gap-1.5 items-center flex-wrap">
                {[-1, 0, 1, 2, 3, 4, 5].map((v) => (
                  <button key={v} onClick={() => canAssess && setMat(v)} disabled={!canAssess}
                    className="rounded-md raqib-focus" style={{
                      width: v === -1 ? "auto" : 34, padding: v === -1 ? "6px 10px" : "6px 0", fontSize: 12, fontWeight: 700,
                      border: `1px solid ${mat === v ? T.sama : T.line}`,
                      background: mat === v ? "rgba(107,69,22,0.12)" : T.paper,
                      color: mat === v ? T.sama : T.inkFaint,
                      opacity: canAssess ? 1 : 0.6,
                    }}>
                    {v === -1 ? tt(lang, "maturityNone") : v}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, marginBottom: 6 }}>
                <User size={11} style={{ display: "inline", marginInlineEnd: 4 }} />{tt(lang, "owner")}
              </div>
              <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder={tt(lang, "ownerPh")} dir="auto"
                style={inputStyle} className="raqib-focus" disabled={!canAssess} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, marginBottom: 6 }}>
                <CalendarClock size={11} style={{ display: "inline", marginInlineEnd: 4 }} />{tt(lang, "dueLbl")}
              </div>
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} style={inputStyle} className="raqib-focus" disabled={!canAssess} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, marginBottom: 6 }}>{tt(lang, "evidenceLbl")}</div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} dir="auto"
              placeholder={tt(lang, "notePh")} disabled={!canAssess}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.7 }} className="raqib-focus" />
          </div>

          {canAssess && (
            <button onClick={save} className="w-full rounded-lg py-2.5 font-semibold raqib-focus"
              style={{ background: T.green, color: "#F4F2E9", fontSize: 14 }}>
              {tt(lang, "saveAssess")}
            </button>
          )}

          {/* POA&M entry point: remediate a gap/partial control from here */}
          {canCreateAction(user.role) && (rec.s === "gap" || rec.s === "partial") && (
            <button onClick={() => onCreateAction(row)}
              className="w-full rounded-lg py-2.5 font-semibold inline-flex items-center justify-center gap-2 raqib-focus"
              style={{ background: "rgba(22,143,91,0.1)", color: T.emerald, fontSize: 13.5, border: `1px solid ${T.emerald}` }}>
              <ListTodo size={14} /> {tt(lang, "createFromGap")}
            </button>
          )}

          {linked.length > 0 && (
            <Card className="p-4">
              <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft }}>
                <FileCheck2 size={12} style={{ display: "inline", marginInlineEnd: 5 }} color={T.green} />{tt(lang, "linkedEvidence")} ({linked.length})
              </div>
              <div className="mt-2 space-y-2">
                {linked.map((ev) => (
                  <div key={ev.id} className="flex items-start gap-2" style={{ fontSize: 12, color: T.inkSoft }}>
                    <span className="rounded-full mt-1" style={{ width: 7, height: 7, background: QC[ev.quality] || T.na, flexShrink: 0 }} />
                    <div className="min-w-0">
                      <div dir="auto" style={{ fontWeight: 600, color: T.ink }}>{ev.name}</div>
                      <div dir="auto" style={{ fontSize: 11.5, lineHeight: 1.5 }}>{ev.summary.slice(0, 110)}{ev.summary.length > 110 ? "…" : ""}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft }}>
                <Wand2 size={12} style={{ display: "inline", marginInlineEnd: 5 }} color={T.brass} />{tt(lang, "guidanceLbl")}
              </div>
              {!g && (
                <button disabled={genBusy}
                  onClick={async () => { setGenBusy(true); await onGuidance(row); setGenBusy(false); }}
                  className="rounded-md px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 raqib-focus"
                  style={{ background: "rgba(168,123,34,0.14)", color: T.brass }}>
                  {genBusy ? <Loader2 size={12} className="raqib-spin" /> : <Sparkles size={12} />} {tt(lang, "generate")}
                </button>
              )}
            </div>
            {g ? (
              <div dir="auto" style={{
                fontSize: 12.5, color: T.ink, lineHeight: hasArabic(g) ? 1.9 : 1.65, marginTop: 8, textAlign: "start",
                fontFamily: hasArabic(g) ? "'IBM Plex Sans Arabic','IBM Plex Sans',sans-serif" : "inherit",
              }}><RichText text={g} /></div>
            ) : (
              <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 8 }}>{tt(lang, "guidanceHint")}</div>
            )}
            <button onClick={() => onAskAI(row)} className="mt-3 text-xs font-semibold raqib-focus" style={{ color: T.green }}>
              {tt(lang, "openAdvisor")}
            </button>
          </Card>

          {trail.length > 0 && (
            <Card className="p-4">
              <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft }}>
                <History size={12} style={{ display: "inline", marginInlineEnd: 5 }} />{tt(lang, "historyLbl")}
              </div>
              <div className="mt-2 space-y-1.5">
                {trail.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 flex-wrap" style={{ fontSize: 11.5, color: T.inkSoft }}>
                    <StatusDot s={a.to} size={6} />
                    {stLabel(lang, a.from)} ← <b style={{ color: (STATUS_META[a.to] || STATUS_META.unassessed).color }}>{stLabel(lang, a.to)}</b>
                    {a.by && <span style={{ color: T.inkFaint }}>· {a.by}</span>}
                    <span style={{ color: T.inkFaint, marginInlineStart: "auto" }} dir="ltr">{new Date(a.t).toLocaleString(lang === "ar" ? "ar-SA" : undefined)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════════════════════════════════ */

function Dashboard({ catalogs, selected, assess, org, goControls, snaps, audit, allRows, onExportCSV, onExportJSON, onReport, lang, evidence, user, goEvidence }) {
  const overall = useMemo(() => scoreOf(allRows, assess), [allRows, assess]);
  const perFw = selected.map((fw) => ({ fw, ...scoreOf(allRows.filter((r) => r.fw === fw), assess) }));
  const isAr = lang === "ar";

  const domainData = useMemo(() => {
    const rows = [];
    for (const fw of selected) {
      for (const d of catalogs[fw].domains) {
        const sub = allRows.filter((r) => r.fw === fw && r.domainN === d.n);
        const s = scoreOf(sub, assess);
        rows.push({ name: `${FRAMEWORKS[fw].short.split(" ")[0]} D${d.n}`, full: isAr && d.ar ? d.ar : d.en, pct: s.pct, gaps: s.counts.gap, fw });
      }
    }
    return rows;
  }, [allRows, assess, catalogs, selected, isAr]);

  const donut = Object.entries(overall.counts).filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: stLabel(lang, k), value: v, color: STATUS_META[k].color }));
  const trend = snaps.map((s) => ({
    t: new Date(s.t).toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " +
       new Date(s.t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
    pct: s.pct,
  }));
  const topGaps = allRows.filter((r) => assess[r.key]?.s === "gap")
    .sort((a, b) => (assess[b.key]?.t || 0) - (assess[a.key]?.t || 0)).slice(0, 5);
  const overdue = allRows.filter((r) => {
    const a = assess[r.key];
    return a?.due && a.s !== "compliant" && a.s !== "na" && new Date(a.due) < new Date();
  }).length;

  const evCov = useMemo(() => evidenceCoverage(allRows, assess, evidence), [allRows, assess, evidence]);
  const evList = Object.values(evidence).sort((a, b) => b.t - a.t);
  const evByType = useMemo(() => {
    const m = {};
    for (const ev of evList) m[ev.docType] = (m[ev.docType] || 0) + 1;
    const palette = [T.green, T.brass, T.sama, T.partial, T.na, T.compliant, T.gap, T.inkFaint];
    return Object.entries(m).map(([k, v], i) => ({ name: k, value: v, color: palette[i % palette.length] }));
  }, [evList]);
  const samaRows = allRows.filter((r) => r.fw === "samacsf");
  const mat = avgMaturity(samaRows, assess);
  const QC = { strong: T.compliant, adequate: T.partial, weak: T.gap };
  const tipStyle = { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 10, fontSize: 12, direction: "ltr" };

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3 raqib-rise">
        <div>
          <Eyebrow ar="وضع الامتثال" en="Compliance posture" lang={lang} />
          <h1 style={{ fontSize: 26, fontWeight: 700, color: T.ink, marginTop: 4 }}>{org || tt(lang, "orgFallback")}</h1>
          <div style={{ fontSize: 13, color: T.inkSoft }}>
            {tt(lang, "countsLine", { t: overall.total, c: overall.counts.compliant, g: overall.counts.gap })}
            {overdue > 0 && <span style={{ color: T.gap, fontWeight: 700 }}> · {tt(lang, "overdueN", { n: overdue })}</span>}
            {mat != null && <span style={{ color: T.sama, fontWeight: 600 }}> · {tt(lang, "avgMaturity", { m: mat })}</span>}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={onReport} className="rounded-lg px-3 py-2 text-sm font-semibold flex items-center gap-1.5 raqib-focus"
            style={{ background: T.green, color: "#F4F2E9" }}>
            <FileDown size={14} /> {tt(lang, "reportBtn")}
          </button>
          {can(user.role, "exportData") && (
            <>
              <button onClick={onExportCSV} className="rounded-lg px-3 py-2 text-sm font-semibold flex items-center gap-1.5 raqib-focus"
                style={{ background: T.panel, border: `1px solid ${T.line}`, color: T.inkSoft }}>
                <FileSpreadsheet size={14} /> CSV
              </button>
              <button onClick={onExportJSON} className="rounded-lg px-3 py-2 text-sm font-semibold flex items-center gap-1.5 raqib-focus"
                style={{ background: T.panel, border: `1px solid ${T.line}`, color: T.inkSoft }}>
                <FileJson size={14} /> JSON
              </button>
            </>
          )}
          {overall.counts.unassessed > 0 && can(user.role, "assess") && (
            <button onClick={goControls} className="rounded-lg px-4 py-2 text-sm font-semibold raqib-focus transition-transform hover:scale-[1.02]"
              style={{ background: T.panel, border: `1px solid ${T.green}`, color: T.green }}>
              {tt(lang, "assessRemaining", { n: overall.counts.unassessed })}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 flex items-center justify-center">
          <PostureGauge pct={overall.pct} label={tt(lang, "overall")} accent={T.green} big sub={tt(lang, "applicable", { n: overall.denom })} />
        </Card>
        <Card className="p-5 md:col-span-2">
          <Eyebrow ar="حسب الإطار" en="By framework" lang={lang} />
          <div className="flex items-center justify-around mt-2 flex-wrap gap-4">
            {perFw.map((p) => (
              <PostureGauge key={p.fw} pct={p.pct} label={FRAMEWORKS[p.fw].short} accent={FRAMEWORKS[p.fw].accent}
                sub={tt(lang, "gapsUn", { g: p.counts.gap, u: p.counts.unassessed })} />
            ))}
            {perFw.length === 1 && (
              <div style={{ maxWidth: 230, fontSize: 13, color: T.inkSoft }}>{tt(lang, "singleScope")}</div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="p-5 lg:col-span-3">
          <Eyebrow ar="حسب النطاق" en="Domain readiness" lang={lang} />
          <div style={{ height: 230, direction: "ltr" }} className="mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={domainData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={T.line} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: T.inkSoft }} axisLine={{ stroke: T.line }} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: T.inkFaint }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "rgba(17,64,47,0.06)" }} contentStyle={tipStyle}
                  formatter={(v) => [`${v}%`, ""]} labelFormatter={(l, p) => p?.[0]?.payload?.full || l} />
                <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                  {domainData.map((d, i) => <Cell key={i} fill={FRAMEWORKS[d.fw].accent} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <Eyebrow ar="توزيع الحالات" en="Control status mix" lang={lang} />
          <div style={{ height: 170, direction: "ltr" }} className="mt-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donut} dataKey="value" innerRadius={50} outerRadius={74} paddingAngle={2} stroke={T.panel}>
                  {donut.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={tipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1">
            {donut.map((d) => (
              <div key={d.name} className="flex items-center gap-2" style={{ fontSize: 12, color: T.inkSoft }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: d.color }} />
                {d.name} · {d.value}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Evidence row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <Eyebrow ar="تغطية الأدلة" en="Evidence coverage" lang={lang} />
            <button onClick={goEvidence} className="raqib-focus" style={{ fontSize: 12, color: T.green, fontWeight: 600 }}>{tt(lang, "viewAll")}</button>
          </div>
          <div className="flex items-center gap-5 mt-3 flex-wrap">
            <PostureGauge pct={evCov.pct} label={tt(lang, "nav").evidence} accent={T.brass}
              sub={`${evCov.have}/${evCov.need}`} />
            {evByType.length > 0 && (
              <div style={{ width: 130, height: 110, direction: "ltr" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={evByType} dataKey="value" innerRadius={28} outerRadius={48} paddingAngle={2} stroke={T.panel}>
                      {evByType.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip contentStyle={tipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 4 }}>{tt(lang, "evCoverageSub", { p: evCov.pct })}</div>
        </Card>

        <Card className="p-5 lg:col-span-3">
          <Eyebrow ar="أحدث الأدلة" en="Recent evidence" lang={lang} />
          {evList.length === 0 ? (
            <div style={{ fontSize: 13, color: T.inkFaint, marginTop: 10 }}>{tt(lang, "evidenceEmpty")}</div>
          ) : (
            <div className="mt-3 space-y-2">
              {evList.slice(0, 4).map((ev) => (
                <div key={ev.id} className="flex items-center gap-3 rounded-lg px-3 py-2 flex-wrap"
                  style={{ background: "rgba(17,64,47,0.04)", border: `1px solid ${T.line}` }}>
                  <span className="rounded-full" style={{ width: 8, height: 8, background: QC[ev.quality], flexShrink: 0 }} />
                  <span dir="auto" style={{ fontSize: 13, fontWeight: 600, color: T.ink, flex: 1, minWidth: 140 }}>{ev.name}</span>
                  <span style={{ fontSize: 11, color: T.inkFaint }}>{ev.docType}</span>
                  <span style={{ fontSize: 11, color: T.green, fontWeight: 700 }}>{tt(lang, "linkedTo", { n: (ev.controls || []).length })}</span>
                  <span style={{ fontSize: 11, color: T.inkFaint }} dir="ltr">{new Date(ev.t).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="p-5 lg:col-span-3">
          <Eyebrow ar="مسار الجاهزية" en="Posture trend" lang={lang} />
          {trend.length >= 2 ? (
            <div style={{ height: 170, direction: "ltr" }} className="mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={T.green} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={T.green} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={T.line} vertical={false} />
                  <XAxis dataKey="t" tick={{ fontSize: 10, fill: T.inkFaint }} axisLine={{ stroke: T.line }} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: T.inkFaint }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tipStyle} formatter={(v) => [`${v}%`, ""]} />
                  <Area type="monotone" dataKey="pct" stroke={T.green} strokeWidth={2} fill="url(#trendFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: T.inkFaint, marginTop: 10 }}>{tt(lang, "trendHint")}</div>
          )}
        </Card>

        <Card className="p-5 lg:col-span-2">
          <Eyebrow ar="آخر النشاط" en="Recent activity" lang={lang} />
          {audit.length === 0 ? (
            <div style={{ fontSize: 13, color: T.inkFaint, marginTop: 10 }}>{tt(lang, "activityEmpty")}</div>
          ) : (
            <div className="mt-2 space-y-2">
              {audit.slice(0, 6).map((a, i) => (
                <div key={i} className="flex items-center gap-2" style={{ fontSize: 12, color: T.inkSoft }}>
                  <StatusDot s={a.to} size={7} />
                  <Mono style={{ fontWeight: 600, color: T.ink }}>{a.id}</Mono>
                  <span>← {stLabel(lang, a.to)}</span>
                  {a.by && <span style={{ color: T.inkFaint, fontSize: 11 }}>{a.by}</span>}
                  <span style={{ marginInlineStart: "auto", color: T.inkFaint, fontSize: 11 }} dir="ltr">
                    {new Date(a.t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <Eyebrow ar="الفجوات المفتوحة" en="Open gaps requiring remediation" lang={lang} />
          <button onClick={goControls} className="raqib-focus" style={{ fontSize: 12, color: T.green, fontWeight: 600 }}>{tt(lang, "viewAll")}</button>
        </div>
        {topGaps.length === 0 ? (
          <div style={{ fontSize: 13, color: T.inkFaint, marginTop: 10 }}>{tt(lang, "gapsEmpty")}</div>
        ) : (
          <div className="mt-3 space-y-2">
            {topGaps.map((r) => {
              const a = assess[r.key] || {};
              return (
                <div key={r.key} className="flex items-center gap-3 rounded-lg px-3 py-2 flex-wrap"
                  style={{ background: "rgba(178,58,46,0.06)", border: "1px solid rgba(178,58,46,0.18)" }}>
                  <StatusDot s="gap" />
                  <Mono style={{ color: T.gap, fontWeight: 600, minWidth: 60 }}>{r.control.id}</Mono>
                  <span dir="auto" style={{ fontSize: 13, color: T.ink, flex: 1, minWidth: 180, textAlign: "start" }}>{r.control.t}</span>
                  {a.owner && <span dir="auto" style={{ fontSize: 11, color: T.inkSoft }}><User size={10} style={{ display: "inline" }} /> {a.owner}</span>}
                  {a.due && <span style={{ fontSize: 11, color: new Date(a.due) < new Date() ? T.gap : T.inkSoft, fontWeight: 600 }}>{tt(lang, "due", { d: a.due })}</span>}
                  <span style={{ fontSize: 11, color: T.inkFaint }}>{FRAMEWORKS[r.fw].short}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   CONTROLS REGISTER (+ CSV import)
══════════════════════════════════════════════════════════════════════════ */

function ImportModal({ lang, onClose, keysByCid, onApply }) {
  const [parsed, setParsed] = useState(null);
  const [err, setErr] = useState("");
  const fileRef = useRef(null);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr("");
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (!rows.length) throw new Error("empty");
      const plan = buildImport(rows, keysByCid);
      if (plan.error) throw new Error(plan.error);
      setParsed({ rows: rows.length - 1, plan });
    } catch (e2) {
      setErr(`${tt(lang, "badCsv")}${e2.message ? ` — ${e2.message}` : ""}`);
      setParsed(null);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center px-4" style={{ zIndex: 85, background: "rgba(20,28,24,0.4)" }} onClick={onClose}>
      <Card className="p-5 w-full raqib-drawer" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div style={{ fontSize: 16, fontWeight: 700, color: T.ink }}>{tt(lang, "importTitle")}</div>
          <button onClick={onClose} className="raqib-focus"><X size={16} color={T.inkFaint} /></button>
        </div>
        <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 8, lineHeight: 1.7 }}>{tt(lang, "importHint")}</div>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: "none" }} />
        <button onClick={() => fileRef.current?.click()}
          className="mt-4 rounded-lg px-4 py-2.5 text-sm font-semibold flex items-center gap-2 raqib-focus"
          style={{ background: "rgba(168,123,34,0.14)", color: T.brass }}>
          <Upload size={14} /> {tt(lang, "chooseFile")}
        </button>
        {err && <div style={{ color: T.gap, fontSize: 12.5, marginTop: 10 }} dir="auto">{err}</div>}
        {parsed && (
          <>
            <div style={{ fontSize: 13, color: T.ink, marginTop: 12, fontWeight: 600 }}>
              {tt(lang, "previewN", { n: parsed.rows, m: parsed.plan.matched })}
            </div>
            <button disabled={!parsed.plan.matched}
              onClick={() => { onApply(parsed.plan); onClose(); }}
              className="mt-3 w-full rounded-lg py-2.5 font-semibold raqib-focus"
              style={{ background: parsed.plan.matched ? T.green : T.line, color: parsed.plan.matched ? "#F4F2E9" : T.inkFaint, fontSize: 14 }}>
              {tt(lang, "applyImport")}
            </button>
          </>
        )}
      </Card>
    </div>
  );
}

function ControlsView({ allRows, selected, assess, onStatus, onBulk, onOpen, lang, user, keysByCid, onImport }) {
  const [q, setQ] = useState("");
  const [fwF, setFwF] = useState("all");
  const [stF, setStF] = useState("all");
  const [openSub, setOpenSub] = useState({});
  const [showImport, setShowImport] = useState(false);
  const isAr = lang === "ar";
  const canAssess = can(user.role, "assess");
  const canBulk = can(user.role, "bulk");

  const filtered = allRows.filter((r) => {
    if (fwF !== "all" && r.fw !== fwF) return false;
    const st = assess[r.key]?.s || "unassessed";
    if (stF !== "all" && st !== stF) return false;
    if (q && !(`${r.control.id} ${r.control.t} ${r.sub.en} ${r.sub.ar} ${r.domain} ${r.domainAr || ""}`.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });

  const groups = useMemo(() => {
    const m = new Map();
    for (const r of filtered) {
      const gk = `${r.fw}:${r.sub.id}`;
      if (!m.has(gk)) m.set(gk, { fw: r.fw, domain: r.domain, domainAr: r.domainAr, sub: r.sub, rows: [] });
      m.get(gk).rows.push(r);
    }
    return [...m.values()];
  }, [filtered]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      {showImport && <ImportModal lang={lang} keysByCid={keysByCid} onApply={onImport} onClose={() => setShowImport(false)} />}
      <div className="flex items-end justify-between flex-wrap gap-3 raqib-rise">
        <div>
          <Eyebrow ar="سجل الضوابط" en="Controls register" lang={lang} />
          <h1 style={{ fontSize: 24, fontWeight: 700, color: T.ink, marginTop: 4 }}>
            {tt(lang, "regCount", { x: filtered.length, y: allRows.length })}
          </h1>
          <div style={{ fontSize: 12.5, color: T.inkFaint }}>{canAssess ? tt(lang, "regHint") : tt(lang, "roViewer")}</div>
        </div>
        {can(user.role, "importData") && (
          <button onClick={() => setShowImport(true)}
            className="rounded-lg px-3 py-2 text-sm font-semibold flex items-center gap-1.5 raqib-focus"
            style={{ background: T.panel, border: `1px solid ${T.line}`, color: T.inkSoft }}>
            <Upload size={14} /> {tt(lang, "importBtn")}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-2 rounded-lg px-3 flex-1" style={{ background: T.panel, border: `1px solid ${T.line}`, minWidth: 200 }}>
          <Search size={15} color={T.inkFaint} />
          <input value={q} dir="auto" onChange={(e) => setQ(e.target.value)} placeholder={tt(lang, "searchPh")}
            className="py-2 w-full outline-none bg-transparent" style={{ fontSize: 13, color: T.ink, textAlign: "start" }} />
          {q && <button onClick={() => setQ("")} className="raqib-focus"><X size={13} color={T.inkFaint} /></button>}
        </div>
        <select value={fwF} onChange={(e) => setFwF(e.target.value)} style={selStyle} className="raqib-focus">
          <option value="all">{tt(lang, "allFw")}</option>
          {selected.map((f) => <option key={f} value={f}>{FRAMEWORKS[f].short}</option>)}
        </select>
        <select value={stF} onChange={(e) => setStF(e.target.value)} style={selStyle} className="raqib-focus">
          <option value="all">{tt(lang, "allSt")}</option>
          {STATUS_KEYS.map((k) => <option key={k} value={k}>{stLabel(lang, k)}</option>)}
        </select>
      </div>

      <div className="space-y-3">
        {groups.map((g) => {
          const gk = `${g.fw}:${g.sub.id}`;
          const open = openSub[gk] !== false;
          const s = scoreOf(g.rows, assess);
          return (
            <Card key={gk}>
              <div className="flex items-center gap-2 px-4 py-3">
                <button onClick={() => setOpenSub((p) => ({ ...p, [gk]: !open }))}
                  className="flex items-center gap-3 flex-1 min-w-0 raqib-focus" style={{ textAlign: "start" }}>
                  <ChevronDown size={16} color={T.inkFaint}
                    style={{ transform: open ? "none" : `rotate(${isAr ? "" : "-"}90deg)`, transition: "transform 160ms" }} />
                  <Mono style={{ color: FRAMEWORKS[g.fw].accent, fontWeight: 700, minWidth: 52 }}>{g.sub.id}</Mono>
                  <div className="flex-1 min-w-0">
                    <div dir="auto" style={{ fontSize: 14, fontWeight: 600, color: T.ink, textAlign: "start" }}>
                      {isAr && g.sub.ar ? g.sub.ar : g.sub.en}
                    </div>
                    <div className="flex gap-2 items-baseline flex-wrap">
                      <span dir="auto" style={{ fontFamily: isAr ? "inherit" : "'IBM Plex Sans Arabic'", fontSize: 12, color: T.brass }}>
                        {isAr ? g.sub.en : g.sub.ar}
                      </span>
                      <span style={{ fontSize: 11, color: T.inkFaint }}>{FRAMEWORKS[g.fw].short} · {isAr && g.domainAr ? g.domainAr : g.domain}</span>
                    </div>
                  </div>
                </button>
                {canBulk && (
                  <select value="" onChange={(e) => { if (e.target.value) onBulk(g.rows, e.target.value); }}
                    title={tt(lang, "setAll")} style={{ ...selStyle, padding: "4px 6px", fontSize: 11 }} className="raqib-focus">
                    <option value="">{tt(lang, "setAll")}</option>
                    {STATUS_KEYS.map((k) => <option key={k} value={k}>{stLabel(lang, k)}</option>)}
                  </select>
                )}
                <div className="rounded-full px-2.5 py-1" style={{ background: T.paper, border: `1px solid ${T.line}`, fontSize: 11, fontWeight: 700, color: s.pct >= 80 ? T.compliant : s.pct >= 40 ? T.partial : T.gap }}>
                  {s.pct}%
                </div>
              </div>
              {open && (
                <div style={{ borderTop: `1px solid ${T.line}` }}>
                  {g.rows.map((r) => {
                    const a = assess[r.key] || {};
                    const st = a.s || "unassessed";
                    return (
                      <div key={r.key} className="flex items-center gap-3 px-4 py-2.5 flex-wrap raqib-row"
                        style={{ borderBottom: `1px solid ${T.paper}`, cursor: "pointer" }}
                        onClick={() => onOpen(r)}>
                        <StatusDot s={st} />
                        <Mono style={{ color: T.inkSoft, minWidth: 60 }}>{r.control.id}</Mono>
                        <span dir="auto" style={{ fontSize: 13, color: T.ink, flex: 1, minWidth: 180, textAlign: "start" }}>{r.control.t}</span>
                        {a.review === "pending" && (
                          <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 700, background: "rgba(184,134,27,0.14)", color: T.partial }}>
                            {tt(lang, "pendingBadge")}
                          </span>
                        )}
                        {a.note && <span title={tt(lang, "evidenceLbl")} style={{ fontSize: 10, color: T.brass }}>●</span>}
                        {Number.isFinite(a.m) && <span style={{ fontSize: 10.5, fontWeight: 700, color: T.sama }}>M{a.m}</span>}
                        {a.owner && <span dir="auto" style={{ fontSize: 11, color: T.inkFaint }}>{a.owner}</span>}
                        {a.due && <span style={{ fontSize: 11, fontWeight: 600, color: new Date(a.due) < new Date() && st !== "compliant" && st !== "na" ? T.gap : T.inkFaint }}>{a.due}</span>}
                        {canAssess ? (
                          <select value={st} onClick={(e) => e.stopPropagation()}
                            onChange={(e) => onStatus(r, e.target.value)}
                            style={{ ...selStyle, padding: "5px 8px", fontSize: 12, color: (STATUS_META[st] || STATUS_META.unassessed).color, fontWeight: 600 }}
                            className="raqib-focus">
                            {STATUS_KEYS.map((k) => <option key={k} value={k}>{stLabel(lang, k)}</option>)}
                          </select>
                        ) : (
                          <span style={{ fontSize: 12, fontWeight: 600, color: (STATUS_META[st] || STATUS_META.unassessed).color }}>{stLabel(lang, st)}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
        {groups.length === 0 && (
          <Card className="p-8 text-center" style={{ color: T.inkFaint, fontSize: 13 }}>{tt(lang, "noMatch")}</Card>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   EVIDENCE REGISTRY
══════════════════════════════════════════════════════════════════════════ */

/* Item 5: clicking a control code in the registry opens a popover with the
   control's title, catalog context and official source — or a clear
   "no mapping" state. Never navigates away. */
function ControlPopover({ keyStr, row, versions, lang, onClose }) {
  const isAr = lang === "ar";
  const cid = keyStr.split(":")[1] || keyStr;
  const fw = row ? FRAMEWORKS[row.fw] : null;
  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 90, background: "rgba(20,28,24,0.3)" }} onClick={onClose}>
      <Card className="p-5 raqib-drawer" style={{ maxWidth: 440, width: "92%", background: "#FFFFFF" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <Mono style={{ fontWeight: 700, color: "#FFFFFF", background: T.emerald, borderRadius: 6, padding: "2px 10px", fontSize: 14 }}>{cid}</Mono>
          <button onClick={onClose} className="rounded-md p-1.5 raqib-focus" style={{ background: "rgba(0,0,0,0.05)" }}>
            <X size={15} color={T.inkSoft} />
          </button>
        </div>
        {row ? (
          <div className="mt-3 space-y-2">
            <div dir="auto" style={{ fontSize: 15, fontWeight: 700, color: T.ink, lineHeight: 1.45, textAlign: "start" }}>{row.control.t}</div>
            <div dir="auto" style={{ fontSize: 12.5, color: T.inkSoft, lineHeight: 1.6, textAlign: "start" }}>
              {isAr && row.domainAr ? row.domainAr : row.domain} · {isAr && row.sub.ar ? row.sub.ar : row.sub.en}
            </div>
            <div className="rounded-lg p-3" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.inkFaint }}>{tt(lang, "ctrlSource")}</div>
              <div style={{ fontSize: 12.5, color: T.ink, marginTop: 4 }}>
                {fw.short} {(versions && versions[row.fw]) || ""} · {isAr ? fw.regulatorAr : fw.regulator}
              </div>
              <div style={{ fontSize: 12, marginTop: 2 }} dir="ltr">
                <a href={`https://${fw.officialSource}`} target="_blank" rel="noopener noreferrer"
                  className="raqib-focus" style={{ color: T.emerald, fontWeight: 600 }}>
                  {fw.officialSource}
                </a>
                {" · "}<Mono style={{ color: T.inkSoft, fontSize: 11.5 }}>{fw.short} {row.control.id}</Mono>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded-lg p-3" style={{ background: "rgba(184,134,27,0.08)", border: "1px solid rgba(184,134,27,0.3)", fontSize: 12.5, color: T.amber, fontWeight: 600 }}>
            {tt(lang, "ctrlNoMap")}
          </div>
        )}
      </Card>
    </div>
  );
}

/* Standalone "request evidence" flow: generate an upload link BEFORE any
   evidence exists. Creates a placeholder registry item (docType "request")
   that external uploads attach to. Available from the Evidence Registry and
   the Advisor headers (Admin/Manager/Assessor; server-enforced). */
function RequestUploadLinkModal({ lang, toast, onCreated, onClose }) {
  const [title, setTitle] = useState("");
  const [expiresDays, setExpiresDays] = useState(7);
  const [maxUses, setMaxUses] = useState(1);
  const [fresh, setFresh] = useState(null); // one-time link
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");

  const gen = async () => {
    setErr("");
    if (!title.trim()) return setErr(tt(lang, "linkReqName"));
    setBusy(true);
    try {
      const { link, evidence: ev } = await api.createUploadLink({ title: title.trim(), expiresDays, maxUses });
      setFresh({ url: `${window.location.origin}/u/${link.token}`, expiresAt: link.expiresAt, maxUses: link.maxUses });
      if (ev && onCreated) onCreated(ev);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(fresh.url); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {}
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 95, background: "rgba(20,28,24,0.35)" }} onClick={onClose}>
      <Card className="p-5 raqib-drawer w-full space-y-3" style={{ maxWidth: 480, background: "#FFFFFF" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div style={{ fontSize: 16, fontWeight: 700, color: T.ink }}>{tt(lang, "genLink")}</div>
          <button onClick={onClose} className="rounded-md p-1.5 raqib-focus" style={{ background: "rgba(0,0,0,0.05)" }}><X size={15} color={T.inkSoft} /></button>
        </div>

        {!fresh ? (
          <>
            <div style={{ fontSize: 12.5, color: T.inkSoft, lineHeight: 1.6 }}>{tt(lang, "linkReqHint")}</div>
            <div>
              <FieldLbl>{tt(lang, "linkReqName")}</FieldLbl>
              <input value={title} onChange={(e) => setTitle(e.target.value)} dir="auto" autoFocus
                placeholder={lang === "ar" ? "مثال: سياسة النسخ الاحتياطي — المورّد س" : "e.g. Backup policy — Vendor X"}
                style={inputStyle} className="raqib-focus" onKeyDown={(e) => e.key === "Enter" && gen()} />
            </div>
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <FieldLbl>{tt(lang, "linkExpiry")}</FieldLbl>
                <input type="number" min={1} max={30} value={expiresDays} onChange={(e) => setExpiresDays(e.target.value)}
                  dir="ltr" style={{ ...inputStyle, width: 90 }} className="raqib-focus" />
              </div>
              <div>
                <FieldLbl>{tt(lang, "linkUses")}</FieldLbl>
                <input type="number" min={1} max={100} value={maxUses} onChange={(e) => setMaxUses(e.target.value)}
                  dir="ltr" style={{ ...inputStyle, width: 90 }} className="raqib-focus" />
              </div>
            </div>
            {err && <div style={{ color: T.red, fontSize: 12.5 }}>{err}</div>}
            <button onClick={gen} disabled={busy} className="w-full rounded-lg py-2.5 font-semibold inline-flex items-center justify-center gap-2 raqib-focus"
              style={{ background: T.emerald, color: "#FFFFFF", fontSize: 14, opacity: busy ? 0.6 : 1 }}>
              {busy ? <Loader2 size={15} className="raqib-spin" /> : <Upload size={15} />} {tt(lang, "genLink")}
            </button>
          </>
        ) : (
          <>
            <div className="rounded-lg p-3 space-y-2" style={{ background: "rgba(22,143,91,0.07)", border: `1px solid ${T.emerald}` }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: T.emerald }}>{tt(lang, "linkOnce")}</div>
              <div className="flex items-center gap-2 flex-wrap">
                <Mono style={{ fontSize: 11.5, color: T.ink, wordBreak: "break-all", flex: 1, minWidth: 200, background: "#FFFFFF", borderRadius: 6, padding: "6px 8px", border: `1px solid ${T.line}` }} dir="ltr">
                  {fresh.url}
                </Mono>
                <button onClick={copy} className="rounded-lg px-3 py-2 text-xs font-bold inline-flex items-center gap-1.5 raqib-focus"
                  style={{ background: T.emerald, color: "#FFFFFF" }}>
                  {copied ? <CheckCheck size={12} /> : <Copy size={12} />} {copied ? tt(lang, "copied") : tt(lang, "copyLink")}
                </button>
              </div>
              <div style={{ fontSize: 11, color: T.inkSoft }}>
                {tt(lang, "dueLbl")}: <span dir="ltr">{new Date(fresh.expiresAt).toLocaleDateString(lang === "ar" ? "ar-SA" : undefined)}</span> · {tt(lang, "linkUses")}: {fresh.maxUses}
              </div>
            </div>
            <button onClick={onClose} className="w-full rounded-lg py-2.5 font-semibold raqib-focus"
              style={{ background: T.line, color: T.inkSoft, fontSize: 14 }}>
              {lang === "ar" ? "تم" : "Done"}
            </button>
          </>
        )}
      </Card>
    </div>
  );
}

/* Item 6: per-item external upload links (Admin/Manager/Assessor; the server
   enforces the same perm on every endpoint). The raw link is shown ONCE. */
function UploadLinksPanel({ evidenceId, lang, toast }) {
  const [links, setLinks] = useState(null);
  const [expiresDays, setExpiresDays] = useState(7);
  const [maxUses, setMaxUses] = useState(1);
  const [fresh, setFresh] = useState(null); // { url, expiresAt, maxUses } — shown once
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try { const { links: ls } = await api.listUploadLinks(evidenceId); setLinks(ls); }
    catch (e) { toast(e.message, "error"); }
  }, [evidenceId, toast]);
  useEffect(() => { load(); }, [load]);

  const gen = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { link } = await api.createUploadLink({ evidenceId, expiresDays, maxUses });
      setFresh({ url: `${window.location.origin}/u/${link.token}`, expiresAt: link.expiresAt, maxUses: link.maxUses });
      setCopied(false);
      await load();
    } catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  };
  const revoke = async (id) => {
    try { await api.revokeUploadLink(id); await load(); } catch (e) { toast(e.message, "error"); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(fresh.url); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {}
  };

  const fmtD = (t) => new Date(t).toLocaleDateString(lang === "ar" ? "ar-SA" : undefined);
  // Amber/red reserved for status: expired/used-up = amber, revoked = red.
  const stateColor = { active: T.emerald, expired: T.amber, used_up: T.amber, revoked: T.red };

  return (
    <div className="mt-3 rounded-lg p-3 space-y-3" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
      <div className="flex items-end gap-2 flex-wrap">
        <div>
          <FieldLbl>{tt(lang, "linkExpiry")}</FieldLbl>
          <input type="number" min={1} max={30} value={expiresDays} onChange={(e) => setExpiresDays(e.target.value)}
            dir="ltr" style={{ ...inputStyle, width: 90 }} className="raqib-focus" />
        </div>
        <div>
          <FieldLbl>{tt(lang, "linkUses")}</FieldLbl>
          <input type="number" min={1} max={100} value={maxUses} onChange={(e) => setMaxUses(e.target.value)}
            dir="ltr" style={{ ...inputStyle, width: 90 }} className="raqib-focus" />
        </div>
        <button onClick={gen} disabled={busy}
          className="rounded-lg px-3 py-2 text-xs font-bold inline-flex items-center gap-1.5 raqib-focus"
          style={{ background: T.emerald, color: "#FFFFFF", opacity: busy ? 0.6 : 1 }}>
          {busy ? <Loader2 size={12} className="raqib-spin" /> : <Upload size={12} />} {tt(lang, "genLink")}
        </button>
      </div>

      {fresh && (
        <div className="rounded-lg p-3 space-y-2" style={{ background: "rgba(22,143,91,0.07)", border: `1px solid ${T.emerald}` }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: T.emerald }}>{tt(lang, "linkOnce")}</div>
          <div className="flex items-center gap-2 flex-wrap">
            <Mono style={{ fontSize: 11.5, color: T.ink, wordBreak: "break-all", flex: 1, minWidth: 200, background: "#FFFFFF", borderRadius: 6, padding: "6px 8px", border: `1px solid ${T.line}` }} dir="ltr">
              {fresh.url}
            </Mono>
            <button onClick={copy} className="rounded-lg px-3 py-2 text-xs font-bold inline-flex items-center gap-1.5 raqib-focus"
              style={{ background: T.emerald, color: "#FFFFFF" }}>
              {copied ? <CheckCheck size={12} /> : <Copy size={12} />} {copied ? tt(lang, "copied") : tt(lang, "copyLink")}
            </button>
          </div>
          <div style={{ fontSize: 11, color: T.inkSoft }}>
            {tt(lang, "dueLbl")}: <span dir="ltr">{fmtD(fresh.expiresAt)}</span> · {tt(lang, "linkUses")}: {fresh.maxUses}
          </div>
        </div>
      )}

      {links && links.length > 0 && (
        <div className="space-y-1.5">
          {links.map((l) => (
            <div key={l.id} className="flex items-center gap-2 flex-wrap" style={{ fontSize: 11.5, color: T.inkSoft }}>
              <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 700, background: `${stateColor[l.state] || T.na}1A`, color: stateColor[l.state] || T.na }}>
                {tt(lang, "linkState")[l.state] || l.state}
              </span>
              <span dir="ltr">{fmtD(l.expiresAt)}</span>
              <span>{tt(lang, "usesLeft", { n: Math.max(l.maxUses - l.usedCount, 0), m: l.maxUses })}</span>
              <span style={{ color: T.inkFaint }}>{l.createdBy}</span>
              {l.state === "active" && (
                <button onClick={() => revoke(l.id)} className="rounded-md px-2 py-0.5 text-xs font-bold raqib-focus"
                  style={{ background: "rgba(178,58,46,0.1)", color: T.red, marginInlineStart: "auto" }}>
                  {tt(lang, "revoke")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EvidenceView({ evidence, setEvidence, lang, user, allRowsByKey, goAdvisor, toast, versions }) {
  const list = Object.values(evidence).sort((a, b) => b.t - a.t);
  const QC = { strong: T.compliant, adequate: T.partial, weak: T.gap };
  const canManage = can(user.role, "evidence");
  const canShare = can(user.role, "shareEvidence");
  const [ctrlPop, setCtrlPop] = useState(null); // clicked control key
  const [linksFor, setLinksFor] = useState(null); // evidence id with links panel open
  const [reqLink, setReqLink] = useState(false); // standalone "request evidence" modal

  const remove = async (id) => {
    try {
      await api.deleteEvidence(id);
      setEvidence((p) => { const n = { ...p }; delete n[id]; return n; });
    } catch (e) { toast(e.message || "Delete failed", "error"); }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3 raqib-rise">
        <div>
          <Eyebrow ar="سجل الأدلة" en="Evidence registry" lang={lang} />
          <h1 style={{ fontSize: 24, fontWeight: 700, color: T.ink, marginTop: 4 }}>{tt(lang, "evidenceTitle")}</h1>
          <div style={{ fontSize: 12.5, color: T.inkFaint }}>{tt(lang, "notRetained")}</div>
        </div>
        {canShare && (
          <button onClick={() => setReqLink(true)}
            className="rounded-lg px-4 py-2 text-sm font-semibold inline-flex items-center gap-2 raqib-focus"
            style={{ background: T.emerald, color: "#FFFFFF" }}>
            <Upload size={14} /> {tt(lang, "genLink")}
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <Card className="p-8 text-center" style={{ color: T.inkFaint, fontSize: 13 }}>
          {tt(lang, "evidenceEmpty")}
          <div className="mt-3">
            <button onClick={goAdvisor} className="rounded-lg px-4 py-2 text-sm font-semibold raqib-focus"
              style={{ background: T.green, color: "#F4F2E9" }}>
              {tt(lang, "nav").advisor} ←
            </button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((ev, idx) => (
            <Card key={ev.id} className="p-4 raqib-rise" style={{ animationDelay: `${Math.min(idx * 40, 300)}ms` }}>
              <div className="flex items-start gap-3 flex-wrap">
                <FileCheck2 size={18} color={T.green} style={{ marginTop: 2 }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span dir="auto" style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{ev.name}</span>
                    {ev.quality && (
                      <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10.5, fontWeight: 700, background: `${QC[ev.quality]}1A`, color: QC[ev.quality] }}>
                        {tt(lang, "evQuality")[ev.quality]}
                      </span>
                    )}
                    {ev.parentId && (
                      <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10.5, fontWeight: 700, background: "rgba(22,143,91,0.1)", color: T.emerald }}>
                        {tt(lang, "extUpload")}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: T.inkFaint }}>{ev.docType} · {ev.fileType} · {Math.round((ev.size || 0) / 1024)} KB</span>
                  </div>
                  <div dir="auto" style={{ fontSize: 13, color: T.inkSoft, marginTop: 4, lineHeight: 1.65 }}>{ev.summary}</div>
                  <div className="flex gap-1.5 flex-wrap mt-2">
                    {(ev.controls || []).map((k) => {
                      const row = allRowsByKey.get(k);
                      return (
                        <button key={k} title={row ? row.control.t : tt(lang, "ctrlNoMap")} onClick={() => setCtrlPop(k)}
                          className="raqib-focus" style={{ padding: 0 }}>
                          <Mono style={{ background: "rgba(22,143,91,0.1)", color: T.emerald, fontWeight: 700, borderRadius: 4, padding: "1px 6px", fontSize: 11, textDecoration: "underline dotted", textUnderlineOffset: 2, cursor: "pointer" }}>
                            {k.split(":")[1]}
                          </Mono>
                        </button>
                      );
                    })}
                    {!(ev.controls || []).length && <span style={{ fontSize: 11.5, color: T.inkFaint }}>{tt(lang, "noLinks")}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: T.inkFaint, marginTop: 6 }}>
                    {ev.by} · <span dir="ltr">{new Date(ev.t).toLocaleString(lang === "ar" ? "ar-SA" : undefined)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {canShare && (
                    <button onClick={() => setLinksFor(linksFor === ev.id ? null : ev.id)} title={tt(lang, "uploadLinks")}
                      className="rounded-md p-1.5 raqib-focus"
                      style={{ background: linksFor === ev.id ? T.emerald : "rgba(22,143,91,0.1)", color: linksFor === ev.id ? "#FFFFFF" : T.emerald }}>
                      <Upload size={14} />
                    </button>
                  )}
                  {canManage && (
                    <button onClick={() => remove(ev.id)} title={tt(lang, "deleteEv")}
                      className="rounded-md p-1.5 raqib-focus" style={{ background: "rgba(178,58,46,0.08)", color: T.gap }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              {canShare && linksFor === ev.id && (
                <UploadLinksPanel evidenceId={ev.id} lang={lang} toast={toast} />
              )}
            </Card>
          ))}
        </div>
      )}
      {ctrlPop && (
        <ControlPopover keyStr={ctrlPop} row={allRowsByKey.get(ctrlPop) || null}
          versions={versions} lang={lang} onClose={() => setCtrlPop(null)} />
      )}
      {reqLink && (
        <RequestUploadLinkModal lang={lang} toast={toast} onClose={() => setReqLink(false)}
          onCreated={(ev) => setEvidence((p) => ({ ...p, [ev.id]: ev }))} />
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   APPROVALS QUEUE
══════════════════════════════════════════════════════════════════════════ */

function ApprovalsView({ allRows, assess, lang, onDecide }) {
  const pending = allRows.filter((r) => assess[r.key]?.review === "pending");
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="raqib-rise">
        <Eyebrow ar="الاعتمادات" en="Approval queue" lang={lang} />
        <h1 style={{ fontSize: 24, fontWeight: 700, color: T.ink, marginTop: 4 }}>{tt(lang, "approvalsTitle")}</h1>
      </div>
      {pending.length === 0 ? (
        <Card className="p-8 text-center" style={{ color: T.inkFaint, fontSize: 13 }}>{tt(lang, "noPending")}</Card>
      ) : (
        <div className="space-y-3">
          {pending.map((r) => {
            const a = assess[r.key];
            return (
              <Card key={r.key} className="p-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <StatusDot s={a.s} />
                  <Mono style={{ fontWeight: 700, color: T.ink, minWidth: 60 }}>{r.control.id}</Mono>
                  <span dir="auto" style={{ fontSize: 13, color: T.ink, flex: 1, minWidth: 180, textAlign: "start" }}>{r.control.t}</span>
                  <span style={{ fontSize: 12, color: T.inkSoft, fontWeight: 600 }}>
                    {tt(lang, "fromTo", { a: stLabel(lang, a.prevS || "unassessed"), b: stLabel(lang, a.s) })}
                  </span>
                  <span style={{ fontSize: 11.5, color: T.inkFaint }}>{tt(lang, "pendingBy", { u: a.by || "—" })}</span>
                  <div className="flex gap-2">
                    <button onClick={() => onDecide(r, "approve")}
                      className="rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 raqib-focus"
                      style={{ background: T.compliant, color: "#FFF" }}>
                      <BadgeCheck size={12} /> {tt(lang, "approve")}
                    </button>
                    <button onClick={() => onDecide(r, "reject")}
                      className="rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 raqib-focus"
                      style={{ background: "rgba(178,58,46,0.1)", color: T.gap }}>
                      <Ban size={12} /> {tt(lang, "reject")}
                    </button>
                  </div>
                </div>
                {a.note && <div dir="auto" style={{ fontSize: 12, color: T.inkSoft, marginTop: 8, paddingInlineStart: 20 }}>{a.note}</div>}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   CORRECTIVE ACTIONS (POA&M) — gap → owner → due date → evidence-of-fix →
   closed. Rules live in api/_lib/poam.js (shared with the server route).
══════════════════════════════════════════════════════════════════════════ */

const ACT_STATUS_COLOR = (s) => (s === "Closed" ? T.emerald : s === "Blocked" ? T.amber : s === "In Progress" ? T.green : T.na);
const PRIO_COLOR = { Low: T.na, Medium: T.inkSoft, High: T.amber, Critical: T.red };

function ActionBadges({ a, lang }) {
  const over = isOverdue(a);
  const soon = !over && isDueSoon(a);
  return (
    <span className="inline-flex gap-1.5 items-center flex-wrap">
      <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10.5, fontWeight: 700, background: `${ACT_STATUS_COLOR(a.status)}1A`, color: ACT_STATUS_COLOR(a.status) }}>
        {tt(lang, "actStatus")[a.status] || a.status}
      </span>
      {a.closureRequested && a.status !== "Closed" && (
        <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10.5, fontWeight: 700, background: "rgba(184,134,27,0.12)", color: T.amber }}>
          {tt(lang, "closureRequested")}
        </span>
      )}
      {over && (
        <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10.5, fontWeight: 700, background: "rgba(178,58,46,0.12)", color: T.red }}>
          {tt(lang, "overdueLbl")}
        </span>
      )}
      {soon && (
        <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10.5, fontWeight: 700, background: "rgba(184,134,27,0.12)", color: T.amber }}>
          {tt(lang, "dueSoonLbl")}
        </span>
      )}
    </span>
  );
}

/* Create form (modal). Admin/Manager assign any active owner; an Assessor's
   creations are owned by the assessor (server enforces the same). */
function ActionForm({ user, owners, lang, prefillKeys, onCreate, onClose }) {
  const [f, setF] = useState({
    title: "", description: "", dueDate: "", priority: "Medium",
    ownerUserId: user.id, linkedControlIds: prefillKeys || [],
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const assignable = canAssignOwner(user.role);
  const ownerOpts = (owners || []).filter((o) => o.active && o.role !== "viewer");

  const submit = async () => {
    setErr("");
    if (!f.title.trim()) return setErr(tt(lang, "actTitleLbl"));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.dueDate)) return setErr(tt(lang, "dueLbl"));
    setBusy(true);
    try { await onCreate(f); onClose(); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 95, background: "rgba(20,28,24,0.35)" }} onClick={onClose}>
      <Card className="p-5 raqib-drawer w-full space-y-3" style={{ maxWidth: 520, background: "#FFFFFF", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div style={{ fontSize: 16, fontWeight: 700, color: T.ink }}>{tt(lang, "newAction")}</div>
          <button onClick={onClose} className="rounded-md p-1.5 raqib-focus" style={{ background: "rgba(0,0,0,0.05)" }}><X size={15} color={T.inkSoft} /></button>
        </div>
        <div>
          <FieldLbl>{tt(lang, "actTitleLbl")}</FieldLbl>
          <input value={f.title} onChange={(e) => setF((p) => ({ ...p, title: e.target.value }))} dir="auto" style={inputStyle} className="raqib-focus" />
        </div>
        <div>
          <FieldLbl>{tt(lang, "actDescLbl")}</FieldLbl>
          <textarea value={f.description} onChange={(e) => setF((p) => ({ ...p, description: e.target.value }))} rows={3} dir="auto"
            style={{ ...inputStyle, resize: "vertical" }} className="raqib-focus" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <FieldLbl>{tt(lang, "owner")}</FieldLbl>
            {assignable ? (
              <select value={f.ownerUserId} onChange={(e) => setF((p) => ({ ...p, ownerUserId: e.target.value }))}
                style={{ ...inputStyle, background: T.panel }} className="raqib-focus">
                {ownerOpts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            ) : (
              <div className="rounded-lg px-3 py-2" style={{ ...inputStyle, background: T.panel, color: T.inkSoft }}>{user.name}</div>
            )}
          </div>
          <div>
            <FieldLbl>{tt(lang, "dueLbl")}</FieldLbl>
            <input type="date" value={f.dueDate} onChange={(e) => setF((p) => ({ ...p, dueDate: e.target.value }))} style={inputStyle} className="raqib-focus" />
          </div>
          <div>
            <FieldLbl>{tt(lang, "priorityLbl")}</FieldLbl>
            <select value={f.priority} onChange={(e) => setF((p) => ({ ...p, priority: e.target.value }))}
              style={{ ...inputStyle, background: T.panel }} className="raqib-focus">
              {ACTION_PRIORITIES.map((p) => <option key={p} value={p}>{tt(lang, "actPriority")[p]}</option>)}
            </select>
          </div>
        </div>
        {f.linkedControlIds.length > 0 && (
          <div>
            <FieldLbl>{tt(lang, "linkControlsLbl")}</FieldLbl>
            <div className="flex gap-1.5 flex-wrap">
              {f.linkedControlIds.map((k) => (
                <Mono key={k} style={{ background: "rgba(22,143,91,0.1)", color: T.emerald, fontWeight: 700, borderRadius: 4, padding: "1px 6px", fontSize: 11 }}>
                  {k.split(":")[1] || k}
                </Mono>
              ))}
            </div>
          </div>
        )}
        {err && <div style={{ color: T.red, fontSize: 12.5 }}>{err}</div>}
        <button onClick={submit} disabled={busy} className="w-full rounded-lg py-2.5 font-semibold raqib-focus"
          style={{ background: T.emerald, color: "#FFFFFF", fontSize: 14, opacity: busy ? 0.6 : 1 }}>
          {busy ? "…" : tt(lang, "createBtn")}
        </button>
      </Card>
    </div>
  );
}

/* Detail drawer: role-based field edit, link/unlink evidence, status timeline
   from audit rows. Owner can request closure; only Admin/Manager close. */
function ActionDrawer({ action, audit, owners, evidence, user, lang, onPatch, onArchive, onClose, toast }) {
  const [note, setNote] = useState(action.closureNote || "");
  const [busy, setBusy] = useState(false);
  const isAr = lang === "ar";
  const isOwner = action.ownerUserId === user.id;
  const isCreator = action.createdBy === user.id;
  const scope = actionEditScope(user.role, isOwner, isCreator);
  const canEdit = scope !== "none" && action.status !== "Closed";
  const managerial = isManagerial(user.role);
  const trail = audit.filter((a) => a.actionId === action.id);
  const evList = Object.values(evidence).sort((a, b) => b.t - a.t).slice(0, 40);
  const linked = new Set(action.linkedEvidenceIds || []);
  const ownerOpts = (owners || []).filter((o) => o.active && o.role !== "viewer");

  const patch = async (p) => {
    if (busy) return;
    setBusy(true);
    try { await onPatch(action.id, p); }
    catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  };
  const toggleEv = (id) => {
    const next = new Set(linked);
    next.has(id) ? next.delete(id) : next.add(id);
    patch({ linkedEvidenceIds: [...next] });
  };
  const closeReady = closureGuard({ ...action, closureNote: note }, note).ok;

  return (
    <div className="fixed inset-0 flex justify-end" style={{ zIndex: 85, background: "rgba(20,28,24,0.35)" }} onClick={onClose}>
      <div className="h-full overflow-y-auto raqib-drawer w-full" onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 470, background: T.panel, boxShadow: "0 0 40px rgba(15,25,20,0.3)" }}>
        <div className="p-5" style={{ background: T.emerald }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div dir="auto" style={{ color: "#FFFFFF", fontSize: 17, fontWeight: 700, lineHeight: 1.4, textAlign: "start" }}>{action.title}</div>
              <div className="mt-2"><ActionBadges a={action} lang={lang} /></div>
              <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 6 }}>
                {tt(lang, "owner")}: {action.ownerName || tt(lang, "unassigned")} · {tt(lang, "dueLbl")}: <span dir="ltr">{action.dueDate ? String(action.dueDate).slice(0, 10) : "—"}</span>
                {" · "}<span style={{ fontWeight: 700 }}>{tt(lang, "actPriority")[action.priority]}</span>
              </div>
            </div>
            <button onClick={onClose} className="rounded-md p-1.5 raqib-focus" style={{ background: "rgba(255,255,255,0.15)" }}>
              <X size={16} color="#FFFFFF" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {scope === "none" && (
            <div className="rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: "rgba(184,134,27,0.1)", color: T.amber, fontSize: 12, fontWeight: 600 }}>
              <Eye size={13} /> {tt(lang, "roViewer")}
            </div>
          )}

          {action.description && (
            <div dir="auto" style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.65, textAlign: "start" }}>{action.description}</div>
          )}

          {/* status transitions (legal + role-gated; Closed only via approve button below) */}
          {canEdit && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, marginBottom: 6 }}>{tt(lang, "status")}</div>
              <div className="flex gap-2 flex-wrap">
                {ACTION_STATUSES.filter((s) => s !== "Closed").map((s) => {
                  const allowed = canTransition(user.role, isOwner, action.status, s);
                  return (
                    <button key={s} disabled={!allowed || busy} onClick={() => patch({ status: s })}
                      className="rounded-lg px-3 py-1.5 text-xs font-bold raqib-focus"
                      style={{
                        border: `1px solid ${action.status === s ? ACT_STATUS_COLOR(s) : T.line}`,
                        background: action.status === s ? `${ACT_STATUS_COLOR(s)}14` : T.paper,
                        color: action.status === s ? ACT_STATUS_COLOR(s) : allowed ? T.inkSoft : T.inkFaint,
                        opacity: allowed ? 1 : 0.5, cursor: allowed ? "pointer" : "not-allowed",
                      }}>
                      {tt(lang, "actStatus")[s]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* owner / due / priority (managers; owner+creator per OWN_FIELDS) */}
          {canEdit && (
            <div className="grid grid-cols-2 gap-3">
              {managerial && (
                <div>
                  <FieldLbl>{tt(lang, "owner")}</FieldLbl>
                  <select value={action.ownerUserId || ""} disabled={busy}
                    onChange={(e) => patch({ ownerUserId: e.target.value })}
                    style={{ ...inputStyle, background: T.panel }} className="raqib-focus">
                    {ownerOpts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <FieldLbl>{tt(lang, "dueLbl")}</FieldLbl>
                <input type="date" defaultValue={action.dueDate ? String(action.dueDate).slice(0, 10) : ""} disabled={busy}
                  onBlur={(e) => e.target.value && e.target.value !== String(action.dueDate).slice(0, 10) && patch({ dueDate: e.target.value })}
                  style={inputStyle} className="raqib-focus" />
              </div>
              <div>
                <FieldLbl>{tt(lang, "priorityLbl")}</FieldLbl>
                <select value={action.priority} disabled={busy} onChange={(e) => patch({ priority: e.target.value })}
                  style={{ ...inputStyle, background: T.panel }} className="raqib-focus">
                  {ACTION_PRIORITIES.map((p) => <option key={p} value={p}>{tt(lang, "actPriority")[p]}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* linked controls */}
          {(action.linkedControlIds || []).length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, marginBottom: 6 }}>{tt(lang, "linkControlsLbl")}</div>
              <div className="flex gap-1.5 flex-wrap">
                {action.linkedControlIds.map((k) => (
                  <Mono key={k} style={{ background: "rgba(22,143,91,0.1)", color: T.emerald, fontWeight: 700, borderRadius: 4, padding: "1px 6px", fontSize: 11 }}>
                    {k.split(":")[1] || k}
                  </Mono>
                ))}
              </div>
            </div>
          )}

          {/* link/unlink evidence-of-fix */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, marginBottom: 6 }}>
              <FileCheck2 size={12} style={{ display: "inline", marginInlineEnd: 5 }} color={T.emerald} />
              {tt(lang, "linkEvidenceLbl")} ({(action.linkedEvidenceIds || []).length})
            </div>
            {evList.length === 0 ? (
              <div style={{ fontSize: 12, color: T.inkFaint }}>{tt(lang, "evidenceEmpty")}</div>
            ) : (
              <div className="space-y-1" style={{ maxHeight: 180, overflowY: "auto" }}>
                {evList.map((ev) => (
                  <label key={ev.id} className="flex items-center gap-2 rounded-md px-2 py-1 raqib-row" style={{ fontSize: 12, cursor: canEdit ? "pointer" : "default" }}>
                    <input type="checkbox" checked={linked.has(ev.id)} disabled={!canEdit || busy} onChange={() => toggleEv(ev.id)} />
                    <span dir="auto" style={{ fontWeight: 600, color: T.ink }}>{ev.name}</span>
                    <span style={{ color: T.inkFaint, fontSize: 11 }}>{ev.docType}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* closure workflow */}
          <Card className="p-4 space-y-2">
            <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft }}>{tt(lang, "closureNoteLbl")}</div>
            {action.status === "Closed" ? (
              <>
                <div dir="auto" style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.6 }}>{action.closureNote}</div>
                <div style={{ fontSize: 11.5, color: T.emerald, fontWeight: 600 }}>
                  {tt(lang, "closedBadge")} · {action.closedBy} · <span dir="ltr">{action.closedAt ? new Date(action.closedAt).toLocaleString(isAr ? "ar-SA" : undefined) : ""}</span>
                </div>
                {managerial && (
                  <button disabled={busy} onClick={() => patch({ status: "Open" })}
                    className="rounded-lg px-3 py-1.5 text-xs font-bold raqib-focus" style={{ background: T.line, color: T.inkSoft }}>
                    {tt(lang, "reopen")}
                  </button>
                )}
              </>
            ) : (
              <>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} dir="auto" disabled={scope === "none" || busy}
                  placeholder={tt(lang, "closureNoteLbl")} style={{ ...inputStyle, resize: "vertical" }} className="raqib-focus" />
                <div style={{ fontSize: 11.5, color: closeReady ? T.emerald : T.amber, fontWeight: 600 }}>
                  {closeReady ? "✓" : "•"} {tt(lang, "closureNeeds")}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {canEdit && !managerial && (
                    <button disabled={busy || action.closureRequested} onClick={() => patch({ closureNote: note, closureRequested: true })}
                      className="rounded-lg px-3 py-1.5 text-xs font-bold raqib-focus"
                      style={{ background: "rgba(184,134,27,0.12)", color: T.amber, opacity: action.closureRequested ? 0.5 : 1 }}>
                      {action.closureRequested ? tt(lang, "closureRequested") : tt(lang, "requestClosure")}
                    </button>
                  )}
                  {managerial && (
                    <button disabled={busy || !closeReady} onClick={() => patch({ closureNote: note, status: "Closed" })}
                      className="rounded-lg px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1.5 raqib-focus"
                      style={{ background: closeReady ? T.emerald : T.line, color: closeReady ? "#FFFFFF" : T.inkFaint }}>
                      <BadgeCheck size={12} /> {tt(lang, "approveClose")}
                    </button>
                  )}
                  {canArchiveAction(user.role) && (
                    <button disabled={busy} onClick={() => { onArchive(action.id); onClose(); }}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold raqib-focus" style={{ background: "rgba(178,58,46,0.08)", color: T.red, marginInlineStart: "auto" }}>
                      {tt(lang, "archiveBtn")}
                    </button>
                  )}
                </div>
              </>
            )}
          </Card>

          {/* timeline from audit rows */}
          {trail.length > 0 && (
            <Card className="p-4">
              <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft }}>
                <History size={12} style={{ display: "inline", marginInlineEnd: 5 }} />{tt(lang, "timelineLbl")}
              </div>
              <div className="mt-2 space-y-1.5">
                {trail.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 flex-wrap" style={{ fontSize: 11.5, color: T.inkSoft }}>
                    <Mono style={{ fontSize: 10.5, color: T.inkFaint }}>{a.field}</Mono>
                    <span dir="auto">{a.from ?? "—"}</span>←<b style={{ color: T.ink }} dir="auto">{a.to ?? "—"}</b>
                    <span style={{ color: T.inkFaint }}>· {a.by}</span>
                    <span style={{ color: T.inkFaint, marginInlineStart: "auto" }} dir="ltr">{new Date(a.t).toLocaleString(isAr ? "ar-SA" : undefined)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionsView({ user, lang, evidence, toast, prefillKey, clearPrefill }) {
  const [data, setData] = useState(null); // { actions, audit, owners }
  const [flt, setFlt] = useState({ owner: "", status: "", fw: "", overdue: false });
  const [detailId, setDetailId] = useState(null);
  const [creating, setCreating] = useState(false);
  const isAr = lang === "ar";

  const load = useCallback(async () => {
    try { setData(await api.listActions()); }
    catch (e) { toast(e.message, "error"); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (prefillKey) setCreating(true); }, [prefillKey]);

  const actions = data?.actions || [];
  const fwOf = (a) => [...new Set((a.linkedControlIds || []).map((k) => String(k).split(":")[0]))];
  const filtered = actions.filter((a) =>
    (!flt.owner || a.ownerUserId === flt.owner) &&
    (!flt.status || a.status === flt.status) &&
    (!flt.fw || fwOf(a).includes(flt.fw)) &&
    (!flt.overdue || isOverdue(a)));

  const openCount = actions.filter((a) => a.status !== "Closed").length;
  const overdueCount = actions.filter((a) => isOverdue(a)).length;
  const byOwner = useMemo(() => {
    const m = new Map();
    for (const a of actions) if (a.status !== "Closed") m.set(a.ownerName || "—", (m.get(a.ownerName || "—") || 0) + 1);
    return [...m.entries()].map(([name, n]) => ({ name, n })).sort((x, y) => y.n - x.n).slice(0, 8);
  }, [actions]);
  const byFw = useMemo(() => {
    const m = new Map();
    for (const a of actions) if (a.status !== "Closed") for (const f of fwOf(a)) m.set(FRAMEWORKS[f]?.short || f, (m.get(FRAMEWORKS[f]?.short || f) || 0) + 1);
    return [...m.entries()].map(([name, n]) => ({ name, n }));
  }, [actions]);

  const create = async (f) => {
    await api.createAction({ ...f, linkedControlIds: f.linkedControlIds });
    await load();
    toast(tt(lang, "toastAction"));
  };
  const patchOne = async (id, p) => {
    const { action } = await api.patchAction(id, p);
    setData((d) => d ? { ...d, actions: d.actions.map((a) => (a.id === id ? action : a)) } : d);
    load(); // refresh audit trail
  };
  const archive = async (id) => {
    try { await api.archiveAction(id); await load(); } catch (e) { toast(e.message, "error"); }
  };

  const detail = detailId ? actions.find((a) => a.id === detailId) : null;
  const owners = data?.owners || [];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3 raqib-rise">
        <div>
          <Eyebrow ar="خطط المعالجة" en="Remediation · POA&M" lang={lang} />
          <h1 style={{ fontSize: 24, fontWeight: 700, color: T.ink, marginTop: 4 }}>{tt(lang, "poamTitle")}</h1>
        </div>
        {canCreateAction(user.role) && (
          <button onClick={() => setCreating(true)}
            className="rounded-lg px-4 py-2 text-sm font-semibold inline-flex items-center gap-2 raqib-focus"
            style={{ background: T.emerald, color: "#FFFFFF" }}>
            <ListTodo size={14} /> {tt(lang, "newAction")}
          </button>
        )}
      </div>

      {/* rollup */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <div style={{ fontSize: 26, fontWeight: 700, color: T.emerald }}>{openCount}</div>
          <div style={{ fontSize: 11.5, color: T.inkFaint, fontWeight: 600 }}>{tt(lang, "openCount")}</div>
        </Card>
        <Card className="p-4">
          <div style={{ fontSize: 26, fontWeight: 700, color: overdueCount ? T.red : T.emerald }}>{overdueCount}</div>
          <div style={{ fontSize: 11.5, color: T.inkFaint, fontWeight: 600 }}>{tt(lang, "overdueLbl")}</div>
        </Card>
        <Card className="p-4">
          <div style={{ fontSize: 11.5, color: T.inkFaint, fontWeight: 600, marginBottom: 4 }}>{tt(lang, "byOwner")}</div>
          <ResponsiveContainer width="100%" height={70}>
            <BarChart data={byOwner} layout="vertical" margin={{ top: 0, right: 6, bottom: 0, left: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 9, fill: T.inkFaint }} axisLine={false} tickLine={false} />
              <Bar dataKey="n" fill={T.emerald} radius={[0, 3, 3, 0]} barSize={8} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-4">
          <div style={{ fontSize: 11.5, color: T.inkFaint, fontWeight: 600, marginBottom: 4 }}>{tt(lang, "byFramework")}</div>
          <ResponsiveContainer width="100%" height={70}>
            <BarChart data={byFw} layout="vertical" margin={{ top: 0, right: 6, bottom: 0, left: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 9, fill: T.inkFaint }} axisLine={false} tickLine={false} />
              <Bar dataKey="n" fill={T.green} radius={[0, 3, 3, 0]} barSize={8} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <select value={flt.owner} onChange={(e) => setFlt((p) => ({ ...p, owner: e.target.value }))}
          style={{ ...inputStyle, width: "auto", background: T.panel }} className="raqib-focus">
          <option value="">{tt(lang, "allOwners")}</option>
          {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <select value={flt.status} onChange={(e) => setFlt((p) => ({ ...p, status: e.target.value }))}
          style={{ ...inputStyle, width: "auto", background: T.panel }} className="raqib-focus">
          <option value="">{tt(lang, "allSt")}</option>
          {ACTION_STATUSES.map((s) => <option key={s} value={s}>{tt(lang, "actStatus")[s]}</option>)}
        </select>
        <select value={flt.fw} onChange={(e) => setFlt((p) => ({ ...p, fw: e.target.value }))}
          style={{ ...inputStyle, width: "auto", background: T.panel }} className="raqib-focus">
          <option value="">{tt(lang, "allFw")}</option>
          {Object.keys(FRAMEWORKS).map((f) => <option key={f} value={f}>{FRAMEWORKS[f].short}</option>)}
        </select>
        <label className="flex items-center gap-1.5" style={{ fontSize: 12.5, color: T.inkSoft, fontWeight: 600, cursor: "pointer" }}>
          <input type="checkbox" checked={flt.overdue} onChange={(e) => setFlt((p) => ({ ...p, overdue: e.target.checked }))} />
          {tt(lang, "onlyOverdue")}
        </label>
      </div>

      {/* table */}
      {filtered.length === 0 ? (
        <Card className="p-8 text-center" style={{ color: T.inkFaint, fontSize: 13 }}>{tt(lang, "noActions")}</Card>
      ) : (
        <Card className="p-0" style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 640 }}>
            <thead>
              <tr>
                {[tt(lang, "actTitleLbl"), tt(lang, "owner"), tt(lang, "priorityLbl"), tt(lang, "dueLbl"), tt(lang, "status"), tt(lang, "linkEvidenceLbl")].map((h) => (
                  <th key={h} style={{ textAlign: "start", padding: "9px 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: T.inkFaint, borderBottom: `1px solid ${T.line}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="raqib-row" style={{ cursor: "pointer" }} onClick={() => setDetailId(a.id)}>
                  <td style={{ padding: "9px 12px", borderBottom: `1px solid ${T.line}` }}>
                    <div dir="auto" style={{ fontSize: 13, fontWeight: 600, color: T.ink, textAlign: "start" }}>{a.title}</div>
                    <div className="flex gap-1 flex-wrap mt-0.5">
                      {(a.linkedControlIds || []).slice(0, 4).map((k) => (
                        <Mono key={k} style={{ fontSize: 10, color: T.emerald, fontWeight: 700 }}>{k.split(":")[1] || k}</Mono>
                      ))}
                    </div>
                  </td>
                  <td dir="auto" style={{ padding: "9px 12px", fontSize: 12.5, color: T.inkSoft, borderBottom: `1px solid ${T.line}` }}>{a.ownerName || tt(lang, "unassigned")}</td>
                  <td style={{ padding: "9px 12px", fontSize: 12, fontWeight: 700, color: PRIO_COLOR[a.priority] || T.inkSoft, borderBottom: `1px solid ${T.line}` }}>{tt(lang, "actPriority")[a.priority]}</td>
                  <td dir="ltr" style={{ padding: "9px 12px", fontSize: 12, color: isOverdue(a) ? T.red : isDueSoon(a) ? T.amber : T.inkSoft, fontWeight: isOverdue(a) || isDueSoon(a) ? 700 : 400, borderBottom: `1px solid ${T.line}` }}>
                    {a.dueDate ? String(a.dueDate).slice(0, 10) : "—"}
                  </td>
                  <td style={{ padding: "9px 12px", borderBottom: `1px solid ${T.line}` }}><ActionBadges a={a} lang={lang} /></td>
                  <td style={{ padding: "9px 12px", fontSize: 12.5, color: (a.linkedEvidenceIds || []).length ? T.emerald : T.inkFaint, fontWeight: 700, borderBottom: `1px solid ${T.line}` }}>
                    {(a.linkedEvidenceIds || []).length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {creating && (
        <ActionForm user={user} owners={owners} lang={lang} prefillKeys={prefillKey ? [prefillKey] : []}
          onCreate={create} onClose={() => { setCreating(false); clearPrefill(); }} />
      )}
      {detail && (
        <ActionDrawer action={detail} audit={data?.audit || []} owners={owners} evidence={evidence}
          user={user} lang={lang} onPatch={patchOne} onArchive={archive} toast={toast}
          onClose={() => setDetailId(null)} />
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   USERS (admin)
══════════════════════════════════════════════════════════════════════════ */

function UsersView({ users, lang, currentUser, onAdd, onToggleActive, onResetPw, toast }) {
  const [form, setForm] = useState({ name: "", email: "", role: "assessor", pw: "" });
  const [err, setErr] = useState("");
  const [pwFor, setPwFor] = useState(null);
  const [newPw, setNewPw] = useState("");
  const [confirmFor, setConfirmFor] = useState(null); // deactivation needs an explicit confirm step
  const list = Object.values(users).sort((a, b) => a.t - b.t);

  const submit = async () => {
    setErr("");
    if (!form.name.trim() || !normEmail(form.email)) return setErr(tt(lang, "wrongCreds"));
    if (form.pw.length < 8) return setErr(tt(lang, "pwShort"));
    if (list.some((u) => u.email === normEmail(form.email))) return setErr(tt(lang, "wrongCreds"));
    await onAdd({ name: form.name.trim(), email: normEmail(form.email), role: form.role, password: form.pw });
    setForm({ name: "", email: "", role: "assessor", pw: "" });
  };

  return (
    <div className="p-4 md:p-6 space-y-4" style={{ maxWidth: 760 }}>
      <div className="raqib-rise">
        <Eyebrow ar="المستخدمون" en="User management" lang={lang} />
        <h1 style={{ fontSize: 24, fontWeight: 700, color: T.ink, marginTop: 4 }}>{tt(lang, "usersTitle")}</h1>
      </div>

      <Card className="p-5">
        <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginBottom: 10 }}>
          <UserPlus size={14} style={{ display: "inline", marginInlineEnd: 6 }} />{tt(lang, "addUser")}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={tt(lang, "nameLbl")} dir="auto" style={inputStyle} className="raqib-focus" />
          <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder={tt(lang, "emailLbl")} dir="ltr" type="email" style={inputStyle} className="raqib-focus" />
          <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            style={{ ...inputStyle, background: T.panel }} className="raqib-focus">
            {ROLES.map((r) => <option key={r} value={r}>{tt(lang, "roles")[r]}</option>)}
          </select>
          <input value={form.pw} onChange={(e) => setForm((f) => ({ ...f, pw: e.target.value }))}
            placeholder={tt(lang, "pwLbl")} dir="ltr" type="password" style={inputStyle} className="raqib-focus"
            onKeyDown={(e) => e.key === "Enter" && submit()} />
        </div>
        {err && <div style={{ color: T.gap, fontSize: 12.5, marginTop: 8 }}>{err}</div>}
        <button onClick={submit} className="mt-3 rounded-lg px-4 py-2 text-sm font-semibold raqib-focus"
          style={{ background: T.green, color: "#F4F2E9" }}>{tt(lang, "addUser")}</button>
      </Card>

      <div className="space-y-2">
        {list.map((u) => (
          <Card key={u.id} className="p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="rounded-full flex items-center justify-center" style={{ width: 34, height: 34, background: "rgba(17,64,47,0.1)", color: T.green, fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                {u.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span dir="auto" style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{u.name}</span>
                  {u.id === currentUser.id && <span style={{ fontSize: 10.5, color: T.brass, fontWeight: 700 }}>({tt(lang, "you")})</span>}
                  <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10.5, fontWeight: 700, background: "rgba(17,64,47,0.08)", color: T.green }}>
                    {tt(lang, "roles")[u.role] || u.role}
                  </span>
                  <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10.5, fontWeight: 700, background: u.active ? "rgba(31,122,77,0.1)" : "rgba(178,58,46,0.1)", color: u.active ? T.compliant : T.gap }}>
                    {u.active ? tt(lang, "active") : tt(lang, "inactive")}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: T.inkFaint }} dir="ltr">{u.email} · {tt(lang, "lastSeen", { d: new Date(u.t).toLocaleDateString() })}</div>
              </div>
              {u.id !== currentUser.id && (
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => setPwFor(pwFor === u.id ? null : u.id)}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold raqib-focus"
                    style={{ background: "rgba(168,123,34,0.12)", color: T.brass }}>
                    {tt(lang, "resetPw")}
                  </button>
                  <button onClick={() => (u.active ? setConfirmFor(confirmFor === u.id ? null : u.id) : onToggleActive(u.id))}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold raqib-focus"
                    style={{ background: u.active ? "rgba(178,58,46,0.1)" : "rgba(31,122,77,0.1)", color: u.active ? T.gap : T.compliant }}>
                    {u.active ? tt(lang, "deactivate") : tt(lang, "activate")}
                  </button>
                </div>
              )}
            </div>
            {confirmFor === u.id && u.active && (
              <div className="flex gap-2 mt-3 items-center flex-wrap">
                <span style={{ fontSize: 12.5, color: T.gap, fontWeight: 600 }}>{tt(lang, "removeConfirm", { n: u.name })}</span>
                <button onClick={async () => { await onToggleActive(u.id); setConfirmFor(null); }}
                  className="rounded-lg px-3 py-1.5 text-xs font-bold raqib-focus" style={{ background: T.gap, color: "#FFF" }}>
                  {tt(lang, "confirm")}
                </button>
                <button onClick={() => setConfirmFor(null)} className="rounded-lg px-3 py-1.5 text-xs font-semibold raqib-focus"
                  style={{ background: T.line, color: T.inkSoft }}>{tt(lang, "cancel")}</button>
              </div>
            )}
            {pwFor === u.id && (
              <div className="flex gap-2 mt-3 flex-wrap">
                <input value={newPw} onChange={(e) => setNewPw(e.target.value)} type="password" dir="ltr"
                  placeholder={tt(lang, "pwLbl")} style={{ ...inputStyle, maxWidth: 240 }} className="raqib-focus" />
                <button onClick={async () => {
                    if (newPw.length < 8) return toast(tt(lang, "pwShort"), "error");
                    await onResetPw(u.id, newPw); setNewPw(""); setPwFor(null);
                  }}
                  className="rounded-lg px-3 py-1.5 text-xs font-bold raqib-focus" style={{ background: T.green, color: "#F4F2E9" }}>
                  {tt(lang, "resetPw")}
                </button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   RISK HEATMAP
══════════════════════════════════════════════════════════════════════════ */

function RiskView({ allRows, assess, onOpenControls, lang }) {
  const isAr = lang === "ar";
  const cells = useMemo(() => {
    const m = new Map();
    for (const r of allRows) {
      const gk = `${r.fw}:${r.sub.id}`;
      if (!m.has(gk)) m.set(gk, { fw: r.fw, sub: r.sub, n: 0, gap: 0, partial: 0, un: 0 });
      const c = m.get(gk);
      c.n++;
      const st = assess[r.key]?.s || "unassessed";
      if (st === "gap") c.gap++;
      else if (st === "partial") c.partial++;
      else if (st === "unassessed") c.un++;
    }
    return [...m.values()].map((c) => ({ ...c, risk: c.n ? (c.gap + c.partial * 0.5 + c.un * 0.35) / c.n : 0 }))
      .sort((a, b) => b.risk - a.risk);
  }, [allRows, assess]);

  const tags = (STR[lang] || STR.en).heatTags;
  const heat = (r) => {
    if (r >= 0.66) return { bg: "rgba(178,58,46,0.85)", fg: "#FFF6F2", tag: tags[0] };
    if (r >= 0.4) return { bg: "rgba(184,134,27,0.8)", fg: "#2A1F05", tag: tags[1] };
    if (r >= 0.15) return { bg: "rgba(31,122,77,0.25)", fg: T.greenDeep, tag: tags[2] };
    return { bg: "rgba(31,122,77,0.7)", fg: "#F0F7F1", tag: tags[3] };
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="raqib-rise">
        <Eyebrow ar="خريطة المخاطر" en="Residual risk by subdomain" lang={lang} />
        <h1 style={{ fontSize: 24, fontWeight: 700, color: T.ink, marginTop: 4 }}>{tt(lang, "riskTitle")}</h1>
        <div style={{ fontSize: 13, color: T.inkSoft }}>{tt(lang, "riskFormula")}</div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {cells.map((c, i) => {
          const h = heat(c.risk);
          return (
            <button key={`${c.fw}:${c.sub.id}`} onClick={onOpenControls}
              className="rounded-xl p-3 raqib-rise transition-transform hover:scale-[1.02] raqib-focus"
              style={{ background: h.bg, animationDelay: `${Math.min(i * 30, 400)}ms`, textAlign: "start" }}>
              <div className="flex items-center justify-between">
                <Mono style={{ color: h.fg, fontWeight: 700 }}>{c.sub.id}</Mono>
                <span style={{ fontSize: 10, fontWeight: 700, color: h.fg, opacity: 0.85, letterSpacing: "0.06em" }}>
                  {FRAMEWORKS[c.fw].short.split(" ")[0]}
                </span>
              </div>
              <div dir="auto" style={{ fontSize: 12.5, fontWeight: 600, color: h.fg, marginTop: 4, minHeight: 34, textAlign: "start" }}>
                {isAr && c.sub.ar ? c.sub.ar : c.sub.en}
              </div>
              <div style={{ fontSize: 11, color: h.fg, opacity: 0.9, marginTop: 6 }}>
                {h.tag} · {tt(lang, "gapsOf", { g: c.gap, n: c.n })}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   SETTINGS + DIAGNOSTICS
══════════════════════════════════════════════════════════════════════════ */

/* Self-service password change: requires the CURRENT password (server-enforced
   in /api/auth?action=change-password); available to every signed-in role. */
function PasswordSection({ lang, toast }) {
  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");
  const [nw2, setNw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    if (nw.length < 8) return setErr(tt(lang, "pwShort"));
    if (nw !== nw2) return setErr(tt(lang, "pwMismatch"));
    setBusy(true);
    try {
      await api.changePassword(cur, nw);
      setCur(""); setNw(""); setNw2("");
      toast(tt(lang, "pwChanged"));
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound size={15} color={T.emerald} />
        <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{tt(lang, "pwChangeTitle")}</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input value={cur} onChange={(e) => setCur(e.target.value)} type="password" dir="ltr" autoComplete="current-password"
          placeholder={tt(lang, "pwCurrentLbl")} style={inputStyle} className="raqib-focus" />
        <input value={nw} onChange={(e) => setNw(e.target.value)} type="password" dir="ltr" autoComplete="new-password"
          placeholder={tt(lang, "pwNewLbl")} style={inputStyle} className="raqib-focus" />
        <input value={nw2} onChange={(e) => setNw2(e.target.value)} type="password" dir="ltr" autoComplete="new-password"
          placeholder={tt(lang, "pw2Lbl")} style={inputStyle} className="raqib-focus"
          onKeyDown={(e) => e.key === "Enter" && submit()} />
      </div>
      {err && <div style={{ color: T.gap, fontSize: 12.5 }}>{err}</div>}
      <button onClick={submit} disabled={busy || !cur || !nw || !nw2}
        className="rounded-lg px-4 py-2 text-sm font-semibold inline-flex items-center gap-2 raqib-focus"
        style={{ background: T.emerald, color: "#FFFFFF", opacity: busy || !cur || !nw || !nw2 ? 0.6 : 1 }}>
        {busy ? <Loader2 size={14} className="raqib-spin" /> : <KeyRound size={14} />} {tt(lang, "pwChangeTitle")}
      </button>
    </Card>
  );
}

function MfaSection({ lang, mfaEnabled, onChanged, toast }) {
  const L = (ar, en) => (lang === "ar" ? ar : en);
  const [mode, setMode] = useState("idle"); // idle | enroll | codes | disable
  const [secret, setSecret] = useState("");
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [codes, setCodes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const startEnroll = async () => {
    setErr(""); setBusy(true);
    try {
      const { secret: sec, otpauth } = await api.mfaSetup();
      setSecret(sec);
      setQr(await QRCode.toDataURL(otpauth, { margin: 1, width: 180 }));
      setCode(""); setMode("enroll");
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const confirmEnroll = async () => {
    setErr(""); setBusy(true);
    try {
      const { recoveryCodes } = await api.mfaEnable(code.trim());
      setCodes(recoveryCodes); setMode("codes"); onChanged(true);
      toast(L("تم تفعيل التحقق بخطوتين", "Two-factor enabled"), "ok");
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const doDisable = async () => {
    setErr(""); setBusy(true);
    try { await api.mfaDisable(pw); setPw(""); setMode("idle"); onChanged(false); toast(L("تم تعطيل التحقق بخطوتين", "Two-factor disabled"), "ok"); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Smartphone size={15} color={T.green} />
        <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{L("المصادقة الثنائية (2FA)", "Two-factor authentication")}</div>
        {mfaEnabled && <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10.5, fontWeight: 700, background: `${T.compliant}1A`, color: T.compliant }}>{L("مفعّلة", "Enabled")}</span>}
      </div>

      {mode === "idle" && !mfaEnabled && (<>
        <div style={{ fontSize: 13, color: T.inkSoft }}>{L("أضف طبقة حماية ثانية باستخدام تطبيق مصادقة (TOTP).", "Add a second layer with an authenticator app (TOTP).")}</div>
        <button onClick={startEnroll} disabled={busy} className="rounded-lg px-4 py-2 text-sm font-semibold inline-flex items-center gap-2 raqib-focus" style={{ background: T.green, color: "#F4F2E9", opacity: busy ? 0.6 : 1 }}>
          {busy ? <Loader2 size={14} className="raqib-spin" /> : <ShieldCheck size={14} />} {L("تفعيل", "Enable 2FA")}
        </button>
      </>)}

      {mode === "idle" && mfaEnabled && (<>
        <div style={{ fontSize: 13, color: T.inkSoft }}>{L("التحقق بخطوتين مفعّل على حسابك.", "Two-factor is active on your account.")}</div>
        <button onClick={() => { setErr(""); setMode("disable"); }} className="rounded-lg px-4 py-2 text-sm font-semibold raqib-focus" style={{ background: "rgba(178,58,46,0.1)", color: T.gap }}>{L("تعطيل", "Disable 2FA")}</button>
      </>)}

      {mode === "enroll" && (<>
        <div style={{ fontSize: 13, color: T.inkSoft }}>{L("امسح الرمز بتطبيق المصادقة ثم أدخل الرمز المكوّن من ٦ أرقام.", "Scan with your authenticator app, then enter the 6-digit code.")}</div>
        {qr && <img src={qr} alt="QR" style={{ width: 180, height: 180, background: "#fff", padding: 8, borderRadius: 8 }} />}
        <div><FieldLbl>{L("المفتاح اليدوي", "Manual key")}</FieldLbl><Mono style={{ fontSize: 12, wordBreak: "break-all", color: T.inkSoft }}>{secret}</Mono></div>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" dir="ltr" className="raqib-focus"
          style={{ ...inputStyle, letterSpacing: "0.25em", textAlign: "center", fontWeight: 700 }} onKeyDown={(e) => e.key === "Enter" && confirmEnroll()} />
        {err && <div style={{ color: T.gap, fontSize: 13 }}>{err}</div>}
        <div className="flex gap-2">
          <button onClick={confirmEnroll} disabled={busy} className="rounded-lg px-4 py-2 text-sm font-semibold inline-flex items-center gap-2 raqib-focus" style={{ background: T.green, color: "#F4F2E9", opacity: busy ? 0.6 : 1 }}>
            {busy ? <Loader2 size={14} className="raqib-spin" /> : <BadgeCheck size={14} />} {L("تأكيد", "Confirm")}
          </button>
          <button onClick={() => setMode("idle")} className="rounded-lg px-3 py-2 text-sm font-semibold raqib-focus" style={{ background: T.line, color: T.inkSoft }}>{tt(lang, "cancel")}</button>
        </div>
      </>)}

      {mode === "codes" && (<>
        <div style={{ fontSize: 13, color: T.ink, fontWeight: 600 }}>{L("رموز الاسترداد — احفظها الآن", "Recovery codes — save these now")}</div>
        <div style={{ fontSize: 12, color: T.inkFaint }}>{L("كل رمز يُستخدم مرة واحدة، ولن تظهر مجددًا.", "Each code works once and will not be shown again.")}</div>
        <div className="rounded-lg p-3" style={{ background: "rgba(17,64,47,0.05)", border: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {codes.map((c) => <Mono key={c} style={{ fontSize: 13, color: T.ink }}>{c}</Mono>)}
        </div>
        <div className="flex gap-2">
          <button onClick={() => { navigator.clipboard?.writeText(codes.join("\n")); toast(L("نُسخت", "Copied"), "ok"); }} className="rounded-lg px-3 py-2 text-sm font-semibold inline-flex items-center gap-2 raqib-focus" style={{ background: "rgba(168,123,34,0.14)", color: T.brass }}><Copy size={13} /> {L("نسخ", "Copy")}</button>
          <button onClick={() => setMode("idle")} className="rounded-lg px-4 py-2 text-sm font-semibold raqib-focus" style={{ background: T.green, color: "#F4F2E9" }}>{L("تم", "Done")}</button>
        </div>
      </>)}

      {mode === "disable" && (<>
        <div style={{ fontSize: 13, color: T.inkSoft }}>{L("أكّد كلمة المرور لتعطيل التحقق بخطوتين.", "Confirm your password to disable two-factor.")}</div>
        <input value={pw} onChange={(e) => setPw(e.target.value)} type="password" dir="ltr" className="raqib-focus" style={inputStyle} placeholder={tt(lang, "pwLbl")} onKeyDown={(e) => e.key === "Enter" && doDisable()} />
        {err && <div style={{ color: T.gap, fontSize: 13 }}>{err}</div>}
        <div className="flex gap-2">
          <button onClick={doDisable} disabled={busy} className="rounded-lg px-4 py-2 text-sm font-semibold inline-flex items-center gap-2 raqib-focus" style={{ background: T.gap, color: "#fff", opacity: busy ? 0.6 : 1 }}>
            {busy ? <Loader2 size={14} className="raqib-spin" /> : <Ban size={14} />} {L("تعطيل", "Disable")}
          </button>
          <button onClick={() => { setMode("idle"); setPw(""); }} className="rounded-lg px-3 py-2 text-sm font-semibold raqib-focus" style={{ background: T.line, color: T.inkSoft }}>{tt(lang, "cancel")}</button>
        </div>
      </>)}
    </Card>
  );
}

function SettingsView({ settings, catalogs, onRescope, onRefreshCatalogs, onReset, audit, lang, user, toast, onMfaChanged }) {
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <div className="p-4 md:p-6 space-y-4" style={{ maxWidth: 640 }}>
      <div className="raqib-rise">
        <Eyebrow ar="الإعدادات" en="Settings" lang={lang} />
        <h1 style={{ fontSize: 24, fontWeight: 700, color: T.ink, marginTop: 4 }}>{tt(lang, "settingsTitle")}</h1>
      </div>
      <Card className="p-5 space-y-3">
        <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{tt(lang, "scopeLbl")}</div>
        <div style={{ fontSize: 13, color: T.inkSoft }}>
          {tt(lang, "activeLbl")}: {settings.frameworks.map((f) => `${FRAMEWORKS[f].short} ${catalogs[f]?.version || ""}`).join(" + ")}
          {settings.org ? ` · ${settings.org}` : ""}
        </div>
        {can(user.role, "manageScope") && (
          <button onClick={onRescope} className="rounded-lg px-4 py-2 text-sm font-semibold raqib-focus"
            style={{ background: T.green, color: "#F4F2E9" }}>{tt(lang, "changeFw")}</button>
        )}
      </Card>
      <Card className="p-5 space-y-3">
        <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{tt(lang, "cacheLbl")}</div>
        {settings.frameworks.map((f) => (
          <div key={f} style={{ fontSize: 13, color: T.inkSoft }}>
            {FRAMEWORKS[f].short}: {catalogs[f]
              ? tt(lang, "cachedAt", {
                  v: catalogs[f].version,
                  d: new Date(catalogs[f].fetchedAt).toLocaleString(lang === "ar" ? "ar-SA" : undefined),
                  n: catalogs[f].domains.reduce((a, d) => a + d.subdomains.reduce((b, s) => b + s.controls.length, 0), 0),
                })
              : tt(lang, "notLoaded")}
            {catalogs[f]?.source === "verified fallback" && (
              <span style={{ color: T.partial, fontWeight: 600 }}> · fallback</span>
            )}
          </div>
        ))}
        {can(user.role, "refetch") && (
          <button onClick={onRefreshCatalogs} className="rounded-lg px-4 py-2 text-sm font-semibold inline-flex items-center gap-2 raqib-focus"
            style={{ background: "rgba(168,123,34,0.14)", color: T.brass }}>
            <RefreshCw size={14} /> {tt(lang, "refetch")}
          </button>
        )}
        <div style={{ fontSize: 12, color: T.inkFaint }}>{tt(lang, "refetchNote")}</div>
      </Card>
      <PasswordSection lang={lang} toast={toast} />
      <MfaSection lang={lang} mfaEnabled={user.mfaEnabled} onChanged={onMfaChanged} toast={toast} />
      <Card className="p-5 space-y-3">
        <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{tt(lang, "auditData")}</div>
        <div style={{ fontSize: 13, color: T.inkSoft }}>{tt(lang, "auditN", { n: audit.length })}</div>
        {can(user.role, "resetData") && (!confirmReset ? (
          <button onClick={() => setConfirmReset(true)} className="rounded-lg px-4 py-2 text-sm font-semibold raqib-focus"
            style={{ background: "rgba(178,58,46,0.1)", color: T.gap }}>{tt(lang, "resetBtn")}</button>
        ) : (
          <div className="flex gap-2 items-center flex-wrap">
            <span style={{ fontSize: 13, color: T.gap, fontWeight: 600 }}>{tt(lang, "resetConfirm")}</span>
            <button onClick={onReset} className="rounded-lg px-3 py-1.5 text-xs font-bold raqib-focus" style={{ background: T.gap, color: "#FFF" }}>{tt(lang, "yesReset")}</button>
            <button onClick={() => setConfirmReset(false)} className="rounded-lg px-3 py-1.5 text-xs font-semibold raqib-focus" style={{ background: T.line, color: T.inkSoft }}>{tt(lang, "cancel")}</button>
          </div>
        ))}
      </Card>
      {can(user.role, "diagnostics") && <DiagnosticsPanel lang={lang} catalogs={catalogs} settings={settings} />}
    </div>
  );
}

function DiagnosticsPanel({ lang, catalogs, settings }) {
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);

  const TESTS = [
    {
      id: "storage", name: tt(lang, "diagStorage"),
      run: async () => {
        const t0 = Date.now();
        const me = await api.me();
        if (!me.user) throw new Error("no active session");
        await api.workspace();
        return `session valid · workspace reachable · ${Date.now() - t0}ms`;
      },
    },
    {
      id: "api", name: tt(lang, "diagApi"),
      run: async () => {
        const t0 = Date.now();
        const { reply } = await api.advisor([{ role: "user", content: "Reply with exactly: OK" }], false, lang);
        if (!/OK/i.test(reply)) throw new Error(`unexpected reply: ${String(reply).slice(0, 40)}`);
        return `claude-sonnet-4-6 via /api/advisor · ${Date.now() - t0}ms`;
      },
    },
    {
      id: "apisearch", name: tt(lang, "diagApiSearch"),
      run: async () => {
        const t0 = Date.now();
        const { meta } = await api.catalogMeta("ncaecc");
        if (!meta || !meta.version) throw new Error("no version returned");
        return `${meta.version} · ${meta.source} · ${Date.now() - t0}ms`;
      },
    },
    {
      id: "parser", name: tt(lang, "diagParser"),
      run: async () => {
        const trunc = '{"subdomains":[{"id":"1-1","en":"S","ar":"س","controls":[{"id":"1-1-1","t":"x"},{"id":"1-1-2","t":"tru';
        const r = parseLooseJSON(trunc);
        if (r.subdomains?.[0]?.controls?.length !== 1) throw new Error("repair produced wrong shape");
        if (parseLooseJSON('```json\n{"a":1}\n```').a !== 1) throw new Error("fence strip failed");
        return "fence strip + truncation repair OK";
      },
    },
    {
      id: "catalog", name: tt(lang, "diagCatalog"),
      run: async () => {
        const fws = (settings?.frameworks || []).filter((f) => catalogs[f]);
        if (!fws.length) throw new Error("no cached catalogs");
        const report = [];
        for (const f of fws) {
          const cat = catalogs[f];
          const rows = flattenControls({ [f]: cat }, [f]);
          if (!rows.length) throw new Error(`${f}: zero controls`);
          const ids = rows.map((r) => r.key);
          if (new Set(ids).size !== ids.length) throw new Error(`${f}: duplicate control IDs`);
          if (!cat.version) throw new Error(`${f}: missing version`);
          const arMissing = cat.domains.reduce((a, d) => a + d.subdomains.filter((s) => !s.ar).length, 0);
          report.push(`${(FRAMEWORKS[f] && FRAMEWORKS[f].short) || f} ${cat.version}: ${rows.length} controls, unique IDs${arMissing ? `, ${arMissing} subdomains missing Arabic` : ""}`);
        }
        return report.join(" · ");
      },
    },
  ];

  const runAll = async () => {
    setRunning(true);
    const out = [];
    for (const test of TESTS) {
      try { out.push({ id: test.id, name: test.name, ok: true, detail: await test.run() }); }
      catch (e) { out.push({ id: test.id, name: test.name, ok: false, detail: e.message }); }
      setResults([...out]);
    }
    setRunning(false);
  };

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{tt(lang, "diagTitle")}</div>
        <button onClick={runAll} disabled={running}
          className="rounded-lg px-4 py-2 text-sm font-semibold inline-flex items-center gap-2 raqib-focus"
          style={{ background: T.green, color: "#F4F2E9", opacity: running ? 0.6 : 1 }}>
          {running ? <Loader2 size={14} className="raqib-spin" /> : <CheckCheck size={14} />}
          {running ? tt(lang, "diagRunning") : tt(lang, "diagRun")}
        </button>
      </div>
      <div style={{ fontSize: 12, color: T.inkFaint }}>{tt(lang, "diagHint")}</div>
      {results && (
        <div className="space-y-1.5">
          {results.map((r) => (
            <div key={r.id} className="flex items-start gap-2 rounded-lg px-3 py-2"
              style={{ background: r.ok ? "rgba(31,122,77,0.07)" : "rgba(178,58,46,0.07)", border: `1px solid ${r.ok ? "rgba(31,122,77,0.25)" : "rgba(178,58,46,0.25)"}` }}>
              {r.ok ? <CheckCheck size={14} color={T.compliant} style={{ marginTop: 2, flexShrink: 0 }} />
                    : <AlertTriangle size={14} color={T.gap} style={{ marginTop: 2, flexShrink: 0 }} />}
              <div className="min-w-0">
                <div style={{ fontSize: 12.5, fontWeight: 700, color: r.ok ? T.compliant : T.gap }}>{r.name}</div>
                <div dir="auto" style={{ fontSize: 11.5, color: T.inkSoft, wordBreak: "break-word" }}>{r.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   SHELL & APP
══════════════════════════════════════════════════════════════════════════ */

const NAV = [
  { id: "dash", Icon: LayoutDashboard },
  { id: "controls", Icon: ListChecks },
  { id: "risk", Icon: Flame },
  { id: "evidence", Icon: FileCheck2 },
  { id: "actions", Icon: ListTodo }, // POA&M — every role; viewer is read-only
  { id: "approvals", Icon: ClipboardCheck, need: "approve" },
  { id: "advisor", Icon: Sparkles },
  { id: "users", Icon: UsersIcon, need: "manageUsers" },
  { id: "settings", Icon: Settings2 },
];

export default function App() {
  const [phase, setPhase] = useState("boot"); // boot | firstrun | login | onboard | loading | ready
  const [users, setUsers] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [settings, setSettings] = useState(null);
  const [lang, setLangRaw] = useState("en");
  const [catalogs, setCatalogs] = useState({});
  const [assess, setAssessRaw] = useState({});
  const [audit, setAudit] = useState([]);
  const [snaps, setSnaps] = useState([]);
  const [guidance, setGuidance] = useState({});
  const [evidence, setEvidenceRaw] = useState({});
  const [view, setView] = useState("dash");
  const [progress, setProgress] = useState({ pct: 0, label: "", done: 0, total: 0, kind: "discover" });
  const [loadError, setLoadError] = useState(null);
  const [advisorMsgs, setAdvisorMsgsRaw] = useState([]);
  const [advisorCid, setAdvisorCid] = useState(null);
  const [pendingControl, setPendingControl] = useState(null);
  const [actionsPrefill, setActionsPrefill] = useState(null); // control key pre-linked into a new corrective action
  const [drawerRow, setDrawerRow] = useState(null);
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const toast = useCallback((msg, kind = "ok") => {
    const id = Math.random();
    setToasts((p) => [...p.slice(-2), { id, msg, kind }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3200);
  }, []);

  // Language is a per-user UI preference, kept client-side (no server write needed).
  const setLang = useCallback((l) => {
    setLangRaw(l);
    try { localStorage.setItem("raqib:lang", l); } catch {}
  }, []);

  // Advisor thread renders from memory but is persisted server-side per
  // conversation id (survives reload); per-control guidance stays in memory.
  const setAdvisorMsgs = useCallback((updater) => setAdvisorMsgsRaw(updater), []);
  const setEvidence = useCallback((updater) => setEvidenceRaw(updater), []);

  const newCid = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`);
  useEffect(() => {
    if (!currentUser) { setAdvisorCid(null); return; }
    const k = `raqib:cid:${currentUser.id}`;
    let c = null;
    try { c = localStorage.getItem(k); } catch {}
    if (!c || !/^[A-Za-z0-9_-]{8,64}$/.test(c)) {
      c = newCid();
      try { localStorage.setItem(k, c); } catch {}
    }
    setAdvisorCid(c);
  }, [currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const newAdvisorThread = useCallback(async () => {
    if (advisorCid) { try { await api.advisorClear(advisorCid); } catch { /* stale rows are harmless */ } }
    const c = newCid();
    if (currentUser) { try { localStorage.setItem(`raqib:cid:${currentUser.id}`, c); } catch {} }
    setAdvisorCid(c);
    setAdvisorMsgsRaw([]);
  }, [advisorCid, currentUser]);

  // Reload the authoritative workspace from the server (used to recover from a write error).
  const reloadWorkspace = useCallback(async () => {
    try {
      const ws = await api.workspace();
      setCatalogs(ws.catalogs || {});
      setAssessRaw(ws.assessments || {});
      setAudit(ws.audit || []);
      setSnaps(ws.snapshots || []);
      setEvidenceRaw(ws.evidence || {});
      if (ws.settings) setSettings((st) => ({ ...(st || {}), ...ws.settings }));
    } catch { /* session likely expired; boot/login will handle */ }
  }, []);

  // Persist a batch of assessment changes; reconcile with the server's authoritative records.
  const persistAssess = useCallback((items) => {
    if (!items.length) return;
    api.applyAssessments(items)
      .then((res) => { if (res && res.changed) setAssessRaw((cur) => ({ ...cur, ...res.changed })); })
      .catch((e) => { toast(e.message || tt(lang, "permDenied"), "error"); reloadWorkspace(); });
  }, [lang, toast, reloadWorkspace]);

  const selected = settings?.frameworks?.filter((f) => catalogs[f]) || [];
  const allRows = useMemo(() => flattenControls(catalogs, selected), [catalogs, selected]);
  const allRowsByKey = useMemo(() => new Map(allRows.map((r) => [r.key, r])), [allRows]);
  const keysByCid = useMemo(() => {
    const m = new Map();
    for (const r of allRows) {
      const arr = m.get(r.control.id) || [];
      arr.push(r.key);
      m.set(r.control.id, arr);
    }
    return m;
  }, [allRows]);
  const validKeysByFw = useMemo(() => {
    const m = {};
    for (const f of selected) m[f] = new Set(allRows.filter((r) => r.fw === f).map((r) => r.key));
    return m;
  }, [allRows, selected]);
  const versions = useMemo(() => {
    const v = {};
    for (const f of selected) v[f] = catalogs[f]?.version || "";
    return v;
  }, [catalogs, selected]);
  const postureSummary = useMemo(
    () => buildPostureSummary(allRows, assess, selected, versions),
    [allRows, assess, selected, versions]
  );
  const pendingCount = useMemo(
    () => allRows.filter((r) => assess[r.key]?.review === "pending").length,
    [allRows, assess]
  );

  /* Core mutation: status/record changes with RBAC + approval + audit + snapshot.
     Updates local state optimistically (instant UI), then persists to the server
     which re-checks RBAC, runs the approval transition, writes audit, and snapshots. */
  const applyStatus = useCallback((rowsOrRow, status, extra) => {
    if (!currentUser || !can(currentUser.role, "assess")) { toast(tt(lang, "permDenied"), "error"); return; }
    const rows = Array.isArray(rowsOrRow) ? rowsOrRow : [rowsOrRow];
    const next = { ...assess };
    const auditAdds = [];
    const items = [];
    let anyPending = false;
    for (const r of rows) {
      const from = assess[r.key]?.s || "unassessed";
      const patch = { ...(extra || {}) };
      if (status !== undefined && status !== null) patch.s = status;
      next[r.key] = makeRecord(assess[r.key], patch, currentUser);
      if (next[r.key].review === "pending") anyPending = true;
      const to = next[r.key].s;
      if (from !== to) auditAdds.push({ key: r.key, id: r.control.id, from, to, by: currentUser.name, t: Date.now() });
      items.push({ key: r.key, id: r.control.id, ...patch });
    }
    setAssessRaw(next);
    if (auditAdds.length) {
      setAudit((a) => [...auditAdds.slice().reverse(), ...a].slice(0, 300));
      const pct = scoreOf(allRows, next).pct;
      setSnaps((s) => [...s, { t: Date.now(), pct }].slice(-60));
    }
    persistAssess(items);
    return anyPending;
  }, [allRows, assess, currentUser, lang, toast, persistAssess]);

  const saveDrawer = useCallback((key, rec) => {
    const row = allRowsByKey.get(key);
    if (!row) return;
    const pending = applyStatus(row, rec.s, rec);
    setDrawerRow(null);
    toast(tt(lang, pending ? "toastPending" : "toastSaved"));
  }, [allRowsByKey, applyStatus, toast, lang]);

  const decideApproval = useCallback((row, action) => {
    if (!currentUser || !can(currentUser.role, "approve")) return;
    const rec = assess[row.key];
    if (!rec || rec.review !== "pending") return;
    const next = { ...assess };
    if (action === "approve") {
      next[row.key] = approveRecord(rec, currentUser);
    } else {
      const reverted = rejectRecord(rec, currentUser);
      next[row.key] = reverted;
      setAudit((a) => [{ key: row.key, id: row.control.id, from: rec.s, to: reverted.s, by: currentUser.name, t: Date.now() }, ...a].slice(0, 300));
    }
    setAssessRaw(next);
    api.decide(row.key, row.control.id, action)
      .then((res) => { if (res && res.record) setAssessRaw((cur) => ({ ...cur, [row.key]: res.record })); })
      .catch((e) => { toast(e.message, "error"); reloadWorkspace(); });
    toast(tt(lang, action === "approve" ? "toastApproved" : "toastRejected"));
  }, [assess, currentUser, lang, toast, reloadWorkspace]);

  const onImport = useCallback((plan) => {
    if (!currentUser || !can(currentUser.role, "importData")) { toast(tt(lang, "permDenied"), "error"); return; }
    const byKey = new Map();
    for (const u of plan.updates) byKey.set(u.key, { ...(byKey.get(u.key) || {}), ...u });
    const next = { ...assess };
    const auditAdds = [];
    const items = [];
    let applied = 0;
    for (const [key, u] of byKey) {
      const row = allRowsByKey.get(key);
      if (!row) continue;
      const from = assess[key]?.s || "unassessed";
      const patch = {};
      if (u.s) patch.s = u.s;
      if (u.owner !== undefined) patch.owner = u.owner;
      if (u.due !== undefined) patch.due = u.due;
      if (u.note !== undefined) patch.note = u.note;
      next[key] = makeRecord(assess[key], patch, currentUser);
      applied++;
      const to = next[key].s;
      if (from !== to) auditAdds.push({ key, id: row.control.id, from, to, by: currentUser.name, t: Date.now() });
      items.push({ key, id: row.control.id, ...patch });
    }
    setAssessRaw(next);
    if (auditAdds.length) {
      setAudit((a) => [...auditAdds.slice().reverse(), ...a].slice(0, 300));
      const pct = scoreOf(allRows, next).pct;
      setSnaps((s) => [...s, { t: Date.now(), pct }].slice(-60));
    }
    persistAssess(items);
    toast(tt(lang, "toastImport", { a: applied, k: plan.skipped }));
  }, [allRows, allRowsByKey, assess, currentUser, lang, toast, persistAssess]);

  const onEvidence = useCallback((ev) => {
    setEvidence((p) => ({ ...p, [ev.id]: ev }));
  }, [setEvidence]);

  const genGuidance = useCallback(async (row) => {
    try {
      const isAr = lang === "ar";
      const content = isAr
        ? `الضابط ${row.control.id} (${FRAMEWORKS[row.fw].short} ${versions[row.fw] || ""}، النطاق الفرعي "${row.sub.ar || row.sub.en}"): "${row.control.t}".\nأعطني: (١) ٣-٥ خطوات تنفيذ، (٢) الأدلة التي يقبلها المدقق، (٣) خطأ شائع واحد. نص عادي مرقّم بدون عناوين. بحد أقصى ١٨٠ كلمة.`
        : `Control ${row.control.id} (${FRAMEWORKS[row.fw].short} ${versions[row.fw] || ""}, subdomain "${row.sub.en}"): "${row.control.t}".\nGive: (1) 3-5 implementation steps, (2) evidence artifacts an auditor accepts, (3) one common pitfall. Plain text, numbered, no headers. Max 180 words.`;
      const { reply } = await api.advisor([{ role: "user", content }], false, lang);
      setGuidance((g) => ({ ...g, [row.key]: reply }));
    } catch (e) { toast(e.message || tt(lang, "advFail"), "error"); }
  }, [toast, lang, versions]);

  const makeReport = useCallback(() => {
    const overall = scoreOf(allRows, assess);
    const perFw = selected.map((fw) => ({ fw, ...scoreOf(allRows.filter((r) => r.fw === fw), assess) }));
    const isAr = lang === "ar";
    const domainRows = [];
    for (const fw of selected) {
      for (const d of catalogs[fw].domains) {
        const s = scoreOf(allRows.filter((r) => r.fw === fw && r.domainN === d.n), assess);
        domainRows.push({ full: `${FRAMEWORKS[fw].short} — ${isAr && d.ar ? d.ar : d.en}`, pct: s.pct, gaps: s.counts.gap });
      }
    }
    const gaps = allRows.filter((r) => assess[r.key]?.s === "gap").slice(0, 20)
      .map((r) => ({ id: r.control.id, t: r.control.t, owner: assess[r.key]?.owner, due: assess[r.key]?.due }));
    const evCov = evidenceCoverage(allRows, assess, evidence);
    const html = reportHTML({
      org: settings.org, lang, selected, versions, overall, perFw, domainRows, gaps,
      evCov, evCount: Object.keys(evidence).length,
      maturity: avgMaturity(allRows.filter((r) => r.fw === "samacsf"), assess),
      generatedBy: currentUser?.name || "",
    });
    downloadBlob(`burhan-report-${new Date().toISOString().slice(0, 10)}.html`, "text/html;charset=utf-8", html);
    toast(tt(lang, "toastReport"));
  }, [allRows, assess, catalogs, currentUser, evidence, lang, selected, settings, toast, versions]);

  /* ── Auth actions ── */
  /* Hydrate the authoritative workspace from the server after auth, then route
     to onboard / loading / ready. Catalogs are server-persisted; the user list
     is loaded only for roles that may manage it. */
  const hydrate = useCallback(async (user) => {
    const ws = await api.workspace();
    setCatalogs(ws.catalogs || {});
    setAssessRaw(ws.assessments || {});
    setAudit(ws.audit || []);
    setSnaps(ws.snapshots || []);
    setEvidenceRaw(ws.evidence || {});
    if (ws.settings) setSettings((st) => ({ ...(st || {}), ...ws.settings }));
    if (user && can(user.role, "manageUsers")) {
      try {
        const { users: list } = await api.listUsers();
        const map = {};
        for (const u of list) map[u.id] = { ...u, t: u.created_at ? new Date(u.created_at).getTime() : 0 };
        setUsers(map);
      } catch { /* non-fatal */ }
    }
    const fws = (ws.settings && ws.settings.frameworks) || [];
    if (!fws.length) { setPhase("onboard"); return; }
    if (fws.some((f) => !ws.catalogs || !ws.catalogs[f])) loadCatalogs(fws, ws.catalogs || {});
    else setPhase("ready");
  }, []); // loadCatalogs is hoisted below

  const createAdmin = useCallback(async ({ name, email, password }) => {
    const { user } = await api.bootstrap({ name, email, password });
    setCurrentUser(user);
    await hydrate(user);
  }, [hydrate]);

  const login = useCallback(async (email, password) => {
    try {
      const r = await api.login(email, password);
      if (r.mfa) return { mfa: true, challenge: r.challenge };
      setCurrentUser(r.user);
      await hydrate(r.user);
      return { ok: true };
    } catch (e) { return { error: e.message }; }
  }, [hydrate]);

  const verifyMfa = useCallback(async (challenge, code) => {
    try {
      const r = await api.mfaVerify(challenge, code);
      setCurrentUser(r.user);
      await hydrate(r.user);
      return { ok: true };
    } catch (e) { return { error: e.message }; }
  }, [hydrate]);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch {}
    setCurrentUser(null); setUsers({}); setSettings(null); setCatalogs({});
    setAssessRaw({}); setAudit([]); setSnaps([]); setGuidance({}); setAdvisorMsgsRaw([]); setEvidenceRaw({});
    setPhase("login");
  }, []);

  const refreshUsers = useCallback(async () => {
    try {
      const { users: list } = await api.listUsers();
      const map = {};
      for (const u of list) map[u.id] = { ...u, t: u.created_at ? new Date(u.created_at).getTime() : 0 };
      setUsers(map);
    } catch { /* ignore */ }
  }, []);

  const addUser = useCallback(async ({ name, email, role, password }) => {
    try { await api.addUser({ name, email, role, password }); await refreshUsers(); toast(tt(lang, "toastUser")); }
    catch (e) { toast(e.message, "error"); }
  }, [lang, toast, refreshUsers]);

  const toggleActive = useCallback(async (id) => {
    try {
      // Removal is a soft-delete: DELETE /api/users deactivates (records survive).
      const { user } = users[id]?.active ? await api.removeUser(id) : await api.patchUser({ id, active: true });
      setUsers((p) => ({ ...p, [id]: { ...p[id], ...user } }));
    } catch (e) { toast(e.message, "error"); }
  }, [users, toast]);

  const resetPw = useCallback(async (id, password) => {
    try { await api.patchUser({ id, password }); toast(tt(lang, "toastUser")); }
    catch (e) { toast(e.message, "error"); }
  }, [lang, toast]);

  /* ── Boot ── */
  useEffect(() => {
    try { const l = localStorage.getItem("raqib:lang"); if (l) setLangRaw(l); } catch {}
    (async () => {
      try {
        const { user } = await api.me();
        setCurrentUser(user);
        await hydrate(user);
      } catch {
        try { const { initialized } = await api.status(); setPhase(initialized ? "login" : "firstrun"); }
        catch { setPhase("login"); }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCatalogs(frameworks, existing = {}, force = false) {
    setPhase("loading"); setLoadError(null);
    try {
      const { catalogs: cats, errors } = await fetchCatalogs(frameworks, existing, force, (kind, done, total, label) => {
        const pct = kind === "discover" ? Math.round((done / total) * 18) : 18 + Math.round((done / total) * 82);
        setProgress({ kind, done, total, label, pct });
      });
      setCatalogs((prev) => ({ ...prev, ...cats })); // keep frameworks that completed
      if (errors && errors.length) { setLoadError(errors.join(" | ")); return; } // stay on loader; retry fills the gaps
      setPhase("ready");
      toast(tt(lang, "toastCat"));
    } catch (e) { setLoadError(e.message); }
  }

  const confirmScope = async (frameworks, org) => {
    try {
      await api.saveSettings(frameworks, org, lang);
      setSettings((st) => ({ ...(st || {}), frameworks, org, lang }));
      loadCatalogs(frameworks, catalogs);
    } catch (e) { toast(e.message, "error"); }
  };

  const resetAll = async () => {
    try { await api.resetAll(); } catch (e) { toast(e.message, "error"); return; }
    setUsers({}); setCurrentUser(null); setSettings(null); setCatalogs({});
    setAssessRaw({}); setAudit([]); setSnaps([]); setGuidance({}); setAdvisorMsgsRaw([]); setEvidenceRaw({});
    setPhase("firstrun");
  };

  const dir = lang === "ar" ? "rtl" : "ltr";
  const appFont = fontFor(lang);

  if (phase === "boot") {
    return (
      <div dir={dir} className="min-h-screen flex items-center justify-center" style={{ background: T.green }}>
        <Loader2 size={26} color={T.brassSoft} className="raqib-spin" /><GlobalStyle />
      </div>
    );
  }
  if (phase === "firstrun") {
    return <div dir={dir} style={{ fontFamily: appFont }}><GlobalStyle />
      <AuthShell lang={lang} setLang={setLang}><FirstRun lang={lang} onCreate={createAdmin} /></AuthShell></div>;
  }
  if (phase === "login") {
    return <div dir={dir} style={{ fontFamily: appFont }}><GlobalStyle />
      <AuthShell lang={lang} setLang={setLang}><Login lang={lang} onLogin={login} onVerify={verifyMfa} /></AuthShell></div>;
  }
  if (phase === "onboard") {
    return <div dir={dir} style={{ fontFamily: appFont }}><GlobalStyle />
      <Onboarding onConfirm={confirmScope} initial={settings} lang={lang} setLang={setLang} /></div>;
  }
  if (phase === "loading") {
    return <div dir={dir} style={{ fontFamily: appFont }}><GlobalStyle />
      <CatalogLoader progress={progress} error={loadError} lang={lang}
        onRetry={() => loadCatalogs(settings.frameworks, catalogs)} /></div>;
  }

  const askAI = (r) => { setDrawerRow(null); setPendingControl(r); setView("advisor"); };
  const navItems = NAV.filter((n) => !n.need || can(currentUser.role, n.need));

  return (
    <div dir={dir} className="flex min-h-screen" style={{ background: T.paper, fontFamily: appFont }}>
      <GlobalStyle />
      <Toasts toasts={toasts} />
      {drawerRow && (
        <ControlDrawer row={drawerRow} assess={assess} audit={audit} guidance={guidance} lang={lang}
          evidence={evidence} user={currentUser}
          onSave={saveDrawer} onClose={() => setDrawerRow(null)} onGuidance={genGuidance} onAskAI={askAI}
          onCreateAction={(r) => { setDrawerRow(null); setActionsPrefill(r.key); setView("actions"); }} />
      )}

      <aside className="flex flex-col items-stretch flex-shrink-0 w-16 md:w-52" style={{ background: T.green }}>
        <div className="px-3 md:px-5 pt-6 pb-5" style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'IBM Plex Sans Arabic'", color: T.brassSoft, fontSize: 26, fontWeight: 700, lineHeight: 1 }}>برهان</div>
          <div className="hidden md:block" style={{ color: "#CFE0D6", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700, marginTop: 4 }}>Burhan GRC</div>
          <div className="hidden md:block" style={{ color: "#7E988B", fontSize: 11, marginTop: 2 }}>
            {selected.map((f) => `${FRAMEWORKS[f].short} ${versions[f]}`.trim()).join(" · ")}
          </div>
        </div>
        <nav className="flex-1 px-2 md:px-3 space-y-1">
          {navItems.map(({ id, Icon }) => {
            const on = view === id;
            const badge = id === "approvals" && pendingCount > 0 ? pendingCount : null;
            return (
              <button key={id} onClick={() => setView(id)} title={(STR[lang] || STR.en).nav[id]}
                className="w-full flex items-center justify-center md:justify-start gap-3 rounded-lg px-2 md:px-3 py-2.5 transition-colors raqib-focus"
                style={{ background: on ? "rgba(201,164,90,0.16)" : "transparent", position: "relative" }}>
                <Icon size={17} color={on ? T.brassSoft : "#9DB1A7"} />
                <span className="hidden md:block" style={{ fontSize: 13.5, fontWeight: on ? 700 : 500, color: on ? "#F4F2E9" : "#BACFC4", flex: 1, textAlign: "start" }}>
                  {(STR[lang] || STR.en).nav[id]}
                </span>
                {badge && (
                  <span className="rounded-full" style={{ fontSize: 10, fontWeight: 800, background: T.brassSoft, color: T.greenDeep, padding: "1px 7px" }}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="px-2 md:px-4 py-4 space-y-3" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="flex items-center justify-center md:justify-start gap-2">
            <div className="rounded-full flex items-center justify-center" style={{ width: 30, height: 30, background: "rgba(201,164,90,0.2)", color: T.brassSoft, fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
              {currentUser.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="hidden md:block min-w-0">
              <div dir="auto" style={{ color: "#F1EFE6", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{currentUser.name}</div>
              <div style={{ color: "#7E988B", fontSize: 10.5 }}>{tt(lang, "roles")[currentUser.role]}</div>
            </div>
          </div>
          <div className="flex items-center justify-center md:justify-between gap-2 flex-wrap">
            <LangToggle lang={lang} onToggle={() => setLang(lang === "ar" ? "en" : "ar")} dark />
            <button onClick={logout} title={tt(lang, "signOut")}
              className="rounded-lg p-1.5 raqib-focus" style={{ background: "rgba(255,255,255,0.08)" }}>
              <LogOut size={14} color="#BACFC4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto" style={{ maxHeight: "100vh" }}>
        {view === "dash" && (
          <Dashboard catalogs={catalogs} selected={selected} assess={assess} org={settings.org} lang={lang}
            goControls={() => setView("controls")} goEvidence={() => setView("evidence")}
            snaps={snaps} audit={audit} allRows={allRows} evidence={evidence} user={currentUser}
            onReport={makeReport}
            onExportCSV={() => { exportCSV(allRows, assess, settings.org, lang); toast(tt(lang, "toastCsv")); }}
            onExportJSON={() => { exportJSON(catalogs, assess, settings, audit, snaps, evidence, users); toast(tt(lang, "toastJson")); }} />
        )}
        {view === "controls" && (
          <ControlsView allRows={allRows} selected={selected} assess={assess} lang={lang} user={currentUser}
            keysByCid={keysByCid} onImport={onImport}
            onStatus={(r, s) => { const p = applyStatus(r, s); if (p !== undefined) toast(tt(lang, p ? "toastPending" : "toastSaved")); }}
            onBulk={(rows, s) => { const p = applyStatus(rows, s); if (p !== undefined) toast(tt(lang, p ? "toastPending" : "toastBulk", p ? {} : { n: rows.length, s: stLabel(lang, s) })); }}
            onOpen={setDrawerRow} />
        )}
        {view === "risk" && <RiskView allRows={allRows} assess={assess} lang={lang} onOpenControls={() => setView("controls")} />}
        {view === "actions" && (
          <ActionsView user={currentUser} lang={lang} evidence={evidence} toast={toast}
            prefillKey={actionsPrefill} clearPrefill={() => setActionsPrefill(null)} />
        )}
        {view === "evidence" && (
          <EvidenceView evidence={evidence} setEvidence={setEvidence} lang={lang} user={currentUser}
            allRowsByKey={allRowsByKey} goAdvisor={() => setView("advisor")} toast={toast} versions={versions} />
        )}
        {view === "approvals" && can(currentUser.role, "approve") && (
          <ApprovalsView allRows={allRows} assess={assess} lang={lang} onDecide={decideApproval} />
        )}
        {view === "advisor" && (
          <AdvisorView msgs={advisorMsgs} setMsgs={setAdvisorMsgs} lang={lang}
            pendingControl={pendingControl} clearPending={() => setPendingControl(null)}
            org={settings.org} selected={selected} toast={toast} postureSummary={postureSummary}
            versions={versions} onEvidence={onEvidence} validKeysByFw={validKeysByFw}
            user={currentUser} goEvidence={() => setView("evidence")}
            cid={advisorCid} onNewThread={newAdvisorThread} />
        )}
        {view === "users" && can(currentUser.role, "manageUsers") && (
          <UsersView users={users} lang={lang} currentUser={currentUser}
            onAdd={addUser} onToggleActive={toggleActive} onResetPw={resetPw} toast={toast} />
        )}
        {view === "settings" && (
          <SettingsView settings={settings} catalogs={catalogs} audit={audit} lang={lang} user={currentUser}
            toast={toast} onMfaChanged={(v) => setCurrentUser((u) => (u ? { ...u, mfaEnabled: v } : u))}
            onRescope={() => setPhase("onboard")}
            onRefreshCatalogs={() => loadCatalogs(settings.frameworks, {}, true)}
            onReset={resetAll} />
        )}
      </main>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   PUBLIC UPLOAD PAGE — /u/<token> · no login, no registration, no app shell.
   Shows only the target item's TITLE; can only submit to that item.
══════════════════════════════════════════════════════════════════════════ */

const PUB_ACCEPT = ".pdf,.png,.jpg,.jpeg,.zip,.csv,.log,.txt";

export function PublicUploadPage({ token }) {
  const lang = typeof navigator !== "undefined" && String(navigator.language || "").startsWith("ar") ? "ar" : "en";
  const dir = lang === "ar" ? "rtl" : "ltr";
  const [phase, setPhase] = useState("loading"); // loading | ready | sending | done | invalid
  const [info, setInfo] = useState(null);
  const [files, setFiles] = useState([]);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try { setInfo(await api.publicUploadInfo(token)); setPhase("ready"); }
      catch { setPhase("invalid"); }
    })();
  }, [token]);

  const maxFiles = info?.maxFiles || 3;
  const maxMb = Math.round((info?.maxBytes || 4 * 1024 * 1024) / 1024 / 1024);

  const onPick = (e) => {
    setErr("");
    setFiles(Array.from(e.target.files || []).slice(0, maxFiles));
    e.target.value = "";
  };

  const submit = async () => {
    if (!files.length || phase === "sending") return;
    setErr(""); setPhase("sending");
    try {
      const payload = [];
      for (const f of files) {
        const ext = (f.name.toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || "";
        const entry = { name: f.name, size: f.size };
        if (["pdf", "png", "jpg", "jpeg"].includes(ext)) entry.data = await readFileAs(f, "b64");
        else if (["csv", "log", "txt"].includes(ext)) entry.text = (await readFileAs(f, "text")).slice(0, 24000);
        if (["png", "jpg", "jpeg"].includes(ext)) entry.mime = f.type || (ext === "png" ? "image/png" : "image/jpeg");
        payload.push(entry); // zip: metadata only — bytes are never retained anyway
      }
      await api.publicUpload(token, { name: name.trim(), note: note.trim(), files: payload });
      setPhase("done");
    } catch (e) {
      if (e.status === 410) { setPhase("invalid"); return; }
      setErr(e.message || "Upload failed");
      setPhase("ready");
    }
  };

  return (
    <div dir={dir} className="min-h-screen flex items-center justify-center p-4"
      style={{ background: T.paper, fontFamily: fontFor(lang) }}>
      <GlobalStyle />
      <div className="w-full rounded-2xl p-6 space-y-4" style={{ maxWidth: 460, background: "#FFFFFF", border: `1px solid ${T.line}`, boxShadow: "0 10px 34px rgba(20,30,25,0.08)" }}>
        <div className="flex items-center gap-2">
          <div style={{ fontFamily: "'IBM Plex Sans Arabic'", color: T.emerald, fontSize: 20, fontWeight: 700 }}>برهان</div>
          <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: T.inkFaint, fontWeight: 700 }}>Burhan GRC</div>
        </div>

        {phase === "loading" && (
          <div className="flex items-center gap-2" style={{ color: T.inkFaint, fontSize: 13 }}>
            <Loader2 size={15} className="raqib-spin" /> …
          </div>
        )}

        {phase === "invalid" && (
          <div className="rounded-lg p-4" style={{ background: "rgba(178,58,46,0.07)", border: "1px solid rgba(178,58,46,0.3)", color: T.red, fontSize: 13.5, fontWeight: 600 }}>
            {tt(lang, "pubInvalid")}
          </div>
        )}

        {phase === "done" && (
          <div className="rounded-lg p-4 flex items-center gap-2" style={{ background: "rgba(22,143,91,0.08)", border: `1px solid ${T.emerald}`, color: T.emerald, fontSize: 13.5, fontWeight: 600 }}>
            <CheckCheck size={16} /> {tt(lang, "pubDone")}
          </div>
        )}

        {(phase === "ready" || phase === "sending") && info && (
          <>
            <div>
              <h1 style={{ fontSize: 19, fontWeight: 700, color: T.ink, margin: 0 }}>{tt(lang, "pubUploadTitle")}</h1>
              <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 6 }}>{tt(lang, "pubUploadFor")}</div>
              <div dir="auto" className="rounded-lg px-3 py-2 mt-1" style={{ background: T.panel, border: `1px solid ${T.line}`, fontSize: 13.5, fontWeight: 700, color: T.ink }}>
                {info.title}
              </div>
            </div>
            <input value={name} onChange={(e) => setName(e.target.value)} dir="auto"
              placeholder={tt(lang, "pubYourName")} style={inputStyle} className="raqib-focus" />
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} dir="auto"
              placeholder={tt(lang, "pubNote")} style={{ ...inputStyle, resize: "vertical" }} className="raqib-focus" />
            <div>
              <input id="pub-files" type="file" multiple accept={PUB_ACCEPT} onChange={onPick} style={{ display: "none" }} />
              <label htmlFor="pub-files" className="rounded-lg px-4 py-2.5 text-sm font-semibold inline-flex items-center gap-2 raqib-focus"
                style={{ background: "rgba(22,143,91,0.1)", color: T.emerald, cursor: "pointer" }}>
                <Paperclip size={14} /> {tt(lang, "attach")}
              </label>
              <div style={{ fontSize: 11, color: T.inkFaint, marginTop: 6 }}>
                {tt(lang, "pubLimits", { ext: (info.accept || []).join(", "), mb: maxMb, n: maxFiles })}
              </div>
              {files.length > 0 && (
                <div className="mt-2 space-y-1">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2" style={{ fontSize: 12.5, color: T.inkSoft }}>
                      <FileText size={13} color={T.emerald} />
                      <span dir="auto" style={{ fontWeight: 600, color: T.ink }}>{f.name}</span>
                      <span style={{ color: T.inkFaint }}>{Math.round(f.size / 1024)} KB</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {err && <div style={{ color: T.red, fontSize: 12.5, fontWeight: 600 }}>{err}</div>}
            <button onClick={submit} disabled={!files.length || phase === "sending"}
              className="w-full rounded-lg py-2.5 font-semibold inline-flex items-center justify-center gap-2 raqib-focus"
              style={{ background: files.length && phase !== "sending" ? T.emerald : T.line, color: files.length && phase !== "sending" ? "#FFFFFF" : T.inkFaint, fontSize: 14 }}>
              {phase === "sending" ? <Loader2 size={15} className="raqib-spin" /> : <Upload size={15} />} {tt(lang, "pubSubmit")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Global styles ── */

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;600;700&display=swap');
      * { box-sizing: border-box; }
      body { margin: 0; }
      button { cursor: pointer; border: none; background: none; font-family: inherit; }
      input, textarea, select { font-family: inherit; }
      [dir="rtl"] input, [dir="rtl"] textarea { text-align: start; }
      .raqib-focus:focus-visible { outline: 2px solid #C9A45A; outline-offset: 2px; }
      .raqib-row { transition: background 120ms; }
      .raqib-row:hover { background: rgba(17,64,47,0.04); }
      @keyframes raqibRise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
      .raqib-rise { animation: raqibRise 480ms cubic-bezier(.2,.7,.2,1) both; }
      @keyframes raqibDrawer { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
      .raqib-drawer { animation: raqibDrawer 220ms cubic-bezier(.2,.7,.2,1) both; }
      @keyframes raqibSpin { to { transform: rotate(360deg); } }
      .raqib-spin { animation: raqibSpin 900ms linear infinite; }
      ::-webkit-scrollbar { width: 10px; height: 10px; }
      ::-webkit-scrollbar-thumb { background: #CFCBBC; border-radius: 8px; border: 2px solid #F2F1EA; }
      @media (prefers-reduced-motion: reduce) {
        .raqib-rise, .raqib-drawer { animation: none; }
        * { transition: none !important; }
      }
    `}</style>
  );
}
