import { Question } from '../types';

/**
 * Parses questions from CSV text.
 * Expected columns:
 * Question, Option A, Option B, Option C, Option D, Correct Option, Explanation (optional)
 * Correct Option can be: 'A', 'B', 'C', 'D' or '1', '2', '3', '4' or option text.
 */
export function parseQuestionsFromCSV(csvText: string): { questions: Question[]; errors: string[] } {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  const questions: Question[] = [];
  const errors: string[] = [];

  if (lines.length === 0) {
    return { questions: [], errors: ['CSV text is empty.'] };
  }

  // Helper to parse CSV line accounting for quoted fields with commas
  function parseCSVLine(text: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (inQuotes && text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  }

  let startIndex = 0;
  // Detect if first line is a header
  const firstLineCols = parseCSVLine(lines[0]).map(c => c.toLowerCase());
  if (
    firstLineCols.some(c => c.includes('question') || c.includes('option') || c.includes('answer') || c.includes('correct'))
  ) {
    startIndex = 1;
  }

  for (let i = startIndex; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine.trim()) continue;

    const cols = parseCSVLine(rawLine);
    if (cols.length < 5) {
      errors.push(`Row ${i + 1}: Insufficient columns. Minimum 5 required (Question, Option A, Option B, Option C, Option D, Correct Option).`);
      continue;
    }

    const qText = cols[0];
    const optA = cols[1];
    const optB = cols[2];
    const optC = cols[3];
    const optD = cols[4] || '';
    const rawCorrect = (cols[5] || 'A').trim();
    const explanation = cols[6] || '';

    if (!qText) {
      errors.push(`Row ${i + 1}: Missing question text.`);
      continue;
    }

    // Determine correct option index (0 = A, 1 = B, 2 = C, 3 = D)
    let correctIdx = 0;
    const cleanCorrect = rawCorrect.toUpperCase();

    if (cleanCorrect === 'A' || cleanCorrect === '1' || cleanCorrect === 'OPTION A' || cleanCorrect === '(A)') {
      correctIdx = 0;
    } else if (cleanCorrect === 'B' || cleanCorrect === '2' || cleanCorrect === 'OPTION B' || cleanCorrect === '(B)') {
      correctIdx = 1;
    } else if (cleanCorrect === 'C' || cleanCorrect === '3' || cleanCorrect === 'OPTION C' || cleanCorrect === '(C)') {
      correctIdx = 2;
    } else if (cleanCorrect === 'D' || cleanCorrect === '4' || cleanCorrect === 'OPTION D' || cleanCorrect === '(D)') {
      correctIdx = 3;
    } else {
      // Check if text matches one of the options directly
      const lower = rawCorrect.toLowerCase();
      if (lower === optA.toLowerCase()) correctIdx = 0;
      else if (lower === optB.toLowerCase()) correctIdx = 1;
      else if (lower === optC.toLowerCase()) correctIdx = 2;
      else if (lower === optD.toLowerCase()) correctIdx = 3;
    }

    questions.push({
      id: 'q-' + (i + 1) + '-' + Math.random().toString(36).substring(2, 7),
      question: qText,
      options: [optA || 'Option A', optB || 'Option B', optC || 'Option C', optD || 'Option D'],
      correctOption: correctIdx,
      explanation: explanation || undefined
    });
  }

  return { questions, errors };
}

/**
 * Sample Chemistry Test CSV Data for Admin download
 */
export function getSampleChemistryCSV(): string {
  return `Question,Option A,Option B,Option C,Option D,Correct Option,Explanation
"Which of the following molecules has a linear molecular geometry according to VSEPR theory?","H2O","CO2","NH3","SO2","B","CO2 has 2 bonding pairs and 0 lone pairs on the central carbon atom resulting in a 180° bond angle (linear shape)."
"The oxidation number of Chromium in K2Cr2O7 is:","+3","+6","+5","+4","B","Let oxidation state of Cr be x: 2(+1) + 2(x) + 7(-2) = 0 => 2 + 2x - 14 = 0 => 2x = 12 => x = +6."
"Which gas law states that volume is directly proportional to temperature at constant pressure?","Boyle's Law","Charles's Law","Gay-Lussac's Law","Avogadro's Law","B","Charles's law states that V ∝ T when pressure (P) and amount of gas (n) remain constant."
"What is the IUPAC name of CH3-CH(OH)-CH3?","Propan-1-ol","Propan-2-ol","Propanoic acid","Methoxyethane","B","The longest carbon chain contains 3 carbons with -OH substituent on C2, hence Propan-2-ol."
"Which of the following orbital has a spherical node?","1s","2s","2p","3d","B","The number of radial (spherical) nodes is given by (n - l - 1). For 2s: n=2, l=0 => 2 - 0 - 1 = 1 node."
"The catalyst used in Haber's process for manufacture of Ammonia is:","Platinized asbestos","Finely divided Iron with Molybdenum promoter","Nickel powder","V2O5","B","In Haber's process (N2 + 3H2 ⇌ 2NH3), finely divided iron acts as catalyst and molybdenum/K2O/Al2O3 acts as promoter."
"Which transition metal ion exhibits highest magnetic moment?","Fe3+ (d5)","Mn2+ (d5)","Cr3+ (d3)","Both A and B","D","Both Fe3+ and Mn2+ have 3d5 electronic configuration with 5 unpaired electrons (μ = √35 ≈ 5.92 BM)."
"What is the pH of a 0.001 M HCl solution at 25°C?","1","2","3","4","C","HCl is a strong acid that completely dissociates: [H+] = 10^-3 M. pH = -log[H+] = -log(10^-3) = 3."
"Which functional group is present in aldehydes?","-COOH","-CHO","-CO-","-OH","B","Aldehydes contain the formyl group (-CHO) bonded to an alkyl/aryl group."
"Which law explains the elevation of boiling point in dilute solutions?","Raoult's Law","Henry's Law","Hess's Law","Graham's Law","A","Elevation in boiling point (ΔTb = Kb × m) is derived directly from Raoult's law of vapor pressure lowering."`;
}

/**
 * Downloads a sample Chemistry CSV template to the user's computer
 */
export function downloadSampleCSV(): void {
  const csvContent = getSampleChemistryCSV();
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'Apex_Chemistry_Question_Paper_Template.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
