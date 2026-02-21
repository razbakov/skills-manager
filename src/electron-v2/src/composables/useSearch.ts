import type { SkillViewModel } from "@/types";

function fuzzyScore(query: string, rawText: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;

  const text = String(rawText || "").toLowerCase();
  if (!text) return 0;
  if (text === q) return 5;
  if (text.startsWith(q)) return 4;
  if (text.includes(q)) return 3;

  let qi = 0;
  for (const char of text) {
    if (char === q[qi]) {
      qi += 1;
      if (qi === q.length) return 1;
    }
  }
  return 0;
}

function compareByName(a: { name: string }, b: { name: string }): number {
  return (a.name || "").localeCompare(b.name || "", undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

export function sortByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort(compareByName);
}

export function filterSkills(
  skills: SkillViewModel[],
  query: string,
): SkillViewModel[] {
  const ordered = sortByName(skills);
  if (!query.trim()) return ordered;

  const filtered: { skill: SkillViewModel; score: number; nameScore: number }[] = [];
  for (const skill of ordered) {
    const nameScore = Math.max(
      fuzzyScore(query, skill.name || ""),
      fuzzyScore(query, skill.installName || ""),
    );
    const score = Math.max(
      nameScore,
      fuzzyScore(query, skill.description || ""),
      fuzzyScore(query, skill.sourcePath),
      fuzzyScore(query, skill.sourceName || ""),
    );
    if (score > 0) {
      filtered.push({ skill, score, nameScore });
    }
  }

  filtered.sort((a, b) => {
    if (b.nameScore !== a.nameScore) return b.nameScore - a.nameScore;
    if (b.score !== a.score) return b.score - a.score;
    return compareByName(a.skill, b.skill);
  });

  return filtered.map((entry) => entry.skill);
}
