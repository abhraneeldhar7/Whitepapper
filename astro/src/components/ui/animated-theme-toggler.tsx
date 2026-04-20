import { useCallback, useEffect, useRef, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { flushSync } from "react-dom"

function cn(...inputs: any[]) {
  const classes: string[] = [];
  inputs.forEach((input) => {
    if (!input) return;
    if (Array.isArray(input)) {
      input.forEach(i => { if (i) classes.push(String(i)); });
      return;
    }
    classes.push(String(input));
  });
  return classes.join(' ');
}

interface AnimatedThemeTogglerProps extends React.ComponentPropsWithoutRef<"button"> {
  duration?: number,
  size?: number
}

export const AnimatedThemeToggler = ({
  className,
  duration = 400,
  size = 18,
  ...props
}: AnimatedThemeTogglerProps) => {
  const [isDark, setIsDark] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const updateTheme = () => {
      setIsDark(document.documentElement.classList.contains("dark"))
    }

    updateTheme()

    const observer = new MutationObserver(updateTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })

    return () => observer.disconnect()
  }, [])

  const toggleTheme = useCallback(() => {
    const button = buttonRef.current
    if (!button) return

    const { top, left, width, height } = button.getBoundingClientRect()
    const x = left + width / 2
    const y = top + height / 2
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight
    const maxRadius = Math.hypot(
      Math.max(x, viewportWidth - x),
      Math.max(y, viewportHeight - y)
    )

    const applyTheme = () => {
      const newTheme = !isDark
      setIsDark(newTheme)
      document.documentElement.classList.toggle("dark")
      localStorage.setItem("theme", newTheme ? "dark" : "light")
      document.cookie = `theme=${newTheme ? "dark" : "light"}; path=/; max-age=31536000`
    }

    if (typeof document.startViewTransition !== "function") {
      applyTheme()
      return
    }

    try {
      const transition = document.startViewTransition(() => {
        flushSync(applyTheme)
      })

      const ready = transition?.ready
      if (ready && typeof ready.then === "function") {
        ready
          .then(() => {
            document.documentElement.animate(
              {
                clipPath: [
                  `circle(0px at ${x}px ${y}px)`,
                  `circle(${maxRadius}px at ${x}px ${y}px)`,
                ],
              },
              {
                duration,
                easing: "ease-in-out",
                pseudoElement: "::view-transition-new(root)",
              }
            )
          })
          .catch(() => {
            // Ignore animation failures; theme is already applied.
          })
      }
    } catch {
      applyTheme()
    }
  }, [isDark, duration])

  return (
    <button
      type="button"
      ref={buttonRef}
      onClick={toggleTheme}
      className={cn(className)}
      {...props}
    >
      {isDark ? <Sun size={size} /> : <Moon size={size} />}
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}
