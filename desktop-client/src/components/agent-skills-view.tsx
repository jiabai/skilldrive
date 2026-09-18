import { useEffect, useMemo, useState } from "react"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  PageIntro
} from "@/components/ui-primitives"
import { useI18n } from "@/i18n/use-i18n"
import type {
  AgentDetectionSnapshot,
  AgentId,
  LocalSkillInventoryRow,
  LocalSkillsInventorySnapshot
} from "@/types"

type DirectoryStatus = "ok" | "empty" | "missing"

type AgentSkillEntry = {
  agentId: AgentId
  displayName: string
  targetPaths: string[]
  rows: LocalSkillInventoryRow[]
  validCount: number
  status: DirectoryStatus
  sharedDisplayNames: string[]
}

type AgentSkillsViewProps = {
  detectionSnapshot: AgentDetectionSnapshot | null
  inventorySnapshot: LocalSkillsInventorySnapshot | null
  selectedAgentId: AgentId | null
  bridgeAvailable: boolean
  configurationReady: boolean
  isRefreshing: boolean
  deletingRowKey: string | null
  onSelectAgent: (agentId: AgentId) => void
  onBackToList: () => void
  onRefresh: () => void
  onOpenFolder: (row: LocalSkillInventoryRow) => void
  onDelete: (row: LocalSkillInventoryRow) => void
}

function buildEntries(
  detectionSnapshot: AgentDetectionSnapshot | null,
  inventorySnapshot: LocalSkillsInventorySnapshot | null
): AgentSkillEntry[] {
  if (!detectionSnapshot) {
    return []
  }

  const rows = inventorySnapshot?.rows ?? []

  return detectionSnapshot.agentStatuses
    .filter((status) => status.installed)
    .map((status) => {
      const matchedRows = rows.filter((row) => row.sourceAgents.includes(status.agentId))
      const validCount = matchedRows.filter((row) => row.validationState === "valid").length
      const sharedDisplayNames = [
        ...new Set(matchedRows.flatMap((row) => row.sourceDisplayNames))
      ].filter((name) => name !== status.displayName)

      const directoryStatus: DirectoryStatus =
        validCount > 0 ? "ok" : status.targetPaths.length === 0 ? "missing" : "empty"

      return {
        agentId: status.agentId,
        displayName: status.displayName,
        targetPaths: status.targetPaths,
        rows: matchedRows,
        validCount,
        status: directoryStatus,
        sharedDisplayNames
      }
    })
    .sort((left, right) => right.validCount - left.validCount || left.displayName.localeCompare(right.displayName))
}

function directoryName(row: LocalSkillInventoryRow): string {
  return row.packageRootPath.split(/[\\/]/).filter(Boolean).at(-1) ?? row.packageRootPath
}

function rowDisplayName(row: LocalSkillInventoryRow): string {
  return row.name ?? directoryName(row)
}

function otherSharedAgentNames(row: LocalSkillInventoryRow, selfDisplayName: string): string[] {
  return row.sourceDisplayNames.filter((name) => name !== selfDisplayName)
}

function directoryStatusTone(status: DirectoryStatus) {
  if (status === "ok") return "success" as const
  if (status === "empty") return "warning" as const
  return "neutral" as const
}

export function AgentSkillsView({
  detectionSnapshot,
  inventorySnapshot,
  selectedAgentId,
  bridgeAvailable,
  configurationReady,
  isRefreshing,
  deletingRowKey,
  onSelectAgent,
  onBackToList,
  onRefresh,
  onOpenFolder,
  onDelete
}: AgentSkillsViewProps) {
  const { dictionary } = useI18n()
  const copy = dictionary.agentSkillsView

  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null)
  const [pendingDeleteRow, setPendingDeleteRow] = useState<LocalSkillInventoryRow | null>(null)

  const entries = useMemo(
    () => buildEntries(detectionSnapshot, inventorySnapshot),
    [detectionSnapshot, inventorySnapshot]
  )

  const selectedEntry = selectedAgentId
    ? entries.find((entry) => entry.agentId === selectedAgentId) ?? null
    : null

  const deleteInFlight = deletingRowKey !== null
  const rowActionsDisabled = !bridgeAvailable || deleteInFlight

  useEffect(() => {
    if (!expandedRowKey) {
      return
    }

    const stillExists = selectedEntry?.rows.some((row) => row.rowKey === expandedRowKey) ?? false

    if (!stillExists) {
      setExpandedRowKey(null)
    }
  }, [expandedRowKey, selectedEntry])

  const handleToggleExpanded = (rowKey: string) => {
    setExpandedRowKey((current) => (current === rowKey ? null : rowKey))
  }

  const handleRequestDelete = (row: LocalSkillInventoryRow) => {
    setPendingDeleteRow(row)
  }

  const handleConfirmDelete = () => {
    if (!pendingDeleteRow) return
    onDelete(pendingDeleteRow)
    setPendingDeleteRow(null)
  }

  const handleCancelDelete = () => {
    setPendingDeleteRow(null)
  }

  const refreshButton = (
    <Button variant="secondary" disabled={isRefreshing} onClick={onRefresh}>
      {isRefreshing ? copy.refreshing : copy.refresh}
    </Button>
  )

  if (selectedEntry) {
    const pendingDeleteSharedNames = pendingDeleteRow
      ? otherSharedAgentNames(pendingDeleteRow, selectedEntry.displayName)
      : []

    return (
      <section className="page-stack" aria-label={copy.detailLabel(selectedEntry.displayName)}>
        <PageIntro
          eyebrow={copy.eyebrow}
          title={copy.detailLabel(selectedEntry.displayName)}
          summary={selectedEntry.targetPaths.join(", ") || copy.noSnapshot}
          actions={
            <>
              <Button variant="outline" onClick={onBackToList}>
                {copy.back}
              </Button>
              {refreshButton}
            </>
          }
        />

        <Card aria-labelledby="agent-skills-detail-heading">
          <CardHeader>
            <CardTitle id="agent-skills-detail-heading">
              {copy.detailLabel(selectedEntry.displayName)}
            </CardTitle>
            <CardDescription>{copy.skillCount(selectedEntry.validCount)}</CardDescription>
          </CardHeader>

          <CardContent>
            {selectedEntry.targetPaths.length > 0 ? (
              <p className="card__description mono">
                {copy.targetPath(selectedEntry.targetPaths.join(", "))}
              </p>
            ) : null}

            {selectedEntry.sharedDisplayNames.length > 0 ? (
              <p className="card__description muted">
                {copy.sharedWith(selectedEntry.sharedDisplayNames.join(", "))}
              </p>
            ) : null}

            {selectedEntry.rows.length === 0 ? <div className="callout">{copy.emptySkills}</div> : null}

            {selectedEntry.rows.length > 0 && selectedEntry.validCount === 0 ? (
              <div className="callout callout--warning">{copy.noValidSkills}</div>
            ) : null}

            {selectedEntry.rows.length > 0 ? (
              <div className="stack-list">
                {selectedEntry.rows.map((row) => {
                  const isExpanded = expandedRowKey === row.rowKey
                  const isRowDeleting = deletingRowKey === row.rowKey
                  const sharedAgentNames = otherSharedAgentNames(row, selectedEntry.displayName)

                  return (
                    <article className="update-item" key={row.rowKey}>
                      <div className="update-item__header">
                        <div>
                          <h3>{rowDisplayName(row)}</h3>
                        </div>
                        <div className="update-item__actions">
                          <Badge tone={row.validationState === "valid" ? "success" : "warning"}>
                            {copy.validationStateLabels[row.validationState]}
                          </Badge>
                          <Button size="sm" variant="secondary" onClick={() => onOpenFolder(row)}>
                            {copy.openFolder}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            aria-expanded={isExpanded}
                            disabled={rowActionsDisabled}
                            onClick={() => handleToggleExpanded(row.rowKey)}
                          >
                            {isExpanded ? copy.showLess : copy.showMore}
                          </Button>
                        </div>
                      </div>

                      {isExpanded ? (
                        <div className="update-item__expanded-actions">
                          {sharedAgentNames.length > 0 ? (
                            <span className="update-item__expanded-note">
                              {copy.sharedWith(sharedAgentNames.join(", "))}
                            </span>
                          ) : null}
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={deleteInFlight}
                            onClick={() => handleRequestDelete(row)}
                          >
                            {isRowDeleting ? copy.deleting : copy.delete}
                          </Button>
                        </div>
                      ) : null}

                      <p className="card__description muted">{row.description ?? copy.noDescription}</p>
                      <p className="card__description mono">{row.packageRootPath}</p>
                      <div className="update-item__meta">
                        <Badge tone="neutral">
                          {copy.localVersionLabel}: {row.localVersion ?? copy.noVersion}
                        </Badge>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {pendingDeleteRow ? (
          <Dialog
            open={true}
            size="narrow"
            onClose={handleCancelDelete}
            title={copy.deleteConfirmTitle}
            description={copy.deleteConfirmDescription(rowDisplayName(pendingDeleteRow))}
            closeLabel={dictionary.common.close}
            footer={
              <div className="dialog-actions">
                <Button variant="outline" onClick={handleCancelDelete}>
                  {dictionary.common.cancel}
                </Button>
                <Button variant="destructive" onClick={handleConfirmDelete}>
                  {copy.deleteConfirmButton}
                </Button>
              </div>
            }
          >
            <div className="callout callout--warning" role="alert">
              <span>{copy.deleteConfirmWarning}</span>
              <ul className="dialog-path-list">
                <li>
                  <code>{pendingDeleteRow.packageRootPath}</code>
                </li>
              </ul>
            </div>

            {pendingDeleteSharedNames.length > 0 ? (
              <div className="callout">
                {copy.deleteConfirmSharedNotice(pendingDeleteSharedNames.join(", "))}
              </div>
            ) : null}
          </Dialog>
        ) : null}
      </section>
    )
  }

  return (
    <section className="page-stack" aria-label={copy.title}>
      <PageIntro
        eyebrow={copy.eyebrow}
        title={copy.title}
        summary={copy.summary}
        actions={refreshButton}
      />

      {!bridgeAvailable ? (
        <div className="callout callout--error" role="alert">
          {dictionary.appShell.bridgeStatus.unavailable}
        </div>
      ) : null}

      {bridgeAvailable && !configurationReady ? (
        <div className="callout callout--warning">{dictionary.homeView.tokenNeededDetail}</div>
      ) : null}

      <Card aria-labelledby="agent-skills-list-heading">
        <CardHeader>
          <CardTitle id="agent-skills-list-heading">{copy.title}</CardTitle>
          <CardDescription>{copy.agentCount(entries.length)}</CardDescription>
        </CardHeader>

        <CardContent>
          {isRefreshing && !detectionSnapshot ? <div className="callout">{copy.loading}</div> : null}
          {!isRefreshing && !detectionSnapshot ? <div className="callout">{copy.noSnapshot}</div> : null}
          {detectionSnapshot && entries.length === 0 ? <div className="callout">{copy.noAgents}</div> : null}

          {entries.length > 0 ? (
            <div className="stack-list">
              {entries.map((entry) => (
                <article className="update-item" key={entry.agentId}>
                  <div className="update-item__header">
                    <div>
                      <h3>{entry.displayName}</h3>
                    </div>
                    <div className="update-item__actions">
                      <Badge tone={directoryStatusTone(entry.status)}>
                        {copy.directoryStatusLabels[entry.status]}
                      </Badge>
                      <Badge tone="neutral">{copy.skillCount(entry.validCount)}</Badge>
                      <Button size="sm" variant="outline" onClick={() => onSelectAgent(entry.agentId)}>
                        {copy.inspect(entry.displayName)}
                      </Button>
                    </div>
                  </div>

                  {entry.targetPaths.length > 0 ? (
                    <p className="card__description mono">{copy.targetPath(entry.targetPaths.join(", "))}</p>
                  ) : null}

                  {entry.sharedDisplayNames.length > 0 ? (
                    <p className="card__description muted">
                      {copy.sharedWith(entry.sharedDisplayNames.join(", "))}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  )
}
