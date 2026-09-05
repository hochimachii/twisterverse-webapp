// src/data/schools.js
//
// ⚠️ REPLACE THESE with the client's actual school names before
// deploying. The `id` is what gets stored in Firestore on every student
// and teacher record — once real students have signed up, changing an
// id orphans their data, so pick the ids now and leave them alone.
// The `name` is display-only and safe to edit any time.

export const SCHOOLS = [
  { id: "school-1", name: "Benigno “Ninoy” S. Aquino High School" },
  { id: "school-2", name: "Taguig Science High School" },
  { id: "school-3", name: "Taguig National High School" }
];

export function schoolName(id) {
  const found = SCHOOLS.find((s) => s.id === id);
  return found ? found.name : "Hindi tukoy na paaralan";
}
