import { fireEvent, render, screen, within } from "@testing-library/react"
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
const common = defaultDictionary.common

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

type RenderOptions = {
  selectedAgentId?: AgentId | null
  deletingRowKey?: string | null
  bridgeAvailable?: boolean
  detectionSnapshot?: AgentDetectionSnapshot
  inventorySnapshot?: LocalSkillsInventorySnapshot
}

function renderView(options: RenderOptions = {}) {
  const onSelectAgent = vi.fn()
  const onBackToList = vi.fn()
  const onDelete = vi.fn()

  const buildView = (overrides: RenderOptions = {}) => {
    const merged = { ...options, ...overrides }

    return (
      <AgentSkillsView
        detectionSnapshot={merged.detectionSnapshot ?? detection}
        inventorySnapshot={merged.inventorySnapshot ?? inventory}
        selectedAgentId={merged.selectedAgentId ?? null}
        bridgeAvailable={merged.bridgeAvailable ?? true}
        configurationReady={true}
        isRefreshing={false}
        deletingRowKey={merged.deletingRowKey ?? null}
        onSelectAgent={onSelectAgent}
        onBackToList={onBackToList}
        onRefresh={vi.fn()}
        onOpenFolder={vi.fn()}
        onDelete={onDelete}
      />
    )
  }

  const view = render(buildView())

  return {
    ...view,
    onSelectAgent,
    onBackToList,
    onDelete,
    rerenderWith: (overrides: RenderOptions) => view.rerender(buildView(overrides))
  }
}

function expandedActions(): HTMLElement {
  const node = document.querySelector(".update-item__expanded-actions")
  if (!node) {
    throw new Error("Expected an expanded row action area")
  }
  return node as HTMLElement
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
    renderView({ selectedAgentId: "claude-code" })

    expect(screen.getByText("claude-skill")).toBeTruthy()
    expect(screen.queryByText("shared-skill")).toBeNull()
    expect(screen.getByText("/home/user/.claude/skills")).toBeTruthy()
    expect(screen.getByText(copy.skillCount(1))).toBeTruthy()
  })

  it("calls back when leaving the detail view", () => {
    const { onBackToList } = renderView({ selectedAgentId: "claude-code" })

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
    renderView({
      detectionSnapshot: makeDetection([makeStatus({ agentId: "copilot", displayName: "Copilot" })]),
      inventorySnapshot: makeInventory([])
    })

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

    renderView({
      detectionSnapshot: makeDetection([
        makeStatus({
          agentId: "copilot",
          displayName: "Copilot",
          targetPaths: ["/home/user/.copilot/skills"]
        })
      ]),
      inventorySnapshot: makeInventory([invalidRow])
    })

    expect(screen.getByText(copy.directoryStatusLabels.empty)).toBeTruthy()
  })
})

describe("AgentSkillsView skill deletion", () => {
  it("keeps the delete action hidden until the row menu is expanded", () => {
    renderView({ selectedAgentId: "claude-code" })

    expect(screen.queryByText(copy.delete)).toBeNull()
    expect(screen.getByText(copy.showMore)).toBeTruthy()

    fireEvent.click(screen.getByText(copy.showMore))

    expect(screen.getByText(copy.delete)).toBeTruthy()
    expect(screen.getByText(copy.showLess)).toBeTruthy()
  })

  it("collapses the row when the menu button is pressed again", () => {
    renderView({ selectedAgentId: "claude-code" })

    fireEvent.click(screen.getByText(copy.showMore))
    expect(screen.getByText(copy.delete)).toBeTruthy()

    fireEvent.click(screen.getByText(copy.showLess))

    expect(screen.queryByText(copy.delete)).toBeNull()
  })

  it("keeps only one row expanded at a time", () => {
    const multiDetection = makeDetection([
      makeStatus({
        agentId: "codex",
        displayName: "Codex",
        targetPaths: ["/home/user/.agents/skills"]
      })
    ])
    const multiInventory = makeInventory([
      makeRow({
        rowKey: "alpha",
        packageRootPath: "/home/user/.agents/skills/alpha",
        sourceAgents: ["codex"],
        sourceDisplayNames: ["Codex"]
      }),
      makeRow({
        rowKey: "beta",
        packageRootPath: "/home/user/.agents/skills/beta",
        sourceAgents: ["codex"],
        sourceDisplayNames: ["Codex"]
      })
    ])

    renderView({
      selectedAgentId: "codex",
      detectionSnapshot: multiDetection,
      inventorySnapshot: multiInventory
    })

    fireEvent.click(screen.getAllByText(copy.showMore)[0])
    expect(screen.getAllByText(copy.delete)).toHaveLength(1)

    fireEvent.click(screen.getAllByText(copy.showMore)[0])

    expect(screen.getAllByText(copy.delete)).toHaveLength(1)
    expect(screen.getAllByText(copy.showLess)).toHaveLength(1)
  })

  it("shows the shared agents inside the expanded row", () => {
    renderView({ selectedAgentId: "codex" })

    fireEvent.click(screen.getByText(copy.showMore))

    expect(within(expandedActions()).getByText(copy.sharedWith("Cline"))).toBeTruthy()
  })

  it("opens a confirmation dialog that names the skill and lists the exact path", () => {
    renderView({ selectedAgentId: "claude-code" })

    fireEvent.click(screen.getByText(copy.showMore))
    fireEvent.click(screen.getByText(copy.delete))

    const dialog = screen.getByRole("dialog")

    expect(within(dialog).getByText(copy.deleteConfirmDescription("claude-skill"))).toBeTruthy()
    expect(within(dialog).getByText("/home/user/.claude/skills/claude-skill")).toBeTruthy()
  })

  it("omits the shared notice when the directory belongs to a single agent", () => {
    renderView({ selectedAgentId: "claude-code" })

    fireEvent.click(screen.getByText(copy.showMore))
    fireEvent.click(screen.getByText(copy.delete))

    const dialog = screen.getByRole("dialog")

    expect(dialog.querySelectorAll(".callout")).toHaveLength(1)
    expect(within(dialog).queryByText(copy.deleteConfirmSharedNotice("Codex"))).toBeNull()
    expect(within(dialog).queryByText(copy.deleteConfirmSharedNotice("Cline"))).toBeNull()
  })

  it("lists the other affected agents when the directory is shared", () => {
    renderView({ selectedAgentId: "codex" })

    fireEvent.click(screen.getByText(copy.showMore))
    fireEvent.click(screen.getByText(copy.delete))

    const dialog = screen.getByRole("dialog")

    expect(within(dialog).getByText(copy.deleteConfirmSharedNotice("Cline"))).toBeTruthy()
    expect(dialog.querySelectorAll(".callout")).toHaveLength(2)
  })

  it("passes only the clicked row to onDelete so sibling copies survive", () => {
    const { onDelete } = renderView({ selectedAgentId: "claude-code" })

    fireEvent.click(screen.getByText(copy.showMore))
    fireEvent.click(screen.getByText(copy.delete))
    fireEvent.click(within(screen.getByRole("dialog")).getByText(copy.deleteConfirmButton))

    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onDelete.mock.calls[0]).toHaveLength(1)
    expect(onDelete.mock.calls[0][0]).toBe(claudeRow)
  })

  it("does not delete when the dialog is cancelled", () => {
    const { onDelete } = renderView({ selectedAgentId: "claude-code" })

    fireEvent.click(screen.getByText(copy.showMore))
    fireEvent.click(screen.getByText(copy.delete))
    fireEvent.click(within(screen.getByRole("dialog")).getByText(common.cancel))

    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("marks the row being deleted as busy and blocks further row actions", () => {
    const { rerenderWith } = renderView({ selectedAgentId: "claude-code" })

    fireEvent.click(screen.getByText(copy.showMore))
    rerenderWith({ deletingRowKey: "claude-skill" })

    expect(screen.getByText(copy.deleting)).toBeTruthy()
    expect((screen.getByText(copy.showLess) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByText(copy.deleting) as HTMLButtonElement).disabled).toBe(true)
  })

  it("disables the row menu when the desktop bridge is unavailable", () => {
    renderView({ selectedAgentId: "claude-code", bridgeAvailable: false })

    expect((screen.getByText(copy.showMore) as HTMLButtonElement).disabled).toBe(true)
  })
})
