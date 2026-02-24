import { invoke } from '@tauri-apps/api/core'
import { AppUpdate, UpdateResult } from '@/features/updates/types'
import { inferPackageManager } from '@/features/updates/lib/package-manager'

interface RawAppUpdate {
    id: string
    name: string
    installedVersion: string
    availableVersion: string
    source: string
}

export async function fetchUpdates() {
    const data = await invoke<RawAppUpdate[]>('get_updates')
    return data.map((item) => ({
        ...item,
        packageManager: inferPackageManager(item.source)
    })) as AppUpdate[]
}

export function updateApp(id: string) {
    return invoke<UpdateResult>('update_app', { id })
}
