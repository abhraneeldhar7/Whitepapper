"use client"
import { useState } from "react"
import hashnode_logo from "../../assets/logos/hashnodeLogo.png"
import { saveHashnodeDistribution, revokeHashnodeDistribution } from "@/lib/api/distributions"
import type { UserDoc } from "@/lib/types"
import { toast } from "sonner"
import { Button } from "../ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog"
import { Input } from "../ui/input"
import { Switch } from "../ui/switch"
import { ArrowUpRight, EyeIcon } from "lucide-react"

const HASHNODE_ACCESS_TOKEN_KEY = "hashnode_access_token"

type HashnodeCardProps = {
    user: UserDoc
    onUserUpdated: (user: UserDoc) => void
}

export function HashnodeCard({ user, onUserUpdated }: HashnodeCardProps) {
    const [open, setOpen] = useState(false)

    return (<div className="">
        <div className="flex gap-4 items-center">
            <img alt="Hashnode logo" src={hashnode_logo.src} height={35} width={35} />
            <h3 className="text-[19px]">Hashnode</h3>
        </div>
        <p className="text-[15px] mt-3">Connect hashnode to cross post your content. Lorem ipsum dolor sit amet consectetur adipisicing elit. Qui, hic!</p>
        <div className="flex justify-end mt-4">
            <Button onClick={() => setOpen(true)}>Configure</Button>
            <HashnodeDialog user={user} onUserUpdated={onUserUpdated} open={open} setOpen={setOpen} />
        </div>
    </div>)
}

export function HashnodeDialog({
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
    const [storeInCloud, setStoreInCloud] = useState(Boolean(user.preferences?.hashnodeStoreInCloud))
    const [hasLocalToken, setHasLocalToken] = useState(false)
    const [showToken, setShowToken] = useState(false)
    const [saving, setSaving] = useState(false)
    const [revoking, setRevoking] = useState(false)

    function readLocalToken(): string {
        if (typeof window === "undefined") {
            return ""
        }
        return localStorage.getItem(HASHNODE_ACCESS_TOKEN_KEY) || ""
    }

    function updateLocalToken(nextToken: string | null) {
        if (typeof window === "undefined") {
            return
        }
        if (!nextToken) {
            localStorage.removeItem(HASHNODE_ACCESS_TOKEN_KEY)
            return
        }
        localStorage.setItem(HASHNODE_ACCESS_TOKEN_KEY, nextToken)
    }

    function refreshFromUserState(nextUser: UserDoc) {
        const localToken = readLocalToken()
        const preferenceCloud = Boolean(nextUser.preferences?.hashnodeStoreInCloud)
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

    const hasPreferenceIntegration = Boolean(user.preferences?.hashnodeIntegrated)
    const hasSavedToken = hasPreferenceIntegration || hasLocalToken

    async function handleSave() {
        const tokenToSave = accessToken.trim() || readLocalToken().trim()
        if (!tokenToSave) {
            toast.error("Please enter your Hashnode access token.")
            return
        }

        setSaving(true)
        try {
            const updatedUser = await saveHashnodeDistribution({
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
            toast.error(error instanceof Error ? error.message : "Failed to save Hashnode key.")
        }
    }

    async function handleRevoke() {
        setRevoking(true)
        try {
            const updatedUser = await revokeHashnodeDistribution()
            updateLocalToken(null)
            onUserUpdated(updatedUser)
            setOpen?.(false)
        } catch (error) {
            setRevoking(false)
            toast.error(error instanceof Error ? error.message : "Failed to revoke Hashnode key.")
        }
    }

    const cloudMaskedValue = "XXX-XXXX-XXX-XXXX"
    const localToken = readLocalToken()
    const existingTokenDisplay = showToken && localToken ? localToken : cloudMaskedValue

    return (<Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Hashnode Integration</DialogTitle>
                <DialogDescription>Add secret key here to Lorem ipsum .
                    Can't find secret key? Follow this <a href="/integrations/hashnode" className="font-[500] underline" target="_blank">instruction <ArrowUpRight size={12} className="ml-1 inline-block"/></a>
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
