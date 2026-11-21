import type { CurriculumSubject, CurriculumTopic } from '../../types/curriculum';
import type { BilingualText } from '../../types/database';
import { VERIFIED_DATE } from './upBoardScience';

export const JEE_ADV_SESSION = '2026-27';
export const JEE_ADV_SOURCE_URL = 'https://jeeadv.ac.in/';

function makeAdvTopic(
  subjectId: string,
  chapterId: string,
  idx: number,
  en: string,
  hi: string,
  inclusionStatus: CurriculumTopic['inclusionStatus'] = 'included',
  subtopics: BilingualText[] = []
): CurriculumTopic {
  return {
    id: `${chapterId}-t${idx}`,
    chapterId,
    subjectId,
    title: { en, hi },
    subtopics,
    syllabusCode: `JEEA-${subjectId.slice(-3).toUpperCase()}-${idx}`,
    inclusionStatus,
    importance: 'high_yield',
    order: idx,
    isPublished: true,
    verificationStatus: 'verified',
  };
}

export const JEE_ADVANCED_SUBJECTS: CurriculumSubject[] = [
  {
    id: 'jeeadv-physics',
    examTrack: 'jee-advanced',
    classLevel: 'entrance-ug',
    academicSession: JEE_ADV_SESSION,
    code: 'ADV-PHY',
    name: { en: 'Physics (JEE Advanced)', hi: 'भौतिक विज्ञान (जेईई एडवांस्ड)' },
    overview: {
      en: 'Dedicated IIT JEE Advanced Physics syllabus (separate from JEE Main). Retains Blackbody Radiation, Kirchhoff Law of Radiation, Wien Displacement Law, Radioactive Decay Law, and multi-concept Mechanics/Electromagnetism depth.',
      hi: 'जेईई मेन से पूर्णतः पृथक आईआईटी जेईई एडवांस्ड भौतिक विज्ञान पाठ्यक्रम। इसमें कृष्णिका विकिरण, वीन नियम, रेडियोधर्मी क्षय नियम व गहन यांत्रिकी/वैद्युतचुंबकत्व शामिल हैं।',
    },
    order: 1,
    isPublished: true,
    importantTopics: [
      { en: 'Rigid Body Rotational Dynamics + Instantaneous Axis of Rotation', hi: 'दृढ़ पिंड घूर्णन गतिकी व तात्क्षणिक घूर्णन अक्ष' },
      { en: 'Thermal Physics: Thermodynamics, Blackbody Radiation & Heat Conduction', hi: 'ऊष्मीय भौतिकी: ऊष्मागतिकी, कृष्णिका विकिरण व ऊष्मा चालन' },
      { en: 'Electromagnetism: Gauss Law, Potentiometer/RC, Induced Electric Field', hi: 'वैद्युतचुंबकत्व: गॉस नियम, RC परिपथ व प्रेरित विद्युत क्षेत्र' },
      { en: 'Modern Physics: Nuclear Decay Law (Activity, Half-Life) & X-Rays', hi: 'आधुनिक भौतिकी: नाभिकीय क्षय नियम व एक्स-किरणें' },
    ],
    removedOrReducedTopics: [],
    verification: {
      sourceName: { en: 'IIT JEE Advanced Official Information Brochure & Syllabus', hi: 'आईआईटी जेईई एडवांस्ड आधिकारिक सूचना विवरणिका व पाठ्यक्रम' },
      sourceUrl: JEE_ADV_SOURCE_URL,
      academicSession: JEE_ADV_SESSION,
      lastVerifiedDate: VERIFIED_DATE,
      verificationStatus: 'verified',
      notes: {
        en: 'Strictly independent from NTA JEE Main syllabus. Retains topics excluded from JEE Main such as Blackbody Radiation, Heat Transfer, X-Rays, and Radioactivity.',
        hi: 'एनटीए जेईई मेन से स्वतंत्र पाठ्यक्रम। कृष्णिका विकिरण, एक्स-किरणें व रेडियोधर्मिता जैसे अतिरिक्त विषय सुरक्षित हैं।',
      },
    },
    chapters: [
      { id: 'jeeadv-phy-c1', subjectId: 'jeeadv-physics', examTrack: 'jee-advanced', classLevel: 'entrance-ug', academicSession: JEE_ADV_SESSION, unitNumber: 1, order: 1, title: { en: 'General Physics & Mechanics (Multi-Concept)', hi: 'सामान्य भौतिकी व यांत्रिकी (बहु-संकल्पना)' }, overview: { en: 'Error analysis, screw gauge/vernier, kinematics, variable mass/centre of mass, rigid body rotation, fluid statics/dynamics, and gravitation.', hi: 'त्रुटि विश्लेषण, स्क्रू गेज, द्रव्यमान केंद्र, दृढ़ पिंड घूर्णन, द्रव यांत्रिकी व गुरुत्वाकर्षण।' }, estimatedHours: 24, isImportantUnit: true, isPublished: true, verificationStatus: 'verified', sourceUrl: JEE_ADV_SOURCE_URL, topics: [makeAdvTopic('jeeadv-physics', 'jeeadv-phy-c1', 1, 'Error Analysis, Post-Office Box & Mechanics Instruments', 'त्रुटि विश्लेषण व प्रयोगात्मक उपकरण'), makeAdvTopic('jeeadv-physics', 'jeeadv-phy-c1', 2, 'Rigid Body General Plane Motion & Conservation Laws', 'दृढ़ पिंड की समतलीय गति व संरक्षण नियम')] },
      { id: 'jeeadv-phy-c2', subjectId: 'jeeadv-physics', examTrack: 'jee-advanced', classLevel: 'entrance-ug', academicSession: JEE_ADV_SESSION, unitNumber: 2, order: 2, title: { en: 'Thermal Physics, Waves & Acoustics', hi: 'ऊष्मीय भौतिकी, तरंगें एवं ध्वनि' }, overview: { en: 'Thermal expansion, calorimetry, heat conduction, Kirchhoff & Stefan-Boltzmann laws, Wien law, Newton law of cooling, Doppler effect, and beats.', hi: 'ऊष्मीय प्रसार, चालन, किरचॉफ/स्टीफन/वीन नियम, न्यूटन शीतलन व डॉप्लर प्रभाव।' }, estimatedHours: 16, isImportantUnit: true, isPublished: true, verificationStatus: 'verified', sourceUrl: JEE_ADV_SOURCE_URL, topics: [makeAdvTopic('jeeadv-physics', 'jeeadv-phy-c2', 1, 'Blackbody Radiation, Wien & Stefan-Boltzmann Laws (Retained)', 'कृष्णिका विकिरण, वीन व स्टीफन नियम (एडवांस्ड में सुरक्षित)', 'advanced_only'), makeAdvTopic('jeeadv-physics', 'jeeadv-phy-c2', 2, 'Heat Conduction, Thermodynamics Cycles & Doppler Effect', 'ऊष्मा चालन, ऊष्मागतिक चक्र व डॉप्लर प्रभाव')] },
      { id: 'jeeadv-phy-c3', subjectId: 'jeeadv-physics', examTrack: 'jee-advanced', classLevel: 'entrance-ug', academicSession: JEE_ADV_SESSION, unitNumber: 3, order: 3, title: { en: 'Electricity, Magnetism, Optics & Modern Physics', hi: 'विद्युत, चुंबकत्व, प्रकाशिकी व आधुनिक भौतिकी' }, overview: { en: 'Induced electric field, LR/RC transients, non-uniform media optics, X-rays, photoelectric effect, and law of radioactive decay.', hi: 'प्रेरित विद्युत क्षेत्र, LR/RC क्षणिक परिपथ, प्रकाशिकी, एक्स-किरणें व रेडियोधर्मी क्षय नियम।' }, estimatedHours: 24, isImportantUnit: true, isPublished: true, verificationStatus: 'verified', sourceUrl: JEE_ADV_SOURCE_URL, topics: [makeAdvTopic('jeeadv-physics', 'jeeadv-phy-c3', 1, 'Induced Electric Field, LR/RC Transients & EM Waves', 'प्रेरित विद्युत क्षेत्र व LR/RC परिपथ'), makeAdvTopic('jeeadv-physics', 'jeeadv-phy-c3', 2, 'Radioactive Decay Law, Half-Life & Continuous/Characteristic X-Rays (Retained)', 'रेडियोधर्मी क्षय नियम व एक्स-किरणें (एडवांस्ड में सुरक्षित)', 'advanced_only')] },
    ],
  },
  {
    id: 'jeeadv-chemistry',
    examTrack: 'jee-advanced',
    classLevel: 'entrance-ug',
    academicSession: JEE_ADV_SESSION,
    code: 'ADV-CHEM',
    name: { en: 'Chemistry (JEE Advanced)', hi: 'रसायन विज्ञान (जेईई एडवांस्ड)' },
    overview: {
      en: 'Dedicated IIT JEE Advanced Chemistry syllabus. Unlike JEE Main, JEE Advanced explicitly RETAINS Gaseous & Liquid States, Solid State, Surface Chemistry, Hydrogen, s-Block, Extractive Metallurgy, Polymers, and Environmental Chemistry.',
      hi: 'जेईई मेन से पृथक आईआईटी जेईई एडवांस्ड रसायन विज्ञान पाठ्यक्रम। जेईई मेन के विपरीत इसमें गैसीय व ठोस अवस्था, पृष्ठ रसायन, हाइड्रोजन, s-ब्लॉक, धातुकर्म, बहुलक व पर्यावरणीय रसायन शामिल हैं।',
    },
    order: 2,
    isPublished: true,
    importantTopics: [
      { en: 'Real Gases (van der Waals), Solid State (Crystal Lattices) & Surface Chemistry', hi: 'वास्तविक गैस, ठोस अवस्था (क्रिस्टल जालक) व पृष्ठ रसायन' },
      { en: 'Extractive Metallurgy (Ellingham Diagrams), s-Block & Detailed p-Block Compounds', hi: 'धातुकर्म (एलिंगम आरेख), s-ब्लॉक व विस्तृत p-ब्लॉक यौगिक' },
      { en: 'Qualitative Salt Analysis (Groups I–V Cations & Anions)', hi: 'लवणों का गुणात्मक विश्लेषण (समूह I–V धनायन व ऋणायन)' },
      { en: 'Multi-Step Organic Synthesis, Carbohydrates, Amino Acids & Polymers', hi: 'बहु-चरणीय कार्बनिक संश्लेषण, कार्बोहाइड्रेट व बहुलक' },
    ],
    removedOrReducedTopics: [],
    verification: {
      sourceName: { en: 'IIT JEE Advanced Official Chemistry Syllabus', hi: 'आईआईटी जेईई एडवांस्ड आधिकारिक रसायन पाठ्यक्रम' },
      sourceUrl: JEE_ADV_SOURCE_URL,
      academicSession: JEE_ADV_SESSION,
      lastVerifiedDate: VERIFIED_DATE,
      verificationStatus: 'verified',
      notes: {
        en: 'Retains chapters removed from JEE Main (States of Matter, Solid State, Surface Chemistry, Hydrogen, s-Block, Metallurgy, Polymers, Environmental Chemistry).',
        hi: 'जेईई मेन से हटाए गए कई महत्वपूर्ण अध्याय (ठोस/गैस अवस्था, पृष्ठ रसायन, धातुकर्म, बहुलक) जेईई एडवांस्ड में सुरक्षित हैं।',
      },
    },
    chapters: [
      { id: 'jeeadv-chem-c1', subjectId: 'jeeadv-chemistry', examTrack: 'jee-advanced', classLevel: 'entrance-ug', academicSession: JEE_ADV_SESSION, unitNumber: 1, order: 1, title: { en: 'Physical Chemistry (Including Gas Laws, Solid State & Surface Chemistry)', hi: 'भौतिक रसायन (गैस नियम, ठोस अवस्था व पृष्ठ रसायन सहित)' }, overview: { en: 'Atomic structure, kinetic theory & real gases, solid state packing/defects, thermodynamics, chemical/ionic equilibrium, electrochemistry, kinetics, and surface catalysis/colloids.', hi: 'परमाणु संरचना, वास्तविक गैस, ठोस अवस्था संकुलन/दोष, साम्य, वैद्युतरसायन, बलगतिकी व पृष्ठ रसायन।' }, estimatedHours: 24, isImportantUnit: true, isPublished: true, verificationStatus: 'verified', sourceUrl: JEE_ADV_SOURCE_URL, topics: [makeAdvTopic('jeeadv-chemistry', 'jeeadv-chem-c1', 1, 'Gaseous State (van der Waals), Solid State & Surface Chemistry (Retained)', 'गैसीय अवस्था, ठोस अवस्था व पृष्ठ रसायन', 'advanced_only'), makeAdvTopic('jeeadv-chemistry', 'jeeadv-chem-c1', 2, 'Thermodynamics, Ionic Equilibrium, Nernst & Kinetics', 'ऊष्मागतिकी, आयनिक साम्य व बलगतिकी')] },
      { id: 'jeeadv-chem-c2', subjectId: 'jeeadv-chemistry', examTrack: 'jee-advanced', classLevel: 'entrance-ug', academicSession: JEE_ADV_SESSION, unitNumber: 2, order: 2, title: { en: 'Inorganic Chemistry (Including Hydrogen, s/p-Block, Metallurgy & Salt Analysis)', hi: 'अकार्बनिक रसायन (हाइड्रोजन, s/p-ब्लॉक, धातुकर्म व लवण विश्लेषण सहित)' }, overview: { en: 'Alkali/alkaline earth metals, Boron/Silicon/Nitrogen/Phosphorus/Halogen/Noble Gas compounds, Fe/Cu/Zn/Al extraction, coordination chemistry, and cation/anion groups.', hi: 's-ब्लॉक, विस्तृत p-ब्लॉक यौगिक, धातुकर्म, उपसहसंयोजन यौगिक व गुणात्मक लवण विश्लेषण।' }, estimatedHours: 22, isImportantUnit: true, isPublished: true, verificationStatus: 'verified', sourceUrl: JEE_ADV_SOURCE_URL, topics: [makeAdvTopic('jeeadv-chemistry', 'jeeadv-chem-c2', 1, 'Hydrogen, s-Block, Detailed p-Block & Metallurgy (Retained)', 'हाइड्रोजन, s-ब्लॉक, विस्तृत p-ब्लॉक व धातुकर्म', 'advanced_only'), makeAdvTopic('jeeadv-chemistry', 'jeeadv-chem-c2', 2, 'Coordination Chemistry & Qualitative Analysis (Groups I–V)', 'उपसहसंयोजन रसायन व लवण विश्लेषण')] },
      { id: 'jeeadv-chem-c3', subjectId: 'jeeadv-chemistry', examTrack: 'jee-advanced', classLevel: 'entrance-ug', academicSession: JEE_ADV_SESSION, unitNumber: 3, order: 3, title: { en: 'Organic Chemistry (Including Polymers & Everyday Chemistry)', hi: 'कार्बनिक रसायन (बहुलक व व्यावहारिक रसायन सहित)' }, overview: { en: 'Stereochemistry, reactive intermediates, aromatic/carbonyl mechanisms, biomolecules, natural/synthetic polymers, and practical organic tests.', hi: 'त्रिविम रसायन, अभिक्रिया मध्यवर्ती, ऐरोमैटिक व कार्बोनिल क्रियाविधि, जैव-अणु व बहुलक।' }, estimatedHours: 24, isImportantUnit: true, isPublished: true, verificationStatus: 'verified', sourceUrl: JEE_ADV_SOURCE_URL, topics: [makeAdvTopic('jeeadv-chemistry', 'jeeadv-chem-c3', 1, 'Multi-Concept Stereochemistry & Carbonyl/Aromatic Mechanisms', 'त्रिविम रसायन व बहु-चरणीय संश्लेषण'), makeAdvTopic('jeeadv-chemistry', 'jeeadv-chem-c3', 2, 'Carbohydrates, Amino Acids, Polymers & POC (Retained)', 'कार्बोहाइड्रेट, बहुलक व प्रायोगिक कार्बनिक परीक्षण', 'advanced_only')] },
    ],
  },
  {
    id: 'jeeadv-maths',
    examTrack: 'jee-advanced',
    classLevel: 'entrance-ug',
    academicSession: JEE_ADV_SESSION,
    code: 'ADV-MATH',
    name: { en: 'Mathematics (JEE Advanced)', hi: 'गणित (जेईई एडवांस्ड)' },
    overview: {
      en: 'Dedicated IIT JEE Advanced Mathematics syllabus. Unlike JEE Main, JEE Advanced explicitly RETAINS Planes in 3D Geometry, Scalar & Vector Triple Products, and Tangents/Normals/Properties of Conics.',
      hi: 'जेईई मेन से पृथक आईआईटी जेईई एडवांस्ड गणित पाठ्यक्रम। इसमें 3D में समतल समीकरण, सदिश/अदिश त्रिक गुणनफल व शांकवों की स्पर्श रेखाएँ/अभिलंब शामिल हैं।',
    },
    order: 3,
    isPublished: true,
    importantTopics: [
      { en: 'Complex Numbers (De Moivre, Cube Roots, Geometry) & Logarithms', hi: 'सम्मिश्र संख्याएँ (ज्यामिति सहित) व लघुगणक' },
      { en: '3D Planes, Line-Plane Intersections & Scalar/Vector Triple Products', hi: '3D समतल, रेखा-समतल प्रतिच्छेदन व त्रिक गुणनफल' },
      { en: 'Conics Tangents/Normals & Parametric Locus Problems', hi: 'शांकव स्पर्श रेखा/अभिलंब व प्राचलिक बिंदुपथ' },
      { en: 'Limits, Rolle/LMVT, Functional Equations & Definite Integrals', hi: 'सीमा, रोले/मध्यमान प्रमेय, फलनीय समीकरण व निश्चित समाकलन' },
    ],
    removedOrReducedTopics: [],
    verification: {
      sourceName: { en: 'IIT JEE Advanced Official Mathematics Syllabus', hi: 'आईआईटी जेईई एडवांस्ड आधिकारिक गणित पाठ्यक्रम' },
      sourceUrl: JEE_ADV_SOURCE_URL,
      academicSession: JEE_ADV_SESSION,
      lastVerifiedDate: VERIFIED_DATE,
      verificationStatus: 'verified',
      notes: {
        en: 'Retains JEE Advanced 3D Planes, Triple Products, and Conics tangents/normals removed from JEE Main.',
        hi: 'जेईई मेन से हटाए गए 3D समतल, त्रिक गुणनफल व शांकव स्पर्श रेखा विषय जेईई एडवांस्ड में सुरक्षित हैं।',
      },
    },
    chapters: [
      { id: 'jeeadv-math-c1', subjectId: 'jeeadv-maths', examTrack: 'jee-advanced', classLevel: 'entrance-ug', academicSession: JEE_ADV_SESSION, unitNumber: 1, order: 1, title: { en: 'Sets, Functions, Algebra, Matrices & Probability', hi: 'समुच्चय, फलन, बीजगणित, आव्यूह व प्रायिकता' }, overview: { en: 'Logarithms, complex number geometry, quadratic equations, AP/GP/AM-GM, P&C, binomial theorem, matrices/determinants, and Bayes theorem.', hi: 'लघुगणक, सम्मिश्र ज्यामिति, द्विघात, क्रमचय-संचय, द्विपद, आव्यूह व बेज़ प्रमेय।' }, estimatedHours: 22, isImportantUnit: true, isPublished: true, verificationStatus: 'verified', sourceUrl: JEE_ADV_SOURCE_URL, topics: [makeAdvTopic('jeeadv-maths', 'jeeadv-math-c1', 1, 'Logarithms, Complex Geometry & Matrix Algebraic Systems', 'लघुगणक, सम्मिश्र ज्यामिति व आव्यूह'), makeAdvTopic('jeeadv-maths', 'jeeadv-math-c1', 2, 'P&C Derangements, Probability & Statistics', 'क्रमचय-संचय व प्रायिकता')] },
      { id: 'jeeadv-math-c2', subjectId: 'jeeadv-maths', examTrack: 'jee-advanced', classLevel: 'entrance-ug', academicSession: JEE_ADV_SESSION, unitNumber: 2, order: 2, title: { en: 'Calculus (Including Rolle/LMVT & Tangents/Normals)', hi: 'कलन (रोले/मध्यमान प्रमेय व स्पर्श रेखा-अभिलंब सहित)' }, overview: { en: 'Limits, continuity/differentiability, Rolle & Lagrange MVT, monotonicity, maxima/minima, Leibniz rule, definite integrals, and differential equations.', hi: 'सीमा, अवकलनीयता, रोले व लैग्रांज प्रमेय, लाइबनिट्ज़ नियम, निश्चित समाकलन व अवकल समीकरण।' }, estimatedHours: 24, isImportantUnit: true, isPublished: true, verificationStatus: 'verified', sourceUrl: JEE_ADV_SOURCE_URL, topics: [makeAdvTopic('jeeadv-maths', 'jeeadv-math-c2', 1, 'Rolle/LMVT, Monotonicity & Functional Inequalities (Retained)', 'रोले/मध्यमान प्रमेय व एकदिष्टता', 'advanced_only'), makeAdvTopic('jeeadv-maths', 'jeeadv-math-c2', 2, 'Leibniz Integral Rule, Reduction Formulae & Area', 'लाइबनिट्ज़ नियम व निश्चित समाकलन')] },
      { id: 'jeeadv-math-c3', subjectId: 'jeeadv-maths', examTrack: 'jee-advanced', classLevel: 'entrance-ug', academicSession: JEE_ADV_SESSION, unitNumber: 3, order: 3, title: { en: 'Coordinate Geometry (Conics Tangents), Vectors & 3D Planes', hi: 'निर्देशांक ज्यामिति (स्पर्श रेखा), सदिश व 3D समतल' }, overview: { en: 'Circles, tangents/normals/chord of contact in conics, scalar & vector triple products, and planes in 3D geometry.', hi: 'वृत्त, शांकवों की स्पर्श रेखा/अभिलंब, अदिश व सदिश त्रिक गुणनफल तथा 3D समतल समीकरण।' }, estimatedHours: 20, isImportantUnit: true, isPublished: true, verificationStatus: 'verified', sourceUrl: JEE_ADV_SOURCE_URL, topics: [makeAdvTopic('jeeadv-maths', 'jeeadv-math-c3', 1, 'Tangents & Normals to Parabola, Ellipse & Hyperbola (Retained)', 'शांकवों की स्पर्श रेखा व अभिलंब', 'advanced_only'), makeAdvTopic('jeeadv-maths', 'jeeadv-math-c3', 2, '3D Planes & Scalar/Vector Triple Products (Retained)', '3D समतल व त्रिक गुणनफल', 'advanced_only')] },
    ],
  },
];
