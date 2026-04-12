import { Button } from '@/components/ui/button'
import { Cpu, Sparkles } from 'lucide-react'
import {
    DEV_API_LIMIT_PER_MONTH,
    MAX_COLLECTIONS_PER_PROJECT,
    MAX_DESCRIPTION_LENGTH,
    MAX_IMAGES_PER_PAPER,
    MAX_PAPER_BODY_LENGTH,
    MAX_PAPERS_PER_USER,
    MAX_PROJECTS_PER_USER,
} from '@/lib/limits'

type Row = {
    label: string
    free: string | boolean
}

function formatNumber(value: number): string {
    return value.toLocaleString('en-US')
}

const planLimitRows: Row[] = [
    { label: 'Price', free: '$0/month' },
    { label: 'Projects per user', free: formatNumber(MAX_PROJECTS_PER_USER) },
    { label: 'Collections per project', free: formatNumber(MAX_COLLECTIONS_PER_PROJECT) },
    { label: 'Papers per user', free: formatNumber(MAX_PAPERS_PER_USER) },
    { label: 'Dev API requests per month', free: formatNumber(DEV_API_LIMIT_PER_MONTH) },
    { label: 'Images per paper', free: formatNumber(MAX_IMAGES_PER_PAPER) },
    { label: 'Paper description max length', free: `${formatNumber(MAX_DESCRIPTION_LENGTH)} chars` },
    { label: 'Paper body max length', free: `${formatNumber(MAX_PAPER_BODY_LENGTH)} chars` },
]

const includedRows: Row[] = [
    { label: 'Markdown editor', free: true },
    { label: 'Public pages', free: true },
    { label: 'Metadata workflow', free: true },
    { label: 'Distribution support', free: true }
]

export default function PricingComparator() {
    const Check = (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="size-4">
            <path
                fillRule="evenodd"
                d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
                clipRule="evenodd"
            />
        </svg>
    )

    return (
        <section className="">
            <div className="mx-auto max-w-5xl">
                <div className="w-full overflow-auto lg:overflow-visible">
                    <table className="w-[140vw] border-separate border-spacing-x-3 md:w-full dark:[--color-muted:var(--color-zinc-900)]">
                        <thead className="bg-background sticky top-4">
                            <tr className="*:py-4 *:text-left *:font-medium">
                                <th className="lg:w-2/5"></th>
                                <th className="bg-muted rounded-t-(--radius) space-y-3 p-4">
                                    <span className="block">Free</span>

                                    <a href="/login" className='w-full'>
                                        <Button size="lg" className='w-full'>
                                            Get started
                                        </Button>
                                    </a>

                                </th>
                            </tr>
                        </thead>
                        <tbody className="text-caption text-sm">
                            <tr className="*:py-3">
                                <td className="flex items-center gap-2 font-medium">
                                    <Cpu className="size-4" />
                                    <span>Plan limits</span>
                                </td>
                                <td className="bg-muted border-none px-4"></td>
                            </tr>
                            {planLimitRows.map((row, index) => (
                                <tr
                                    key={`limit-${index}`}
                                    className="*:border-b *:py-3">
                                    <td className="text-muted-foreground">{row.label}</td>
                                    <td className="bg-muted border-none px-4">
                                        <div className="-mb-3 border-b py-3">
                                            {row.free}
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            <tr className="*:pb-3 *:pt-8">
                                <td className="flex items-center gap-2 font-medium">
                                    <Sparkles className="size-4" />
                                    <span>Included capabilities</span>
                                </td>
                                <td className="bg-muted border-none px-4"></td>
                            </tr>
                            {includedRows.map((row, index) => (
                                <tr
                                    key={`included-${index}`}
                                    className="*:border-b *:py-3">
                                    <td className="text-muted-foreground">{row.label}</td>
                                    <td className="bg-muted border-none px-4">
                                        <div className="-mb-3 border-b py-3">
                                            {row.free === true ? Check : row.free}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            <tr className="*:py-6">
                                <td></td>
                                <td className="bg-muted rounded-b-(--radius) border-none px-4"></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    )
}
