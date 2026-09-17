import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { LocalSkillsView } from "@/components/local-skills-view"
import { defaultDictionary } from "@/i18n/get-dictionary"
import type {
  LocalSkillGroupRow,
  LocalSkillInventoryRow,
  LocalSkillsInventorySnapshot
} from "@/types"

const copy = defaultDictionary.localSkillsView

type RowOverrides = Partial<LocalSkillInventoryRow> & { rowKey: string; packageRootPath: string }

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

function makeGroup(row: LocalSkillInventoryRow): LocalSkillGroupRow {
  return {
    groupKey: row.rowKey,
    name: row.name ?? row.rowKey,
    items: [row],
    primary: row,
    sourceDisplayNames: [...row.sourceDisplayNames],
    pathCount: 1,
    uploadable: row.uploadable,
    hasVersionConflict: false
  }
}

function makeSnapshot(rows: LocalSkillInventoryRow[]): LocalSkillsInventorySnapshot {
  return {
    checkedAt: "2026-01-01T00:00:00.000Z",
    rows,
    groupedRows: rows.map(makeGroup),
    serverLookupStatus: "ok",
    serverLookupMessage: null
  }
}

function renderView(snapshot: LocalSkillsInventorySnapshot) {
  render(
    <LocalSkillsView
      snapshot={snapshot}
      bridgeAvailable={true}
      configurationReady={true}
      isRefreshing={false}
      uploadingRowKey={null}
      deletingRowKey={null}
      onRefresh={vi.fn()}
      onUpload={vi.fn()}
      onDelete={vi.fn()}
      onOpenFolder={vi.fn()}
    />
  )
  return screen.getByLabelText(copy.searchLabel) as HTMLInputElement
}

const alpha = makeRow({ rowKey: "alpha", packageRootPath: "/skills/alpha" })
const beta = makeRow({
  rowKey: "beta",
  packageRootPath: "/skills/beta",
  description: "deploy helper"
})
const gamma = makeRow({ rowKey: "gamma", packageRootPath: "/skills/gamma" })

describe("LocalSkillsView search", () => {
  it("filters the grouped list by name, case insensitively", () => {
    const input = renderView(makeSnapshot([alpha, beta, gamma]))

    fireEvent.change(input, { target: { value: "ALPHA" } })

    expect(screen.getByText("alpha")).toBeTruthy()
    expect(screen.queryByText("beta")).toBeNull()
    expect(screen.queryByText("gamma")).toBeNull()
  })

  it("matches against the package path", () => {
    const input = renderView(makeSnapshot([alpha, beta, gamma]))

    fireEvent.change(input, { target: { value: "/skills/gamma" } })

    expect(screen.getByText("gamma")).toBeTruthy()
    expect(screen.queryByText("alpha")).toBeNull()
  })

  it("matches against the description", () => {
    const input = renderView(makeSnapshot([alpha, beta, gamma]))

    fireEvent.change(input, { target: { value: "deploy" } })

    expect(screen.getByText("beta")).toBeTruthy()
    expect(screen.queryByText("alpha")).toBeNull()
  })

  it("reports the filtered count and shows an empty state when nothing matches", () => {
    const input = renderView(makeSnapshot([alpha, beta, gamma]))

    fireEvent.change(input, { target: { value: "beta" } })
    expect(screen.getByText(copy.filteredCount(1, 3))).toBeTruthy()

    fireEvent.change(input, { target: { value: "zzz" } })
    expect(screen.getByText(copy.noMatch("zzz"))).toBeTruthy()
    expect(screen.queryByText("alpha")).toBeNull()
  })

  it("restores the full list when the search is cleared", () => {
    const input = renderView(makeSnapshot([alpha, beta, gamma]))

    fireEvent.change(input, { target: { value: "beta" } })
    expect(screen.queryByText("alpha")).toBeNull()

    fireEvent.click(screen.getByText(copy.clearSearch))

    expect(screen.getByText("alpha")).toBeTruthy()
    expect(screen.getByText("gamma")).toBeTruthy()
  })
})
