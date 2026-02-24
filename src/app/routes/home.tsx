import UpdatesLibrary from '@/features/updates'

export function HomePage() {
    return <UpdatesLibrary />
}

// Necessary for react router to lazy load.
export const Component = HomePage
