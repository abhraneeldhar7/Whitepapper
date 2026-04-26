import { Button } from '@/components/ui/button'
import { CircleCheckIcon, Cpu, Sparkles } from 'lucide-react'

const tableData = [
    {
        feature: 'Feature 1',
        free: true,
        pro: true,
        startup: true,
    },
    {
        feature: 'Feature 2',
        free: true,
        pro: true,
        startup: true,
    },
    {
        feature: 'Feature 3',
        free: false,
        pro: true,
        startup: true,
    },
    {
        feature: 'Tokens',
        free: '',
        pro: '20 Users',
        startup: 'Unlimited',
    },
    {
        feature: 'Video calls',
        free: '',
        pro: '12 Weeks',
        startup: '56',
    },
    {
        feature: 'Support',
        free: '',
        pro: 'Secondes',
        startup: 'Unlimited',
    },
    {
        feature: 'Security',
        free: '',
        pro: '20 Users',
        startup: 'Unlimited',
    },
]

export default function CMSComparison() {
    return (
        <div className="mx-auto">
            <div className="w-full overflow-auto lg:overflow-visible">
                <table className="w-fit border-separate border-spacing-x-3 md:w-full dark:[--color-muted:var(--color-zinc-900)]">
                    <thead className="bg-background sticky top-0">
                        <tr className="*:py-4 *:text-left *:font-medium">
                            <th className="lg:w-2/5 flex gap-2 items-center">
                                <Cpu className="size-4 shrink-0" />
                                <span>Features</span></th>
                            <th className="space-y-3">
                                <span className="block">Whitepapper</span>

                            </th>
                            <th className="bg-muted rounded-t-(--radius) space-y-3 px-4">
                                <span className="block">Traditional CMS</span>

                            </th>
                        </tr>
                    </thead>
                    <tbody className="text-caption text-sm">

                        {tableData.map((row, index) => (
                            <tr
                                key={index}
                                className="*:border-b *:py-3">
                                <td className="text-muted-foreground">{row.feature}</td>

                                <td className="bg-muted border-none px-4">
                                    <div className="-mb-3 border-b py-3">
                                        {row.pro === true ? (

                                            <CircleCheckIcon size={20} />
                                        ) : (
                                            row.free
                                        )}
                                    </div>
                                </td>
                                <td>
                                    {row.startup === true ? (
                                        <CircleCheckIcon size={20} />
                                    ) : (
                                        row.pro
                                    )}
                                </td>
                            </tr>
                        ))}
                        <tr className="*:py-6">
                            <td></td>
                            <td></td>
                            <td className="bg-muted rounded-b-(--radius) border-none px-4"></td>
                            <td></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    )
}