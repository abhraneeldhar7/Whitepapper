import { useEffect, useState } from "react";

interface Tweet {
  id: string;
  author: string;
  handle: string;
  content: string;
  time: string;
}

const TWEETS_DATA: Tweet[] = Array.from({ length: 10 }).map((_, i) => ({
  id: `tweet-${i}`,
  author: `User ${i + 1}`,
  handle: `@user${i + 1}_dev`,
  content: `This is tweet number ${i + 1}. Building an awesome stacking card animation using pure React, Tailwind, and CSS transitions!`,
  time: `${i + 1}h`,
}));

const MAX_VISIBLE_CARDS = 4;
const SWIPE_INTERVAL_MS = 1500;
const SWIPE_DURATION_MS = 500;

export default function TweetStack() {
  const [cards, setCards] = useState<Tweet[]>(TWEETS_DATA);
  const [isSwiping, setIsSwiping] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    if (cards.length === 0) {
      return;
    }

    if (isSwiping) {
      timer = setTimeout(() => {
        setCards((prev) => {
          if (prev.length <= 1) {
            return prev;
          }
          return [...prev.slice(1), prev[0]];
        });
        setIsSwiping(false);
      }, SWIPE_DURATION_MS);
    } else {
      timer = setTimeout(() => {
        setIsSwiping(true);
      }, SWIPE_INTERVAL_MS);
    }

    return () => clearTimeout(timer);
  }, [cards.length, isSwiping]);

  return (
    <div className="flex items-center justify-center h-[360px] overflow-hidden">
      <div className="relative w-[320px] sm:w-[400px] h-[220px]">
        {cards.map((tweet, index) => {
          const isTopCard = index === 0;
          const isSwiped = isSwiping && isTopCard;
          const visualPos = isSwiping ? index - 1 : index;
          const clampedPos = Math.min(Math.max(visualPos, 0), MAX_VISIBLE_CARDS - 1);

          let translateX = 0;
          let translateY = 0;
          let opacity = 1;
          const zIndex = cards.length - index;

          if (isSwiped) {
            translateX = 400;
            opacity = 0;
          } else {
            translateX = -clampedPos * 20;
            translateY = -clampedPos * 20;
            if (visualPos >= MAX_VISIBLE_CARDS) {
              opacity = 0;
            }
          }

          return (
            <div
              key={tweet.id}
              className="absolute top-0 left-0 w-full p-6 bg-white rounded-2xl shadow-xl border border-slate-100 ease-out"
              style={{
                transition: "transform 0.5s ease-out, opacity 0.5s ease-out",
                transform: `translate(${translateX}px, ${translateY}px)`,
                opacity,
                zIndex,
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-500 font-bold">
                    {tweet.author.charAt(0)}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-800 leading-tight">{tweet.author}</span>
                    <span className="text-sm text-slate-500 leading-tight">{tweet.handle}</span>
                  </div>
                </div>
                <span className="text-slate-400 text-sm">{tweet.time}</span>
              </div>

              <p className="text-slate-700 leading-relaxed mb-4">{tweet.content}</p>

              <div className="flex items-center justify-between text-slate-400 text-sm pr-4">
                <button className="hover:text-blue-500 transition-colors">Reply 12</button>
                <button className="hover:text-green-500 transition-colors">Repost 4</button>
                <button className="hover:text-red-500 transition-colors">Like 48</button>
                <button className="hover:text-blue-500 transition-colors">Views 1.2k</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
