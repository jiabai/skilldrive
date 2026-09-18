import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AgentSkillsView } from "@/components/agent-skills-view"
import { defaultDictionary } from "@/i18n/get-dictionary"
import type {
  AgentDetectionSnapshot,
  AgentId,
  AgentInstallStatus,
  LocalSkillInventoryRow,
  LocalSkillsInventorySnapshot
} from "@/types"

const copy = defaultDictionary.agentSkillsView

type StatusOverrides = Partial<AgentInstallStatus> & {
  agentId: AgentId
  displayName: string
  installed?: boolean
}

function makeStatus({ agentId, displayName, installed = true, ...overrides }: StatusOverrides): AgentInstallStatus {
  return {
    agentId,
    displayName,
    installed,
    source: "detected",
    detectionDirs: [],
    targetPaths: [],
    compatibleReadPaths: [],
    reason: null,
    ...overrides
  }
}

function makeDetection(statuses: AgentInstallStatus[]): AgentDetectionSnapshot {
  return {
    checkedAt: "2026-01-01T00:00:00.000Z",
    supportedAgentCount: statuses.length,
    installedAgentIds: statuses.filter((status) => status.installed).map((status) => status.agentId),
    agentStatuses: statuses,
    uniqueTargets: []
  }
}

type RowOverrides = Partial<LocalSkillInventoryRow> & {
  rowKey: string
  packageRootPath: string
}

function makeRow({ rowKey, packageRootPath, ...overrides }: RowOverrides): LocalSkillInventoryRow {
  return {
    rowKey,
    name: rowKey,
    description: null,
    localVersion: null,
    packageRootPath,
    sourceAgents: [],
    sourceDisplayNames: [],
    validationState: "valid",
    validationMessage: null,
    serverState: "unknown",
    remoteSkillId: null,
    remoteVersion: null,
    uploadable: true,
    ...overrides
  }
}

function makeInventory(rows: LocalSkillInventoryRow[]): LocalSkillsInventorySnapshot {
  return {
    checkedAt: "2026-01-01T00:00:00.000Z",
    rows,
    groupedRows: [],
    serverLookupStatus: "ok",
    serverLookupMessage: null
  }
}

const sharedRow = makeRow({
  rowKey: "shared-skill",
  packageRootPath: "/home/user/.agents/skills/shared-skill",
  sourceAgents: ["codex", "cline"],
  sourceDisplayNames: ["Codex", "Cline"]
})

const claudeRow = makeRow({
  rowKey: "claude-skill",
  packageRootPath: "/home/user/.claude/skills/claude-skill",
  description: "review helper",
  localVersion: "1.2.0",
  sourceAgents: ["claude-code"],
  sourceDisplayNames: ["Claude Code"]
})

const detection = makeDetection([
  makeStatus({
    agentId: "claude-code",
    displayName: "Claude Code",
    targetPaths: ["/home/user/.claude/skills"]
  }),
  makeStatus({
    agentId: "codex",
    displayName: "Codex",
    targetPaths: ["/home/user/.agents/skills"]
  }),
  makeStatus({
    agentId: "cline",
    displayName: "Cline",
    targetPaths: ["/home/user/.agents/skills"]
  }),
  makeStatus({
    agentId: "gemini-cli",
    displayName: "Gemini CLI",
    installed: false,
    targetPaths: []
  })
])

const inventory = makeInventory([claudeRow, sharedRow])

function renderView(selectedAgentId: AgentId | null = null) {
  const onSelectAgent = vi.fn()
  const onBackToList = vi.fn()
  render(
    <AgentSkillsView
      detectionSnapshot={detection}
      inventorySnapshot={inventory}
      selectedAgentId={selectedAgentId}
      bridgeAvailable={true}
      configurationReady={true}
      isRefreshing={false}
      onSelectAgent={onSelectAgent}
      onBackToList={onBackToList}
      onRefresh={vi.fn()}
      onOpenFolder={vi.fn()}
    />
  )
  return { onSelectAgent, onBackToList }
}

describe("AgentSkillsView agent list", () => {
  it("lists only installed agents", () => {
    renderView()

    expect(screen.getByText("Claude Code")).toBeTruthy()
    expect(screen.getByText("Codex")).toBeTruthy()
    expect(screen.queryByText("Gemini CLI")).toBeNull()
    expect(screen.getByText(copy.agentCount(3))).toBeTruthy()
  })

  it("sorts agents by valid skill count", () => {
    renderView()

    const headings = screen.getAllByRole("heading", { level: 3 }).map((node) => node.textContent)
    expect(headings[0]).toBe("Claude Code")
  })

  it("reports the shared directory on agents that write to the same path", () => {
    renderView()

    expect(screen.getByText(copy.sharedWith("Codex"))).toBeTruthy()
  })

  it("drills into an agent and shows only its skills", () => {
    renderView("claude-code")

    expect(screen.getByText("claude-skill")).toBeTruthy()
    expect(screen.queryByText("shared-skill")).toBeNull()
    expect(screen.getByText("/home/user/.claude/skills")).toBeTruthy()
    expect(screen.getByText(copy.skillCount(1))).toBeTruthy()
  })

  it("calls back when leaving the detail view", () => {
    const { onBackToList } = renderView("claude-code")

    fireEvent.click(screen.getByText(copy.back))

    expect(onBackToList).toHaveBeenCalledTimes(1)
  })

  it("calls back with the agent id when inspecting", () => {
    const { onSelectAgent } = renderView()

    fireEvent.click(screen.getByText(copy.inspect("Codex")))

    expect(onSelectAgent).toHaveBeenCalledWith("codex")
  })
})

describe("AgentSkillsView directory status", () => {
  it("marks an installed agent without a skill directory as missing", () => {
    render(
      <AgentSkillsView
        detectionSnapshot={makeDetection([
          makeStatus({ agentId: "copilot", displayName: "Copilot" })
        ])}
        inventorySnapshot={makeInventory([])}
        selectedAgentId={null}
        bridgeAvailable={true}
        configurationReady={true}
        isRefreshing={false}
        onSelectAgent={vi.fn()}
        onBackToList={vi.fn()}
        onRefresh={vi.fn()}
        onOpenFolder={vi.fn()}
      />
    )

    expect(screen.getByText(copy.directoryStatusLabels.missing)).toBeTruthy()
  })

  it("marks an agent whose directory has no valid package as empty", () => {
    const invalidRow = makeRow({
      rowKey: "broken",
      packageRootPath: "/home/user/.copilot/skills/broken",
      validationState: "invalid",
      sourceAgents: ["copilot"],
      sourceDisplayNames: ["Copilot"]
    })

    render(
      <AgentSkillsView
        detectionSnapshot={makeDetection([
          makeStatus({
            agentId: "copilot",
            displayName: "Copilot",
            targetPaths: ["/home/user/.copilot/skills"]
          })
        ])}
        inventorySnapshot={makeInventory([invalidRow])}
        selectedAgentId={null}
        bridgeAvailable={true}
        configurationReady={true}
        isRefreshing={false}
        onSelectAgent={vi.fn()}
        onBackToList={vi.fn()}
        onRefresh={vi.fn()}
        onOpenFolder={vi.fn()}
      />
    )

    expect(screen.getByText(copy.directoryStatusLabels.empty)).toBeTruthy()
  })
})
