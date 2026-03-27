import { cn } from '@/lib/utils';
import React, { useId } from 'react';

export interface FolderNotesProps {
  logoUrl?: string|null;
  /** Width of the component. Scales perfectly. */
  width?: number | string;
  /** Height of the component. Scales perfectly. */
  height?: number | string;
  /** Optional class name for the wrapper */
  className?: string;
}

const FolderNotes: React.FC<FolderNotesProps> = ({
  logoUrl,
  width,
  height,
  className = '',
}) => {
  // Generate unique IDs for SVG defs to prevent conflicts if multiple are rendered
  const idPrefix = useId().replace(/:/g, '');
  const backGrad = `backGrad-${idPrefix}`;
  const glassFill = `glassFill-${idPrefix}`;
  const glassStroke = `glassStroke-${idPrefix}`;
  const paperShadow = `paperShadow-${idPrefix}`;
  const mainShadow = `mainShadow-${idPrefix}`;
  const glassBlur = `glassBlur-${idPrefix}`;
  const glassClip = `glassClip-${idPrefix}`;
  const paper1Class = `paper1-${idPrefix}`;
  const paper2Class = `paper2-${idPrefix}`;
  const paper3Class = `paper3-${idPrefix}`;
  const wrapperClass = `folder-wrap-${idPrefix}`;

  // The perfectly traced path for the modern glass folder front pane
  const frontFolderPath =
    `M 74 340 
     L 326 340 
     A 24 24 0 0 0 350 316 
     L 350 214 
     A 24 24 0 0 0 326 190 
     L 190 190 
     C 175 190, 165 160, 150 160 
     L 74 160 
     A 24 24 0 0 0 50 184 
     L 50 316 
     A 24 24 0 0 0 74 340 Z`;

  return (
    <div
      className={cn("md:w-[180px] md:h-[180px]", `${wrapperClass} ${className}`)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: width ?? undefined,
        height: height ?? undefined,
      }}
    >
      {/* {logoUrl &&
        <img
          src={logoUrl}
          alt="P"
          className="h-[35px] w-[35px] absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 rounded-[12px] z-2 object-cover"
        />} */}
      <svg
        viewBox="35 70 330 300"
        style={{ width: '100%', height: '100%', display: 'block' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <style>{`
          .${paper1Class}, .${paper2Class}, .${paper3Class} {
            transform-box: view-box;
            transform-origin: 220px 200px;
            transition: transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
          }
          .${paper1Class} {
            transform: translate(-52px, 22px) rotate(-9deg);
          }
          .${paper2Class} {
            transform: translate(-10px, 11px) rotate(0deg);
          }
          .${paper3Class} {
            transform: translate(32px, 28px) rotate(10deg);
          }
          @media (hover: hover) and (pointer: fine) {
            .${wrapperClass}:hover .${paper1Class} {
              transform: translate(-68px, 12px) rotate(-14deg);
            }
            .${wrapperClass}:hover .${paper2Class} {
              transform: translate(-10px, 6px) rotate(0deg);
            }
            .${wrapperClass}:hover .${paper3Class} {
              transform: translate(50px, 18px) rotate(15deg);
            }
          }
          @media (hover: none) and (pointer: coarse) {
            .${wrapperClass}:active .${paper1Class} {
              transform: translate(-68px, 12px) rotate(-14deg);
            }
            .${wrapperClass}:active .${paper2Class} {
              transform: translate(-10px, 6px) rotate(0deg);
            }
            .${wrapperClass}:active .${paper3Class} {
              transform: translate(50px, 18px) rotate(15deg);
            }
          }
        `}</style>
        <defs>
          {/* Main Drop Shadow for the entire icon */}
          <filter id={mainShadow} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="15" stdDeviation="20" floodColor="#000000" floodOpacity="0.25" />
          </filter>

          {/* Shadow for the individual papers */}
          <filter id={paperShadow} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="-2" dy="6" stdDeviation="6" floodColor="#000000" floodOpacity="0.12" />
          </filter>

          {/* Glassmorphism background blur filter */}
          <filter id={glassBlur} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" />
            <feColorMatrix type="matrix" values="1.1 0 0 0 0  0 1.1 0 0 0  0 0 1.1 0 0  0 0 0 1 0" />
          </filter>

          {/* Clip path to constrain the blur effect to the glass shape */}
          <clipPath id={glassClip}>
            <path d={frontFolderPath} />
          </clipPath>

          {/* Gradients */}
          <linearGradient id={backGrad} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2A2A2E" />
            <stop offset="100%" stopColor="#111113" />
          </linearGradient>

          <linearGradient id={glassFill} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
            <stop offset="35%" stopColor="#ffffff" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.15" />
          </linearGradient>

          <linearGradient id={glassStroke} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* Outer overall shadow catcher */}
        <rect x="60" y="140" width="280" height="200" rx="28" fill="rgba(0,0,0,0)" filter={`url(#${mainShadow})`} />

        {/* Main content behind the glass */}
        <g>
          {/* Back Folder */}
          <rect x="50" y="110" width="300" height="230" rx="28" fill={`url(#${backGrad})`} />
          {/* Back Folder Inner Rim */}
          <rect x="51.5" y="111.5" width="297" height="227" rx="26.5" fill="none" stroke="#4a4a50" strokeWidth="1.5" />

          {/* Paper 3 (Back-most, Right) */}
          <g className={paper3Class}>
            <rect x="140" y="100" width="130" height="180" rx="12" fill="#E8E8EB" filter={`url(#${paperShadow})`} />
            <rect x="155" y="120" width="50" height="8" rx="4" fill="#CFCFD4" />
            <rect x="155" y="140" width="90" height="6" rx="3" fill="#E0E0E5" />
            <rect x="155" y="155" width="100" height="6" rx="3" fill="#E0E0E5" />
          </g>

          {/* Paper 2 (Middle, Tallest) */}
          <g className={paper2Class}>
            <rect x="150" y="80" width="140" height="190" rx="12" fill="#F4F4F6" filter={`url(#${paperShadow})`} />
            <rect x="165" y="100" width="70" height="8" rx="4" fill="#D8D8DE" />
            <rect x="165" y="120" width="100" height="6" rx="3" fill="#E8E8EC" />
            <rect x="165" y="135" width="90" height="6" rx="3" fill="#E8E8EC" />
            <rect x="165" y="150" width="110" height="6" rx="3" fill="#E8E8EC" />
          </g>

          {/* Paper 1 (Front-most, Left) */}
          <g className={paper1Class}>
            <rect x="150" y="90" width="150" height="200" rx="12" fill="#FFFFFF" filter={`url(#${paperShadow})`} />
            <rect x="165" y="110" width="60" height="8" rx="4" fill="#E2E2E8" />
            <rect x="165" y="130" width="115" height="6" rx="3" fill="#F0F0F4" />
            <rect x="165" y="145" width="105" height="6" rx="3" fill="#F0F0F4" />
            <rect x="165" y="160" width="120" height="6" rx="3" fill="#F0F0F4" />
            <rect x="165" y="175" width="80" height="6" rx="3" fill="#F0F0F4" />
            <rect x="165" y="190" width="110" height="6" rx="3" fill="#F0F0F4" />
          </g>
        </g>

        {/* --- Glassmorphism Effect Layer --- */}
        {/* 1. Real duplicated content, blurred and clipped to glass shape */}
        <g filter={`url(#${glassBlur})`} clipPath={`url(#${glassClip})`}>
          {/* Back Folder */}
          <rect x="50" y="110" width="300" height="230" rx="28" fill={`url(#${backGrad})`} />
          {/* Back Folder Inner Rim */}
          <rect x="51.5" y="111.5" width="297" height="227" rx="26.5" fill="none" stroke="#4a4a50" strokeWidth="1.5" />

          {/* Paper 3 (Back-most, Right) */}
          <g className={paper3Class}>
            <rect x="140" y="100" width="130" height="180" rx="12" fill="#E8E8EB" filter={`url(#${paperShadow})`} />
            <rect x="155" y="120" width="50" height="8" rx="4" fill="#CFCFD4" />
            <rect x="155" y="140" width="90" height="6" rx="3" fill="#E0E0E5" />
            <rect x="155" y="155" width="100" height="6" rx="3" fill="#E0E0E5" />
          </g>

          {/* Paper 2 (Middle, Tallest) */}
          <g className={paper2Class}>
            <rect x="150" y="80" width="140" height="190" rx="12" fill="#F4F4F6" filter={`url(#${paperShadow})`} />
            <rect x="165" y="100" width="70" height="8" rx="4" fill="#D8D8DE" />
            <rect x="165" y="120" width="100" height="6" rx="3" fill="#E8E8EC" />
            <rect x="165" y="135" width="90" height="6" rx="3" fill="#E8E8EC" />
            <rect x="165" y="150" width="110" height="6" rx="3" fill="#E8E8EC" />
          </g>

          {/* Paper 1 (Front-most, Left) */}
          <g className={paper1Class}>
            <rect x="150" y="90" width="150" height="200" rx="12" fill="#FFFFFF" filter={`url(#${paperShadow})`} />
            <rect x="165" y="110" width="60" height="8" rx="4" fill="#E2E2E8" />
            <rect x="165" y="130" width="115" height="6" rx="3" fill="#F0F0F4" />
            <rect x="165" y="145" width="105" height="6" rx="3" fill="#F0F0F4" />
            <rect x="165" y="160" width="120" height="6" rx="3" fill="#F0F0F4" />
            <rect x="165" y="175" width="80" height="6" rx="3" fill="#F0F0F4" />
            <rect x="165" y="190" width="110" height="6" rx="3" fill="#F0F0F4" />
          </g>
        </g>

        {/* 2. Glass Base Fill overlay to give it brightness and tint */}
        <path
          d={frontFolderPath}
          fill={`url(#${glassFill})`}
        />

        {/* 3. Glass Outer Rim (Glossy Stroke Highlight) */}
        <path
          d={frontFolderPath}
          fill="none"
          stroke={`url(#${glassStroke})`}
          strokeWidth="2.5"
        />
      </svg>
    </div>
  );
};

export default FolderNotes;
