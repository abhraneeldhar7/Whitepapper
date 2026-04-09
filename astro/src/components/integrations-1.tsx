import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ChevronRight } from 'lucide-react'
import type { ImageMetadata } from 'astro'
import hashnodeLogo from "@/assets/logos/hashnodeLogo.png"
import devtoLogo from "@/assets/logos/devto.webp"
import mediumLogo from "@/assets/logos/mediumLogo.jpeg"
import rssLogo from "@/assets/logos/rssLogo.png"

import substackLogo from "@/assets/logos/substackLogo.png"
import xLogo from "@/assets/logos/xLogo.jpg"
import linkedinLogo from "@/assets/logos/linkedinLogo.png"



export default function IntegrationsSection() {
    const integrations = [
        {
            title: "Hashnode",
            description: "Connect your hashnode account to publish from whitepapper",
            logo: hashnodeLogo,
            href: "/docs/distribution/hashnode"
        },
        {
            title: "DevTo",
            description: "Connect your Devto account to cross post papers.",
            logo: devtoLogo,
            href: "/docs/distribution/devto"
        },
        {
            title: "REST API",
            description: "Use whitepapper as a content engine for your websites, blogs, articles",
            logo: rssLogo,
            href: "/docs/dev-api/overview"
        },
        {
            title: "Medium",
            description: "Use Medium's import feature to cross post from whitepapper",
            logo: mediumLogo,
            href: "/docs/distribution/medium-import"
        },
    ]
    return (
        <section>
            <div className="py-32">
                <div className="mx-auto max-w-5xl px-6">
                    <div className="text-center">
                        <h2 className="text-balance text-3xl font-semibold md:text-4xl">Use Whitepapper in your workflow</h2>
                        <p className="text-muted-foreground mt-6">Connect seamlessly with your platforms and websites to enhance your content distribution.</p>
                    </div>

                    <div className="mt-12 grid gap-7 md:grid-cols-3 grid-cols-1">
                        {integrations.map((item) => (
                            <IntegrationCard title={item.title} description={item.description} logo={item.logo} link={item.href} />
                        ))}

                        <Card className="p-5">
                            <div className="relative">
                                <div className='relative h-[40px]'>
                                    <img src={linkedinLogo.src} height={34} width={34} className='rounded-[5px] absolute z-4' />
                                    <img src={xLogo.src} height={34} width={34} className='rounded-[5px] z-2 top-0 absolute translate-x-5' />
                                    <img src={substackLogo.src} height={34} width={34} className='rounded-[5px] absolute top-0 translate-x-10' />
                                </div>

                                <div className="space-y-2 py-6">
                                    <h3 className="text-base font-medium">Comming soon</h3>
                                    <p className="text-muted-foreground line-clamp-2 text-sm">More platforms applied for approval and under development</p>
                                </div>

                                <div className="flex gap-3 border-t border-dashed pt-6">
                                    <a href="/docs/distribution/platform-status">
                                        <Button size="sm">
                                            Learn More
                                            <ChevronRight />
                                        </Button>
                                    </a>
                                </div>
                            </div>
                        </Card>


                    </div>
                </div>
            </div>
        </section>
    )
}

const IntegrationCard = ({ title, description, logo, link }: { title: string; description: string; logo: ImageMetadata; link?: string }) => {
    return (
        <Card className="p-5">
            <div className="relative">
                <img src={logo.src} height={40} width={40} className='rounded-[5px]' />

                <div className="space-y-2 py-6">
                    <h3 className="text-base font-medium">{title}</h3>
                    <p className="text-muted-foreground line-clamp-2 text-sm">{description}</p>
                </div>

                <div className="flex gap-3 border-t border-dashed pt-6">
                    <a href={link}>
                        <Button size="sm">
                            Learn More
                            <ChevronRight />
                        </Button>
                    </a>
                </div>
            </div>
        </Card>
    )
}
