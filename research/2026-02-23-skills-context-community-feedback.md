# Skills Context Limits (Community Feedback)

## Summary

Community reports across Reddit and forums are inconsistent on hard limits but
consistent on one point: too many discoverable skills can hurt context economy.
People commonly report practical ceilings in the dozens to low hundreds unless
metadata is aggressively constrained.

## Key Findings

- Codex users report very high baseline context when many skills are discoverable.
  One report says ~650 skills consumed about 95% of context before user input.
- Other Codex community replies say metadata (name/description/path) is loaded
  broadly, while full `SKILL.md` content is loaded on invocation.
- Claude community posts frequently mention practical issues beyond ~80-150
  discoverable skills, with some users observing skills becoming hidden.
- Another Claude community thread claims a description-budget behavior around
  ~15k characters total for skill descriptions before visibility/selection degrades.
- Counterexample: some users report running 600+ skills without major issues,
  arguing lazy loading keeps full instructions out of baseline context.
- Cursor forum users report context waste from duplicate skill loading and from
  large always-loaded instruction files (AGENTS/rules), increasing first-turn
  token usage.

## Sources

- https://www.reddit.com/r/OpenAI/comments/1mjkfi7/codex_skills_in_initial_context/
- https://www.reddit.com/r/OpenAI/comments/1mjkhcz/is_it_true_that_codex_loads_all_skill_instructions/
- https://www.reddit.com/r/OpenAI/comments/1ku2b3i/1000_curated_openai_codex_skills/
- https://www.reddit.com/r/ClaudeAI/comments/1n58vs3/how_many_skills_is_too_many/
- https://www.reddit.com/r/ClaudeAI/comments/1n7a39n/15000_char_budget_for_skill_descriptions_in/
- https://forum.cursor.com/t/critical-issue-duplicate-skills-loading-causing-context-window-waste-and-confusion/150137
- https://forum.cursor.com/t/agents-md-and-rule-files-included-in-context-even-if-unnecessary/97707
- https://forum.cursor.com/t/why-does-cursor-load-so-many-tokens-in-context-for-a-simple-first-prompt/118708
