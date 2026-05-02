import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowUpRight, ChevronRight } from 'lucide-react'
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
            href: "/settings"
        },
        {
            title: "DevTo",
            description: "Connect your Devto account to cross post papers.",
            logo: devtoLogo,
            href: "/settings"
        },
        {
            title: "REST API",
            description: "Use whitepapper as a content engine for your websites, blogs, articles",
            logo: rssLogo,
            href: "/docs/dev-api/quickstart"
        },
        {
            title: "Medium",
            description: "Use Medium's import feature to cross post from whitepapper",
            logo: mediumLogo,
            href: "/settings"
        },
    ]
    return (
        <section>
            <div className="pt-30">
                <div className="mx-auto max-w-5xl px-4">
                    <div className="text-center">
                        <h2 className="text-[30px] md:text-[40px] font-[400]">Use Whitepapper in your workflow</h2>
                        <p className="text-muted-foreground mt-6">Connect seamlessly with your platforms and websites to enhance your content distribution.</p>
                    </div>

                    <div className="mt-15 grid gap-5 md:grid-cols-2 grid-cols-1 max-w-[700px] mx-auto w-full">
                        {integrations.map((item, index) => (
                            <IntegrationCard title={item.title} description={item.description} logo={item.logo} key={index} link={item.href} />
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
}

const IntegrationCard = ({ title, description, logo, link }: { title: string; description: string; logo: ImageMetadata; link?: string }) => {
    return (
        <a data-astro-prefetch="viewport" href={link} className="p-5 rounded-[8px] h-55 relative overflow-hidden group">
            <img src={logo.src} alt={`${title} logo`} height={40} width={40} className='rounded-[5px]' />

            <div className="space-y-2 py-6">
                <h3 className="text-base font-medium">{title}</h3>
                <p className="text-muted-foreground line-clamp-2 text-sm">{description}</p>
            </div>

            <p className='justify-end mt-auto w-full font-[450] text-muted-foreground text-[12px] flex items-center gap-2'>Integrate <ArrowUpRight size={12} /></p>

            <div className='w-[120%] h-[0px] group-hover:h-[40px] blur-[40px] bg-primary absolute bottom-[-20px] rounded-[50%] translate-x-[-50%] left-[50%] transition-all duration-500 z-[-1]' />
        </a>
    )
}