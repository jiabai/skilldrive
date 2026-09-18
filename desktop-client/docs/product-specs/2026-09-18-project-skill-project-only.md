# Project Detail Scope Becomes Project Only

Status: approved on 2026-09-18

## Purpose

The Projects detail view currently merges two sources into one skill list:

- skills found inside the selected project folder
- global skills whose package root lives under `~/.agents/skills`

The merge was defined by `2026-05-07-project-skill-loading.md`. Operator feedback
on 2026-09-18 says the merged list is confusing: a row that looks like part of a
project can actually be a global skill, and the list stops answering the question
the operator is asking, which is "what skills does this project own".

This change makes the project detail view project-scoped only. Global skills stay
fully available in the Local Skills view; they simply stop appearing inside a
project detail list.

## Goals

- Project detail shows only skill rows discovered under the selected project
  root.
- Remove the `~/.agents/skills` global row merge from the project scan.
- Remove the now-unused global source concept from project scan types and copy.
- Stop the project scan from refreshing the global local skills inventory, since
  the result is no longer part of the project snapshot.
- Keep the project-level scan target set unchanged, including `.agents/skills`.
- Keep scan behavior otherwise identical: same target resolution, same identity
  rules, same validation states, same ordering inside project rows.

## Non-Goals

- No change to Local Skills inventory, upload, delete, or refresh workflows.
- No change to import behavior, import target selection, overwrite rules, or path
  safety checks.
- No change to the catalog project target list. `.agents/skills` remains a
  project-level target because Cline, Codex, and Warp write there, and OpenCode
  reads there.
- No change to project storage, `config/projects.json`, or IPC channel names.
- No new filtering or grouping UI inside the project detail list.
- No change to the Agent Skills view.

## Affected Surfaces

- Project skill scan service and its input contract.
- Shared project scan types.
- Electron main process project scan handler.
- Projects detail renderer row badge and i18n copy.
- Project scan unit tests and renderer tests.
- Desktop-client architecture, reference, and design documents.
- The 2026-05-07 project skill loading spec and design doc, which must be marked
  as superseded on this one point.

## User Experience

### Project Detail Skill List

Opening a project scans the project folder and lists only project rows. Each row
keeps:

- resolved skill identity
- local version when available
- description when available
- source badge
- contributing agent display names
- project-relative path in monospace
- validation state and validation message

Rules:

- Every row's path is project-relative.
- No row can originate from a home-directory skill target.
- A global skill with the same identity no longer suppresses, replaces, or joins
  a project row, because global rows are gone entirely.
- The empty state still appears when the project has no project-level skills,
  even if the operator has many global skills.

### Source Badge

The scan has exactly one source, so the badge stays visible for scan readability
and shows the project label. The global label is removed from all three i18n
message files.

## Acceptance Criteria

- A project whose folder contains no skills renders zero rows, regardless of how
  many skills exist under `~/.agents/skills`.
- A project containing a skill at `.claude/skills/<identity>` shows exactly one
  row for that skill.
- A project containing `.agents/skills/<identity>` still shows that row, and the
  shared target is still deduped across Cline, Codex, Warp, and OpenCode.
- `ProjectSkillRow` no longer carries a global variant, and `relativePath` is no
  longer nullable.
- The project scan no longer reads or receives a global local skills snapshot.
- `npm test` passes for the desktop client.
- `npm run build` passes for the desktop client.
- `python scripts/validate_agents_docs.py --level ERROR` passes.
- Documentation that described the merge is updated, and the superseded spec
  states the new scope.

## Documentation And Execution Gates

Before implementation starts, this spec must be paired with:

- `desktop-client/docs/design-docs/project-skill-loading.md`
- `desktop-client/docs/exec-plans/active/2026-09-18-project-skill-project-only.md`

Implementation completion must satisfy the desktop client and documentation gates
in `../../docs/EXECUTION_GATES.md`:

```bash
cd desktop-client && npm test
cd desktop-client && npm run build
python scripts/validate_agents_docs.py --level ERROR
git diff --check
```
