import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, normalize } from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import type { AgentPathDefinition } from "@/adapters/agents/definitions"
import { createProjectSkillScanService } from "@/core/projects/project-skill-scan-service"
import type { ProjectEntry } from "@/types"

const definitions: AgentPathDefinition[] = [
  {
    id: "claude-code",
    displayName: "Claude Code",
    detectionDirs: [],
    defaultTargets: [],
    pathResolution: "all-owned",
    projectTargets: [{ path: ".claude/skills", role: "primary" }]
  },
  {
    id: "codex",
    displayName: "Codex",
    detectionDirs: [],
    defaultTargets: [],
    pathResolution: "all-owned",
    projectTargets: [{ path: ".agents/skills", role: "primary", sharedPathKey: "agents-universal" }]
  },
  {
    id: "cursor",
    displayName: "Cursor",
    detectionDirs: [],
    defaultTargets: [],
    pathResolution: "all-owned",
    projectTargets: [{ path: ".agents/skills", role: "compatible-read", sharedPathKey: "agents-universal" }]
  }
]

function writeSkill(root: string, markdown: string): void {
  mkdirSync(root, { recursive: true })
  writeFileSync(join(root, "SKILL.md"), markdown, "utf8")
}

describe("project skill scan service", () => {
  const tempRoots: string[] = []

  afterEach(() => {
    while (tempRoots.length > 0) {
      const root = tempRoots.pop()

      if (root) {
        rmSync(root, { recursive: true, force: true })
      }
    }
  })

  function createProject(): ProjectEntry {
    const root = mkdtempSync(join(tmpdir(), "skilldrive-project-scan-"))
    tempRoots.push(root)

    return {
      id: "project-1",
      name: "Example",
      path: root,
      addedAt: "2026-05-07T00:00:00.000Z",
      updatedAt: "2026-05-07T00:00:00.000Z"
    }
  }

  it("scans project skill rows without merging global rows", async () => {
    const project = createProject()
    writeSkill(
      join(project.path, ".claude", "skills", "project-skill"),
      "---\nname: Project Skill\nslug: project-skill\nversion: 2.0.0\ndescription: Project scoped skill\n---\n"
    )
    writeSkill(
      join(project.path, ".agents", "skills", "invalid name"),
      "---\nname: Invalid Name With Spaces\n---\n"
    )
    const service = createProjectSkillScanService({
      definitions,
      now: () => new Date("2026-05-07T01:00:00.000Z"),
      platform: "win32"
    })

    const snapshot = await service.scan({ project })

    expect(snapshot.checkedAt).toBe("2026-05-07T01:00:00.000Z")
    expect(snapshot.targets).toHaveLength(2)
    expect(snapshot.rows.map((row) => `${row.source}:${row.identity ?? "null"}`)).toEqual([
      "project:project-skill",
      "project:null"
    ])
    expect(snapshot.rows[0]).toEqual(
      expect.objectContaining({
        identity: "project-skill",
        version: "2.0.0",
        description: "Project scoped skill",
        source: "project",
        sourceDisplayNames: ["Claude Code"],
        relativePath: normalize(".claude/skills/project-skill"),
        validationState: "valid"
      })
    )
    expect(snapshot.rows[1]).toEqual(
      expect.objectContaining({
        identity: null,
        source: "project",
        relativePath: normalize(".agents/skills/invalid name"),
        validationState: "invalid-skill-name"
      })
    )
  })

  it("reports unreadable target scan errors without failing the whole scan", async () => {
    const project = {
      ...createProject(),
      path: join(tmpdir(), "missing-project-root-for-scan")
    }
    const service = createProjectSkillScanService({
      definitions,
      now: () => new Date("2026-05-07T01:00:00.000Z")
    })

    const snapshot = await service.scan({ project })

    expect(snapshot.rows).toEqual([])
    expect(snapshot.errors.length).toBeGreaterThan(0)
  })

  it("scans categorized project skill roots", async () => {
    const project = createProject()
    const categorizedDefinitions: AgentPathDefinition[] = [
      {
        ...definitions[0],
        projectTargets: [
          {
            path: ".hermes/skills",
            role: "primary",
            skillLayout: {
              mode: "categorized",
              categoryDepth: 1,
              defaultCategory: "general",
              categorySource: "agent-default"
            }
          }
        ]
      }
    ]
    writeSkill(
      join(project.path, ".hermes", "skills", "tools", "project-tool"),
      "---\nname: Project Tool\nslug: project-tool\nversion: 3.0.0\n---\n"
    )
    mkdirSync(join(project.path, ".hermes", "skills", "empty-category"), { recursive: true })
    const service = createProjectSkillScanService({
      definitions: categorizedDefinitions,
      now: () => new Date("2026-05-07T01:00:00.000Z")
    })

    const snapshot = await service.scan({ project })

    expect(snapshot.rows).toHaveLength(1)
    expect(snapshot.rows[0]).toMatchObject({
      identity: "project-tool",
      version: "3.0.0",
      relativePath: join(".hermes", "skills", "tools", "project-tool"),
      validationState: "valid"
    })
  })
})
