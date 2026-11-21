import type { LanguageCode } from '../types/database';

export type TranslationDict = Record<string, string>;

const en: TranslationDict = {
  // Brand & Shell
  'brand.name': 'PrepZone',
  'brand.tagline': 'UP Board Class 12 & JEE Learning Platform',
  'nav.group.core': 'Overview',
  'nav.group.tracks': 'Exam Tracks',
  'nav.group.tools': 'Study Workspace',
  'nav.group.account': 'Personal',
  'nav.dashboard': 'Dashboard',
  'nav.upBoard12': 'UP Board Class 12',
  'nav.jeeMain': 'JEE Main',
  'nav.jeeAdvanced': 'JEE Advanced',
  'nav.pdfLibrary': 'PDF Library',
  'nav.videoLectures': 'Video Lectures',
  'nav.practiceTests': 'Practice & Mock Tests',
  'nav.revisionCenter': 'Revision Center',
  'nav.studyPlanner': 'Study Planner',
  'nav.aiAssistant': 'AI Study Assistant',
  'nav.progressAnalytics': 'Progress & Analytics',
  'nav.bookmarks': 'Bookmarks',
  'nav.settings': 'Settings',
  'nav.profile': 'Student Profile',
  'nav.signIn': 'Sign In',
  'nav.register': 'Create Account',
  'nav.signOut': 'Sign Out',
  'nav.openMenu': 'Open navigation menu',
  'nav.closeMenu': 'Close navigation menu',

  // Header & Global Controls
  'header.searchPlaceholder': 'Search modules, exams, or tools...',
  'header.searchLabel': 'Search PrepZone',
  'header.searchNoResults': 'No matching modules found.',
  'header.languageSwitch': 'Switch language',
  'header.themeLight': 'Switch to dark mode',
  'header.themeDark': 'Switch to light mode',
  'header.notifications': 'Notifications',
  'header.markAllRead': 'Mark all read',
  'header.noNotifications': 'All caught up — no unread notices.',
  'header.guestStudent': 'Guest Student',
  'header.viewProfile': 'View Profile',

  // Dashboard Welcome
  'dashboard.welcomeGuest': 'Welcome to PrepZone',
  'dashboard.welcomeUser': 'Welcome back, {name}',
  'dashboard.welcomeSubtitle':
    'Your bilingual preparation workspace for UP Board Class 12, JEE Main, and upcoming JEE Advanced modules.',
  'dashboard.activeFocus': 'Active Focus',
  'dashboard.configureGoals': 'Configure Goals',
  'dashboard.exploreTracks': 'Explore Exam Tracks',
  'dashboard.bannerAlt': 'Minimalist blue and white academic geometry illustration',

  // Dashboard Exam Track Cards
  'dashboard.tracksHeading': 'Preparation Tracks',
  'dashboard.track.upBoard.title': 'UP Board Class 12',
  'dashboard.track.upBoard.meta': 'UPMSP Syllabus · Hindi & English Medium · Setup Ready',
  'dashboard.track.upBoard.desc':
    'Structured board preparation covering Physics, Chemistry, Mathematics, Biology, Hindi, and English.',
  'dashboard.track.upBoard.cta': 'Open Track Overview',

  'dashboard.track.jeeMain.title': 'JEE Main',
  'dashboard.track.jeeMain.meta': 'NTA Pattern · Physics, Chemistry, Maths · Setup Ready',
  'dashboard.track.jeeMain.desc':
    'Concept mastery, chapter weightage alignment, and CBT-style mock test preparation.',
  'dashboard.track.jeeMain.cta': 'Open Track Overview',

  'dashboard.track.jeeAdvanced.title': 'JEE Advanced',
  'dashboard.track.jeeAdvanced.meta': 'Future Expansion · Paper 1 & 2 · Scheduled',
  'dashboard.track.jeeAdvanced.desc':
    'Multi-concept problem solving and advanced test templates planned after JEE Main rollout.',
  'dashboard.track.jeeAdvanced.cta': 'View Roadmap',

  // Dashboard Daily Study Target
  'dashboard.dailyTarget.title': 'Daily Study Target',
  'dashboard.dailyTarget.subtitle': 'Target set by you for daily focused preparation',
  'dashboard.dailyTarget.loggedToday': 'Logged today',
  'dashboard.dailyTarget.goalLabel': 'Daily goal',
  'dashboard.dailyTarget.hoursUnit': 'hrs',
  'dashboard.dailyTarget.adjust': 'Adjust daily target',
  'dashboard.dailyTarget.decrease': 'Decrease daily study target',
  'dashboard.dailyTarget.increase': 'Increase daily study target',
  'dashboard.dailyTarget.emptyHint':
    'Study time tracking activates once chapters, lectures, and practice modules go live.',

  // Dashboard Study Progress Overview
  'dashboard.progress.title': 'Study Progress Overview',
  'dashboard.progress.subtitle': 'Real progress across your active tracks',
  'dashboard.progress.overall': 'Overall Completion',
  'dashboard.progress.emptyTitle': 'No study data recorded yet',
  'dashboard.progress.emptyBody':
    'Progress percentages remain at 0% until you complete real chapters, quizzes, or video lessons in upcoming modules.',
  'dashboard.progress.setupAction': 'Set Target Exam in Settings',

  // Dashboard Continue Learning
  'dashboard.continue.title': 'Continue Learning',
  'dashboard.continue.emptyTitle': 'Nothing in progress yet',
  'dashboard.continue.emptyBody':
    'Your recently opened chapters, NCERT notes, and video lectures will appear here automatically.',
  'dashboard.continue.cta': 'Preview Syllabus Tracks',

  // Dashboard Upcoming Exam Countdown
  'dashboard.countdown.title': 'Upcoming Exam Countdowns',
  'dashboard.countdown.subtitle': 'Customize target dates anytime in Settings',
  'dashboard.countdown.days': 'days',
  'dashboard.countdown.hours': 'hrs',
  'dashboard.countdown.mins': 'min',
  'dashboard.countdown.passed': 'Target date reached',
  'dashboard.countdown.editDates': 'Edit Dates',
  'dashboard.countdown.targetDate': 'Target',

  // Dashboard Recent Activity
  'dashboard.activity.title': 'Recent Activity',
  'dashboard.activity.emptyTitle': 'No recent activity yet',
  'dashboard.activity.emptyBody':
    'Bookmarks, mock test submissions, and planner updates will populate your timeline once modules are enabled.',

  // Dashboard Quick Access
  'dashboard.quickAccess.title': 'Quick Access',
  'dashboard.quickAccess.pdfTitle': 'PDF Library',
  'dashboard.quickAccess.pdfDesc': 'NCERT books, notes & PYQ archive (Prompt 3)',
  'dashboard.quickAccess.testsTitle': 'Practice & Mock Tests',
  'dashboard.quickAccess.testsDesc': 'Topic quizzes & CBT simulator (Prompt 4)',
  'dashboard.quickAccess.plannerTitle': 'Study Planner',
  'dashboard.quickAccess.plannerDesc': 'Weekly timetable & reminders (Prompt 5)',
  'dashboard.quickAccess.open': 'Open',

  // Module Setup / Coming Soon States
  'modules.status.active': 'Foundation Active',
  'modules.status.scheduled': 'Scheduled Module — Setup Ready',
  'modules.plannedCapabilities': 'Planned Module Capabilities',
  'modules.dataArchitecture': 'Prepared Database Collections',
  'modules.noFakeNote':
    'This module is scheduled for an upcoming build milestone. No placeholder or fabricated content is displayed.',
  'modules.backToDashboard': 'Back to Dashboard',
  'modules.configureInSettings': 'Configure Preferences',

  'modules.dashboard.subtitle': 'Central student overview, targets, and exam countdowns.',
  'modules.upBoard12.subtitle': 'UPMSP Class 12 bilingual syllabus, chapter blueprint, and board preparation workspace.',
  'modules.jeeMain.subtitle': 'NTA JEE Main Physics, Chemistry, and Mathematics structured preparation track.',
  'modules.jeeAdvanced.subtitle': 'Future expansion track for multi-concept IIT JEE Advanced preparation.',
  'modules.pdfLibrary.subtitle': 'Centralized NCERT textbooks, bilingual notes, formula sheets, and previous-year PDFs.',
  'modules.videoLectures.subtitle': 'Chapter-by-chapter recorded lessons with bilingual explanations.',
  'modules.practiceTests.subtitle': 'Topic-wise practice sets and full-length computer-based mock tests.',
  'modules.revisionCenter.subtitle': 'Formula recall decks, error logs, and spaced-repetition revision tools.',
  'modules.studyPlanner.subtitle': 'Personalized weekly schedules, chapter milestones, and study reminders.',
  'modules.aiAssistant.subtitle': 'Server-side Gemini-powered bilingual concept explainer and doubt solver.',
  'modules.progressAnalytics.subtitle': 'Accurate subject mastery metrics, test accuracy trends, and study streaks.',
  'modules.bookmarks.subtitle': 'Saved chapters, PDFs, lectures, and practice questions synced to your profile.',
  'modules.settings.subtitle': 'Manage language, theme, daily targets, exam dates, and system readiness.',

  // Settings Page
  'settings.title': 'Platform Settings',
  'settings.language.title': 'Display Language',
  'settings.language.desc': 'Switch the entire PrepZone interface between English and Hindi.',
  'settings.theme.title': 'Appearance Theme',
  'settings.theme.desc': 'Choose light, dark, or match your device preference.',
  'settings.theme.light': 'Light',
  'settings.theme.dark': 'Dark',
  'settings.theme.system': 'System',
  'settings.study.title': 'Study Target & Primary Track',
  'settings.study.dailyGoal': 'Daily study target (hours)',
  'settings.study.primaryTrack': 'Primary exam focus',
  'settings.dates.title': 'Exam Countdown Target Dates',
  'settings.dates.desc': 'Update tentative exam dates to keep dashboard countdowns accurate.',
  'settings.dates.reset': 'Reset Defaults',
  'settings.dates.save': 'Save Dates',
  'settings.dates.saved': 'Target dates updated.',
  'settings.infra.title': 'Backend, Firebase & PWA Readiness',
  'settings.infra.firebaseStatus': 'Firebase & Firestore Status',
  'settings.infra.configured': 'Connected ({projectId})',
  'settings.infra.notConfigured': 'Pending configuration (local foundation mode active)',
  'settings.infra.firestoreDbLabel': 'Firestore Database ID',
  'settings.infra.pwaStatus': 'PWA Compatibility',
  'settings.infra.pwaDesc':
    'Web App Manifest and install metadata are prepared. Full offline study caching is scheduled for a future module and is not claimed as complete yet.',

  // Auth & Profile
  'auth.loginTitle': 'Sign in to PrepZone',
  'auth.loginSubtitle': 'Access your student profile, saved preferences, and synced study foundation.',
  'auth.registerTitle': 'Create your PrepZone account',
  'auth.registerSubtitle': 'Set your primary exam track and bilingual preference from day one.',
  'auth.fullName': 'Full Name',
  'auth.email': 'Email Address',
  'auth.password': 'Password',
  'auth.primaryExam': 'Primary Exam Track',
  'auth.studyMedium': 'Study Medium',
  'auth.medium.hindi': 'Hindi Medium',
  'auth.medium.english': 'English Medium',
  'auth.medium.bilingual': 'Bilingual (Hindi + English)',
  'auth.submitLogin': 'Sign In',
  'auth.submitRegister': 'Create Account',
  'auth.googleBtn': 'Continue with Google',
  'auth.signingIn': 'Signing in...',
  'auth.orDivider': 'Or use local foundation preview (Email/Password)',
  'auth.switchToRegister': 'New to PrepZone? Create an account',
  'auth.switchToLogin': 'Already have an account? Sign in',
  'auth.foundationNotice':
    'Google Sign-In is live with Firebase Authentication & Firestore. Email/Password below runs in local preview until Email/Password sign-in is enabled in Firebase Console.',
  'auth.protectedTitle': 'Student Sign-In Required',
  'auth.protectedBody':
    'This page is protected. Sign in with Google or create a local preview account to view and manage your profile.',
  'auth.errEmail': 'Enter a valid email address.',
  'auth.errPassword': 'Password must be at least 8 characters.',
  'auth.errName': 'Enter your full name (at least 2 characters).',
  'auth.errNotFound': 'No local foundation account found for that email. Register first or check your email.',
  'auth.errWrongPass': 'Incorrect password for this account.',
  'auth.errGoogleFailed': 'Google Sign-In did not complete. Please allow popups and try again.',
  'auth.errGoogleUnconfigured':
    'Google Sign-In requires Firebase Auth credentials.',

  'profile.title': 'Student Profile',
  'profile.subtitle': 'Manage your academic identity, exam track, and study medium.',
  'profile.save': 'Save Profile',
  'profile.saved': 'Profile saved.',
  'profile.authModeLabel': 'Session Mode',
  'profile.authModeLocal': 'Local Foundation Session',
  'profile.authModeFirebase': 'Firebase Authenticated',

  // Footer
  'footer.copy': 'PrepZone Education Platform · UP Board Class 12 & JEE Foundation',

  // Prompt 2: Syllabus & Curriculum System
  'syllabus.explorerTitle': 'Syllabus Explorer',
  'syllabus.examSelector': 'Exam Track',
  'syllabus.classLevelLabel': 'Class / Level',
  'syllabus.class12Label': 'Class 12 (Board)',
  'syllabus.entranceUgLabel': 'UG Engineering Entrance',
  'syllabus.streamSelector': 'Select UP Board Stream',
  'syllabus.customizeSubjects': 'Configure Your Subjects',
  'syllabus.customizeSubjectsHint':
    'UP Board students study different subject combinations. Toggle the subjects included in your stream below.',
  'syllabus.resetSubjects': 'Reset Stream Defaults',
  'syllabus.searchPlaceholder': 'Search subjects, chapters, or topics...',
  'syllabus.filterAll': 'All Chapters',
  'syllabus.status.not_started': 'Not Started',
  'syllabus.status.in_progress': 'In Progress',
  'syllabus.status.completed': 'Completed',
  'syllabus.status.needs_revision': 'Needs Revision',
  'syllabus.practice.label': 'Practice Status',
  'syllabus.practice.not_started': 'Not Practiced',
  'syllabus.practice.in_progress': 'Practicing',
  'syllabus.practice.completed': 'Practice Done',
  'syllabus.chaptersCount': '{count} Chapters',
  'syllabus.topicsCount': '{count} Topics',
  'syllabus.completedOf': '{done}/{total} chapters completed',
  'syllabus.revisionCount': '{count} need revision',
  'syllabus.openSubject': 'Open Subject Syllabus',
  'syllabus.openChapter': 'Open Chapter',
  'syllabus.expandTopics': 'Preview Topics',
  'syllabus.hideTopics': 'Hide Topics',
  'syllabus.tabIncluded': 'Included Syllabus',
  'syllabus.tabRemoved': 'Removed / Reduced ({count})',
  'syllabus.removedNotice':
    'Topics below were officially removed or reduced from this exam syllabus. Kept separate so outdated topics never mix with active chapters.',
  'syllabus.noRemovedTopics': 'No removed topics recorded for this subject.',
  'syllabus.jeeAdvBannerTitle': 'Separate IIT JEE Advanced Syllabus',
  'syllabus.jeeAdvBannerBody':
    'JEE Advanced follows a distinct official syllabus and includes several topics removed from JEE Main (such as States of Matter, Solid State, Metallurgy, Polymers, Blackbody Radiation, and 3D Planes). Never treat JEE Main and JEE Advanced syllabi as identical.',
  'syllabus.advancedRetainedTag': 'Retained in JEE Advanced',
  'syllabus.upBoardDisclaimer':
    'Configurable stream options reflect standard UPMSP combinations. Always verify subject codes with your school registration form.',

  // Subject & Chapter Detail
  'syllabus.backToTrack': 'Back to {track}',
  'syllabus.backToSubject': 'Back to {subject}',
  'syllabus.subjectOverview': 'Subject Overview',
  'syllabus.importantTopics': 'Important Topics & High-Yield Areas',
  'syllabus.chapterListHeading': 'Chapter-Wise Syllabus',
  'syllabus.noChaptersMatch': 'No chapters match your current search or completion filter.',
  'syllabus.chapterOverview': 'Chapter Overview',
  'syllabus.topicsHeading': 'Topics & Subtopics Checklist',
  'syllabus.markStatusLabel': 'Chapter Completion Status',
  'syllabus.progressLabel': 'Chapter Progress',
  'syllabus.studyMaterialsTitle': 'Related Study Materials',
  'syllabus.studyMaterialsDesc':
    'PDF notes, NCERT chapter books, formula sheets, and recorded video lectures for this chapter will connect here in Prompt 3.',
  'syllabus.openPdfLibrary': 'Open PDF Library',
  'syllabus.openVideoLectures': 'Open Video Lectures',
  'syllabus.practiceSectionTitle': 'Chapter Practice & PYQs',
  'syllabus.practiceSectionDesc':
    'Topic quizzes, UP Board model questions, and NTA JEE CBT practice sets for this chapter will connect here in Prompt 4.',
  'syllabus.openPracticeTests': 'Open Practice & Mock Tests',
  'syllabus.studyGuideLabel': 'Supplementary Study Note',

  // Verification & Official Source Metadata
  'syllabus.verification.title': 'Official Source & Verification Metadata',
  'syllabus.verification.source': 'Official Source',
  'syllabus.verification.session': 'Academic Session',
  'syllabus.verification.lastVerified': 'Last Verified',
  'syllabus.verification.verified': 'Verified Official Structure',
  'syllabus.verification.awaiting': 'Awaiting Granular Verification',
  'syllabus.verification.viewOfficial': 'Visit Official Portal',

  // Guest Progress Prompt
  'syllabus.guestPrompt.title': 'Sign in to save your syllabus progress',
  'syllabus.guestPrompt.body':
    'You can browse all syllabi as a guest, but chapter completion, topic checkboxes, and revision statuses are saved per student account.',
  'syllabus.guestPrompt.signIn': 'Sign In',
  'syllabus.guestPrompt.register': 'Create Account',
  'syllabus.guestPrompt.dismiss': 'Continue Browsing',

  // Dashboard Curriculum Integration
  'dashboard.streamLabel': 'Stream',
  'dashboard.progress.completedChapters': 'Completed Chapters',
  'dashboard.progress.remainingChapters': 'Remaining Chapters',
  'dashboard.progress.needsRevision': 'Needs Revision',
  'dashboard.progress.subjectWise': 'Subject-wise Syllabus Progress',
  'dashboard.continue.openChapter': 'Resume Chapter',
  'dashboard.continue.browseSyllabus': 'Open Syllabus Explorer',
  'dashboard.activity.updatedOn': 'Updated',
  'header.searchCategoryModules': 'Platform Modules',
  'header.searchCategorySyllabus': 'Subjects & Chapters',
};

const hi: TranslationDict = {
  // Brand & Shell
  'brand.name': 'PrepZone',
  'brand.tagline': 'यूपी बोर्ड कक्षा 12 व जेईई तैयारी मंच',
  'nav.group.core': 'मुख्य पृष्ठ',
  'nav.group.tracks': 'परीक्षा ट्रैक',
  'nav.group.tools': 'अध्ययन कार्यक्षेत्र',
  'nav.group.account': 'व्यक्तिगत',
  'nav.dashboard': 'डैशबोर्ड',
  'nav.upBoard12': 'यूपी बोर्ड कक्षा 12',
  'nav.jeeMain': 'जेईई मेन',
  'nav.jeeAdvanced': 'जेईई एडवांस्ड',
  'nav.pdfLibrary': 'पीडीएफ लाइब्रेरी',
  'nav.videoLectures': 'वीडियो व्याख्यान',
  'nav.practiceTests': 'अभ्यास व मॉक टेस्ट',
  'nav.revisionCenter': 'पुनरीक्षण केंद्र',
  'nav.studyPlanner': 'अध्ययन योजनाकार',
  'nav.aiAssistant': 'एआई अध्ययन सहायक',
  'nav.progressAnalytics': 'प्रगति व विश्लेषण',
  'nav.bookmarks': 'बुकमार्क',
  'nav.settings': 'सेटिंग्स',
  'nav.profile': 'छात्र प्रोफ़ाइल',
  'nav.signIn': 'लॉगिन करें',
  'nav.register': 'खाता बनाएँ',
  'nav.signOut': 'लॉगआउट',
  'nav.openMenu': 'नेविगेशन मेनू खोलें',
  'nav.closeMenu': 'नेविगेशन मेनू बंद करें',

  // Header & Global Controls
  'header.searchPlaceholder': 'मॉड्यूल, परीक्षा या टूल खोजें...',
  'header.searchLabel': 'PrepZone खोजें',
  'header.searchNoResults': 'कोई मिलता-जुलता मॉड्यूल नहीं मिला।',
  'header.languageSwitch': 'भाषा बदलें',
  'header.themeLight': 'डार्क मोड चालू करें',
  'header.themeDark': 'लाइट मोड चालू करें',
  'header.notifications': 'सूचनाएँ',
  'header.markAllRead': 'सभी पढ़ा हुआ चिह्नित करें',
  'header.noNotifications': 'कोई नई अपठित सूचना नहीं है।',
  'header.guestStudent': 'अतिथि छात्र',
  'header.viewProfile': 'प्रोफ़ाइल देखें',

  // Dashboard Welcome
  'dashboard.welcomeGuest': 'PrepZone में आपका स्वागत है',
  'dashboard.welcomeUser': 'पुनः स्वागत है, {name}',
  'dashboard.welcomeSubtitle':
    'यूपी बोर्ड कक्षा 12, जेईई मेन और आगामी जेईई एडवांस्ड मॉड्यूल के लिए आपका द्विभाषी अध्ययन कार्यक्षेत्र।',
  'dashboard.activeFocus': 'सक्रिय लक्ष्य',
  'dashboard.configureGoals': 'लक्ष्य सेट करें',
  'dashboard.exploreTracks': 'परीक्षा ट्रैक देखें',
  'dashboard.bannerAlt': 'नीले और सफेद रंग में न्यूनतम शैक्षणिक ज्यामिति चित्रण',

  // Dashboard Exam Track Cards
  'dashboard.tracksHeading': 'तैयारी के मुख्य ट्रैक',
  'dashboard.track.upBoard.title': 'यूपी बोर्ड कक्षा 12',
  'dashboard.track.upBoard.meta': 'यूपीएमएसपी पाठ्यक्रम · हिंदी व अंग्रेज़ी माध्यम · सेटअप तैयार',
  'dashboard.track.upBoard.desc':
    'भौतिकी, रसायन विज्ञान, गणित, जीव विज्ञान, हिंदी और अंग्रेज़ी की व्यवस्थित बोर्ड तैयारी।',
  'dashboard.track.upBoard.cta': 'ट्रैक विवरण खोलें',

  'dashboard.track.jeeMain.title': 'जेईई मेन',
  'dashboard.track.jeeMain.meta': 'एनटीए पैटर्न · भौतिकी, रसायन, गणित · सेटअप तैयार',
  'dashboard.track.jeeMain.desc':
    'अवधारणा निपुणता, अध्याय अंक-भार संरेखण और सीबीटी शैली मॉक टेस्ट तैयारी।',
  'dashboard.track.jeeMain.cta': 'ट्रैक विवरण खोलें',

  'dashboard.track.jeeAdvanced.title': 'जेईई एडवांस्ड',
  'dashboard.track.jeeAdvanced.meta': 'आगामी विस्तार · पेपर 1 व 2 · अनुसूचित',
  'dashboard.track.jeeAdvanced.desc':
    'जेईई मेन के बाद बहु-संकल्पना प्रश्न समाधान और उन्नत परीक्षण टेम्पलेट जोड़े जाएँगे।',
  'dashboard.track.jeeAdvanced.cta': 'रोडमैप देखें',

  // Dashboard Daily Study Target
  'dashboard.dailyTarget.title': 'दैनिक अध्ययन लक्ष्य',
  'dashboard.dailyTarget.subtitle': 'दैनिक केंद्रित तैयारी के लिए आपका निर्धारित लक्ष्य',
  'dashboard.dailyTarget.loggedToday': 'आज दर्ज समय',
  'dashboard.dailyTarget.goalLabel': 'दैनिक लक्ष्य',
  'dashboard.dailyTarget.hoursUnit': 'घंटे',
  'dashboard.dailyTarget.adjust': 'दैनिक लक्ष्य बदलें',
  'dashboard.dailyTarget.decrease': 'दैनिक अध्ययन लक्ष्य कम करें',
  'dashboard.dailyTarget.increase': 'दैनिक अध्ययन लक्ष्य बढ़ाएँ',
  'dashboard.dailyTarget.emptyHint':
    'अध्याय, व्याख्यान और अभ्यास मॉड्यूल सक्रिय होने पर अध्ययन समय अपने आप दर्ज होगा।',

  // Dashboard Study Progress Overview
  'dashboard.progress.title': 'अध्ययन प्रगति सारांश',
  'dashboard.progress.subtitle': 'आपके सक्रिय ट्रैक की वास्तविक प्रगति',
  'dashboard.progress.overall': 'कुल पूर्णता',
  'dashboard.progress.emptyTitle': 'अभी कोई अध्ययन डेटा दर्ज नहीं है',
  'dashboard.progress.emptyBody':
    'आगामी मॉड्यूल में वास्तविक अध्याय, क्विज़ या वीडियो पाठ पूरे करने तक प्रगति 0% ही दिखेगी।',
  'dashboard.progress.setupAction': 'सेटिंग्स में लक्ष्य परीक्षा चुनें',

  // Dashboard Continue Learning
  'dashboard.continue.title': 'अध्ययन जारी रखें',
  'dashboard.continue.emptyTitle': 'अभी कोई सक्रिय पाठ नहीं है',
  'dashboard.continue.emptyBody':
    'आपके हाल ही में खोले गए अध्याय, एनसीईआरटी नोट्स और वीडियो व्याख्यान यहाँ अपने आप दिखाई देंगे।',
  'dashboard.continue.cta': 'पाठ्यक्रम ट्रैक देखें',

  // Dashboard Upcoming Exam Countdown
  'dashboard.countdown.title': 'आगामी परीक्षा काउंटडाउन',
  'dashboard.countdown.subtitle': 'सेटिंग्स में कभी भी लक्षित तिथियाँ बदलें',
  'dashboard.countdown.days': 'दिन',
  'dashboard.countdown.hours': 'घं',
  'dashboard.countdown.mins': 'मि',
  'dashboard.countdown.passed': 'लक्षित तिथि पूर्ण',
  'dashboard.countdown.editDates': 'तिथियाँ बदलें',
  'dashboard.countdown.targetDate': 'लक्ष्य',

  // Dashboard Recent Activity
  'dashboard.activity.title': 'हाल की गतिविधि',
  'dashboard.activity.emptyTitle': 'अभी कोई हाल की गतिविधि नहीं है',
  'dashboard.activity.emptyBody':
    'मॉड्यूल सक्रिय होने पर बुकमार्क, मॉक टेस्ट और योजनाकार अपडेट यहाँ दिखाई देंगे।',

  // Dashboard Quick Access
  'dashboard.quickAccess.title': 'त्वरित पहुँच',
  'dashboard.quickAccess.pdfTitle': 'पीडीएफ लाइब्रेरी',
  'dashboard.quickAccess.pdfDesc': 'एनसीईआरटी पुस्तकें, नोट्स व पीवाईक्यू (चरण 3)',
  'dashboard.quickAccess.testsTitle': 'अभ्यास व मॉक टेस्ट',
  'dashboard.quickAccess.testsDesc': 'विषय क्विज़ व सीबीटी सिम्युलेटर (चरण 4)',
  'dashboard.quickAccess.plannerTitle': 'अध्ययन योजनाकार',
  'dashboard.quickAccess.plannerDesc': 'साप्ताहिक समय-सारणी व अनुस्मारक (चरण 5)',
  'dashboard.quickAccess.open': 'खोलें',

  // Module Setup / Coming Soon States
  'modules.status.active': 'आधार सक्रिय',
  'modules.status.scheduled': 'अनुसूचित मॉड्यूल — सेटअप तैयार',
  'modules.plannedCapabilities': 'प्रस्तावित मॉड्यूल क्षमताएँ',
  'modules.dataArchitecture': 'तैयार डेटाबेस संग्रह',
  'modules.noFakeNote':
    'यह मॉड्यूल आगामी निर्माण चरण के लिए निर्धारित है। कोई नकली या काल्पनिक सामग्री नहीं दिखाई जा रही है।',
  'modules.backToDashboard': 'डैशबोर्ड पर लौटें',
  'modules.configureInSettings': 'प्राथमिकताएँ सेट करें',

  'modules.dashboard.subtitle': 'मुख्य छात्र सारांश, दैनिक लक्ष्य और परीक्षा काउंटडाउन।',
  'modules.upBoard12.subtitle': 'यूपीएमएसपी कक्षा 12 द्विभाषी पाठ्यक्रम, अध्याय रूपरेखा और बोर्ड तैयारी केंद्र।',
  'modules.jeeMain.subtitle': 'एनटीए जेईई मेन भौतिकी, रसायन और गणित की व्यवस्थित तैयारी।',
  'modules.jeeAdvanced.subtitle': 'बहु-संकल्पना आईआईटी जेईई एडवांस्ड तैयारी के लिए आगामी विस्तार ट्रैक।',
  'modules.pdfLibrary.subtitle': 'एनसीईआरटी पुस्तकें, द्विभाषी नोट्स, सूत्र शीट और पिछले वर्षों के प्रश्न पत्र।',
  'modules.videoLectures.subtitle': 'द्विभाषी स्पष्टीकरण के साथ अध्याय-वार रिकॉर्ड किए गए व्याख्यान।',
  'modules.practiceTests.subtitle': 'विषय-वार अभ्यास सेट और पूर्ण कंप्यूटर आधारित मॉक टेस्ट।',
  'modules.revisionCenter.subtitle': 'सूत्र फ्लैशकार्ड, त्रुटि लॉग और दोहराव आधारित पुनरीक्षण उपकरण।',
  'modules.studyPlanner.subtitle': 'साप्ताहिक समय-सारणी, अध्याय लक्ष्य और अध्ययन अनुस्मारक।',
  'modules.aiAssistant.subtitle': 'सर्वर-साइड जेमिनी आधारित द्विभाषी अवधारणा और संदेह समाधान।',
  'modules.progressAnalytics.subtitle': 'सटीक विषय दक्षता, टेस्ट सटीकता रुझान और अध्ययन निरंतरता।',
  'modules.bookmarks.subtitle': 'सहेजे गए अध्याय, पीडीएफ, व्याख्यान और अभ्यास प्रश्न।',
  'modules.settings.subtitle': 'भाषा, थीम, दैनिक लक्ष्य, परीक्षा तिथियाँ और सिस्टम तैयारी प्रबंधित करें।',

  // Settings Page
  'settings.title': 'प्लेटफ़ॉर्म सेटिंग्स',
  'settings.language.title': 'प्रदर्शन भाषा',
  'settings.language.desc': 'पूरे PrepZone प्लेटफ़ॉर्म को हिंदी और अंग्रेज़ी के बीच बदलें।',
  'settings.theme.title': 'प्रदर्शन थीम',
  'settings.theme.desc': 'लाइट, डार्क या डिवाइस की प्राथमिकता चुनें।',
  'settings.theme.light': 'लाइट',
  'settings.theme.dark': 'डार्क',
  'settings.theme.system': 'सिस्टम',
  'settings.study.title': 'अध्ययन लक्ष्य व मुख्य ट्रैक',
  'settings.study.dailyGoal': 'दैनिक अध्ययन लक्ष्य (घंटे)',
  'settings.study.primaryTrack': 'मुख्य परीक्षा लक्ष्य',
  'settings.dates.title': 'परीक्षा काउंटडाउन तिथियाँ',
  'settings.dates.desc': 'डैशबोर्ड काउंटडाउन सटीक रखने के लिए संभावित परीक्षा तिथियाँ अपडेट करें।',
  'settings.dates.reset': 'डिफ़ॉल्ट रीसेट करें',
  'settings.dates.save': 'तिथियाँ सहेजें',
  'settings.dates.saved': 'लक्षित तिथियाँ सहेजी गईं।',
  'settings.infra.title': 'बैकएंड, फायरबेस व पीडब्ल्यूए स्थिति',
  'settings.infra.firebaseStatus': 'फायरबेस व फायरस्टोर स्थिति',
  'settings.infra.configured': 'जुड़ा हुआ ({projectId})',
  'settings.infra.notConfigured': 'कॉन्फ़िगरेशन प्रतीक्षित (स्थानीय आधार मोड सक्रिय)',
  'settings.infra.firestoreDbLabel': 'फायरस्टोर डेटाबेस आईडी',
  'settings.infra.pwaStatus': 'पीडब्ल्यूए अनुकूलता',
  'settings.infra.pwaDesc':
    'वेब ऐप मैनिफेस्ट और इंस्टॉल मेटाडेटा तैयार हैं। पूर्ण ऑफ़लाइन अध्ययन कैशिंग आगामी मॉड्यूल के लिए निर्धारित है।',

  // Auth & Profile
  'auth.loginTitle': 'PrepZone में लॉगिन करें',
  'auth.loginSubtitle': 'अपनी छात्र प्रोफ़ाइल, सहेजी गई प्राथमिकताएँ और अध्ययन आधार देखें।',
  'auth.registerTitle': 'नया PrepZone खाता बनाएँ',
  'auth.registerSubtitle': 'पहले दिन से अपना मुख्य परीक्षा ट्रैक और भाषा प्राथमिकता सेट करें।',
  'auth.fullName': 'पूरा नाम',
  'auth.email': 'ईमेल पता',
  'auth.password': 'पासवर्ड',
  'auth.primaryExam': 'मुख्य परीक्षा ट्रैक',
  'auth.studyMedium': 'अध्ययन माध्यम',
  'auth.medium.hindi': 'हिंदी माध्यम',
  'auth.medium.english': 'अंग्रेज़ी माध्यम',
  'auth.medium.bilingual': 'द्विभाषी (हिंदी + अंग्रेज़ी)',
  'auth.submitLogin': 'लॉगिन करें',
  'auth.submitRegister': 'खाता बनाएँ',
  'auth.googleBtn': 'Google के साथ जारी रखें',
  'auth.signingIn': 'लॉगिन हो रहा है...',
  'auth.orDivider': 'या स्थानीय पूर्वावलोकन (ईमेल/पासवर्ड) का उपयोग करें',
  'auth.switchToRegister': 'PrepZone पर नए हैं? खाता बनाएँ',
  'auth.switchToLogin': 'पहले से खाता है? लॉगिन करें',
  'auth.foundationNotice':
    'Google लॉगिन Firebase Authentication व Firestore से सक्रिय है। नीचे ईमेल/पासवर्ड स्थानीय पूर्वावलोकन में चलता है जब तक Firebase Console में ईमेल/पासवर्ड सक्रिय न किया जाए।',
  'auth.protectedTitle': 'छात्र लॉगिन आवश्यक है',
  'auth.protectedBody':
    'यह पृष्ठ सुरक्षित है। अपनी प्रोफ़ाइल देखने और अपडेट करने के लिए Google से लॉगिन करें या स्थानीय खाता बनाएँ।',
  'auth.errEmail': 'कृपया मान्य ईमेल पता दर्ज करें।',
  'auth.errPassword': 'पासवर्ड कम से कम 8 अक्षरों का होना चाहिए।',
  'auth.errName': 'कृपया अपना पूरा नाम दर्ज करें (कम से कम 2 अक्षर)।',
  'auth.errNotFound': 'इस ईमेल के लिए कोई स्थानीय आधार खाता नहीं मिला। कृपया पहले पंजीकरण करें।',
  'auth.errWrongPass': 'इस खाते के लिए पासवर्ड गलत है।',
  'auth.errGoogleFailed': 'Google लॉगिन पूरा नहीं हो सका। कृपया पॉपअप की अनुमति दें और पुनः प्रयास करें।',
  'auth.errGoogleUnconfigured':
    'Google लॉगिन के लिए Firebase Auth क्रेडेंशियल आवश्यक हैं।',

  'profile.title': 'छात्र प्रोफ़ाइल',
  'profile.subtitle': 'अपनी शैक्षणिक पहचान, परीक्षा ट्रैक और अध्ययन माध्यम प्रबंधित करें।',
  'profile.save': 'प्रोफ़ाइल सहेजें',
  'profile.saved': 'प्रोफ़ाइल सहेजी गई।',
  'profile.authModeLabel': 'सत्र मोड',
  'profile.authModeLocal': 'स्थानीय आधार सत्र',
  'profile.authModeFirebase': 'Firebase प्रमाणित',

  // Footer
  'footer.copy': 'PrepZone शिक्षा मंच · यूपी बोर्ड कक्षा 12 व जेईई आधार',

  // Prompt 2: Syllabus & Curriculum System
  'syllabus.explorerTitle': 'पाठ्यक्रम एक्सप्लोरर',
  'syllabus.examSelector': 'परीक्षा ट्रैक',
  'syllabus.classLevelLabel': 'कक्षा / स्तर',
  'syllabus.class12Label': 'कक्षा 12 (बोर्ड)',
  'syllabus.entranceUgLabel': 'स्नातक इंजीनियरिंग प्रवेश',
  'syllabus.streamSelector': 'यूपी बोर्ड स्ट्रीम चुनें',
  'syllabus.customizeSubjects': 'अपने विषय चुनें',
  'syllabus.customizeSubjectsHint':
    'यूपी बोर्ड के छात्रों के विषय संयोजन अलग-अलग होते हैं। नीचे अपनी स्ट्रीम के अनुसार विषय चुनें।',
  'syllabus.resetSubjects': 'स्ट्रीम डिफ़ॉल्ट रीसेट करें',
  'syllabus.searchPlaceholder': 'विषय, अध्याय या टॉपिक खोजें...',
  'syllabus.filterAll': 'सभी अध्याय',
  'syllabus.status.not_started': 'शुरू नहीं हुआ',
  'syllabus.status.in_progress': 'प्रगति में',
  'syllabus.status.completed': 'पूर्ण',
  'syllabus.status.needs_revision': 'पुनरीक्षण आवश्यक',
  'syllabus.practice.label': 'अभ्यास स्थिति',
  'syllabus.practice.not_started': 'अभ्यास शेष',
  'syllabus.practice.in_progress': 'अभ्यास जारी',
  'syllabus.practice.completed': 'अभ्यास पूर्ण',
  'syllabus.chaptersCount': '{count} अध्याय',
  'syllabus.topicsCount': '{count} विषय-बिंदु',
  'syllabus.completedOf': '{done}/{total} अध्याय पूर्ण',
  'syllabus.revisionCount': '{count} पुनरीक्षण हेतु',
  'syllabus.openSubject': 'विषय पाठ्यक्रम खोलें',
  'syllabus.openChapter': 'अध्याय खोलें',
  'syllabus.expandTopics': 'टॉपिक्स देखें',
  'syllabus.hideTopics': 'टॉपिक्स छिपाएँ',
  'syllabus.tabIncluded': 'शामिल पाठ्यक्रम',
  'syllabus.tabRemoved': 'हटाए / कम किए गए ({count})',
  'syllabus.removedNotice':
    'नीचे दिए गए विषय इस परीक्षा के नवीनतम आधिकारिक पाठ्यक्रम से हटाए या कम किए गए हैं। इन्हें सक्रिय अध्यायों से अलग रखा गया है।',
  'syllabus.noRemovedTopics': 'इस विषय के लिए कोई हटाया गया टॉपिक दर्ज नहीं है।',
  'syllabus.jeeAdvBannerTitle': 'पृथक आईआईटी जेईई एडवांस्ड पाठ्यक्रम',
  'syllabus.jeeAdvBannerBody':
    'जेईई एडवांस्ड का आधिकारिक पाठ्यक्रम जेईई मेन से अलग है और इसमें कई अतिरिक्त विषय शामिल हैं (जैसे गैसीय/ठोस अवस्था, धातुकर्म, बहुलक, कृष्णिका विकिरण व 3D समतल)। दोनों को एक समान न मानें।',
  'syllabus.advancedRetainedTag': 'जेईई एडवांस्ड में शामिल',
  'syllabus.upBoardDisclaimer':
    'स्ट्रीम विकल्प सामान्य यूपीएमएसपी संयोजनों के लिए हैं। कृपया अपने विद्यालय पंजीकरण फॉर्म से विषय कोड की पुष्टि अवश्य करें।',

  // Subject & Chapter Detail
  'syllabus.backToTrack': '{track} पर लौटें',
  'syllabus.backToSubject': '{subject} पर लौटें',
  'syllabus.subjectOverview': 'विषय सारांश',
  'syllabus.importantTopics': 'महत्वपूर्ण टॉपिक एवं उच्च-प्राथमिकता क्षेत्र',
  'syllabus.chapterListHeading': 'अध्याय-वार पाठ्यक्रम',
  'syllabus.noChaptersMatch': 'आपकी वर्तमान खोज या फ़िल्टर से कोई अध्याय नहीं मिला।',
  'syllabus.chapterOverview': 'अध्याय सारांश',
  'syllabus.topicsHeading': 'टॉपिक व उप-टॉपिक चेकलिस्ट',
  'syllabus.markStatusLabel': 'अध्याय पूर्णता स्थिति',
  'syllabus.progressLabel': 'अध्याय प्रगति',
  'syllabus.studyMaterialsTitle': 'संबंधित अध्ययन सामग्री',
  'syllabus.studyMaterialsDesc':
    'इस अध्याय के पीडीएफ नोट्स, एनसीईआरटी पुस्तकें, सूत्र शीट और वीडियो व्याख्यान चरण 3 में यहाँ जोड़े जाएँगे।',
  'syllabus.openPdfLibrary': 'पीडीएफ लाइब्रेरी खोलें',
  'syllabus.openVideoLectures': 'वीडियो व्याख्यान खोलें',
  'syllabus.practiceSectionTitle': 'अध्याय अभ्यास व पीवाईक्यू',
  'syllabus.practiceSectionDesc':
    'इस अध्याय की क्विज़, यूपी बोर्ड मॉडल प्रश्न और एनटीए जेईई सीबीटी अभ्यास सेट चरण 4 में यहाँ जुड़ेंगे।',
  'syllabus.openPracticeTests': 'अभ्यास व मॉक टेस्ट खोलें',
  'syllabus.studyGuideLabel': 'सहायक अध्ययन टिप्पणी',

  // Verification & Official Source Metadata
  'syllabus.verification.title': 'आधिकारिक स्रोत व सत्यापन विवरण',
  'syllabus.verification.source': 'आधिकारिक स्रोत',
  'syllabus.verification.session': 'शैक्षणिक सत्र',
  'syllabus.verification.lastVerified': 'अंतिम सत्यापन',
  'syllabus.verification.verified': 'आधिकारिक संरचना सत्यापित',
  'syllabus.verification.awaiting': 'विस्तृत सत्यापन प्रतीक्षित',
  'syllabus.verification.viewOfficial': 'आधिकारिक पोर्टल देखें',

  // Guest Progress Prompt
  'syllabus.guestPrompt.title': 'अपनी पाठ्यक्रम प्रगति सहेजने के लिए लॉगिन करें',
  'syllabus.guestPrompt.body':
    'आप अतिथि के रूप में पूरा पाठ्यक्रम देख सकते हैं, लेकिन अध्याय पूर्णता, टॉपिक चेकलिस्ट और पुनरीक्षण स्थिति केवल लॉगिन किए गए छात्र खाते में सहेजी जाती है।',
  'syllabus.guestPrompt.signIn': 'लॉगिन करें',
  'syllabus.guestPrompt.register': 'खाता बनाएँ',
  'syllabus.guestPrompt.dismiss': 'ब्राउज़िंग जारी रखें',

  // Dashboard Curriculum Integration
  'dashboard.streamLabel': 'स्ट्रीम',
  'dashboard.progress.completedChapters': 'पूर्ण अध्याय',
  'dashboard.progress.remainingChapters': 'शेष अध्याय',
  'dashboard.progress.needsRevision': 'पुनरीक्षण हेतु',
  'dashboard.progress.subjectWise': 'विषय-वार पाठ्यक्रम प्रगति',
  'dashboard.continue.openChapter': 'अध्याय फिर से खोलें',
  'dashboard.continue.browseSyllabus': 'पाठ्यक्रम एक्सप्लोरर खोलें',
  'dashboard.activity.updatedOn': 'अपडेट',
  'header.searchCategoryModules': 'प्लेटफ़ॉर्म मॉड्यूल',
  'header.searchCategorySyllabus': 'विषय व अध्याय',
};

export const TRANSLATIONS: Record<LanguageCode, TranslationDict> = { en, hi };

export function translate(
  lang: LanguageCode,
  key: string,
  vars?: Record<string, string | number>
): string {
  const dict = TRANSLATIONS[lang] ?? TRANSLATIONS.en;
  let text = dict[key] ?? TRANSLATIONS.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}
