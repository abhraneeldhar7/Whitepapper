'use client'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

export type FAQItem = {
    question: string
    answer: string
}

const defaultFaqItems: FAQItem[] = [
    {
        question: 'How does the free trial work?',
        answer: 'Start with a 14-day free trial with full access to all features. No credit card required. You can upgrade to a paid plan at any time during or after the trial.',
    },
    {
        question: 'Can I change my plan later?',
        answer: "Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate the difference.",
    },
    {
        question: 'What payment methods do you accept?',
        answer: 'We accept all major credit cards, PayPal, and bank transfers for annual plans. Enterprise customers can also pay via invoice.',
    },
    {
        question: 'Is there a setup fee?',
        answer: 'No, there are no setup fees or hidden costs. You only pay for your subscription plan.',
    },
    {
        question: 'Do you offer refunds?',
        answer: "We offer a 30-day money-back guarantee. If you're not satisfied, contact us within 30 days for a full refund.",
    },
]

type FAQsProps = {
    items?: FAQItem[]
    title?: string
    description?: string
}

export default function FAQs({
    items = defaultFaqItems,
    title = "FAQs",
    description = "Your questions answered",
}: FAQsProps) {
    return (
        <div className="md:flex-row md:items-start md:gap-15 flex flex-col gap-4">
            <div className="md:sticky md:top-24 self-start h-fit md:w-[400px]">
                <h2 className="text-[32px] font-[500]">{title}</h2>
                <p className="text-muted-foreground mt-1 text-[15px]">{description}</p>
            </div>
            <div className="flex-1">
                <Accordion
                    type='multiple'
                    defaultValue={["item-1"]}
                >
                    {items.map((item, index) => (
                        <AccordionItem
                            key={`${item.question}-${index}`}
                            value={`item-${index + 1}`}
                            className="border-dashed">
                            <AccordionTrigger className="cursor-pointer py-4 text-sm font-medium hover:no-underline">{item.question}</AccordionTrigger>
                            <AccordionContent>
                                <p className="text-muted-foreground pb-2 text-sm">{item.answer}</p>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
                <p className="text-muted-foreground @xl:hidden mt-6 text-sm">
                    Need more help?{' '}
                    <a
                        href="/contact"
                        className="font-[450] hover:underline">
                        Contact us
                    </a>
                </p>
            </div>
        </div>

    )
}
