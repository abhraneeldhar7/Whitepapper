import { useMemo, useState, type FormEvent } from "react";
import { EyeIcon } from "lucide-react";
import { toast } from "sonner";

import ScrollToTop from "@/components/scrollToTop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import googleLogo from "@/assets/logos/googleLogo.png";
import { getDefaultRedirectPath, resolveSafeRedirectTarget } from "@/lib/authRedirect";
import styles from "./login.module.css"

async function finalizeAuthAndRedirect(clerk: any, sessionId: string, redirectUrl: string): Promise<void> {
    await clerk.setActive({ session: sessionId, navigate: async () => {} });
    window.location.replace(redirectUrl);
}

type NewAccountFormProps = {
    redirectUrl: string;
    getClerk: () => Promise<any | null>;
    globalLoading: boolean;
    onLoadingChange: (loading: boolean) => void;
};

function NewAccountForm({ redirectUrl, getClerk, globalLoading, onLoadingChange }: NewAccountFormProps) {
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [newAccount, setNewAccount] = useState({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
    });
    const [pendingVerification, setPendingVerification] = useState(false);
    const [verificationOTP, setVerificationOTP] = useState("");

    const isDisabled = loading || globalLoading;

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (isDisabled) return;

        if (newAccount.password !== newAccount.confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }

        const clerk = await getClerk();
        if (!clerk) {
            toast.error("Auth is still loading. Please try again.");
            return;
        }

        const signUp = clerk.client.signUp;

        setLoading(true);
        onLoadingChange(true);

        try {
            const firstName = newAccount.name;
            if (!firstName) {
                toast.error("Please enter your name");
                return;
            }

            await signUp.create({
                firstName,
                emailAddress: newAccount.email,
                password: newAccount.password,
            });

            await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
            setPendingVerification(true);
            setVerificationOTP("");
            toast.success("Verification code sent to your email");
        } catch (err: any) {
            toast.error(err.errors?.[0]?.message || "Failed to sign up");
        } finally {
            setLoading(false);
            onLoadingChange(false);
        }
    };

    const onVerify = async (e: FormEvent) => {
        e.preventDefault();

        if (isDisabled) return;

        if (verificationOTP.length !== 6) {
            toast.error("Enter the 6-digit code");
            return;
        }

        const clerk = await getClerk();
        if (!clerk) {
            toast.error("Auth is still loading. Please try again.");
            return;
        }

        const signUp = clerk.client.signUp;

        setLoading(true);
        onLoadingChange(true);

        try {
            const completeSignUp = await signUp.attemptEmailAddressVerification({
                code: verificationOTP,
            });

            if (completeSignUp.status !== "complete") {
                toast.error("Verification failed. Please try again.");
                return;
            }

            await finalizeAuthAndRedirect(clerk, completeSignUp.createdSessionId, "/dashboard");
            toast.success("Account created successfully!");
        } catch (err: any) {
            toast.error(err.errors?.[0]?.message || "Invalid code");
        } finally {
            setLoading(false);
            onLoadingChange(false);
        }
    };

    if (pendingVerification) {
        return (
            <>
                <p className="text-center text-[14px]">
                    <span className="opacity-[0.8]">Verification code sent to</span> {newAccount.email}{" "}
                    <span className="opacity-[0.8]">Please check your inbox and enter the code below.</span>
                </p>

                <form onSubmit={onVerify} className="mt-[10px] flex w-full flex-col items-center justify-start gap-[20px]">
                    <InputOTP maxLength={6} value={verificationOTP} onChange={setVerificationOTP} disabled={isDisabled}>
                        <InputOTPGroup>
                            <InputOTPSlot index={0} className="h-[42px] w-[42px] text-[18px]" />
                            <InputOTPSlot index={1} className="h-[42px] w-[42px] text-[18px]" />
                            <InputOTPSlot index={2} className="h-[42px] w-[42px] text-[18px]" />
                            <InputOTPSlot index={3} className="h-[42px] w-[42px] text-[18px]" />
                            <InputOTPSlot index={4} className="h-[42px] w-[42px] text-[18px]" />
                            <InputOTPSlot index={5} className="h-[42px] w-[42px] text-[18px]" />
                        </InputOTPGroup>
                    </InputOTP>

                    <Button size="lg" loading={loading} disabled={isDisabled} className="h-[45px] w-full" type="submit">
                        Verify Code
                    </Button>

                    <button
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                            setPendingVerification(false);
                            setVerificationOTP("");
                        }}
                        className="text-sm opacity-[0.6] underline disabled:cursor-not-allowed"
                    >
                        Change email
                    </button>
                </form>
            </>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-[16px]">
            <div className={`flex flex-col gap-[7px] ${styles.heroText}`}>
                <Label htmlFor="signup-name">Name</Label>
                <Input
                    id="signup-name"
                    name="name"
                    disabled={isDisabled}
                    value={newAccount.name}
                    onChange={(e) => setNewAccount((prev) => ({ ...prev, name: e.target.value }))}
                    spellCheck={false}
                    placeholder="your name..."
                    required
                />
            </div>

            <div className={`flex flex-col gap-[7px] ${styles.heroText}`} style={{ animationDelay: "0.1s" }}>
                <Label htmlFor="signup-email">Email</Label>
                <Input
                    id="signup-email"
                    name="email"
                    disabled={isDisabled}
                    type="email"
                    value={newAccount.email}
                    onChange={(e) => setNewAccount((prev) => ({ ...prev, email: e.target.value }))}
                    spellCheck={false}
                    placeholder="your email..."
                    required
                />
            </div>

            <div className={`flex flex-col gap-[7px] ${styles.heroText}`} style={{ animationDelay: "0.2s" }}>
                <Label htmlFor="signup-password">Password</Label>
                <div className="flex gap-[8px]">
                    <Input
                        id="signup-password"
                        name="password"
                        disabled={isDisabled}
                        type={showPassword ? "text" : "password"}
                        value={newAccount.password}
                        onChange={(e) => setNewAccount((prev) => ({ ...prev, password: e.target.value }))}
                        spellCheck={false}
                        required
                    />
                    <Button
                        type="button"
                        disabled={isDisabled}
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="w-[32px] h-[32px]"
                        variant="outline"
                        size="icon-sm"
                        aria-label="Toggle password visibility"
                    >
                        <EyeIcon />
                    </Button>
                </div>
            </div>

            <div className={`flex flex-col gap-[7px] ${styles.heroText}`} style={{ animationDelay: "0.3s" }}>
                <Label htmlFor="signup-confirm-password">Confirm Password</Label>
                <Input
                    id="signup-confirm-password"
                    name="confirmPassword"
                    disabled={isDisabled}
                    type={showPassword ? "text" : "password"}
                    value={newAccount.confirmPassword}
                    onChange={(e) => setNewAccount((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                    spellCheck={false}
                    required
                />
            </div>

            <Button
                disabled={
                    isDisabled ||
                    newAccount.name.length < 3 ||
                    newAccount.email.length < 3 ||
                    !newAccount.password.length ||
                    newAccount.confirmPassword !== newAccount.password
                }
                style={{ animationDelay: "0.4s" }}
                className={styles.heroText}
                loading={loading}
                type="submit"
                size="lg"
            >
                Create Account
            </Button>
        </form>
    );
}

type OldAccountFormProps = {
    redirectUrl: string;
    getClerk: () => Promise<any | null>;
    globalLoading: boolean;
    onLoadingChange: (loading: boolean) => void;
};

function OldAccountForm({ redirectUrl, getClerk, globalLoading, onLoadingChange }: OldAccountFormProps) {
    const [accountDetails, setAccountDetails] = useState({ email: "", password: "" });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const isDisabled = loading || globalLoading;

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (isDisabled) return;

        if (!accountDetails.email || !accountDetails.password) {
            toast.error("Please enter both email and password");
            return;
        }

        const clerk = await getClerk();
        if (!clerk) {
            toast.error("Auth is still loading. Please try again.");
            return;
        }

        const signIn = clerk.client.signIn;

        setLoading(true);
        onLoadingChange(true);
        try {
            const result = await signIn.create({
                identifier: accountDetails.email,
                password: accountDetails.password,
            });

            if (result.status === "complete") {
                await finalizeAuthAndRedirect(clerk, result.createdSessionId, redirectUrl);
                toast.success("Login successful! Redirecting...");
            } else {
                toast.error("Login incomplete. Please check your credentials or try a different method.");
            }
        } catch (err: any) {
            const errorMessage = err.errors?.[0]?.message || "An error occurred during login";
            toast.error(errorMessage);
        } finally {
            setLoading(false);
            onLoadingChange(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-[16px]">
            <div className={`flex flex-col gap-[7px] ${styles.heroText}`}>
                <Label htmlFor="login-email">Email</Label>
                <Input
                    id="login-email"
                    name="email"
                    disabled={isDisabled}
                    type="email"
                    value={accountDetails.email}
                    onChange={(e) => setAccountDetails((prev) => ({ ...prev, email: e.target.value }))}
                    spellCheck={false}
                    placeholder="your email..."
                    required
                />
            </div>

            <div className={`flex flex-col gap-[7px] ${styles.heroText}`} style={{ animationDelay: "0.1s" }}>
                <Label htmlFor="login-password">Password</Label>
                <div className="flex gap-[8px]">
                    <Input
                        id="login-password"
                        name="password"
                        disabled={isDisabled}
                        type={showPassword ? "text" : "password"}
                        value={accountDetails.password}
                        onChange={(e) => setAccountDetails((prev) => ({ ...prev, password: e.target.value }))}
                        spellCheck={false}
                        required
                    />
                    <Button
                        type="button"
                        disabled={isDisabled}
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="w-[32px] h-[32px]"
                        variant="outline"
                        size="icon-sm"
                        aria-label="Toggle password visibility"
                    >
                        <EyeIcon />
                    </Button>
                </div>
            </div>

            <Button size="lg" style={{ animationDelay: "0.2s" }} type="submit" className={styles.heroText} loading={loading} disabled={isDisabled}>
                Login
            </Button>
        </form>
    );
}

export default function LoginPage() {
    const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
    const [oauthLoading, setOauthLoading] = useState(false);
    const [signInLoading, setSignInLoading] = useState(false);
    const [signUpLoading, setSignUpLoading] = useState(false);

    const isAnyLoading = oauthLoading || signInLoading || signUpLoading;

    const getClerk = async () => {
        if (typeof window === "undefined") return null;
        const clerk = (window as { Clerk?: any }).Clerk;
        if (!clerk) {
            return null;
        }

        if (!clerk.loaded) {
            await clerk.load?.();
        }

        if (!clerk?.loaded || !clerk?.client) {
            return null;
        }

        return clerk;
    };

    const redirectUrl = useMemo(() => {
        if (typeof window === "undefined") return getDefaultRedirectPath();
        const raw = new URLSearchParams(window.location.search).get("redirect_url");
        return resolveSafeRedirectTarget(raw, window.location.origin);
    }, []);

    const handleGoogleAuthClick = async () => {
        const clerk = await getClerk();
        if (!clerk) {
            toast.error("Auth is still loading. Please try again.");
            return;
        }

        const signIn = clerk.client.signIn;

        setOauthLoading(true);
        try {
            await signIn.authenticateWithRedirect({
                strategy: "oauth_google",
                redirectUrl: "/welcome",
                redirectUrlComplete: redirectUrl,
            });
        } catch (err: any) {
            toast.error(err.errors?.[0]?.message || "Failed to start Google login");
            setOauthLoading(false);
        }
    };

    return (
        <div className="mx-auto flex min-h-[100svh] w-full max-w-[420px] flex-col items-center justify-start gap-[30px] px-5 pt-22">
            <ScrollToTop />
            <img src="/appLogo.png" height={70} width={70} alt="Whitepapper" />

            {authMode === "login" ? (
                <h1 className="text-[20px]">Welcome back</h1>
            ) : (
                <h1 className="text-[20px]">Join Whitepapper</h1>
            )}

            <div className="flex w-full flex-col gap-[12px]">
                {authMode === "login" ? (
                    <OldAccountForm
                        redirectUrl={redirectUrl}
                        getClerk={getClerk}
                        globalLoading={isAnyLoading}
                        onLoadingChange={setSignInLoading}
                    />
                ) : (
                    <NewAccountForm
                        redirectUrl={redirectUrl}
                        getClerk={getClerk}
                        globalLoading={isAnyLoading}
                        onLoadingChange={setSignUpLoading}
                    />
                )}

                <p className="text-center text-[12px] opacity-[0.7]">or</p>

                <Button
                    onClick={handleGoogleAuthClick}
                    loading={oauthLoading}
                    disabled={isAnyLoading}
                    size="lg"
                    className={`${styles.heroText} w-full bg-[white] text-[black] hover:bg-[white]/70`}
                >
                    <img src={googleLogo.src} alt="Google" height={17} width={17} className="mr-[10px]" /> Continue with Google
                </Button>

                <div className="flex justify-center text-[14px] opacity-[0.9] underline select-none mt-2">
                    {authMode === "login" ? (
                        <p
                            onClick={() => {
                                if (!isAnyLoading) setAuthMode("signup");
                            }}
                            className={isAnyLoading ? "cursor-not-allowed opacity-[0.5]" : "cursor-pointer"}
                        >
                            Create a new account
                        </p>
                    ) : (
                        <p
                            onClick={() => {
                                if (!isAnyLoading) setAuthMode("login");
                            }}
                            className={isAnyLoading ? "cursor-not-allowed opacity-[0.5]" : "cursor-pointer"}
                        >
                            Already have an account ?
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
