"use client"
import { useState } from "react"
import devto_logo from "../../assets/logos/devto.webp"
import { saveDevtoDistribution, revokeDevtoDistribution } from "@/lib/api/distributions"
import type { UserDoc } from "@/lib/types"
import { toast } from "sonner"
import { Button } from "../ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog"
import { Input } from "../ui/input"
import { Switch } from "../ui/switch"
import { ArrowUpRight, EyeIcon } from "lucide-react"

const DEVTO_ACCESS_TOKEN_KEY = "devto_access_token"

type DevtoCardProps = {
    user: UserDoc
    onUserUpdated: (user: UserDoc) => void
}

export function DevtoCard({ user, onUserUpdated }: DevtoCardProps) {
    const [open, setOpen] = useState(false)

    return (<div className="">
        <div className="flex gap-4 items-center">
            <img alt="Dev.to logo" src={devto_logo.src} className="rounded-[5px] dark:invert" height={35} width={35} />
            <h3 className="text-[19px]">Dev.to</h3>
        </div>
        <p className="text-[15px] mt-3">Connect Dev.to to cross post your content. Lorem ipsum dolor sit amet consectetur adipisicing elit. Qui, hic!</p>
        <div className="flex justify-end mt-4">
            <Button onClick={() => setOpen(true)}>Configure</Button>
            <DevtoDialog user={user} onUserUpdated={onUserUpdated} open={open} setOpen={setOpen} />
        </div>
    </div>)
}

export function DevtoDialog({
    user,
    onUserUpdated,
    open,
    setOpen,
}: {
    user: UserDoc
    onUserUpdated: (user: UserDoc) => void
    open?: boolean
    setOpen?: (open: boolean) => void
}) {
    const [accessToken, setAccessToken] = useState("")
    const [storeInCloud, setStoreInCloud] = useState(Boolean(user.preferences?.devtoStoreInCloud))
    const [hasLocalToken, setHasLocalToken] = useState(false)
    const [showToken, setShowToken] = useState(false)
    const [saving, setSaving] = useState(false)
    const [revoking, setRevoking] = useState(false)

    function readLocalToken(): string {
        if (typeof window === "undefined") {
            return ""
        }
        return localStorage.getItem(DEVTO_ACCESS_TOKEN_KEY) || ""
    }

    function updateLocalToken(nextToken: string | null) {
        if (typeof window === "undefined") {
            return
        }
        if (!nextToken) {
            localStorage.removeItem(DEVTO_ACCESS_TOKEN_KEY)
            return
        }
        localStorage.setItem(DEVTO_ACCESS_TOKEN_KEY, nextToken)
    }

    function refreshFromUserState(nextUser: UserDoc) {
        const localToken = readLocalToken()
        const preferenceCloud = Boolean(nextUser.preferences?.devtoStoreInCloud)
        setStoreInCloud(preferenceCloud)
        setHasLocalToken(Boolean(localToken.trim()))
        setAccessToken(localToken)
    }

    function resetDialogState() {
        setSaving(false)
        setRevoking(false)
        setShowToken(false)
        refreshFromUserState(user)
    }

    function handleDialogOpenChange(nextOpen: boolean) {
        if (nextOpen) {
            resetDialogState()
        } else {
            resetDialogState()
        }
        setOpen?.(nextOpen)
    }

    const hasPreferenceIntegration = Boolean(user.preferences?.devtoIntegrated)
    const hasSavedToken = hasPreferenceIntegration || hasLocalToken

    async function handleSave() {
        const tokenToSave = accessToken.trim() || readLocalToken().trim()
        if (!tokenToSave) {
            toast.error("Please enter your Devto access token.")
            return
        }

        setSaving(true)
        try {
            const updatedUser = await saveDevtoDistribution({
                accessToken: tokenToSave,
                storeInCloud,
            })

            if (storeInCloud) {
                updateLocalToken(null)
            } else {
                updateLocalToken(tokenToSave)
            }

            onUserUpdated(updatedUser)
            setOpen?.(false)
        } catch (error) {
            setSaving(false)
            toast.error(error instanceof Error ? error.message : "Failed to save Devto key.")
        }
    }

    async function handleRevoke() {
        setRevoking(true)
        try {
            const updatedUser = await revokeDevtoDistribution()
            updateLocalToken(null)
            onUserUpdated(updatedUser)
            setOpen?.(false)
        } catch (error) {
            setRevoking(false)
            toast.error(error instanceof Error ? error.message : "Failed to revoke Devto key.")
        }
    }

    const cloudMaskedValue = "XXX-XXXX-XXX-XXXX"
    const localToken = readLocalToken()
    const existingTokenDisplay = showToken && localToken ? localToken : cloudMaskedValue

    return (<Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Dev.to Integration</DialogTitle>
                <DialogDescription>Add secret key here to Lorem ipsum .
                    Can't find secret key? Follow this <a href="/integrations/devto" className="font-[500] underline" target="_blank">instruction <ArrowUpRight size={12} className="ml-1 inline-block" /></a>
                </DialogDescription>
            </DialogHeader>

            {!hasSavedToken ? (
                <Input
                    className="mt-2"
                    placeholder="your secret key here..."
                    value={accessToken}
                    onChange={(event) => setAccessToken(event.target.value)}
                />
            ) : (
                <div className="flex gap-2 mt-2">
                    <Input disabled value={existingTokenDisplay} />
                    <Button className="h-[34px] w-[34px]" variant="secondary" onClick={() => setShowToken((current) => !current)}><EyeIcon className="size-[14px]" /></Button>
                </div>
            )}

            {!storeInCloud ? (<div className="bg-primary/10 border-primary/40 border-[2px] rounded-[10px] px-3 py-2 text-muted-foreground my-3">
                Your secret keys are stored in your browser and never touches our database.
            </div>) : null}
            {!hasSavedToken ? (
                <div className="px-1 flex gap-4 items-center">
                    <div>
                        <h2 className="font-[500]">Store in cloud</h2>
                        <p className="text-muted-foreground">Keep your secret keys on the cloud to use integrations on multiple devices</p>
                    </div>
                    <Switch checked={storeInCloud} onCheckedChange={(checked) => setStoreInCloud(Boolean(checked))} />
                </div>
            ) : null}

            <DialogFooter>
                {!hasSavedToken ? <Button loading={saving} onClick={handleSave}>Save key</Button> : null}
                {hasSavedToken ? <Button variant="destructive" loading={revoking} onClick={handleRevoke}>Revoke</Button> : null}
            </DialogFooter>
        </DialogContent>
    </Dialog>)
}
