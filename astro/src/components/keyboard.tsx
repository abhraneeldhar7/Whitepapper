import { cn } from '@/lib/utils';
import React, { useEffect, useState } from 'react';

interface KeyDisplay {
    label: string;
    width: string;
}

export default function OnscreenKeyboard({ className }: { className?: string }) {
    const releaseDelayMs = 100;
    const [activeCodes, setActiveCodes] = useState<Set<string>>(() => new Set());
    const releaseTimersRef = React.useRef<Map<string, number>>(new Map());

    useEffect(() => {
        const clearAllActiveKeys = (): void => {
            releaseTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
            releaseTimersRef.current.clear();
            setActiveCodes((prev) => (prev.size === 0 ? prev : new Set()));
        };

        const handleKeyDown = (e: KeyboardEvent): void => {
            const code = e.code;
            if (!code) return;

            const pending = releaseTimersRef.current.get(code);
            if (pending) {
                window.clearTimeout(pending);
                releaseTimersRef.current.delete(code);
            }

            setActiveCodes((prev) => {
                if (prev.has(code)) return prev;
                const next = new Set(prev);
                next.add(code);
                return next;
            });
        };

        const handleKeyUp = (e: KeyboardEvent): void => {
            const code = e.code;
            if (!code) return;

            const pending = window.setTimeout(() => {
                setActiveCodes((prev) => {
                    if (!prev.has(code)) return prev;
                    const next = new Set(prev);
                    next.delete(code);
                    return next;
                });
                releaseTimersRef.current.delete(code);
            }, releaseDelayMs);

            releaseTimersRef.current.set(code, pending);
        };

        const handleVisibilityChange = (): void => {
            if (document.hidden) {
                clearAllActiveKeys();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', clearAllActiveKeys);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', clearAllActiveKeys);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            clearAllActiveKeys();
        };
    }, []);

    // Key row definitions (standard US layout)
    const rows: string[][] = [
        ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'Backspace'],
        ['Tab', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'],
        ['CapsLock', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'", 'Enter'],
        ['Shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', 'Shift'],
        ['Control', 'Alt', 'Meta', ' ', 'Alt', 'Control'],
    ];

    const getKeyDisplay = (key: string): KeyDisplay => {
        switch (key) {
            case 'Backspace':
                return { label: '⌫', width: 'w-16' };
            case 'Tab':
                return { label: 'Tab ⇥', width: 'w-14' };
            case 'CapsLock':
                return { label: 'Caps Lock', width: 'w-20' };
            case 'Enter':
                return { label: '↵ Enter', width: 'w-20' };
            case 'Shift':
                return { label: '⇧ Shift', width: 'w-20' };
            case 'Control':
                return { label: 'Ctrl', width: 'w-16' };
            case 'Alt':
                return { label: 'Alt', width: 'w-16' };
            case 'Meta':
                return { label: '⌘', width: 'w-16' };
            case ' ':
                return { label: '', width: 'w-80' }; // Spacebar
            default:
                return { label: key, width: 'w-16' };
        }
    };

    const mapKeyIdentifierToCodes = (keyIdentifier: string): string[] => {
        if (keyIdentifier.length === 1 && /[a-zA-Z]/.test(keyIdentifier)) {
            return [`Key${keyIdentifier.toUpperCase()}`];
        }

        switch (keyIdentifier) {
            case '`':
                return ['Backquote'];
            case '1':
                return ['Digit1'];
            case '2':
                return ['Digit2'];
            case '3':
                return ['Digit3'];
            case '4':
                return ['Digit4'];
            case '5':
                return ['Digit5'];
            case '6':
                return ['Digit6'];
            case '7':
                return ['Digit7'];
            case '8':
                return ['Digit8'];
            case '9':
                return ['Digit9'];
            case '0':
                return ['Digit0'];
            case '-':
                return ['Minus'];
            case '=':
                return ['Equal'];
            case '[':
                return ['BracketLeft'];
            case ']':
                return ['BracketRight'];
            case '\\':
                return ['Backslash'];
            case ';':
                return ['Semicolon'];
            case "'":
                return ['Quote'];
            case ',':
                return ['Comma'];
            case '.':
                return ['Period'];
            case '/':
                return ['Slash'];
            case 'Backspace':
                return ['Backspace'];
            case 'Tab':
                return ['Tab'];
            case 'CapsLock':
                return ['CapsLock'];
            case 'Enter':
                return ['Enter'];
            case 'Shift':
                return ['ShiftLeft', 'ShiftRight'];
            case 'Control':
                return ['ControlLeft', 'ControlRight'];
            case 'Alt':
                return ['AltLeft', 'AltRight'];
            case 'Meta':
                return ['MetaLeft', 'MetaRight'];
            case ' ':
                return ['Space'];
            default:
                return [keyIdentifier];
        }
    };

    const isActive = (keyIdentifier: string): boolean => {
        const codes = mapKeyIdentifierToCodes(keyIdentifier);
        return codes.some((code) => activeCodes.has(code));
    };

    return (
        <div className={cn("max-w-4xl pointer-events-none", className)}>
            <div className="flex flex-col gap-1">
                {rows.map((row: string[], rowIndex: number) => (
                    <div key={rowIndex} className="flex justify-center gap-1">
                        {row.map((key: string) => {
                            const { label, width } = getKeyDisplay(key);
                            const active = isActive(key);

                            return (
                                <div
                                    key={`${key}-${rowIndex}`}
                                    className={`
                    ${width} h-16 flex items-center justify-center font-[400] text-sm text-background
                    rounded-md transition-all duration-300 bg-foreground/5 border-foreground/5 border
                    ${active ? "opacity-[1]" : "opacity-[0]"}
                  `}>
                                    {/* {label} */}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div >
    );
};
