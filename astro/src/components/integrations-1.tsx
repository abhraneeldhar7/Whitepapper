import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowUpRight, ChevronRight } from 'lucide-react'
import type { ImageMetadata } from 'astro'
import hashnodeLogo from "@/assets/logos/hashnodeLogo.png"
import devtoLogo from "@/assets/logos/devto.webp"
import mediumLogo from "@/assets/logos/mediumLogo.jpeg"
import rssLogo from "@/assets/logos/rssLogo.png"



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
                    <div className="grid gap-6 mt-12 md:grid-cols-2 lg:grid-cols-4">
                        {integrations.map((integration) => (
                            <a key={integration.title} href={integration.href}>
                                <Card className="p-6 hover:shadow-lg transition-shadow duration-300 flex flex-col items-center text-center h-full group">
                                    <img
                                        src={integration.logo.src}
                                        alt={`${integration.title} logo`}
                                        className="md:w-15 w-20 mb-4"
                                    />
                                    <h3 className="text-[20px] font-[500] mb-2 flex items-center gap-2">
                                        {integration.title}
                                    </h3>
                                    <p className="text-[14px] text-muted-foreground leading-[1.4]">
                                        {integration.description}
                                    </p>
                                </Card>
                            </a>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
}