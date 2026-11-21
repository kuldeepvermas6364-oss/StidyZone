import React from 'react';

interface PrepZoneLogoProps {
  compact?: boolean;
}

export const PrepZoneLogo: React.FC<PrepZoneLogoProps> = ({ compact = false }) => {
  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 select-none">
      <svg
        width="32"
        height="32"
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="w-8 h-8 shrink-0"
      >
        <rect width="64" height="64" rx="16" className="fill-blue-600 dark:fill-blue-500" />
        <path
          d="M18 19.5C18 17.567 19.567 16 21.5 16H35.5C42.9558 16 48 20.4772 48 27C48 33.5228 42.9558 38 35.5 38H26V48H18V19.5ZM26 23V31H35C38.5899 31 40.5 29.3431 40.5 27C40.5 24.6569 38.5899 23 35 23H26Z"
          fill="#FFFFFF"
        />
        <path d="M35 42H46L39.5 48H31L35 42Z" className="fill-blue-200 dark:fill-blue-100" />
      </svg>
      {!compact && (
        <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0">
          Prep<span className="text-blue-600 dark:text-blue-400">Zone</span>
        </span>
      )}
    </span>
  );
};
