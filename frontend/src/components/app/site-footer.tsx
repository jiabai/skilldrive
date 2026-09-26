import { cn } from "@/lib/utils"

/**
 * 工信部 ICP 备案信息，需在站点底部展示并链接至工信部备案系统。
 * 备案号属于法定的语言无关信息，因此不进入 i18n 词典。
 */
export const ICP_FILING_NUMBER = "京ICP备2025130312号-2"
export const ICP_FILING_URL = "https://beian.miit.gov.cn/"

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "relative z-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground",
        className
      )}
    >
      <a
        href={ICP_FILING_URL}
        target="_blank"
        rel="noreferrer noopener"
        className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {ICP_FILING_NUMBER}
      </a>
    </footer>
  )
}
