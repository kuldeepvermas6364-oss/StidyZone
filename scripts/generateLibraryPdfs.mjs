import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const OUT_DIR = path.resolve(process.cwd(), 'storage', 'materials');

/**
 * Generates real, searchable, multi-page educational reference PDFs owned by PrepZone
 * (original concise study summaries, formula references, and model practice sets).
 * Never duplicates copyrighted NCERT / UPMSP / NTA textbooks.
 */
const DOCUMENTS = [
  {
    filename: 'up12-physics-ch1-electrostatics-notes.pdf',
    title: 'UP Board Class 12 Physics - Chapter 1: Electric Charges and Fields',
    subtitle: 'PrepZone Original Bilingual Concept Guide & Key Derivations (2025-26)',
    footerNote: 'PrepZone Open Educational Reference · Supplementary to Official UPMSP & NCERT Syllabus',
    pages: [
      {
        heading: '1. Fundamental Properties of Electric Charge',
        bullets: [
          'Quantization of Charge: Total charge on any macroscopic body is q = +/- n * e, where e = 1.602 x 10^-19 C and n is an integer.',
          'Conservation of Charge: In an isolated system, algebraic sum of positive and negative charges remains constant.',
          'Additivity & Invariance: Charge is a scalar quantity and does not change with velocity of the frame of reference.',
          'Charging Methods: Friction (electron transfer), Conduction (direct contact), and Electrostatic Induction (without contact).',
        ],
      },
      {
        heading: "2. Coulomb's Law & Electric Field Intensity",
        bullets: [
          "Coulomb's Force in Vacuum: F = (1 / (4 * pi * epsilon_0)) * (q1 * q2 / r^2), where 1/(4*pi*epsilon_0) = 9 x 10^9 N*m^2/C^2.",
          'Vector Form & Action-Reaction: F_12 = -F_21 along the line joining the two point charges.',
          'Relative Permittivity (Dielectric Constant): F_medium = F_vacuum / K, where K = epsilon / epsilon_0 >= 1.',
          'Superposition Principle: Net force on q_0 equals vector sum of individual forces due to q_1, q_2, ..., q_n.',
          'Electric Field: E = lim(q0 -> 0) F / q0 (SI Unit: N/C or V/m). Point charge field E = kq / r^2.',
        ],
      },
      {
        heading: "3. Electric Dipole & Gauss's Theorem Derivations (High-Yield Board Topics)",
        bullets: [
          'Dipole Moment: p = q * 2a directed from negative charge (-q) to positive charge (+q); SI unit C*m.',
          'Axial Field (r >> a): E_axial = (1 / 4*pi*epsilon_0) * (2p / r^3) parallel to p.',
          'Equatorial Field (r >> a): E_eq = (1 / 4*pi*epsilon_0) * (p / r^3) opposite to p; therefore E_axial = 2 * E_eq.',
          'Torque in Uniform Field: tau = p x E = pE sin(theta); stable equilibrium at theta = 0 deg, unstable at 180 deg.',
          "Gauss's Law: Total electric flux phi_E = closed integral(E . dA) = q_enclosed / epsilon_0.",
          'Applications: (a) Infinite line charge E = lambda / (2*pi*epsilon_0*r); (b) Plane sheet E = sigma / (2*epsilon_0).',
        ],
      },
    ],
  },
  {
    filename: 'up12-physics-ch2-potential-capacitance-formulas.pdf',
    title: 'UP Board Class 12 Physics - Chapter 2: Potential & Capacitance Formula Sheet',
    subtitle: 'PrepZone Original Quick-Recall Sheet (2025-26)',
    footerNote: 'PrepZone Open Educational Reference · Supplementary Formula Summary',
    pages: [
      {
        heading: '1. Electrostatic Potential & Equipotential Surfaces',
        bullets: [
          'Potential Difference: V_B - V_A = W_ext / q0 = (1/4*pi*epsilon_0) * q * (1/r_B - 1/r_A).',
          'Relation Between Field and Potential: E = -dV/dr (electric field points in direction of decreasing potential).',
          'Dipole Potential: V = (1/4*pi*epsilon_0) * (p cos(theta) / r^2); V = 0 on entire equatorial plane.',
          'Electrostatic Potential Energy of Two Charges: U = (1/4*pi*epsilon_0) * (q1 * q2 / r).',
          'Potential Energy of Dipole in Uniform Field: U = -p . E = -pE cos(theta); work done W = pE(cos theta1 - cos theta2).',
        ],
      },
      {
        heading: '2. Capacitors, Combinations & Dielectric Effect',
        bullets: [
          'Capacitance Definition: C = Q / V (SI Unit: Farad, F). Spherical conductor: C = 4 * pi * epsilon_0 * R.',
          'Parallel Plate Capacitor: C_0 = epsilon_0 * A / d. With dielectric slab of thickness t: C = epsilon_0*A / (d - t + t/K).',
          'Series Combination: 1/C_eq = 1/C1 + 1/C2 + ... (charge Q same on every capacitor).',
          'Parallel Combination: C_eq = C1 + C2 + ... (potential difference V same across every branch).',
          'Stored Energy & Energy Density: U = 1/2 C V^2 = Q^2/(2C) = 1/2 QV; u = 1/2 epsilon_0 E^2.',
        ],
      },
    ],
  },
  {
    filename: 'up12-physics-model-paper-blueprint-2026.pdf',
    title: 'UP Board Class 12 Physics - Solved Model Blueprint (70 Marks Pattern)',
    subtitle: 'PrepZone Practice & Marking Scheme Guide (Authenticated Access Sample)',
    footerNote: 'PrepZone Practice Blueprint · Always check https://upmsp.edu.in/ for official annual model sets.',
    pages: [
      {
        heading: 'Section Breakdown (UPMSP 70 Marks Written Exam · 3 Hours 15 Min)',
        bullets: [
          'Section A (Khand A - Bahuvikalpiya / MCQ): 6 Questions x 1 Mark = 6 Marks.',
          'Section B (Khand B - Ati Laghu Uttariya / Very Short Answer): 6 Questions x 1 Mark = 6 Marks.',
          'Section C (Khand C - Laghu Uttariya Type-I): 4 Questions x 2 Marks = 8 Marks.',
          'Section D (Khand D - Laghu Uttariya Type-II): 10 Questions x 3 Marks = 30 Marks (derivations & numericals).',
          'Section E (Khand E - Dirgha Uttariya / Long Answer with internal choice): 4 Questions x 5 Marks = 20 Marks.',
        ],
      },
      {
        heading: 'Sample Long-Answer Practice Problems (With Key Steps)',
        bullets: [
          "Q1 (5 Marks): State Gauss's theorem and derive electric field due to uniformly charged thin spherical shell outside, on surface, and inside.",
          'Solution Key: Outside E = kQ/r^2; Surface E = sigma/epsilon_0; Inside E = 0 because q_enclosed = 0.',
          'Q2 (5 Marks): Derive Lens Maker Formula (1/f = (n - 1)(1/R1 - 1/R2)) for a thin convex lens placed in air.',
          'Solution Key: Apply spherical refraction formula n2/v - n1/u = (n2 - n1)/R twice across first and second surfaces.',
        ],
      },
    ],
  },
  {
    filename: 'up12-chemistry-ch1-solutions-revision.pdf',
    title: 'UP Board Class 12 Chemistry - Chapter 1: Solutions Revision Notes',
    subtitle: "PrepZone Original Concept & Formula Guide (Raoult's Law & Colligative Properties)",
    footerNote: 'PrepZone Open Educational Reference · Class 12 Chemistry',
    pages: [
      {
        heading: '1. Concentration Terms & Solubility Laws',
        bullets: [
          'Molarity (M) = moles of solute / Volume of solution in L (temperature dependent).',
          'Molality (m) = moles of solute / Mass of solvent in kg (temperature independent).',
          "Henry's Law: Partial pressure of gas p = K_H * x; higher K_H means lower solubility at given pressure.",
          "Raoult's Law for Volatile Liquids: p_total = p1^0 * x1 + p2^0 * x2; ideal solutions show delta_H_mix = 0, delta_V_mix = 0.",
        ],
      },
      {
        heading: "2. Colligative Properties & van't Hoff Factor (i)",
        bullets: [
          'Relative Lowering of Vapour Pressure: (p1^0 - p1)/p1^0 = i * x2.',
          'Elevation in Boiling Point: delta_Tb = i * Kb * m; Depression in Freezing Point: delta_Tf = i * Kf * m.',
          'Osmotic Pressure: pi = i * C * R * T (best suited for molar mass determination of polymers/proteins).',
          "van't Hoff Factor: i = (Normal molar mass) / (Abnormal molar mass) = 1 + (n - 1)*alpha for dissociation.",
        ],
      },
    ],
  },
  {
    filename: 'up12-maths-ch3-matrices-formulas.pdf',
    title: 'UP Board Class 12 Mathematics - Matrices & Determinants Reference',
    subtitle: 'PrepZone Original Theorem & Formula Summary',
    footerNote: 'PrepZone Open Educational Reference · Class 12 Mathematics',
    pages: [
      {
        heading: '1. Matrix Algebra, Transpose & Symmetric Decomposition',
        bullets: [
          'Matrix Multiplication: Defined when columns of A equal rows of B; AB != BA in general; (AB)^T = B^T * A^T.',
          'Symmetric & Skew-Symmetric: Every square matrix A = 1/2(A + A^T) + 1/2(A - A^T). Diagonal elements of skew-symmetric matrix are 0.',
          'Invertible Matrix Property: (AB)^-1 = B^-1 * A^-1 and A^-1 = adj(A) / |A| provided |A| != 0.',
        ],
      },
      {
        heading: '2. Determinants, Adjoint & System of Linear Equations',
        bullets: [
          'Order n square matrix identities: |kA| = k^n |A|; |adj(A)| = |A|^(n-1); A * adj(A) = |A| * I_n.',
          'Area of Triangle with vertices (x1,y1), (x2,y2), (x3,y3): 1/2 * |det([[x1,y1,1],[x2,y2,1],[x3,y3,1]])|.',
          'Martin Rule (Matrix Method): For AX = B, if |A| != 0 unique solution X = A^-1 B. If |A|=0 check (adj A)*B.',
        ],
      },
    ],
  },
  {
    filename: 'up12-commerce-accountancy-partnership-notes.pdf',
    title: 'UP Board Class 12 Accountancy - Accounting for Partnership Firms',
    subtitle: 'PrepZone Commerce Stream Concept Guide (2025-26)',
    footerNote: 'PrepZone Open Educational Reference · Class 12 Commerce',
    pages: [
      {
        heading: '1. Partnership Deed & Absence Rules (Indian Partnership Act, 1932)',
        bullets: [
          'Profit Sharing Ratio: Equal among all partners if no written partnership deed exists.',
          'Interest on Capital & Drawings: Not allowed / not charged in the absence of partnership agreement.',
          'Interest on Partner Loan: Strictly 6% p.a. simple interest even if firm incurs loss.',
          'Partner Remuneration (Salary/Commission): Not payable unless explicitly mentioned in deed.',
        ],
      },
      {
        heading: '2. P&L Appropriation Account & Capital Accounts',
        bullets: [
          'Fixed Capital Method: Separate Capital A/c (fixed balance) and Current A/c (drawings, IOC, salary, profit share).',
          'Fluctuating Capital Method: Single Capital A/c records all adjustments directly.',
          'Guarantee of Profit: Deficiency borne by guaranteeing partner(s) in agreed ratio.',
        ],
      },
    ],
  },
  {
    filename: 'up12-arts-history-harappan-notes.pdf',
    title: 'UP Board Class 12 History - Chapter 1: Bricks, Beads and Bones',
    subtitle: 'PrepZone Humanities / Arts Stream Structured Revision Notes',
    footerNote: 'PrepZone Open Educational Reference · Class 12 History',
    pages: [
      {
        heading: '1. Harappan Civilisation Timeline & Key Archaeological Sites',
        bullets: [
          'Mature Harappan Phase: c. 2600 BCE to 1900 BCE across Harappa, Mohenjodaro, Lothal, Kalibangan, Dholavira, Rakhigarhi.',
          'Subsistence & Agriculture: Wheat, barley, lentil, chickpea, sesame; terracotta plough models at Cholistan & Banawali; ploughed field at Kalibangan.',
          'Urban Planning (Mohenjodaro): Citadel (Great Bath, Warehouse) & Lower Town grid streets with covered brick drainage.',
        ],
      },
      {
        heading: '2. Craft Production, Trade & Seals',
        bullets: [
          'Chanhudaro: Major centre for bead-making (carnelian, steatite, jasper), shell-cutting, and weight-making.',
          'Long-Distance Trade: Copper from Khetri (Rajasthan) & Magan (Oman); Lapis Lazuli from Shortughai (Afghanistan); references to Meluhha.',
          'Weights & Script: Cubical chert weights in binary (1,2,4,8...) & decimal ratios; undeciphered right-to-left script (~375-400 signs).',
        ],
      },
    ],
  },
  {
    filename: 'jeemain-physics-em-circuits-compendium.pdf',
    title: 'JEE Main Physics - Electrostatics, Current & Magnetism Formula Compendium',
    subtitle: 'Aligned to Current NTA JEE Main Syllabus (2026-27 · Reduced Topics Excluded)',
    footerNote: 'PrepZone JEE Main Reference · Potentiometer & Cyclotron excluded per updated NTA syllabus.',
    pages: [
      {
        heading: '1. Electrostatics & RC Circuit Transients',
        bullets: [
          'Gaussian Flux Symmetry: Spherical, cylindrical, and planar symmetry shortcuts for non-uniform charge density rho(r).',
          'Capacitor Charging: q(t) = C*V*(1 - e^(-t/RC)); Time constant tau = R_eq * C_eq (Thevenin equivalent across capacitor).',
          'Energy Loss on Redistribution: delta_U = 1/2 * (C1*C2)/(C1+C2) * (V1 - V2)^2 dissipated as heat in connecting wires.',
        ],
      },
      {
        heading: '2. Current Circuits & Moving Charges in Magnetic Field',
        bullets: [
          'Drift Velocity & Conductivity: I = n*e*A*v_d; J = sigma * E; Wheatstone Bridge & Meter Bridge sensitivity.',
          'Biot-Savart Law: Circular arc center B = (mu_0 * I * theta) / (4 * pi * r); Finite straight wire B = (mu_0*I/4*pi*d)*(sin alpha + sin beta).',
          'Lorentz Force & Helical Trajectory: Pitch = v_parallel * (2*pi*m / (q*B)); Magnetic dipole torque tau = M x B.',
        ],
      },
      {
        heading: '3. Electromagnetic Induction & AC Resonance',
        bullets: [
          'Motional EMF: E = B * v * l (for perpendicular rod, B, and v); Rotating rod EMF = 1/2 * B * omega * L^2.',
          'LCR Series Resonance: omega_0 = 1 / sqrt(LC); Quality Factor Q = (1/R) * sqrt(L/C); Power P = V_rms * I_rms * cos(phi).',
          'Note on Updated NTA Syllabus: Potentiometer, Cyclotron, and Earth Magnetism horizontal/dip topics are NOT included in JEE Main.',
        ],
      },
    ],
  },
  {
    filename: 'jeemain-chemistry-bonding-coordination-sheet.pdf',
    title: 'JEE Main Chemistry - Chemical Bonding & Coordination Compounds Sheet',
    subtitle: 'Current NTA JEE Main High-Yield Revision Reference (2026-27)',
    footerNote: 'PrepZone JEE Main Reference · Chemistry Inorganic & Physical Core',
    pages: [
      {
        heading: '1. VSEPR Geometry, Hybridisation & Molecular Orbital Theory',
        bullets: [
          'Steric Number = 1/2 * (Valence e- on central atom + monovalent atoms - cationic charge + anionic charge).',
          'MOT Filling Order (up to N2, 14 e-): sigma1s < sigma*1s < sigma2s < sigma*2s < (pi2px = pi2py) < sigma2pz < (pi*2px = pi*2py) < sigma*2pz.',
          'O2, B2 are paramagnetic; CO, N2, NO+ have Bond Order = 3.0; Higher bond order implies shorter bond length.',
        ],
      },
      {
        heading: '2. Coordination Compounds & Crystal Field Theory (CFT)',
        bullets: [
          'Spectrochemical Series: I- < Br- < SCN- < Cl- < S2- < F- < OH- < C2O4^2- < H2O < NCS- < edta^4- < NH3 < en < CN- < CO.',
          'Octahedral Splitting (delta_o): t2g lowered by -0.4 delta_o, eg raised by +0.6 delta_o. Pairing occurs when delta_o > P.',
          'Isomerism: Geometrical (Ma2b2, Ma3b3 fac/mer) and Optical isomerism ([Co(en)3]3+, cis-[Co(en)2Cl2]+).',
        ],
      },
    ],
  },
  {
    filename: 'jeemain-maths-calculus-formula-sheet.pdf',
    title: 'JEE Main Mathematics - Differential & Integral Calculus Formula Sheet',
    subtitle: 'Aligned to NTA JEE Main Units 5–8 (2026-27)',
    footerNote: 'PrepZone JEE Main Reference · Mathematics Formula Compendium',
    pages: [
      {
        heading: '1. Limits, Continuity & Derivatives (L-Hospital & Standard Expansions)',
        bullets: [
          'Standard Limits: lim(x->0) (1 + x)^(1/x) = e; lim(x->0) (a^x - 1)/x = ln(a); lim(x->0) (sin x)/x = 1.',
          '1^infinity Indeterminate Form: lim f(x)^g(x) = exp(lim (f(x) - 1) * g(x)).',
          'Leibniz Rule for Differentiation Under Integral: d/dx integral[u(x) to v(x)] f(t) dt = f(v(x))*v\'(x) - f(u(x))*u\'(x).',
        ],
      },
      {
        heading: '2. Definite Integration, King Property & Differential Equations',
        bullets: [
          'King Property: integral[a to b] f(x) dx = integral[a to b] f(a + b - x) dx.',
          'Walli Formula for integral[0 to pi/2] sin^m(x) cos^n(x) dx.',
          'Linear Differential Equation: dy/dx + P(x)y = Q(x) -> Integrating Factor IF = exp(integral P(x) dx); y*(IF) = integral Q*(IF) dx + C.',
        ],
      },
    ],
  },
  {
    filename: 'jeeadv-physics-thermal-radiation-retained.pdf',
    title: 'JEE Advanced Physics - Blackbody Radiation, Wien Law & X-Rays (Retained)',
    subtitle: 'Dedicated IIT JEE Advanced Syllabus Supplement (Distinct from JEE Main)',
    footerNote: 'PrepZone JEE Advanced Reference · Always verify https://jeeadv.ac.in/',
    pages: [
      {
        heading: '1. Thermal Conduction & Blackbody Radiation Laws',
        bullets: [
          'Fourier Heat Conduction: dQ/dt = -k A (dT/dx); Thermal Resistance R_th = L / (kA).',
          "Kirchhoff's Law of Radiation: Ratio of emissive power to absorptivity e_lambda / a_lambda = E_lambda (blackbody) at same T.",
          'Stefan-Boltzmann Law: Radiated Power P = e * sigma * A * T^4 (sigma = 5.67 x 10^-8 W m^-2 K^-4).',
          "Wien's Displacement Law: lambda_max * T = b = 2.898 x 10^-3 m*K (retained exclusively in JEE Advanced).",
        ],
      },
      {
        heading: '2. Radioactivity & X-Ray Cutoff Wavelength',
        bullets: [
          'Law of Radioactive Decay: N(t) = N_0 e^(-lambda*t); Activity A = lambda * N; Half-life T_1/2 = ln(2)/lambda.',
          'Continuous X-Rays: lambda_min = h*c / (e*V) = 12400 / V (in Angstrom); independent of target material.',
          "Moseley's Law for Characteristic X-Rays: sqrt(nu) = a * (Z - b); K_alpha transition from n=2 to n=1.",
        ],
      },
    ],
  },
  {
    filename: 'jeeadv-chemistry-solid-metallurgy-retained.pdf',
    title: 'JEE Advanced Chemistry - Solid State, Metallurgy & Salt Analysis (Retained)',
    subtitle: 'Dedicated IIT JEE Advanced Reference (Retained Topics Excluded from JEE Main)',
    footerNote: 'PrepZone JEE Advanced Reference · Retained Inorganic & Physical Chapters',
    pages: [
      {
        heading: '1. Solid State Crystal Lattices & Packing Efficiency',
        bullets: [
          'Simple Cubic (Z=1, 52.4%), BCC (Z=2, r = sqrt(3)a/4, 68%), FCC/CCP (Z=4, r = a/(2*sqrt(2)), 74%).',
          'Voids in Close Packing: For N spheres, Octahedral voids = N and Tetrahedral voids = 2N.',
          'Density of Unit Cell: d = (Z * M) / (a^3 * N_A); Schottky (lowers density) vs Frenkel (density unchanged).',
        ],
      },
      {
        heading: '2. Extractive Metallurgy & Qualitative Salt Analysis',
        bullets: [
          'Ellingham Diagram: Below intersection point, lower delta_G oxide line reduces the metal oxide above it.',
          'Self-Reduction (Cu2S + 2 Cu2O -> 6 Cu + SO2), Cyanide Process (MacArthur-Forrest for Ag/Au), Mond & van Arkel refining.',
          'Cation Groups: Group I (Pb2+, Ag+ as chlorides), Group II (Cu2+, Cd2+, Bi3+ with H2S in acidic medium), Group III (Fe3+, Al3+, Cr3+ hydroxides).',
        ],
      },
    ],
  },
  {
    filename: 'jeeadv-maths-complex-3d-planes-guide.pdf',
    title: 'JEE Advanced Mathematics - Complex Geometry & 3D Planes Guide',
    subtitle: 'Multi-Concept IIT JEE Advanced Reference (Includes Retained 3D Plane Sections)',
    footerNote: 'PrepZone JEE Advanced Reference · Paper 1 & 2 Problem Patterns',
    pages: [
      {
        heading: '1. Complex Numbers Rotation Theorem & Locus',
        bullets: [
          "Coni's Rotation Formula: (z3 - z1)/(z2 - z1) = (|z3 - z1|/|z2 - z1|) * e^(i * theta).",
          'Equilateral Triangle Condition: z1^2 + z2^2 + z3^2 = z1*z2 + z2*z3 + z3*z1.',
          'Cube Roots of Unity (omega): 1 + omega + omega^2 = 0 and omega^3 = 1.',
        ],
      },
      {
        heading: '2. Planes & Family of Planes in 3D Geometry (Retained in JEE Advanced)',
        bullets: [
          'Normal Form of Plane: r . n_hat = d; Cartesian ax + by + cz + d = 0.',
          'Distance from Point (x1, y1, z1) to Plane: |ax1 + by1 + cz1 + d| / sqrt(a^2 + b^2 + c^2).',
          'Family of Planes through Intersection of P1=0 and P2=0: P1 + lambda * P2 = 0.',
        ],
      },
    ],
  },
];

async function buildPdf(spec) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(spec.title);
  pdfDoc.setAuthor('PrepZone Academic Team');
  pdfDoc.setSubject(spec.subtitle);
  pdfDoc.setCreator('PrepZone Study Material Library');

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const pageWidth = 595.28; // A4 width
  const pageHeight = 841.89; // A4 height
  const margin = 48;
  const maxTextWidth = pageWidth - margin * 2;

  function wrapLines(text, font, size) {
    const words = text.split(/\s+/);
    const lines = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxTextWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  const totalPages = spec.pages.length;
  spec.pages.forEach((p, idx) => {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    // Header band
    page.drawRectangle({
      x: 0,
      y: pageHeight - 92,
      width: pageWidth,
      height: 92,
      color: rgb(0.95, 0.97, 1),
    });
    page.drawLine({
      start: { x: 0, y: pageHeight - 92 },
      end: { x: pageWidth, y: pageHeight - 92 },
      thickness: 1.5,
      color: rgb(0.145, 0.388, 0.922),
    });

    page.drawText('PREPZONE STUDY LIBRARY', {
      x: margin,
      y: pageHeight - 28,
      size: 9,
      font: fontBold,
      color: rgb(0.145, 0.388, 0.922),
    });

    const titleLines = wrapLines(spec.title, fontBold, 14);
    let titleY = pageHeight - 48;
    for (const line of titleLines.slice(0, 2)) {
      page.drawText(line, {
        x: margin,
        y: titleY,
        size: 14,
        font: fontBold,
        color: rgb(0.06, 0.09, 0.16),
      });
      titleY -= 17;
    }

    page.drawText(spec.subtitle, {
      x: margin,
      y: pageHeight - 82,
      size: 9.5,
      font: fontRegular,
      color: rgb(0.28, 0.33, 0.41),
    });

    // Section heading
    let cursorY = pageHeight - 130;
    const headingLines = wrapLines(p.heading, fontBold, 13);
    for (const hLine of headingLines) {
      page.drawText(hLine, {
        x: margin,
        y: cursorY,
        size: 13,
        font: fontBold,
        color: rgb(0.11, 0.24, 0.58),
      });
      cursorY -= 18;
    }

    cursorY -= 8;

    // Bullets
    for (const bullet of p.bullets) {
      const wrapped = wrapLines(`• ${bullet}`, fontRegular, 10.5);
      for (const bLine of wrapped) {
        if (cursorY < 76) break;
        page.drawText(bLine, {
          x: margin,
          y: cursorY,
          size: 10.5,
          font: fontRegular,
          color: rgb(0.12, 0.16, 0.23),
        });
        cursorY -= 16;
      }
      cursorY -= 8;
    }

    // Footer
    page.drawLine({
      start: { x: margin, y: 48 },
      end: { x: pageWidth - margin, y: 48 },
      thickness: 0.75,
      color: rgb(0.82, 0.85, 0.9),
    });
    page.drawText(spec.footerNote, {
      x: margin,
      y: 30,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.4, 0.45, 0.53),
    });
    page.drawText(`Page ${idx + 1} of ${totalPages}`, {
      x: pageWidth - margin - 60,
      y: 30,
      size: 8.5,
      font: fontBold,
      color: rgb(0.28, 0.33, 0.41),
    });
  });

  const bytes = await pdfDoc.save();
  const target = path.join(OUT_DIR, spec.filename);
  fs.writeFileSync(target, bytes);
  return { filename: spec.filename, size: bytes.length, pages: totalPages };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const results = [];
  for (const docSpec of DOCUMENTS) {
    results.push(await buildPdf(docSpec));
  }
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
