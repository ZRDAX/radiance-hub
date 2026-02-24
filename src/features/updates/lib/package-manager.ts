import { PackageManagerType } from '@/features/updates/types'

export function inferPackageManager(source: string): PackageManagerType {
    const normalized = source.trim().toLowerCase()

    if (!normalized) {
        return 'unknown'
    }
    if (normalized.includes('winget') || normalized.includes('msstore')) {
        return 'winget'
    }
    if (normalized.includes('choco') || normalized.includes('chocolatey')) {
        return 'chocolatey'
    }
    if (normalized.includes('manual')) {
        return 'manual'
    }
    return 'unknown'
}

export function formatPackageManagerLabel(manager: PackageManagerType) {
    if (manager === 'winget') {
        return 'winget'
    }
    if (manager === 'chocolatey') {
        return 'chocolatey'
    }
    if (manager === 'manual') {
        return 'manual'
    }
    return 'unknown'
}
