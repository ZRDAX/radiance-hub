import { ReactNode } from 'react'
import { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DashboardCardProps {
    title: string
    description: string
    icon: LucideIcon
    actionLabel: string
    onActionClick?: () => void
    onClick?: () => void
    badge?: ReactNode
    disabled?: boolean
}

export default function DashboardCard({
    title,
    description,
    icon: Icon,
    actionLabel,
    onActionClick,
    onClick,
    badge,
    disabled = false
}: DashboardCardProps) {
    return (
        <article
            className="group flex min-h-44 flex-col justify-between rounded-2xl border border-white/10 bg-white/6 p-5 shadow-lg shadow-black/25 backdrop-blur-xl transition-transform duration-200 hover:-translate-y-1 hover:bg-white/10"
            onClick={disabled ? undefined : onClick}
            role={onClick ? 'button' : undefined}
            aria-disabled={disabled || undefined}
            tabIndex={onClick && !disabled ? 0 : -1}
            onKeyDown={(event) => {
                if (!onClick || disabled) {
                    return
                }
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onClick()
                }
            }}
        >
            <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-100">
                        <Icon className="h-5 w-5" />
                    </span>
                    {badge ? (
                        <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-xs text-slate-200">
                            {badge}
                        </span>
                    ) : null}
                </div>
                <div className="space-y-1">
                    <h3 className="text-base font-semibold text-slate-100">
                        {title}
                    </h3>
                    <p className="text-sm text-slate-300">{description}</p>
                </div>
            </div>
            <div className="mt-4">
                <Button
                    variant="outline"
                    className="w-full border-white/20 bg-white/8 text-slate-100 hover:bg-white/15"
                    onClick={(event) => {
                        event.stopPropagation()
                        onActionClick?.()
                    }}
                    disabled={disabled}
                >
                    {actionLabel}
                </Button>
            </div>
        </article>
    )
}
