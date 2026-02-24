import {
    Activity,
    Boxes,
    Clock3,
    Download,
    FileText,
    Loader2,
    Settings,
    ShieldCheck
} from 'lucide-react'
import { useNavigate } from 'react-router'
import DashboardCard from '@/features/dashboard/components/dashboard-card'
import { useUpdates } from '@/features/updates/hooks/use-updates'

export default function Dashboard() {
    const navigate = useNavigate()
    const { pendingUpdatesCount, isLoadingList, checkUpdates } = useUpdates()

    const cards = [
        {
            key: 'installed-apps',
            title: 'Installed Apps',
            description: 'Browse installed software inventory and metadata.',
            icon: Boxes,
            actionLabel: 'Open',
            onClick: () => navigate('/installed-apps')
        },
        {
            key: 'available-updates',
            title: 'Available Updates',
            description: 'Review and execute pending package updates.',
            icon: Download,
            actionLabel: isLoadingList ? 'Checking...' : 'Check Updates',
            badge: (
                <span className="inline-flex items-center gap-1">
                    {isLoadingList && <Loader2 className="h-3 w-3 animate-spin" />}
                    {pendingUpdatesCount}
                </span>
            ),
            onClick: () => navigate('/available-updates'),
            onActionClick: () => void checkUpdates(),
            disabled: isLoadingList
        },
        {
            key: 'update-history',
            title: 'Update History',
            description: 'Track executed updates and outcomes over time.',
            icon: Clock3,
            actionLabel: 'Open',
            onClick: () => navigate('/update-history')
        },
        {
            key: 'logs',
            title: 'Logs',
            description: 'Inspect technical logs for diagnostics and support.',
            icon: FileText,
            actionLabel: 'Open',
            onClick: () => navigate('/logs')
        },
        {
            key: 'settings',
            title: 'Settings',
            description: 'Configure behavior, startup and update preferences.',
            icon: Settings,
            actionLabel: 'Open',
            onClick: () => navigate('/settings')
        },
        {
            key: 'system-status',
            title: 'System Status',
            description: 'Check tray activity, runtime state and health signals.',
            icon: Activity,
            actionLabel: 'Open',
            badge: (
                <span className="inline-flex items-center gap-1 text-emerald-200">
                    <ShieldCheck className="h-3 w-3" />
                    Healthy
                </span>
            ),
            onClick: () => navigate('/system-status')
        }
    ]

    return (
        <section className="relative min-h-screen overflow-hidden bg-[#050913] px-6 py-8 text-slate-100 sm:px-8">
            <div className="pointer-events-none absolute -left-24 top-0 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl" />
            <div className="pointer-events-none absolute right-0 top-20 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-emerald-500/15 blur-3xl" />

            <div className="relative mx-auto max-w-7xl space-y-6">
                <header className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">
                        Radiance
                    </p>
                    <h1 className="text-3xl font-semibold">Dashboard</h1>
                    <p className="text-sm text-slate-300">
                        Centralized control panel for app updates, logs and
                        runtime status.
                    </p>
                </header>

                <main className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {cards.map((card) => (
                        <DashboardCard
                            key={card.key}
                            title={card.title}
                            description={card.description}
                            icon={card.icon}
                            actionLabel={card.actionLabel}
                            onActionClick={card.onActionClick}
                            onClick={card.onClick}
                            badge={card.badge}
                            disabled={card.disabled}
                        />
                    ))}
                </main>
            </div>
        </section>
    )
}
