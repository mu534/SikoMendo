/**
 * features/employees/education-institutions.ts
 *
 * Verified institution lists for the education section of the employee form.
 *
 * ── Universities ──────────────────────────────────────────────────────────
 * Source: uniRank 2026 A-Z directory of Ethiopian universities
 * (https://www.unirank.org/et/a-z/) – 51 entries meeting their criteria:
 *   officially chartered/licensed/accredited, degree-granting (≥3-year
 *   bachelor's and/or postgraduate), predominantly face-to-face delivery.
 * The list is reproduced by name only; ordering and ranking are uniRank's.
 * Content was paraphrased/listed for compliance with licensing restrictions.
 * Attribution: uniRank (https://www.unirank.org/et/a-z/)
 *
 * ── Colleges & TVET ───────────────────────────────────────────────────────
 * A small starter list of well-known Ethiopian colleges and TVET institutions.
 * This list is intentionally kept separate from the university directory
 * (the university list does not claim to cover all colleges or TVET centres).
 * Extend it in the relevant array below when verified institutions become
 * available; no other code changes are required.
 *
 * ── High schools ─────────────────────────────────────────────────────────
 * High schools are NOT hard-coded. HR staff type the school name manually;
 * the form provides a free-text input for HIGH_SCHOOL institution type.
 *
 * ── Other ────────────────────────────────────────────────────────────────
 * "Other" institution type shows a free-text input.
 */

export type InstitutionEntry = {
  /** Display name shown in the dropdown and stored in the DB. */
  name: string;
  /** Optional location hint shown below the name in the dropdown. */
  location?: string;
};

// ── Ethiopian universities ─────────────────────────────────────────────────
// 51 entries from uniRank 2026 A-Z directory (https://www.unirank.org/et/a-z/)
// Listed alphabetically as they appear in that directory.
export const ETHIOPIAN_UNIVERSITIES: InstitutionEntry[] = [
  { name: "Adama Science and Technology University",  location: "Adama" },
  { name: "Addis Ababa Science and Technology University", location: "Addis Ababa" },
  { name: "Addis Ababa University",                   location: "Addis Ababa" },
  { name: "Adigrat University",                       location: "Adigrat" },
  { name: "Aksum University",                         location: "Aksum" },
  { name: "Ambo University",                          location: "Ambo" },
  { name: "Arba Minch University",                    location: "Arba Minch" },
  { name: "Arsi University",                          location: "Asella" },
  { name: "Assosa University",                        location: "Assosa" },
  { name: "Bahir Dar University",                     location: "Bahir Dar" },
  { name: "Bonga University",                         location: "Bonga" },
  { name: "Borena University",                        location: "Yabelo" },
  { name: "Bule Hora University",                     location: "Bule Hora" },
  { name: "Debark University",                        location: "Debark" },
  { name: "Debre Birhan University",                  location: "Debre Berhan" },
  { name: "Debre Markos University",                  location: "Debre Markos" },
  { name: "Debre Tabor University",                   location: "Gondar" },
  { name: "Dembi Dolo University",                    location: "Dembi Dolo" },
  { name: "Dilla University",                         location: "Dilla" },
  { name: "Dire Dawa University",                     location: "Dire Dawa" },
  { name: "Ethiopian Civil Service University",       location: "Addis Ababa" },
  { name: "Ethiopian Police University",              location: "Sendafa" },
  { name: "Gambella University",                      location: "Gambela" },
  { name: "Haramaya University",                      location: "Haramaya" },
  { name: "Hawassa University",                       location: "Awasa" },
  { name: "Injibara University",                      location: "Injibara" },
  { name: "Jigjiga University",                       location: "Jigjiga" },
  { name: "Jimma University",                         location: "Jimma" },
  { name: "Jinka University",                         location: "Jinka" },
  { name: "Kebri Dehar University",                   location: "Kebri Dahar" },
  { name: "Kotebe Education University",              location: "Addis Ababa" },
  { name: "Madda Walabu University",                  location: "Bale Robe" },
  { name: "Mattu University",                         location: "Metu" },
  { name: "Mekdela Amba University",                  location: "Tulu Awlia" },
  { name: "Mekelle University",                       location: "Mekelle" },
  { name: "Mizan-Tepi University",                    location: "Mizan Teferi" },
  { name: "Oda Bultum University",                    location: "Chiro" },
  { name: "Oromia State University",                  location: "Ziway" },
  { name: "Raya University",                          location: "Maichew" },
  { name: "Rift Valley University",                   location: "Addis Ababa" },
  { name: "Samara University",                        location: "Semera" },
  { name: "Selale University",                        location: "Fiche" },
  { name: "Unity University",                         location: "Addis Ababa" },
  { name: "University of Gondar",                     location: "Gondar" },
  { name: "Wachamo University",                       location: "Hosaena" },
  { name: "Werabe University",                        location: "Worabe" },
  { name: "Wolaita Sodo University",                  location: "Sodo" },
  { name: "Woldia University",                        location: "Woldiya" },
  { name: "Wolkite University",                       location: "Welkite" },
  { name: "Wollega University",                       location: "Nekemte" },
  { name: "Wollo University",                         location: "Dessie" },
];

// ── Ethiopian colleges ─────────────────────────────────────────────────────
// Starter list of well-known Ethiopian colleges.
// This is NOT the full national registry. Add verified entries as needed.
export const ETHIOPIAN_COLLEGES: InstitutionEntry[] = [
  { name: "Addis Ababa Medical College",              location: "Addis Ababa" },
  { name: "Addis Ababa University College of Commerce", location: "Addis Ababa" },
  { name: "Admas University College",                 location: "Addis Ababa" },
  { name: "Beza International College",               location: "Addis Ababa" },
  { name: "Ethiopian Institute of Architecture, Building Construction and City Development", location: "Addis Ababa" },
  { name: "Hawassa College of Teacher Education",     location: "Hawassa" },
  { name: "Jimma Teachers College",                   location: "Jimma" },
  { name: "St. Mary's University College",            location: "Addis Ababa" },
];

// ── Ethiopian TVET institutions ────────────────────────────────────────────
// Starter list of TVET centres. Extend with verified entries as needed.
export const ETHIOPIAN_TVET_INSTITUTIONS: InstitutionEntry[] = [
  { name: "Adama Polytechnic College",                location: "Adama" },
  { name: "Addis Ababa City Administration TVET College", location: "Addis Ababa" },
  { name: "Bale Robe TVET College",                   location: "Bale Robe" },
  { name: "Gondar TVET College",                      location: "Gondar" },
  { name: "Hawassa TVET College",                     location: "Hawassa" },
  { name: "Jimma TVET College",                       location: "Jimma" },
  { name: "Mekelle Polytechnic College",              location: "Mekelle" },
  { name: "Nekemte TVET College",                     location: "Nekemte" },
  { name: "Robe TVET College",                        location: "Bale Robe" },
];

/**
 * Returns the institution list for a given type.
 *
 * - UNIVERSITY → 51 verified Ethiopian universities (uniRank 2026).
 * - COLLEGE    → extensible college starter list.
 * - TVET       → extensible TVET starter list.
 * - HIGH_SCHOOL / OTHER → empty array (free-text input rendered instead).
 */
export function getInstitutionList(type: string | null | undefined): InstitutionEntry[] {
  switch (type) {
    case "UNIVERSITY": return ETHIOPIAN_UNIVERSITIES;
    case "COLLEGE":    return ETHIOPIAN_COLLEGES;
    case "TVET":       return ETHIOPIAN_TVET_INSTITUTIONS;
    default:           return [];
  }
}
