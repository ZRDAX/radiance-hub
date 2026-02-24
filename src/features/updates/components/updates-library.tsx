import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUpdates } from '@/features/updates/hooks/use-updates'
import { PackageManagerType, UpdateItemStatus } from '@/features/updates/types'
import { formatPackageManagerLabel } from '@/features/updates/lib/package-manager'

export default function UpdatesLibrary() {
    const {
        updates,
        pendingUpdatesCount,
        lastCheckedAt,
        itemStates,
        isLoadingList,
        isRunningBatch,
        listError,
        checkUpdates,
        runSingleUpdate,
        runSelectedUpdates
    } = useUpdates()

    const headerState = getHeaderState({
        hasError: Boolean(listError),
        pendingCount: pendingUpdatesCount,
        isChecking: isLoadingList
    })

    return (
        <section className="h-screen w-full overflow-hidden bg-transparent text-slate-100">
            <div className="mx-auto flex h-full w-full max-w-[420px] flex-col">
                <header className="border-b border-white/10 bg-black/10 px-4 py-3 backdrop-blur-md">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-cyan-500/15 text-cyan-200">
                                <RefreshCw className="h-4 w-4" />
                            </span>
                            <p className="text-sm font-semibold">UpdateHub</p>
                        </div>
                        <StatusPill status={headerState} />
                    </div>
                </header>

                <section className="border-b border-white/10 bg-black/5 px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                        <div className="space-y-1">
                            <p className="text-xs text-slate-300">
                                {pendingUpdatesCount} update(s) pending
                            </p>
                            <p className="text-xs text-slate-400">
                                Last check: {formatLastChecked(lastCheckedAt)}
                            </p>
                        </div>
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 border-cyan-200/25 bg-cyan-500/10 px-3 text-xs text-cyan-100 hover:bg-cyan-500/18"
                            onClick={() => void checkUpdates()}
                            disabled={isLoadingList || isRunningBatch}
                        >
                            {isLoadingList ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : null}
                            Check
                        </Button>
                    </div>
                </section>

                <main className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
                    {listError ? (
                        <div className="rounded-md border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                            {listError}
                        </div>
                    ) : null}

                    {!listError && updates.length === 0 && !isLoadingList ? (
                        <div className="px-2 py-8 text-center text-xs text-slate-400">
                            No pending updates.
                        </div>
                    ) : null}

                    <ul className="space-y-1.5">
                        {updates.map((item) => {
                            const state = itemStates[item.id] ?? { status: 'idle' as const }
                            const isExecuting = state.status === 'loading'

                            return (
                                <li
                                    key={item.id}
                                    className="rounded-md border border-white/10 bg-black/20 px-3 py-2.5 transition-colors hover:bg-black/25"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0 space-y-1">
                                            <p className="truncate text-sm font-medium text-slate-100">
                                                {item.name || item.id}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <p className="text-[11px] text-slate-300/85">
                                                    <span className="text-slate-400">
                                                        {item.installedVersion || 'unknown'}
                                                    </span>{' '}
                                                    <span className="text-slate-500">→</span>{' '}
                                                    <span className="text-cyan-100/90">
                                                        {item.availableVersion || 'unknown'}
                                                    </span>
                                                </p>
                                                <ManagerBadge
                                                    manager={item.packageManager}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <ItemState status={state.status} />
                                            <Button
                                                size="sm"
                                                className="h-7 bg-cyan-500/85 px-2 text-xs text-slate-950 hover:bg-cyan-400"
                                                onClick={() => void runSingleUpdate(item.id)}
                                                disabled={isExecuting || isRunningBatch}
                                            >
                                                {isExecuting ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : null}
                                                Update
                                            </Button>
                                        </div>
                                    </div>
                                </li>
                            )
                        })}
                    </ul>
                </main>

                <footer className="border-t border-white/10 px-4 py-3">
                    <Button
                        className="h-8 w-full bg-cyan-500/90 text-sm text-slate-950 hover:bg-cyan-400"
                        onClick={() => void runSelectedUpdates()}
                        disabled={updates.length === 0 || isRunningBatch || isLoadingList}
                    >
                        {isRunningBatch ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        Update All
                    </Button>
                </footer>
            </div>
        </section>
    )
}

function ItemState({ status }: { status: UpdateItemStatus }) {
    if (status === 'loading') {
        return (
            <span className="inline-flex items-center gap-1 text-[11px] text-amber-200">
                <Loader2 className="h-3 w-3 animate-spin" />
            </span>
        )
    }
    if (status === 'success') {
        return (
            <span className="inline-flex items-center rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-200">
                OK
            </span>
        )
    }
    if (status === 'error') {
        return (
            <span className="inline-flex items-center rounded-md bg-red-500/15 px-1.5 py-0.5 text-[10px] text-red-200">
                ERR
            </span>
        )
    }
    return null
}

function ManagerBadge({ manager }: { manager: PackageManagerType }) {
    const baseStyle =
        'inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] tracking-[0.02em]'

    if (manager === 'winget') {
        return (
            <span className={`${baseStyle} border-slate-300/20 bg-slate-400/10 text-slate-200`}>
                {formatPackageManagerLabel(manager)}
            </span>
        )
    }
    if (manager === 'chocolatey') {
        return (
            <span className={`${baseStyle} border-violet-300/20 bg-violet-400/10 text-violet-200`}>
                {formatPackageManagerLabel(manager)}
            </span>
        )
    }
    if (manager === 'manual') {
        return (
            <span className={`${baseStyle} border-amber-300/20 bg-amber-400/10 text-amber-200`}>
                {formatPackageManagerLabel(manager)}
            </span>
        )
    }
    return (
        <span className={`${baseStyle} border-slate-400/20 bg-slate-500/10 text-slate-300`}>
            {formatPackageManagerLabel(manager)}
        </span>
    )
}

function StatusPill({
    status
}: {
    status: 'healthy' | 'pending' | 'error' | 'checking'
}) {
    if (status === 'error') {
        return (
            <span className="inline-flex items-center gap-1 text-xs text-red-200">
                <AlertCircle className="h-3.5 w-3.5" />
                Error
            </span>
        )
    }
    if (status === 'pending') {
        return (
            <span className="inline-flex items-center gap-1 text-xs text-amber-200">
                <span className="h-2 w-2 rounded-full bg-amber-300" />
                Pending
            </span>
        )
    }
    if (status === 'checking') {
        return (
            <span className="inline-flex items-center gap-1 text-xs text-cyan-200">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Checking
            </span>
        )
    }
    return (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Updated
        </span>
    )
}

function formatLastChecked(lastCheckedAt: Date | null) {
    if (!lastCheckedAt) {
        return 'never'
    }
    return lastCheckedAt.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    })
}

function getHeaderState({
    hasError,
    pendingCount,
    isChecking
}: {
    hasError: boolean
    pendingCount: number
    isChecking: boolean
}): 'healthy' | 'pending' | 'error' | 'checking' {
    if (hasError) {
        return 'error'
    }
    if (isChecking) {
        return 'checking'
    }
    if (pendingCount > 0) {
        return 'pending'
    }
    return 'healthy'
}
