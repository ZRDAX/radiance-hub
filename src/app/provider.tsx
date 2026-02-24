import { ReactNode, Suspense } from 'react'
import AppErrorPage from '@/features/errors/app-error'
import { ErrorBoundary } from 'react-error-boundary'
import { TooltipProvider } from '@/components/ui/tooltip'
import { UpdatesProvider } from '@/features/updates/hooks/use-updates'

export default function AppProvider({ children }: { children: ReactNode }) {
    return (
        <Suspense fallback={<>Loading...</>}>
            <ErrorBoundary FallbackComponent={AppErrorPage}>
                <TooltipProvider>
                    <UpdatesProvider>{children}</UpdatesProvider>
                </TooltipProvider>
            </ErrorBoundary>
        </Suspense>
    )
}
