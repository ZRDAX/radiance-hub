export type PackageManagerType = 'winget' | 'chocolatey' | 'manual' | 'unknown'

export interface AppUpdate {
    id: string
    name: string
    installedVersion: string
    availableVersion: string
    source: string
    packageManager: PackageManagerType
}

export interface UpdateResult {
    id: string
    success: boolean
    exitCode: number | null
    message: string
}

export type UpdateItemStatus = 'idle' | 'loading' | 'success' | 'error'

export interface UpdateItemState {
    status: UpdateItemStatus
    progress?: number
    message?: string
}
