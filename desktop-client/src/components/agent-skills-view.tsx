import { useMemo } from "react"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
  onSelectAgent: (agentId: AgentId) => void
  onBackToList: () => void
  onRefresh: () => void
  onOpenFolder: (row: LocalSkillInventoryRow) => void
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
  onSelectAgent,
  onBackToList,
  onRefresh,
  onOpenFolder
}: AgentSkillsViewProps) {
  const { dictionary } = useI18n()
  const copy = dictionary.agentSkillsView

  const entries = useMemo(
    () => buildEntries(detectionSnapshot, inventorySnapshot),
    [detectionSnapshot, inventorySnapshot]
  )

  const selectedEntry = selectedAgentId
    ? entries.find((entry) => entry.agentId === selectedAgentId) ?? null
    : null

  const refreshButton = (
    <Button variant="secondary" disabled={isRefreshing} onClick={onRefresh}>
      {isRefreshing ? copy.refreshing : copy.refresh}
    </Button>
  )

  if (selectedEntry) {
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
                {selectedEntry.rows.map((row) => (
                  <article className="update-item" key={row.rowKey}>
                    <div className="update-item__header">
                      <div>
                        <h3>{row.name ?? directoryName(row)}</h3>
                      </div>
                      <div className="update-item__actions">
                        <Badge tone={row.validationState === "valid" ? "success" : "warning"}>
                          {copy.validationStateLabels[row.validationState]}
                        </Badge>
                        <Button size="sm" variant="secondary" onClick={() => onOpenFolder(row)}>
                          {copy.openFolder}
                        </Button>
                      </div>
                    </div>
                    <p className="card__description muted">{row.description ?? copy.noDescription}</p>
                    <p className="card__description mono">{row.packageRootPath}</p>
                    <div className="update-item__meta">
                      <Badge tone="neutral">
                        {copy.localVersionLabel}: {row.localVersion ?? copy.noVersion}
                      </Badge>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
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
