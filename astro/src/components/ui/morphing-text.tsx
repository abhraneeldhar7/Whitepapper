import { useState, useEffect } from 'react';
import { cn } from "@/lib/utils";

interface MorphingTextProps {
  texts: string[];
  activeTime?: number; // How long it stays fully visible (e.g., 2000)
  className?: string;
}

const MorphingText: React.FC<MorphingTextProps> = ({
  texts,
  activeTime = 1700,
  className,
}) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % texts.length);
    }, activeTime);

    return () => clearInterval(interval);
  }, [texts.length, activeTime]);

  return (
    // Parent provides the area; items-start as requested, but children center themselves
    <div className="relative inline-flex items-start">
      {texts.map((text, i) => {
        const isActive = i === index;
        
        return (
          <div
            key={`${text}-${i}`}
            className="flex items-center justify-center transition-all ease-in-out duration-800"
            style={{
              // Absolute stacking prevents layout jumping
              position: i === 0 ? 'relative' : 'absolute',
              top: 0,
              left: 0,
              // Smooth native transitions
              opacity: isActive ? 1 : 0,
              transform: isActive ? 'scale(1)' : 'scale(0.8)',
              filter: isActive ? 'blur(0px)' : 'blur(8px)',
              zIndex: isActive ? 10 : 0,
              pointerEvents: isActive ? 'auto' : 'none',
            }}
          >
            <span className={cn("whitespace-nowrap", className)}>
              {text}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default MorphingText;