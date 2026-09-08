// src/data/schools.js
//
// The `id` is what gets stored in Firestore on every student and teacher
// record — students are scoped to a teacher by comparing these ids, so
// once real students have signed up, changing an id orphans their data
// AND breaks the teacher/student join. Pick ids once and leave them
// alone. The `name` is display-only and safe to edit any time.
//
// SECTIONS are the client's real Grade 7 sections for the demo, keyed by
// grade so another year level is a data edit rather than a code change.
// They are stored as written ("7-Amapola"), which is how teachers refer
// to them on their rosters.
//
// Students created before sections became a dropdown may hold free-text
// values that appear in no list here. Nothing validates against these
// lists after the fact, and the Teacher Dashboard builds its filters
// from the values students actually have, so those records keep working.

export const SCHOOLS = [
  {
    id: "school-1",
    name: "Benigno “Ninoy” S. Aquino High School",
    sections: {
      7: [
        "7-Amapola",
        "7-Anthurium",
        "7-Amaranth",
        "7-Sampaguita",
        "7-Anemone",
        "7-Bougainvillea"
      ]
    }
  },
  {
    id: "school-2",
    name: "Taguig Science High School",
    sections: {
      7: ["7-Babbage", "7-Descartes", "7-Euclid", "7-Pascal"]
    }
  },
  {
    id: "school-3",
    name: "Taguig National High School",
    sections: {
      7: [
        "7-Aguinaldo",
        "7-Aquino",
        "7-Bonifacio",
        "7-Del-Pilar",
        "7-Jacinto",
        "7-Lopez Jaena",
        "7-Luna",
        "7-Mabini",
        "7-Rizal",
        "7-Silang"
      ]
    }
  }
];

export function schoolName(id) {
  const found = SCHOOLS.find((s) => s.id === id);
  return found ? found.name : "Hindi tukoy na paaralan";
}

/** Grade levels a school actually has sections for, low to high. */
export function gradesFor(schoolId) {
  const school = SCHOOLS.find((s) => s.id === schoolId);
  if (!school) return [];
  return Object.keys(school.sections).sort((a, b) => Number(a) - Number(b));
}

/** Sections for one school and grade, in the order the client listed
 *  them — deliberately not sorted, so their sequence is preserved. */
export function sectionsFor(schoolId, grade) {
  const school = SCHOOLS.find((s) => s.id === schoolId);
  if (!school) return [];
  return school.sections[grade] || school.sections[Number(grade)] || [];
}
