import { listen } from '@tauri-apps/api/event'
import {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react'
import { fetchUpdates, updateApp } from '@/features/updates/api/winget'
import { AppUpdate, UpdateItemState, UpdateResult } from '@/features/updates/types'

type UpdateStateById = Record<string, UpdateItemState>
type BatchStatus = 'idle' | 'running' | 'stopping' | 'stopped' | 'completed'

type UpdatesStore = ReturnType<typeof useUpdatesController>

interface TrayCheckedPayload {
    success: boolean
    count: number
    message?: string
}

const UpdatesStoreContext = createContext<UpdatesStore | null>(null)

export function UpdatesProvider({ children }: { children: ReactNode }) {
    const value = useUpdatesController()
    return (
        <UpdatesStoreContext.Provider value={value}>
            {children}
        </UpdatesStoreContext.Provider>
    )
}

function useUpdatesController() {
    const [updates, setUpdates] = useState<AppUpdate[]>([])
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [itemStates, setItemStates] = useState<UpdateStateById>({})
    const [isLoadingList, setIsLoadingList] = useState(true)
    const [isRunningBatch, setIsRunningBatch] = useState(false)
    const [isStopRequested, setIsStopRequested] = useState(false)
    const [batchStatus, setBatchStatus] = useState<BatchStatus>('idle')
    const [currentBatchItemId, setCurrentBatchItemId] = useState<string | null>(
        null
    )
    const [batchTotal, setBatchTotal] = useState(0)
    const [batchCompleted, setBatchCompleted] = useState(0)
    const [listError, setListError] = useState<string | null>(null)
    const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null)
    const [pendingCountOverride, setPendingCountOverride] = useState<
        number | null
    >(null)
    const progressTimers = useRef<Record<string, number>>({})
    const loadRequestId = useRef(0)
    const stopRequestedRef = useRef(false)

    const stopProgress = useCallback((id: string) => {
        const timerId = progressTimers.current[id]
        if (!timerId) {
            return
        }
        clearInterval(timerId)
        delete progressTimers.current[id]
    }, [])

    const startProgress = useCallback(
        (id: string) => {
            stopProgress(id)
            setItemStates((prev) => ({
                ...prev,
                [id]: { status: 'loading', progress: 8 }
            }))
            const timerId = window.setInterval(() => {
                setItemStates((prev) => {
                    const state = prev[id]
                    if (!state || state.status !== 'loading') {
                        return prev
                    }
                    const current = state.progress ?? 8
                    const nextProgress = Math.min(current + 6, 92)
                    return {
                        ...prev,
                        [id]: { ...state, progress: nextProgress }
                    }
                })
            }, 220)
            progressTimers.current[id] = timerId
        },
        [stopProgress]
    )

    const loadUpdates = useCallback(async () => {
        const requestId = ++loadRequestId.current
        setIsLoadingList(true)
        setListError(null)
        try {
            const data = await fetchUpdates()
            if (requestId !== loadRequestId.current) {
                return
            }
            setPendingCountOverride(null)
            setLastCheckedAt(new Date())
            setUpdates(data)
            setSelectedIds((prev) =>
                prev.filter((id) => data.some((item) => item.id === id))
            )
            setItemStates((prev) => {
                const next: UpdateStateById = {}
                for (const item of data) {
                    if (prev[item.id]) {
                        next[item.id] = prev[item.id]
                    }
                }
                return next
            })
        } catch (error) {
            if (requestId !== loadRequestId.current) {
                return
            }
            setListError(getErrorMessage(error))
            setUpdates([])
            setSelectedIds([])
        } finally {
            if (requestId === loadRequestId.current) {
                setIsLoadingList(false)
            }
        }
    }, [])

    useEffect(() => {
        void loadUpdates()

        let isMounted = true
        let unlisten: (() => void) | null = null
        void listen<TrayCheckedPayload>('updates:checked', (event) => {
            if (!isMounted) {
                return
            }
            const payload = event.payload
            if (!payload.success) {
                setListError(payload.message ?? 'Failed to check updates.')
                return
            }
            setLastCheckedAt(new Date())
            setPendingCountOverride(payload.count)
        })
            .then((fn) => {
                unlisten = fn
            })
            .catch(() => {
                unlisten = null
            })

        return () => {
            isMounted = false
            if (unlisten) {
                unlisten()
            }
            for (const timerId of Object.values(progressTimers.current)) {
                clearInterval(timerId)
            }
            progressTimers.current = {}
        }
    }, [loadUpdates])

    const allSelected = updates.length > 0 && selectedIds.length === updates.length

    const selectedCount = selectedIds.length
    const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])
    const updatableSelectedIds = useMemo(
        () =>
            selectedIds.filter((id) => {
                const state = itemStates[id]
                return !state || state.status !== 'loading'
            }),
        [itemStates, selectedIds]
    )
    const updatableAllIds = useMemo(
        () =>
            updates
                .map((item) => item.id)
                .filter((id) => {
                    const state = itemStates[id]
                    return !state || state.status !== 'loading'
                }),
        [itemStates, updates]
    )

    const toggleSelectAll = useCallback(() => {
        setSelectedIds((prev) => {
            if (prev.length === updates.length) {
                return []
            }
            return updates.map((item) => item.id)
        })
    }, [updates])

    const toggleSelectOne = useCallback((id: string) => {
        setSelectedIds((prev) => {
            if (prev.includes(id)) {
                return prev.filter((selectedId) => selectedId !== id)
            }
            return [...prev, id]
        })
    }, [])

    const runSingleUpdate = useCallback(
        async (id: string, refreshAfter = true) => {
            if (!id.trim()) {
                setItemStates((prev) => ({
                    ...prev,
                    [id]: {
                        status: 'error',
                        progress: 100,
                        message: 'Invalid package id.'
                    }
                }))
                return false
            }

            startProgress(id)

            try {
                const result = await updateApp(id)
                stopProgress(id)
                setItemStates((prev) => ({
                    ...prev,
                    [id]: toItemState(result)
                }))
                if (refreshAfter) {
                    await loadUpdates()
                }
                return result.success
            } catch (error) {
                stopProgress(id)
                setItemStates((prev) => ({
                    ...prev,
                    [id]: {
                        status: 'error',
                        progress: 100,
                        message: getErrorMessage(error)
                    }
                }))
                return false
            }
        },
        [loadUpdates, startProgress, stopProgress]
    )

    const runSelectedUpdates = useCallback(async () => {
        const batchTargetIds =
            updatableSelectedIds.length > 0 ? updatableSelectedIds : updatableAllIds

        if (isRunningBatch || batchTargetIds.length === 0) {
            return
        }

        stopRequestedRef.current = false
        setIsStopRequested(false)
        setBatchStatus('running')
        const total = batchTargetIds.length
        setBatchTotal(total)
        setBatchCompleted(0)
        setIsRunningBatch(true)
        let stopped = false
        try {
            for (const id of batchTargetIds) {
                if (stopRequestedRef.current) {
                    stopped = true
                    break
                }
                setCurrentBatchItemId(id)
                await runSingleUpdate(id, false)
                setBatchCompleted((prev) => prev + 1)
            }
            setCurrentBatchItemId(null)
            await loadUpdates()
            setBatchStatus(stopped ? 'stopped' : 'completed')
        } finally {
            stopRequestedRef.current = false
            setIsStopRequested(false)
            setIsRunningBatch(false)
        }
    }, [isRunningBatch, loadUpdates, runSingleUpdate, updatableAllIds, updatableSelectedIds])

    const stopBatchUpdates = useCallback(() => {
        if (!isRunningBatch) {
            return
        }
        stopRequestedRef.current = true
        setIsStopRequested(true)
        setBatchStatus('stopping')
    }, [isRunningBatch])

    const inFlightProgress =
        currentBatchItemId && itemStates[currentBatchItemId]?.status === 'loading'
            ? (itemStates[currentBatchItemId]?.progress ?? 0) / 100
            : 0

    const batchProgressPercent =
        batchTotal > 0
            ? Math.round(
                  Math.min(((batchCompleted + inFlightProgress) / batchTotal) * 100, 100)
              )
            : 0

    const pendingUpdatesCount = pendingCountOverride ?? updates.length

    return {
        updates,
        selectedIds,
        selectedIdSet,
        selectedCount,
        allSelected,
        itemStates,
        isLoadingList,
        isRunningBatch,
        isStopRequested,
        batchStatus,
        currentBatchItemId,
        batchTotal,
        batchCompleted,
        batchProgressPercent,
        pendingUpdatesCount,
        lastCheckedAt,
        listError,
        loadUpdates,
        checkUpdates: loadUpdates,
        toggleSelectAll,
        toggleSelectOne,
        runSingleUpdate,
        runSelectedUpdates,
        stopBatchUpdates
    }
}

export function useUpdates() {
    const context = useContext(UpdatesStoreContext)
    if (!context) {
        throw new Error('useUpdates must be used within UpdatesProvider')
    }
    return context
}

function toItemState(result: UpdateResult): UpdateItemState {
    if (result.success) {
        return { status: 'success', progress: 100, message: result.message }
    }
    return { status: 'error', progress: 100, message: result.message }
}

function getErrorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message
    }
    return 'Unexpected error.'
}
