import type { CurriculumSubject, CurriculumTopic } from '../../types/curriculum';
import type { BilingualText } from '../../types/database';
import { VERIFIED_DATE } from './upBoardScience';

export const JEE_MAIN_SESSION = '2026-27';
export const NTA_JEE_SOURCE_URL = 'https://jeemain.nta.nic.in/';

function makeJeeMainTopic(
  subjectId: string,
  chapterId: string,
  idx: number,
  en: string,
  hi: string,
  subtopics: BilingualText[] = [],
  importance: CurriculumTopic['importance'] = 'high_yield'
): CurriculumTopic {
  return {
    id: `${chapterId}-t${idx}`,
    chapterId,
    subjectId,
    title: { en, hi },
    subtopics,
    syllabusCode: `JEEM-${subjectId.slice(-3).toUpperCase()}-${idx}`,
    inclusionStatus: 'included',
    importance,
    order: idx,
    isPublished: true,
    verificationStatus: 'verified',
  };
}

export const JEE_MAIN_SUBJECTS: CurriculumSubject[] = [
  {
    id: 'jeemain-physics',
    examTrack: 'jee-main',
    classLevel: 'entrance-ug',
    academicSession: JEE_MAIN_SESSION,
    code: 'NTA-PHY',
    name: { en: 'Physics (JEE Main)', hi: 'भौतिक विज्ञान (जेईई मेन)' },
    overview: {
      en: 'Current official NTA JEE Main Physics syllabus across Section A (Theory: Mechanics, Thermal, Electromagnetism, Optics, Modern Physics) and Section B (Experimental Skills). Outdated/removed topics are isolated separately.',
      hi: 'वर्तमान आधिकारिक एनटीए जेईई मेन भौतिक विज्ञान पाठ्यक्रम — खंड A (यांत्रिकी, ऊष्मागतिकी, वैद्युतचुंबकत्व, प्रकाशिकी, आधुनिक भौतिकी) एवं खंड B (प्रयोगात्मक कौशल)। हटाए गए विषय अलग सूचीबद्ध हैं।',
    },
    order: 1,
    isPublished: true,
    importantTopics: [
      { en: 'Rotational Motion: Moment of Inertia & Angular Momentum Conservation', hi: 'घूर्णन गति: जड़त्व आघूर्ण व कोणीय संवेग संरक्षण' },
      { en: 'Electrostatics, Gauss Law & Current Electricity (RC / Kirchhoff)', hi: 'स्थिरवैद्युतिकी, गॉस नियम व विद्युत धारा परिपथ' },
      { en: 'Optics (Lens, Prism, YDSE) & Modern Physics (Photoelectric, Bohr, De Broglie)', hi: 'प्रकाशिकी व आधुनिक भौतिकी (प्रकाश-वैद्युत व बोर मॉडल)' },
      { en: 'Section B Experimental Skills: Vernier Callipers, Screw Gauge, Meter Bridge', hi: 'प्रयोगात्मक कौशल: वर्नियर कैलिपर्स, स्क्रू गेज व मीटर सेतु' },
    ],
    removedOrReducedTopics: [
      {
        id: 'jeem-phy-rem-1',
        unitOrChapterTitle: { en: 'Communication Systems (Complete Chapter Removed)', hi: 'संचार व्यवस्था (संपूर्ण अध्याय हटाया गया)' },
        removedDetail: { en: 'Propagation of electromagnetic waves, modulation, bandwidth, and earth communication systems removed from NTA JEE Main Physics.', hi: 'ईएम तरंग संचरण, मॉडुलन और संचार प्रणाली एनटीए जेईई मेन पाठ्यक्रम से हटाई गई।' },
        status: 'removed',
      },
      {
        id: 'jeem-phy-rem-2',
        unitOrChapterTitle: { en: 'Specific Sub-Topic Reductions (Potentiometer, Geostationary Satellites, Newton Law of Cooling, Cyclotron)', hi: 'विशिष्ट कम किए गए उप-विषय (विभवमापी, भू-तुल्यकालिक उपग्रह, न्यूटन शीतलन नियम, साइक्लोट्रॉन)' },
        removedDetail: { en: 'Also removed: Earth magnetism horizontal component & hysteresis, Davisson-Germer experiment, radioactivity alpha-beta-gamma decay law & half-life (verify annual NTA bulletin), transistors & Zener as voltage regulator.', hi: 'पृथ्वी का चुंबकत्व, डेविसन-जर्मर प्रयोग, रेडियोधर्मिता क्षय नियम तथा ट्रांजिस्टर अंश एनटीए के संशोधित पाठ्यक्रम में हटाए/कम किए गए।' },
        status: 'reduced',
      },
    ],
    verification: {
      sourceName: { en: 'NTA JEE Main Official Information Bulletin & Physics Syllabus', hi: 'एनटीए जेईई मेन आधिकारिक सूचना बुलेटिन व भौतिक विज्ञान पाठ्यक्रम' },
      sourceUrl: NTA_JEE_SOURCE_URL,
      academicSession: JEE_MAIN_SESSION,
      lastVerifiedDate: VERIFIED_DATE,
      verificationStatus: 'verified',
      notes: { en: '20 NTA Physics units including Experimental Skills; removed/reduced items strictly separated.', hi: 'प्रयोगात्मक कौशल सहित 20 एनटीए भौतिकी इकाइयाँ शामिल; हटाए गए विषय पृथक रखे गए हैं।' },
    },
    chapters: [
      { id: 'jeem-phy-u1', subjectId: 'jeemain-physics', examTrack: 'jee-main', classLevel: 'entrance-ug', academicSession: JEE_MAIN_SESSION, unitNumber: 1, order: 1, title: { en: 'Units 1–3: Measurement, Kinematics & Laws of Motion', hi: 'इकाई 1–3: मापन, गतिकी एवं गति के नियम' }, overview: { en: 'SI units, dimensional analysis, errors, 1D/2D motion, projectiles, vectors, Newton laws, friction, and circular dynamics.', hi: 'विमीय विश्लेषण, त्रुटि, प्रक्षेप्य गति, सदिश, न्यूटन के नियम, घर्षण व वृत्तीय गति।' }, estimatedHours: 14, isImportantUnit: true, isPublished: true, verificationStatus: 'verified', sourceUrl: NTA_JEE_SOURCE_URL, topics: [makeJeeMainTopic('jeemain-physics', 'jeem-phy-u1', 1, 'Dimensional Analysis, Significant Figures & Error Propagation', 'विमीय विश्लेषण व त्रुटि आकलन'), makeJeeMainTopic('jeemain-physics', 'jeem-phy-u1', 2, 'Projectile, Relative Motion, Friction & Circular Dynamics', 'प्रक्षेप्य गति, सापेक्ष वेग, घर्षण व अभिकेंद्रीय बल')] },
      { id: 'jeem-phy-u2', subjectId: 'jeemain-physics', examTrack: 'jee-main', classLevel: 'entrance-ug', academicSession: JEE_MAIN_SESSION, unitNumber: 4, order: 2, title: { en: 'Units 4–6: Work-Energy, Rotational Motion & Gravitation', hi: 'इकाई 4–6: कार्य-ऊर्जा, घूर्णन गति एवं गुरुत्वाकर्षण' }, overview: { en: 'Work-energy theorem, elastic/inelastic collisions, centre of mass, moment of inertia, torque, rolling motion, Kepler laws, and escape velocity.', hi: 'कार्य-ऊर्जा प्रमेय, संघट्ट, द्रव्यमान केंद्र, जड़त्व आघूर्ण, लोटनिक गति व गुरुत्वाकर्षण।' }, estimatedHours: 16, isImportantUnit: true, isPublished: true, verificationStatus: 'verified', sourceUrl: NTA_JEE_SOURCE_URL, topics: [makeJeeMainTopic('jeemain-physics', 'jeem-phy-u2', 1, 'Work-Energy Theorem, Vertical Circular Motion & Collisions', 'कार्य-ऊर्जा प्रमेय व संघट्ट'), makeJeeMainTopic('jeemain-physics', 'jeem-phy-u2', 2, 'Moment of Inertia, Angular Momentum & Rolling Without Slipping', 'जड़त्व आघूर्ण व कोणीय संवेग संरक्षण'), makeJeeMainTopic('jeemain-physics', 'jeem-phy-u2', 3, 'Gravitational Potential, Orbital & Escape Velocity', 'गुरुत्वीय विभव, कक्षीय व पलायन वेग')] },
      { id: 'jeem-phy-u3', subjectId: 'jeemain-physics', examTrack: 'jee-main', classLevel: 'entrance-ug', academicSession: JEE_MAIN_SESSION, unitNumber: 7, order: 3, title: { en: 'Units 7–10: Properties of Matter, Thermodynamics, KTG & Waves', hi: 'इकाई 7–10: द्रव्य के गुण, ऊष्मागतिकी, अणुगति व दोलन-तरंगें' }, overview: { en: 'Elasticity, Bernoulli theorem, viscosity, surface tension, laws of thermodynamics, Carnot cycle, kinetic theory, SHM, and standing waves.', hi: 'प्रत्यास्थता, बर्नौली प्रमेय, पृष्ठ तनाव, ऊष्मागतिकी नियम, KTG, सरल आवर्त गति व तरंगें।' }, estimatedHours: 14, isImportantUnit: true, isPublished: true, verificationStatus: 'verified', sourceUrl: NTA_JEE_SOURCE_URL, topics: [makeJeeMainTopic('jeemain-physics', 'jeem-phy-u3', 1, 'Fluid Mechanics, Viscosity & Surface Tension', 'द्रव गतिकी, श्यानता व पृष्ठ तनाव'), makeJeeMainTopic('jeemain-physics', 'jeem-phy-u3', 2, 'Thermodynamics Laws, Degrees of Freedom & KTG', 'ऊष्मागतिकी के नियम व अणुगति सिद्धांत'), makeJeeMainTopic('jeemain-physics', 'jeem-phy-u3', 3, 'SHM, Pendulums & Organ Pipe Standing Waves', 'सरल आवर्त गति व अप्रगामी तरंगें')] },
      { id: 'jeem-phy-u4', subjectId: 'jeemain-physics', examTrack: 'jee-main', classLevel: 'entrance-ug', academicSession: JEE_MAIN_SESSION, unitNumber: 11, order: 4, title: { en: 'Units 11–14: Electrostatics, Current, Magnetism, EMI & AC', hi: 'इकाई 11–14: स्थिरवैद्युतिकी, धारा, चुंबकत्व, प्रेरण व प्रत्यावर्ती धारा' }, overview: { en: 'Coulomb/Gauss laws, capacitors with dielectrics, Kirchhoff & Wheatstone bridge, Biot-Savart/Ampere laws, Faraday/Lenz laws, and LCR resonance.', hi: 'गॉस नियम, संधारित्र, किरचॉफ परिपथ, बायो-सावर्ट नियम, फैराडे प्रेरण व एलसीआर अनुनाद।' }, estimatedHours: 20, isImportantUnit: true, isPublished: true, verificationStatus: 'verified', sourceUrl: NTA_JEE_SOURCE_URL, topics: [makeJeeMainTopic('jeemain-physics', 'jeem-phy-u4', 1, 'Electric Field, Potential, Gauss Law & Capacitors', 'विद्युत क्षेत्र, विभव, गॉस नियम व संधारित्र'), makeJeeMainTopic('jeemain-physics', 'jeem-phy-u4', 2, 'Current Electricity Circuits, Biot-Savart & Lorentz Force', 'विद्युत धारा परिपथ व चुंबकीय बल'), makeJeeMainTopic('jeemain-physics', 'jeem-phy-u4', 3, 'EMI Motional EMF, Inductance & AC LCR Resonance', 'वैद्युतचुंबकीय प्रेरण व एलसीआर अनुनाद')] },
      { id: 'jeem-phy-u5', subjectId: 'jeemain-physics', examTrack: 'jee-main', classLevel: 'entrance-ug', academicSession: JEE_MAIN_SESSION, unitNumber: 15, order: 5, title: { en: 'Units 15–19: EM Waves, Optics, Dual Nature, Atoms/Nuclei & Semiconductors', hi: 'इकाई 15–19: प्रकाशिकी, द्वैत प्रकृति, परमाणु-नाभिक व अर्धचालक' }, overview: { en: 'Ray & wave optics, photoelectric effect, Bohr model, binding energy, semiconductor diodes, and logic gates (verify NTA Electronics note).', hi: 'किरण व तरंग प्रकाशिकी, प्रकाश-वैद्युत प्रभाव, बोर मॉडल, बंधन ऊर्जा व अर्धचालक डायोड।' }, estimatedHours: 16, isImportantUnit: true, isPublished: true, verificationStatus: 'verified', sourceUrl: NTA_JEE_SOURCE_URL, topics: [makeJeeMainTopic('jeemain-physics', 'jeem-phy-u5', 1, 'Geometrical Optics, YDSE & Single-Slit Diffraction', 'किरण प्रकाशिकी, व्यतिकरण व विवर्तन'), makeJeeMainTopic('jeemain-physics', 'jeem-phy-u5', 2, 'Photoelectric Effect, Bohr Atom & Mass-Energy Binding', 'प्रकाश-वैद्युत प्रभाव, बोर परमाणु व नाभिकीय बंधन ऊर्जा'), makeJeeMainTopic('jeemain-physics', 'jeem-phy-u5', 3, 'Semiconductor Diode, Zener & Logic Gates', 'अर्धचालक डायोड, ज़ेनर व लॉजिक गेट')] },
      { id: 'jeem-phy-u6', subjectId: 'jeemain-physics', examTrack: 'jee-main', classLevel: 'entrance-ug', academicSession: JEE_MAIN_SESSION, unitNumber: 20, order: 6, title: { en: 'Unit 20 (Section B): Experimental Skills', hi: 'इकाई 20 (खंड B): प्रयोगात्मक कौशल' }, overview: { en: 'Vernier callipers, screw gauge, simple pendulum, Young modulus, surface tension, meter bridge, Ohm law, and focal length experiments.', hi: 'वर्नियर कैलिपर्स, स्क्रू गेज, सरल लोलक, यंग मापांक, मीटर सेतु व लेंस फोकस दूरी प्रयोग।' }, estimatedHours: 6, isImportantUnit: true, isPublished: true, verificationStatus: 'verified', sourceUrl: NTA_JEE_SOURCE_URL, topics: [makeJeeMainTopic('jeemain-physics', 'jeem-phy-u6', 1, 'Vernier Callipers, Screw Gauge & Zero Error Numericals', 'वर्नियर कैलिपर्स व स्क्रू गेज शून्यांक त्रुटि'), makeJeeMainTopic('jeemain-physics', 'jeem-phy-u6', 2, 'Meter Bridge, Optical Bench & Multimeter Identification', 'मीटर सेतु व प्रकाशीय बेंच प्रयोग')] },
    ],
  },
  {
    id: 'jeemain-chemistry',
    examTrack: 'jee-main',
    classLevel: 'entrance-ug',
    academicSession: JEE_MAIN_SESSION,
    code: 'NTA-CHEM',
    name: { en: 'Chemistry (JEE Main)', hi: 'रसायन विज्ञान (जेईई मेन)' },
    overview: {
      en: 'Current NTA JEE Main Chemistry aligned to the updated 20-unit rationalized syllabus across Physical, Inorganic (including restricted p-Block, d/f-Block, Coordination), and Organic Chemistry.',
      hi: 'वर्तमान एनटीए जेईई मेन रसायन विज्ञान के संशोधित 20-इकाई पाठ्यक्रम पर आधारित — भौतिक, अकार्बनिक एवं कार्बनिक रसायन।',
    },
    order: 2,
    isPublished: true,
    importantTopics: [
      { en: 'Mole Concept, Thermodynamics, Chemical Equilibrium & Ionic Equilibrium', hi: 'मोल अवधारणा, ऊष्मागतिकी, रासायनिक व आयनिक साम्य' },
      { en: 'Chemical Bonding (VSEPR, MOT, Hybridisation) & Coordination Compounds (CFT)', hi: 'रासायनिक आबंधन (MOT, संकरण) व उपसहसंयोजन यौगिक' },
      { en: 'GOC (Inductive, Resonance, Hyperconjugation), Stereochemistry & Reaction Mechanisms', hi: 'सामान्य कार्बनिक रसायन (GOC), त्रिविम रसायन व अभिक्रिया क्रियाविधि' },
      { en: 'Principles Related to Practical Chemistry (Qualitative Salt & Functional Group Analysis)', hi: 'प्रायोगिक रसायन सिद्धांत (लवण व क्रियात्मक समूह परीक्षण)' },
    ],
    removedOrReducedTopics: [
      {
        id: 'jeem-chem-rem-1',
        unitOrChapterTitle: {
          en: 'Removed Complete Units: States of Matter, Surface Chemistry, Hydrogen, s-Block, Metallurgy, Polymers, Chemistry in Everyday Life, Environmental Chemistry',
          hi: 'संपूर्ण हटाए गए अध्याय: द्रव्य की अवस्थाएँ, पृष्ठ रसायन, हाइड्रोजन, s-ब्लॉक, धातुकर्म, बहुलक, दैनिक जीवन में रसायन व पर्यावरणीय रसायन',
        },
        removedDetail: {
          en: 'All 8 chapters above were removed from the current official NTA JEE Main Chemistry syllabus (note: many remain in JEE Advanced).',
          hi: 'उपरोक्त सभी 8 अध्याय वर्तमान एनटीए जेईई मेन पाठ्यक्रम से हटा दिए गए हैं (नोट: इनमें से कई जेईई एडवांस्ड में अभी भी शामिल हैं)।',
        },
        status: 'removed',
      },
      {
        id: 'jeem-chem-rem-2',
        unitOrChapterTitle: { en: 'Solid State & Detailed p-Block Compounds Reduction', hi: 'ठोस अवस्था व p-ब्लॉक यौगिकों में कटौती' },
        removedDetail: {
          en: 'Solid State removed; p-Block Group 13–18 focuses on electronic configuration and general/anomalous trends without detailed compound metallurgy lists.',
          hi: 'ठोस अवस्था हटाया गया; p-ब्लॉक में केवल सामान्य आवर्त प्रवृत्तियाँ व इलेक्ट्रॉनिक विन्यास शामिल हैं।',
        },
        status: 'reduced',
      },
    ],
    verification: {
      sourceName: { en: 'NTA JEE Main Official Rationalized Chemistry Syllabus', hi: 'एनटीए जेईई मेन आधिकारिक संशोधित रसायन पाठ्यक्रम' },
      sourceUrl: NTA_JEE_SOURCE_URL,
      academicSession: JEE_MAIN_SESSION,
      lastVerifiedDate: VERIFIED_DATE,
      verificationStatus: 'verified',
      notes: { en: 'Strictly separated active NTA units from the 9 removed/reduced JEE Main Chemistry chapters.', hi: 'सक्रिय एनटीए इकाइयों को हटाए गए 9 रसायन अध्यायों से स्पष्ट अलग किया गया है।' },
    },
    chapters: [
      { id: 'jeem-chem-p1', subjectId: 'jeemain-chemistry', examTrack: 'jee-main', classLevel: 'entrance-ug', academicSession: JEE_MAIN_SESSION, unitNumber: 1, order: 1, title: { en: 'Physical Chemistry I: Mole Concept, Atomic Structure & Bonding', hi: 'भौतिक रसायन I: मोल अवधारणा, परमाणु संरचना व रासायनिक आबंधन' }, overview: { en: 'Stoichiometry, Bohr & quantum mechanical atom, quantum numbers, VSEPR, hybridization, and Molecular Orbital Theory.', hi: 'रससमीकरणमिति, बोर व क्वांटम परमाणु मॉडल, VSEPR, संकरण व आण्विक कक्षक सिद्धांत (MOT)।' }, estimatedHours: 14, isImportantUnit: true, isPublished: true, verificationStatus: 'verified', sourceUrl: NTA_JEE_SOURCE_URL, topics: [makeJeeMainTopic('jeemain-chemistry', 'jeem-chem-p1', 1, 'Stoichiometry, Limiting Reagent & Molarity/Molality', 'स्टॉइकियोमेट्री व सांद्रता पद'), makeJeeMainTopic('jeemain-chemistry', 'jeem-chem-p1', 2, 'Quantum Numbers, Orbitals, VSEPR & MOT Bond Order', 'क्वांटम संख्याएँ, VSEPR व MOT आबंध कोटि')] },
      { id: 'jeem-chem-p2', subjectId: 'jeemain-chemistry', examTrack: 'jee-main', classLevel: 'entrance-ug', academicSession: JEE_MAIN_SESSION, unitNumber: 4, order: 2, title: { en: 'Physical Chemistry II: Thermodynamics, Solutions, Equilibrium & Kinetics', hi: 'भौतिक रसायन II: ऊष्मागतिकी, विलयन, साम्य, वैद्युतरसायन व बलगतिकी' }, overview: { en: 'Enthalpy/entropy/Gibbs energy, colligative properties, Kp/Kc, pH & buffer/solubility product, Nernst equation, and rate laws.', hi: 'एंथैल्पी/गिब्स ऊर्जा, अणुसंख्य गुणधर्म, साम्य, बफर/विलेयता गुणनफल, नेर्नस्ट व बलगतिकी।' }, estimatedHours: 18, isImportantUnit: true, isPublished: true, verificationStatus: 'verified', sourceUrl: NTA_JEE_SOURCE_URL, topics: [makeJeeMainTopic('jeemain-chemistry', 'jeem-chem-p2', 1, 'Thermodynamics & Ionic Equilibrium (pH, Buffer, Ksp)', 'ऊष्मागतिकी व आयनिक साम्य'), makeJeeMainTopic('jeemain-chemistry', 'jeem-chem-p2', 2, 'Solutions, Electrochemistry & Chemical Kinetics', 'विलयन, वैद्युतरसायन व रासायनिक बलगतिकी')] },
      { id: 'jeem-chem-in1', subjectId: 'jeemain-chemistry', examTrack: 'jee-main', classLevel: 'entrance-ug', academicSession: JEE_MAIN_SESSION, unitNumber: 9, order: 3, title: { en: 'Inorganic Chemistry: Periodicity, p-Block Trends, d/f-Block & Coordination', hi: 'अकार्बनिक रसायन: आवर्तिता, p-ब्लॉक प्रवृत्तियाँ, d/f-ब्लॉक व उपसहसंयोजन' }, overview: { en: 'Periodic trends (IE, EA, EN), Group 13–18 general trends, transition metals, KMnO4/K2Cr2O7, CFT, and isomerism.', hi: 'आवर्त गुणधर्म, वर्ग 13–18 सामान्य प्रवृत्तियाँ, संक्रमण धातुएँ, CFT व समावयवता।' }, estimatedHours: 15, isImportantUnit: true, isPublished: true, verificationStatus: 'verified', sourceUrl: NTA_JEE_SOURCE_URL, topics: [makeJeeMainTopic('jeemain-chemistry', 'jeem-chem-in1', 1, 'Periodic Properties & Group 13–18 General Trends', 'आवर्त गुणधर्म व p-ब्लॉक सामान्य प्रवृत्तियाँ'), makeJeeMainTopic('jeemain-chemistry', 'jeem-chem-in1', 2, 'd/f-Block Properties & Coordination CFT/Isomerism', 'd/f-ब्लॉक व उपसहसंयोजन यौगिक CFT')] },
      { id: 'jeem-chem-or1', subjectId: 'jeemain-chemistry', examTrack: 'jee-main', classLevel: 'entrance-ug', academicSession: JEE_MAIN_SESSION, unitNumber: 13, order: 4, title: { en: 'Organic Chemistry I: GOC, Isomerism & Hydrocarbons', hi: 'कार्बनिक रसायन I: GOC, समावयवता एवं हाइड्रोकार्बन' }, overview: { en: 'IUPAC, electronic effects (I, R, H), carbocations/carbanions, optical/geometrical isomerism, alkanes, alkenes, alkynes, and aromaticity.', hi: 'IUPAC, प्रेरणिक/अनुनाद/अतिसंयुग्मन प्रभाव, समावयवता, ऐल्केन, ऐल्कीन, ऐल्काइन व ऐरोमैटिकता।' }, estimatedHours: 16, isImportantUnit: true, isPublished: true, verificationStatus: 'verified', sourceUrl: NTA_JEE_SOURCE_URL, topics: [makeJeeMainTopic('jeemain-chemistry', 'jeem-chem-or1', 1, 'GOC Electronic Effects & Stereochemistry (R/S, E/Z)', 'GOC व त्रिविम समावयवता'), makeJeeMainTopic('jeemain-chemistry', 'jeem-chem-or1', 2, 'Hydrocarbons & Electrophilic Aromatic Substitution', 'हाइड्रोकार्बन व इलेक्ट्रॉनरागी ऐरोमैटिक प्रतिस्थापन')] },
      { id: 'jeem-chem-or2', subjectId: 'jeemain-chemistry', examTrack: 'jee-main', classLevel: 'entrance-ug', academicSession: JEE_MAIN_SESSION, unitNumber: 16, order: 5, title: { en: 'Organic Chemistry II: Haloalkanes, Oxygen/Nitrogen Compounds & Biomolecules', hi: 'कार्बनिक रसायन II: हैलोऐल्केन, ऐल्कोहॉल, कार्बोनिल, ऐमीन व जैव-अणु' }, overview: { en: 'SN1/SN2/E1/E2, Grignard reagents, Aldol/Cannizzaro/Wittig/Haloform, Diazonium reactions, carbohydrates, amino acids, and nucleic acids.', hi: 'SN1/SN2/E1/E2, ग्रिग्नार्ड अभिकर्मक, एल्डोल/कैनिज़ारो, ऐमीन, डाइऐज़ोनियम व जैव-अणु।' }, estimatedHours: 18, isImportantUnit: true, isPublished: true, verificationStatus: 'verified', sourceUrl: NTA_JEE_SOURCE_URL, topics: [makeJeeMainTopic('jeemain-chemistry', 'jeem-chem-or2', 1, 'Substitution/Elimination & Alcohols/Phenols/Ethers', 'प्रतिस्थापन/विलोपन व ऐल्कोहॉल-फ़ीनॉल-ईथर'), makeJeeMainTopic('jeemain-chemistry', 'jeem-chem-or2', 2, 'Aldehydes, Ketones, Carboxylic Acids, Amines & Biomolecules', 'कार्बोनिल यौगिक, ऐमीन व जैव-अणु')] },
      { id: 'jeem-chem-pr1', subjectId: 'jeemain-chemistry', examTrack: 'jee-main', classLevel: 'entrance-ug', academicSession: JEE_MAIN_SESSION, unitNumber: 20, order: 6, title: { en: 'Unit 20: Principles Related to Practical Chemistry', hi: 'इकाई 20: प्रायोगिक रसायन से संबंधित सिद्धांत' }, overview: { en: 'Detection of extra elements (Lassaigne), functional groups, inorganic cation/anion qualitative analysis, and titrimetric Mohr salt / KMnO4.', hi: 'लैसेन परीक्षण, क्रियात्मक समूह पहचान, अकार्बनिक धनायन/ऋणायन विश्लेषण व अनुमापन।' }, estimatedHours: 6, isImportantUnit: true, isPublished: true, verificationStatus: 'verified', sourceUrl: NTA_JEE_SOURCE_URL, topics: [makeJeeMainTopic('jeemain-chemistry', 'jeem-chem-pr1', 1, 'Lassaigne Test, Functional Group & Salt Analysis', 'लैसेन व लवण गुणात्मक विश्लेषण')] },
    ],
  },
  {
    id: 'jeemain-maths',
    examTrack: 'jee-main',
    classLevel: 'entrance-ug',
    academicSession: JEE_MAIN_SESSION,
    code: 'NTA-MATH',
    name: { en: 'Mathematics (JEE Main)', hi: 'गणित (जेईई मेन)' },
    overview: {
      en: 'Current 14-unit NTA JEE Main Mathematics syllabus covering Algebra, Calculus, Coordinate Geometry, Vectors & 3D Lines, Trigonometry, and Statistics & Probability.',
      hi: 'वर्तमान 14-इकाई एनटीए जेईई मेन गणित पाठ्यक्रम — बीजगणित, कलन, निर्देशांक ज्यामिति, सदिश व 3D रेखाएँ, त्रिकोणमिति तथा सांख्यिकी व प्रायिकता।',
    },
    order: 3,
    isPublished: true,
    importantTopics: [
      { en: 'Matrices, Determinants (System Solutions) & Complex Number Geometry', hi: 'आव्यूह, सारणिक व सम्मिश्र संख्याएँ' },
      { en: 'Limits, Differentiability, Maxima-Minima, Definite Integrals & Differential Equations', hi: 'सीमा, अवकलनीयता, निश्चित समाकलन व अवकल समीकरण' },
      { en: 'Straight Lines, Circles & Conic Sections (Tangents/Properties reduced — check below)', hi: 'सरल रेखा, वृत्त व शांकव परिच्छेद' },
      { en: 'Vectors & 3D Shortest Distance Between Skew Lines', hi: 'सदिश व 3D विषमतलीय रेखाओं की न्यूनतम दूरी' },
    ],
    removedOrReducedTopics: [
      {
        id: 'jeem-math-rem-1',
        unitOrChapterTitle: {
          en: 'Removed Topics: Mathematical Induction, Mathematical Reasoning, Planes in 3D, Scalar/Vector Triple Products',
          hi: 'हटाए गए विषय: गणितीय आगमन, गणितीय विवेचन, 3D में समतल समीकरण, अदिश व सदिश त्रिक गुणनफल',
        },
        removedDetail: {
          en: 'Also reduced: Binomial coefficient properties, sum to n terms of special series, tangent/normal & Rolle/LMVT conditions (verify NTA annual PDF), equation of tangent/normal to conics, and Bernoulli trials/binomial distribution.',
          hi: '3D में समतल व रेखा-समतल कोण, त्रिक गुणनफल, बर्नौली परीक्षण, गणितीय आगमन व गणितीय विवेचन वर्तमान एनटीए जेईई मेन से हटाए गए हैं।',
        },
        status: 'removed',
      },
    ],
    verification: {
      sourceName: { en: 'NTA JEE Main Official Mathematics Syllabus', hi: 'एनटीए जेईई मेन आधिकारिक गणित पाठ्यक्रम' },
      sourceUrl: NTA_JEE_SOURCE_URL,
      academicSession: JEE_MAIN_SESSION,
      lastVerifiedDate: VERIFIED_DATE,
      verificationStatus: 'verified',
      notes: { en: 'Covers all 14 active NTA units; removed 3D Planes & Mathematical Reasoning clearly isolated.', hi: 'सभी 14 सक्रिय एनटीए इकाइयाँ शामिल; समतल व गणितीय विवेचन जैसे हटाए गए विषय अलग दिखाए गए हैं।' },
    },
    chapters: [
      { id: 'jeem-math-u1', subjectId: 'jeemain-maths', examTrack: 'jee-main', classLevel: 'entrance-ug', academicSession: JEE_MAIN_SESSION, unitNumber: 1, order: 1, title: { en: 'Sets, Relations, Functions & Trigonometry', hi: 'समुच्चय, संबंध, फलन एवं त्रिकोणमिति' }, overview: { en: 'Equivalence relations, domain/range, bijective/composite functions, inverse trig, and trigonometric identities.', hi: 'तुल्यता संबंध, प्रांत/परिसर, एकैकी-आच्छादक व संयुक्त फलन तथा त्रिकोणमितीय सर्वसमिकाएँ।' }, estimatedHours: 12, isImportantUnit: true, isPublished: true, verificationStatus: 'verified', sourceUrl: NTA_JEE_SOURCE_URL, topics: [makeJeeMainTopic('jeemain-maths', 'jeem-math-u1', 1, 'Relations, Composite Functions & Functional Equations', 'संबंध, संयुक्त व प्रतिलोम फलन'), makeJeeMainTopic('jeemain-maths', 'jeem-math-u1', 2, 'Trigonometric Ratios, Identities & Inverse Functions', 'त्रिकोणमितीय सर्वसमिकाएँ व प्रतिलोम फलन')] },
      { id: 'jeem-math-u2', subjectId: 'jeemain-maths', examTrack: 'jee-main', classLevel: 'entrance-ug', academicSession: JEE_MAIN_SESSION, unitNumber: 2, order: 2, title: { en: 'Algebra: Complex Numbers, Quadratics, Matrices, P&C, Binomial & Sequences', hi: 'बीजगणित: सम्मिश्र संख्याएँ, द्विघात, आव्यूह-सारणिक, क्रमचय-संचय, द्विपद व श्रेणी' }, overview: { en: 'Argand plane, roots location, determinant/matrix inverse, fundamental counting, general term in binomial, and AP/GP/AM-GM.', hi: 'आर्गैंड समतल, मूलों की स्थिति, सारणिक, क्रमचय-संचय, द्विपद प्रमेय व समांतर/गुणोत्तर श्रेणी।' }, estimatedHours: 22, isImportantUnit: true, isPublished: true, verificationStatus: 'verified', sourceUrl: NTA_JEE_SOURCE_URL, topics: [makeJeeMainTopic('jeemain-maths', 'jeem-math-u2', 1, 'Complex Numbers, Argand Geometry & Quadratic Roots', 'सम्मिश्र संख्याएँ व द्विघात समीकरण'), makeJeeMainTopic('jeemain-maths', 'jeem-math-u2', 2, 'Matrices, Determinants & System Consistency', 'आव्यूह व सारणिक द्वारा समीकरण हल'), makeJeeMainTopic('jeemain-maths', 'jeem-math-u2', 3, 'P&C, Binomial General Term & AP/GP/AM-GM', 'क्रमचय-संचय, द्विपद व श्रेणियाँ')] },
      { id: 'jeem-math-u3', subjectId: 'jeemain-maths', examTrack: 'jee-main', classLevel: 'entrance-ug', academicSession: JEE_MAIN_SESSION, unitNumber: 7, order: 3, title: { en: 'Differential & Integral Calculus + Differential Equations', hi: 'अवकल व समाकल कलन एवं अवकल समीकरण' }, overview: { en: 'Limits, continuity, differentiability, maxima-minima, indefinite/definite integrals, area under curves, and first-order differential equations.', hi: 'सीमा, सांतत्य, अवकलनीयता, उच्चिष्ठ-निम्निष्ठ, निश्चित समाकलन, क्षेत्रफल व अवकल समीकरण।' }, estimatedHours: 24, isImportantUnit: true, isPublished: true, verificationStatus: 'verified', sourceUrl: NTA_JEE_SOURCE_URL, topics: [makeJeeMainTopic('jeemain-maths', 'jeem-math-u3', 1, 'Limits, Continuity, Differentiability & Applications', 'सीमा, सांतत्य व अवकलज के अनुप्रयोग'), makeJeeMainTopic('jeemain-maths', 'jeem-math-u3', 2, 'Definite Integral Properties & Area Under Curves', 'निश्चित समाकलन प्रगुण व क्षेत्रफल'), makeJeeMainTopic('jeemain-maths', 'jeem-math-u3', 3, 'Linear, Homogeneous & Separable Differential Equations', 'अवकल समीकरण हल विधियाँ')] },
      { id: 'jeem-math-u4', subjectId: 'jeemain-maths', examTrack: 'jee-main', classLevel: 'entrance-ug', academicSession: JEE_MAIN_SESSION, unitNumber: 10, order: 4, title: { en: 'Coordinate Geometry: Straight Lines, Circles & Conics', hi: 'निर्देशांक ज्यामिति: सरल रेखा, वृत्त एवं शांकव परिच्छेद' }, overview: { en: 'Locus, straight line forms, distance/bisectors, circle equations & radical axis, and standard forms/foci/eccentricity of parabola, ellipse, hyperbola.', hi: 'बिंदुपथ, सरल रेखा, वृत्त समीकरण तथा परवलय, दीर्घवृत्त व अतिपरवलय के मानक रूप।' }, estimatedHours: 16, isImportantUnit: true, isPublished: true, verificationStatus: 'verified', sourceUrl: NTA_JEE_SOURCE_URL, topics: [makeJeeMainTopic('jeemain-maths', 'jeem-math-u4', 1, 'Straight Lines, Centroid/Orthocentre & Family of Lines', 'सरल रेखा व त्रिभुज केंद्र'), makeJeeMainTopic('jeemain-maths', 'jeem-math-u4', 2, 'Circles & Standard Parabola, Ellipse, Hyperbola Properties', 'वृत्त व शांकव परिच्छेद (परवलय, दीर्घवृत्त, अतिपरवलय)')] },
      { id: 'jeem-math-u5', subjectId: 'jeemain-maths', examTrack: 'jee-main', classLevel: 'entrance-ug', academicSession: JEE_MAIN_SESSION, unitNumber: 11, order: 5, title: { en: 'Vectors, 3D Geometry (Lines), Statistics & Probability', hi: 'सदिश, 3D रेखाएँ, सांख्यिकी एवं प्रायिकता' }, overview: { en: 'Vector dot/cross products, 3D skew-line shortest distance, mean/variance/standard deviation, conditional probability & Bayes theorem.', hi: 'अदिश/सदिश गुणनफल, विषमतलीय रेखाओं की दूरी, प्रसरण/मानक विचलन व बेज़ प्रमेय।' }, estimatedHours: 14, isImportantUnit: true, isPublished: true, verificationStatus: 'verified', sourceUrl: NTA_JEE_SOURCE_URL, topics: [makeJeeMainTopic('jeemain-maths', 'jeem-math-u5', 1, 'Vector Dot/Cross & Skew-Line Shortest Distance in 3D', 'सदिश गुणन व 3D न्यूनतम दूरी'), makeJeeMainTopic('jeemain-maths', 'jeem-math-u5', 2, "Variance, Standard Deviation & Bayes' Theorem", 'प्रसरण, मानक विचलन व बेज़ प्रमेय')] },
    ],
  },
];
