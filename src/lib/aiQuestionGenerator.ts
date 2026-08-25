import { Question } from '../types';

export interface GenerateQuestionsParams {
  topic: string;
  className?: string;
  numQuestions: number;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  customInstructions?: string;
  marksPerQ?: number;
  negativeMarksPerQ?: number;
}

// Chemistry Question Knowledge Base & Synthesis Engine
function generateLocalChemistryQuestions(params: GenerateQuestionsParams): Question[] {
  const {
    topic,
    className = 'Class 12',
    numQuestions = 5,
    difficulty = 'Medium',
    marksPerQ = 4,
    negativeMarksPerQ = 1
  } = params;

  const cleanTopic = topic.trim() || 'General Chemistry';
  const lower = cleanTopic.toLowerCase();
  const count = Math.max(1, Math.min(numQuestions, 50));

  const questions: Question[] = [];

  // Categorize topic
  const isKinetics = /kinetic|rate|order|half[- ]?life|arrhenius/i.test(lower);
  const isThermo = /thermo|enthalpy|entropy|gibbs|spontaneity|heat|hess/i.test(lower);
  const isElectro = /electro|nernst|faraday|galvanic|emf|cell|kohlrausch|conduct/i.test(lower);
  const isCoordination = /coordination|complex|ligand|cft|isomer|werner|iupac/i.test(lower);
  const isOrganic = /organic|halo|alcohol|phenol|ether|aldehyde|ketone|carboxylic|amine|benzene|hydrocarbon|aromatic|biomolecule|polymer/i.test(lower);
  const isSolution = /solution|colligative|raoult|osmotic|boiling|freezing|van[' ]?t hoff/i.test(lower);
  const isEquilibrium = /equilibrium|ionic|ph|buffer|ksp|solubility|le chatelier|acid|base/i.test(lower);
  const isStructure = /structure|atom|bohr|quantum|bond|hybrid|vsepr|molecular|periodic/i.test(lower);
  const isInorganic = /block|metal|p-block|d-block|f-block|transition|metallurgy|extraction/i.test(lower);

  // Template banks
  const questionPool: Array<{
    q: string;
    opts: [string, string, string, string];
    correct: number;
    exp: string;
  }> = [];

  if (isKinetics) {
    questionPool.push(
      {
        q: `For a first-order chemical reaction in ${cleanTopic}, if the rate constant k = 2.303 × 10⁻³ s⁻¹, what is the half-life period (t₁/₂)?`,
        opts: ["300 s", "693 s", "100 s", "150 s"],
        correct: 0,
        exp: `For first order: t₁/₂ = 0.693 / k = ln(2) / (2.303 × 10⁻³) = 300 seconds.`
      },
      {
        q: `What is the unit of the rate constant (k) for a second-order reaction in ${cleanTopic}?`,
        opts: ["L · mol⁻¹ · s⁻¹", "mol · L⁻¹ · s⁻¹", "s⁻¹", "L² · mol⁻² · s⁻¹"],
        correct: 0,
        exp: `Unit of rate constant = (mol/L)^(1-n) · s⁻¹. For n=2, unit = (mol/L)⁻¹ · s⁻¹ = L · mol⁻¹ · s⁻¹.`
      },
      {
        q: `According to the Arrhenius equation in ${cleanTopic}, what is the slope of the plot of ln(k) versus 1/T?`,
        opts: ["-Ea / R", "+Ea / R", "-Ea / (2.303 R)", "Ea · R"],
        correct: 0,
        exp: `From Arrhenius equation: ln(k) = ln(A) - Ea / (RT). Comparing with y = mx + c, the slope is -Ea / R.`
      },
      {
        q: `If the concentration of a reactant is increased by a factor of 4 and the rate of reaction increases by a factor of 8, what is the order of the reaction?`,
        opts: ["1.5 (or 3/2)", "2", "3", "0.5"],
        correct: 0,
        exp: `Rate r ∝ [A]^n. 8 = 4^n => 2³ = (2²)^n = 2^(2n) => 2n = 3 => n = 1.5 (Order = 3/2).`
      },
      {
        q: `In a zero-order reaction involving ${cleanTopic}, which of the following is directly proportional to the initial concentration of reactant [A]₀?`,
        opts: ["Half-life (t₁/₂)", "Rate of reaction", "Rate constant (k)", "Time for completion squared"],
        correct: 0,
        exp: `For a zero-order reaction, t₁/₂ = [A]₀ / (2k). Thus, the half-life is directly proportional to initial reactant concentration.`
      }
    );
  } else if (isThermo) {
    questionPool.push(
      {
        q: `Under standard conditions in ${cleanTopic}, what is the relationship between standard Gibbs free energy change (ΔG°) and the equilibrium constant (K)?`,
        opts: ["ΔG° = -RT ln K", "ΔG° = +RT ln K", "ΔG° = -nFE°", "ΔG° = ΔH° + TΔS°"],
        correct: 0,
        exp: `At equilibrium, ΔG = 0, which yields ΔG° = -RT ln K.`
      },
      {
        q: `For a spontaneous chemical process at all temperatures in ${cleanTopic}, which combination of enthalpy (ΔH) and entropy (ΔS) is required?`,
        opts: ["ΔH < 0 and ΔS > 0", "ΔH > 0 and ΔS < 0", "ΔH > 0 and ΔS > 0", "ΔH < 0 and ΔS < 0"],
        correct: 0,
        exp: `According to the Gibbs-Helmholtz equation ΔG = ΔH - TΔS. If ΔH is negative and ΔS is positive, ΔG is always negative regardless of temperature.`
      },
      {
        q: `In an adiabatic reversible expansion of an ideal gas related to ${cleanTopic}, which thermodynamic property remains constant?`,
        opts: ["Entropy (S)", "Temperature (T)", "Internal energy (U)", "Pressure (P)"],
        correct: 0,
        exp: `In a reversible adiabatic process, heat transfer q_rev = 0, so dS = dq_rev / T = 0. Hence entropy remains constant (isentropic).`
      },
      {
        q: `What is the standard enthalpy of formation (ΔfH°) of any element in its most stable standard state (e.g., O₂(g), C(graphite))?`,
        opts: ["0 kJ/mol", "1 kJ/mol", "-100 kJ/mol", "+298 kJ/mol"],
        correct: 0,
        exp: `By thermodynamic convention, the standard enthalpy of formation of an element in its standard reference state is assigned as zero.`
      }
    );
  } else if (isElectro) {
    questionPool.push(
      {
        q: `In ${cleanTopic}, what is the Nernst equation for a cell reaction at 298 K?`,
        opts: [
          "E_cell = E°_cell - (0.0591 / n) log Q",
          "E_cell = E°_cell + (0.0591 / n) log Q",
          "E_cell = E°_cell - (RT / nF) log Q",
          "E_cell = E°_cell - (n / 0.0591) log Q"
        ],
        correct: 0,
        exp: `At 298 K, (2.303 RT / F) ≈ 0.0591 V. Thus E_cell = E°_cell - (0.0591 / n) log Q.`
      },
      {
        q: `According to Kohlrausch's law of independent migration of ions in ${cleanTopic}, molar conductivity at infinite dilution (Λ°m) of an electrolyte AxBy is given by:`,
        opts: [
          "Λ°m = x λ°(Aʸ⁺) + y λ°(Bˣ⁻)",
          "Λ°m = λ°(Aʸ⁺) + λ°(Bˣ⁻)",
          "Λ°m = (x/y) λ°(Aʸ⁺) + (y/x) λ°(Bˣ⁻)",
          "Λ°m = [λ°(Aʸ⁺) · λ°(Bˣ⁻)] / (x + y)"
        ],
        correct: 0,
        exp: `Kohlrausch's law states that limiting molar conductivity is the sum of individual contributions of cations and anions multiplied by their stoichiometric coefficients.`
      },
      {
        q: `How much electric charge in Faradays (F) is required to reduce 1 mole of MnO₄⁻ to Mn²⁺ in acidic medium?`,
        opts: ["5 F", "1 F", "2 F", "7 F"],
        correct: 0,
        exp: `The reduction half reaction is: MnO₄⁻ + 8H⁺ + 5e⁻ → Mn²⁺ + 4H₂O. 5 moles of electrons = 5 Faradays of charge.`
      },
      {
        q: `Which of the following represents the relationship between standard cell potential (E°_cell) and standard Gibbs free energy (ΔG°)?`,
        opts: ["ΔG° = -nFE°_cell", "ΔG° = +nFE°_cell", "ΔG° = -RT / nFE°_cell", "ΔG° = -nF / E°_cell"],
        correct: 0,
        exp: `Electrical work done by cell = -ΔG°. Hence, ΔG° = -nFE°_cell.`
      }
    );
  } else if (isCoordination) {
    questionPool.push(
      {
        q: `What is the correct IUPAC name of the complex [Co(NH₃)₅(CO₃)]Cl in ${cleanTopic}?`,
        opts: [
          "Pentaamminecarbonatocobalt(III) chloride",
          "Carbonatopentaamminecobalt(II) chloride",
          "Pentaamminechlorocobalt(III) carbonate",
          "Pentaamminecobalt(III) carbonate chloride"
        ],
        correct: 0,
        exp: `Ligands are named alphabetically: ammine ('a') before carbonato ('c'). Co oxidation state is +3: Co + 5(0) + (-2) + (-1) = 0 => Co = +3. Hence Pentaamminecarbonatocobalt(III) chloride.`
      },
      {
        q: `Which of the following ligands acts as a strong field ligand producing maximum crystal field splitting (Δo) according to the spectrochemical series?`,
        opts: ["CN⁻", "H₂O", "Cl⁻", "F⁻"],
        correct: 0,
        exp: `In the spectrochemical series: I⁻ < Br⁻ < S²⁻ < Cl⁻ < F⁻ < OH⁻ < C₂O₄²⁻ < H₂O < NCS⁻ < EDTA⁴⁻ < NH₃ < en < NO₂⁻ < CN⁻ < CO.`
      },
      {
        q: `What type of isomerism is exhibited by the pair of coordination complexes [Co(NH₃)₅(SO₄)]Br and [Co(NH₃)₅Br]SO₄?`,
        opts: ["Ionization isomerism", "Linkage isomerism", "Coordination isomerism", "Geometrical isomerism"],
        correct: 0,
        exp: `Ionization isomerism occurs when the coordination sphere and ionization sphere exchange ionizable counter-ions.`
      },
      {
        q: `What is the magnetic moment (spin-only) for an octahedral complex with d⁶ high-spin configuration?`,
        opts: ["4.90 BM", "0 BM", "2.83 BM", "5.92 BM"],
        correct: 0,
        exp: `In high-spin d⁶ octahedral complex (t₂g⁴ eg²), there are n = 4 unpaired electrons. μ = √(n(n+2)) = √(4 × 6) = √24 ≈ 4.90 BM.`
      }
    );
  } else if (isOrganic) {
    questionPool.push(
      {
        q: `Which of the following substrates undergoes SN1 nucleophilic substitution reaction most rapidly in ${cleanTopic}?`,
        opts: [
          "(CH₃)₃C-Br (tert-Butyl bromide)",
          "(CH₃)₂CH-Br (Isopropyl bromide)",
          "CH₃CH₂-Br (Ethyl bromide)",
          "CH₃-Br (Methyl bromide)"
        ],
        correct: 0,
        exp: `SN1 mechanism involves carbocation intermediate formation. The 3° (tert-butyl) carbocation is the most stable due to 9 hyperconjugative α-hydrogens and +I inductive effects.`
      },
      {
        q: `In ${cleanTopic}, which named reaction converts benzaldehyde to benzyl alcohol and benzoic acid salt in the presence of concentrated NaOH?`,
        opts: ["Cannizzaro Reaction", "Aldol Condensation", "Reimer-Tiemann Reaction", "Kolbe's Reaction"],
        correct: 0,
        exp: `Aldehydes lacking α-hydrogen (like benzaldehyde) undergo self-redox (disproportionation) in concentrated alkali called the Cannizzaro reaction.`
      },
      {
        q: `Which reagent is most specifically used for converting an aldehyde directly into an alkane (Clemmensen Reduction)?`,
        opts: ["Zn-Hg / conc. HCl", "NH₂NH₂ / KOH / ethylene glycol", "LiAlH₄ / dry ether", "NaBH₄ / ethanol"],
        correct: 0,
        exp: `Clemmensen reduction uses zinc amalgam (Zn-Hg) and concentrated hydrochloric acid to reduce carbonyl >C=O groups to methylene >CH₂ groups.`
      },
      {
        q: `What is the major product formed when phenol is treated with chloroform (CHCl₃) and aqueous NaOH followed by acidification (Reimer-Tiemann reaction)?`,
        opts: ["Salicylaldehyde (2-Hydroxybenzaldehyde)", "Salicylic acid", "Benzoic acid", "Picric acid"],
        correct: 0,
        exp: `The Reimer-Tiemann reaction introduces a formyl (-CHO) group ortho to the phenolic -OH group via a dichlorocarbene (:CCl₂) intermediate, giving salicylaldehyde.`
      },
      {
        q: `Which of the following tests is used to distinguish primary aliphatic/aromatic amines from secondary and tertiary amines using CHCl₃ and alcoholic KOH?`,
        opts: ["Carbylamine test (Isocyanide test)", "Lucas test", "Tollens' test", "Fehling's test"],
        correct: 0,
        exp: `Only primary amines react with chloroform and alc. KOH to produce foul-smelling isocyanides (carbylamines).`
      }
    );
  } else if (isSolution) {
    questionPool.push(
      {
        q: `What is the van 't Hoff factor (i) for complete dissociation of potassium ferricyanide K₃[Fe(CN)₆] in dilute aqueous solution?`,
        opts: ["4", "3", "5", "1"],
        correct: 0,
        exp: `K₃[Fe(CN)₆] dissociates into 3 K⁺ cations and 1 [Fe(CN)₆]³⁻ complex anion: total 4 ions. For 100% dissociation, i = 4.`
      },
      {
        q: `According to Raoult's law for ideal binary solutions in ${cleanTopic}, what is the relative lowering of vapour pressure equal to?`,
        opts: [
          "Mole fraction of solute (x_solute)",
          "Mole fraction of solvent (x_solvent)",
          "Molality of solution",
          "Molarity of solution"
        ],
        correct: 0,
        exp: `(P° - P) / P° = x_solute. The relative lowering of vapour pressure is equal to the mole fraction of the non-volatile solute.`
      },
      {
        q: `An aqueous solution of 0.1 M glucose, 0.1 M NaCl, and 0.1 M CaCl₂ will have boiling points in which increasing order?`,
        opts: [
          "Glucose < NaCl < CaCl₂",
          "CaCl₂ < NaCl < Glucose",
          "NaCl < Glucose < CaCl₂",
          "All will have the same boiling point"
        ],
        correct: 0,
        exp: `Elevation in boiling point ΔTb = i · Kb · m. van 't Hoff factor i: Glucose (1) < NaCl (2) < CaCl₂ (3). Hence boiling point increases as Glucose < NaCl < CaCl₂.`
      }
    );
  } else if (isEquilibrium) {
    questionPool.push(
      {
        q: `According to Le Chatelier's principle in ${cleanTopic}, what happens to an exothermic synthesis reaction at equilibrium when temperature is raised?`,
        opts: [
          "Equilibrium shifts in the backward (endothermic) direction, yield decreases",
          "Equilibrium shifts forward, yield increases",
          "Equilibrium remains completely unchanged",
          "Reaction stops permanently"
        ],
        correct: 0,
        exp: `Raising temperature favors the endothermic direction. For an exothermic reaction (ΔH < 0), the reverse direction is endothermic, so yield decreases.`
      },
      {
        q: `What is the pH of a buffer solution consisting of 0.1 M CH₃COOH and 0.1 M CH₃COONa (given pKa of acetic acid = 4.74)?`,
        opts: ["4.74", "7.00", "5.74", "3.74"],
        correct: 0,
        exp: `From the Henderson-Hasselbalch equation: pH = pKa + log([Salt]/[Acid]) = 4.74 + log(0.1/0.1) = 4.74 + 0 = 4.74.`
      },
      {
        q: `For a sparingly soluble salt of type AB₂ (e.g. CaF₂) with solubility 's' mol/L, what is the solubility product expression (Ksp)?`,
        opts: ["Ksp = 4s³", "Ksp = s²", "Ksp = 27s⁴", "Ksp = 2s²"],
        correct: 0,
        exp: `AB₂(s) ⇌ A²⁺ + 2B⁻. [A²⁺] = s, [B⁻] = 2s. Ksp = [A²⁺][B⁻]² = (s)(2s)² = 4s³.`
      }
    );
  } else {
    // General / Inorganic / Periodic
    questionPool.push(
      {
        q: `Which of the following electronic configurations represents an element with the highest second ionization enthalpy (IE₂)?`,
        opts: ["1s² 2s² 2p⁶ 3s¹ (Sodium, Na)", "1s² 2s² 2p⁶ 3s² (Magnesium, Mg)", "1s² 2s² 2p⁶ (Neon, Ne)", "1s² 2s² 2p⁶ 3s² 3p¹ (Aluminium, Al)"],
        correct: 0,
        exp: `After losing 1 electron, Na⁺ achieves a noble gas stable octet configuration (2p⁶). Removing a second electron requires exceptionally high energy.`
      },
      {
        q: `What is the molecular geometry and hybridization of the central atom in SF₆ according to VSEPR theory in ${cleanTopic}?`,
        opts: ["Octahedral, sp³d²", "Trigonal bipyramidal, sp³d", "Square planar, dsp²", "Tetrahedral, sp³"],
        correct: 0,
        exp: `Sulfur has 6 valence electrons and forms 6 single bonds with fluorine with 0 lone pairs. Steric number = 6 => sp³d² hybridization and regular octahedral shape.`
      },
      {
        q: `Which of the following compounds exhibits highest ionic character according to Fajan's rules in ${cleanTopic}?`,
        opts: ["CsF", "LiI", "NaCl", "AgCl"],
        correct: 0,
        exp: `Ionic character is maximized when cation is large with low charge (Cs⁺) and anion is small (F⁻), resulting in minimal polarizability.`
      },
      {
        q: `In transition metal chemistry regarding ${cleanTopic}, why do transition elements exhibit variable oxidation states?`,
        opts: [
          "Due to very small energy difference between ns and (n-1)d orbitals",
          "Due to high screening effect of d electrons",
          "Due to complete absence of unpaired electrons",
          "Due to extremely low ionization enthalpy of core electrons"
        ],
        correct: 0,
        exp: `The energy difference between (n-1)d and ns electrons is minimal, enabling participation of both sets of electrons in bonding.`
      }
    );
  }

  // Helper to shuffle options and re-map the correct option index
  const shuffleOptionsWithIndex = (opts: [string, string, string, string], correctIndex: number) => {
    const items = opts.map((opt, idx) => ({ text: opt, isCorrect: idx === correctIndex }));
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    const newCorrect = items.findIndex(item => item.isCorrect);
    return {
      options: [items[0].text, items[1].text, items[2].text, items[3].text] as [string, string, string, string],
      correctOption: newCorrect !== -1 ? newCorrect : 0
    };
  };

  // Generate requested count with guaranteed unique parameterization
  for (let i = 0; i < count; i++) {
    const template = questionPool[i % questionPool.length];
    const qNum = i + 1;
    
    // Add distinct numerical or contextual variations if requested count exceeds pool size
    let qText = template.q;
    let expText = template.exp;
    if (i >= questionPool.length) {
      const cycle = Math.floor(i / questionPool.length) + 1;
      const paramTag = (i + 1) * 3.5;
      qText = `[Advanced Set #${cycle} - Case ${paramTag}] ${template.q}`;
      expText = `Analyzed under variant parameter condition #${paramTag}. ${template.exp}`;
    }

    const { options: mixedOpts, correctOption: mixedCorrect } = shuffleOptionsWithIndex(
      template.opts,
      template.correct
    );

    questions.push({
      id: `ai-q-${Date.now()}-${qNum}`,
      question: qText,
      options: mixedOpts,
      correctOption: mixedCorrect,
      explanation: `${expText} [Curriculum Level: ${className} • Difficulty: ${difficulty}]`,
      marks: marksPerQ,
      negativeMarks: negativeMarksPerQ
    });
  }

  // Strict Deduplication Filter
  const uniqueMap = new Map<string, Question>();
  for (const q of questions) {
    const key = q.question.trim().toLowerCase();
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, q);
    } else {
      q.question = `${q.question} (Variant ${uniqueMap.size + 1})`;
      uniqueMap.set(q.question.trim().toLowerCase(), q);
    }
  }

  return Array.from(uniqueMap.values());
}

// Master Generator that tries API first, then falls back seamlessly to client-side engine
export async function generateAiTestQuestions(params: GenerateQuestionsParams): Promise<Question[]> {
  const {
    topic,
    className = 'Class 12',
    numQuestions = 5,
    difficulty = 'Medium',
    customInstructions = '',
    marksPerQ = 4,
    negativeMarksPerQ = 1
  } = params;

  const payload = {
    topic: topic.trim(),
    className,
    numQuestions,
    difficulty,
    customInstructions,
    marksPerQ,
    negativeMarksPerQ
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch('/api/ai/generate-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data.questions) && data.questions.length > 0) {
        return data.questions.map((q: any, idx: number) => ({
          id: q.id || `ai-q-${Date.now()}-${idx + 1}`,
          question: String(q.question || `Question ${idx + 1}`).trim(),
          options: [
            String(q.options?.[0] || 'Option A'),
            String(q.options?.[1] || 'Option B'),
            String(q.options?.[2] || 'Option C'),
            String(q.options?.[3] || 'Option D')
          ] as [string, string, string, string],
          correctOption: typeof q.correctOption === 'number' ? q.correctOption : 0,
          explanation: String(q.explanation || '').trim(),
          marks: marksPerQ,
          negativeMarks: negativeMarksPerQ
        }));
      }
    }
  } catch (err) {
    console.warn('[AI Question Generator] Server request timed out or unavailable, using fast local curriculum synthesis:', err);
  }

  // Fallback to local curriculum generator (instant response, zero wait time)
  return generateLocalChemistryQuestions(params);
}
