

export default function TweetStack() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [isDesktop, setIsDesktop] = useState(false);

  // Keep transform behavior responsive: mobile stacks only on Y, desktop on X + Y.
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const updateIsDesktop = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsDesktop(e.matches);
    };

    updateIsDesktop(mediaQuery);
    mediaQuery.addEventListener('change', updateIsDesktop);

    return () => {
      mediaQuery.removeEventListener('change', updateIsDesktop);
    };
  }, []);

  // Handle the auto-play timer
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (direction === 'forward') {
      if (activeIndex < TWEETS_DATA.length - 1) {
        // Swipe next card every 1.5 seconds
        timer = setTimeout(() => {
          setActiveIndex((prev) => prev + 1);
        }, 1500);
      } else {
        // Reached the last card: wait 1.5s then trigger reverse
        timer = setTimeout(() => {
          setDirection('backward');
        }, 1500);
      }
    } else {
      if (activeIndex > 0) {
        // Reverse fast: every 0.2 seconds
        timer = setTimeout(() => {
          setActiveIndex((prev) => prev - 1);
        }, 200);
      } else {
        // Back to start: wait 1.5s then go forward again
        timer = setTimeout(() => {
          setDirection('forward');
        }, 1500);
      }
    }

    return () => clearTimeout(timer);
  }, [activeIndex, direction]);

  return (
    <div className="flex items-center justify-center w-full py-10 px-4">
      {/* Container needs to be relative and large enough to hold the offset cards */}
      <div className="relative w-full md:w-[400px]  h-[300px]">
        {TWEETS_DATA.map((tweet, index) => {
          // 'pos' represents the card's position relative to the active card
          const pos = index - activeIndex;

          // If pos < 0, it means the card has been swiped away
          const isSwiped = pos < 0;

          // Clamp the position so cards behind the MAX_VISIBLE_CARDS sit exactly 
          // at the position of the last visible card (perfectly overshadowed).
          const clampedPos = Math.min(Math.max(pos, 0), MAX_VISIBLE_CARDS - 1);

          // Calculate visual offsets
          let translateX = 0;
          let translateY = 0;
          let scale = 1;
          let opacity = 1;
          
          // Higher original index means it's deeper in the stack. 
          // Z-index must be highest for the front-most cards.
          const zIndex = TWEETS_DATA.length - index;

          if (isSwiped) {
            // Swiped cards go right and fade out
            translateX = 400; 
            opacity = 0;
          } else {
            // Stack logic: Each consecutive card is lifted up (-Y) and left (-X)
            translateX = isDesktop ? -clampedPos * 20 : 0; // X offset only on desktop
            translateY = -clampedPos * 20; // 20px up per stack level
            scale = isDesktop ? 1 : Math.max(0.85, 1 - clampedPos * 0.05); // Mobile cards get progressively smaller
            
            // Hide cards that are beyond the visible limit so their shadows/borders 
            // don't bleed through the last visible card
            if (pos >= MAX_VISIBLE_CARDS) {
              opacity = 0;
            }
          }

          return (
            <div
              key={tweet.id}
              className={`absolute top-0 left-0 w-full p-6 bg-white rounded-2xl shadow-xl border border-slate-100 ease-out`}
              style={{
                // duration-500 css transition creates the smooth slide in/out
                transition: 'transform 0.5s ease-out, opacity 0.5s ease-out',
                transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
                opacity: opacity,
                zIndex: zIndex,
              }}
            >
              {/* Tweet Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-500 font-bold">
                    {tweet.author.charAt(0)}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-800 leading-tight">
                      {tweet.author}
                    </span>
                    <span className="text-sm text-slate-500 leading-tight">
                      {tweet.handle}
                    </span>
                  </div>
                </div>
                <span className="text-slate-400 text-sm">{tweet.time}</span>
              </div>

              {/* Tweet Body */}
              <p className="text-slate-700 leading-relaxed mb-4">
                {tweet.content}
              </p>

              {/* Tweet Actions (Mock) */}
              <div className="flex items-center justify-between text-slate-400 text-sm pr-4">
                <button className="hover:text-blue-500 transition-colors">💬 12</button>
                <button className="hover:text-green-500 transition-colors">🔁 4</button>
                <button className="hover:text-red-500 transition-colors">❤️ 48</button>
                <button className="hover:text-blue-500 transition-colors">📊 1.2k</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}