import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import LinkedInLogo from '@/assets/logos/linkedinLogo.png'
import MediumLogo from '@/assets/logos/mediumLogo.jpeg'
import DevtoLogo from '@/assets/logos/devto.webp'
import HashnodeLogo from '@/assets/logos/hashnodeLogo.png'
import apiIcon from '@/assets/logos/rssLogo.png'
import threadsLogo from '@/assets/logos/threadsLogo.png'

export default function IntegrationsSection({ hideText = false }: { hideText?: boolean }) {
    return (
        <section>
            <div className="mx-auto max-w-[800px] space-y-10">
                {!hideText &&
                    <div className='md:text-center'>
                        <h2 className="text-balance text-[32px] font-[500]">Write once, distribute everywhere</h2>
                        <p className="mt-1 text-muted-foreground">One source, every platform you write on.<br />
                            Write it. Ship it. Own it.
                        </p>
                    </div>
                }
                <div className="relative mx-auto flex max-w-sm items-center justify-between">
                    <div className="space-y-6">
                        <IntegrationCard position="left-top">
                            <img src={HashnodeLogo.src} alt="Hashnode" className="size-6 object-cover rounded-[4px]" loading="lazy" />
                        </IntegrationCard>
                        <IntegrationCard position="left-middle">
                            <img src={DevtoLogo.src} alt="DevTo" className="size-6 object-cover rounded-[4px]" loading="lazy" />
                        </IntegrationCard>
                        <IntegrationCard position="left-bottom">
                            <img src={apiIcon.src} alt="DevApi" className="size-6 object-cover rounded-[4px]" loading="lazy" />
                        </IntegrationCard>
                    </div>
                    <div className="mx-auto my-2 flex w-fit justify-center gap-2">
                        <div className="bg-muted relative z-2 rounded-2xl border p-1">
                            <IntegrationCard
                                className="shadow-black-950/10 dark:bg-background size-16 border-black/25 shadow-xl dark:border-white/25 dark:shadow-white/10"
                                isCenter={true}>
                                <img src="/appLogo.png" alt="Whitepapper" className="size-8 object-contain" loading="lazy" />
                            </IntegrationCard>
                        </div>
                    </div>
                    <div
                        role="presentation"
                        className="absolute inset-1/3 bg-[radial-gradient(var(--dots-color)_1px,transparent_1px)] opacity-50 [--dots-color:black] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] dark:[--dots-color:white]"
                    ></div>

                    <div className="space-y-6">
                        <IntegrationCard position="right-top">
                            <img src={MediumLogo.src} alt="Medium" className="size-6 object-cover rounded-[4px]" loading="lazy" />
                        </IntegrationCard>
                        <IntegrationCard position="right-middle">
                            <img src={threadsLogo.src} alt="Threads" className="size-6 object-cover rounded-[4px]" loading="lazy" />
                        </IntegrationCard>
                        <IntegrationCard position="right-bottom">
                            <img src={LinkedInLogo.src} alt="Linkedin" className="size-6 object-cover rounded-[4px]" loading="lazy" />
                        </IntegrationCard>
                    </div>
                </div>

                {!hideText &&
                    <div className='flex justify-center'>
                        <Button
                            variant="outline"
                            size="sm"
                            asChild>
                            <a href="/integrations" data-astro-prefetch="viewport">Integrations</a>
                        </Button>
                    </div>}
            </div>

        </section>
    )
}

const IntegrationCard = ({ children, className, position, isCenter = false }: { children: React.ReactNode; className?: string; position?: 'left-top' | 'left-middle' | 'left-bottom' | 'right-top' | 'right-middle' | 'right-bottom'; isCenter?: boolean }) => {
    return (
        <div className={cn('bg-background relative flex size-12 rounded-xl border dark:bg-transparent', className)}>
            <div className={cn('relative z-2 m-auto size-fit *:size-6', isCenter && '*:size-8')}>{children}</div>
            {position && !isCenter && (
                <div
                    className={cn(
                        'bg-linear-to-r to-muted-foreground/25 absolute z-1 h-px',
                        position === 'left-top' && 'left-full top-1/2 w-[130px] origin-left rotate-[25deg]',
                        position === 'left-middle' && 'left-full top-1/2 w-[120px] origin-left',
                        position === 'left-bottom' && 'left-full top-1/2 w-[130px] origin-left rotate-[-25deg]',
                        position === 'right-top' && 'bg-linear-to-l right-full top-1/2 w-[130px] origin-right rotate-[-25deg]',
                        position === 'right-middle' && 'bg-linear-to-l right-full top-1/2 w-[120px] origin-right',
                        position === 'right-bottom' && 'bg-linear-to-l right-full top-1/2 w-[130px] origin-right rotate-[25deg]'
                    )}
                />
            )}
        </div>
    )
}
