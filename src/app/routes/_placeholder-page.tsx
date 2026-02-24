import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'

interface PlaceholderPageProps {
    title: string
    description: string
}

export default function PlaceholderPage({
    title,
    description
}: PlaceholderPageProps) {
    const navigate = useNavigate()

    return (
        <section className="min-h-screen bg-[#050913] px-6 py-8 text-slate-100 sm:px-8">
            <div className="mx-auto max-w-4xl space-y-5 rounded-2xl border border-white/10 bg-white/6 p-6 backdrop-blur-xl">
                <h1 className="text-2xl font-semibold">{title}</h1>
                <p className="text-sm text-slate-300">{description}</p>
                <Button
                    variant="outline"
                    className="border-white/20 bg-white/8 text-slate-100 hover:bg-white/15"
                    onClick={() => navigate('/')}
                >
                    Back to Dashboard
                </Button>
            </div>
        </section>
    )
}
