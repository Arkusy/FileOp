import React from 'react';
import { ArrowLeftRight, Moon, Sun, ShieldCheck } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({ isDarkMode, onToggleTheme }) => {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 py-3.5 px-2 sm:px-4 border-b border-slate-200/80 dark:border-slate-800/80">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-rose-500 to-rose-600 shadow-md shadow-rose-500/20 text-white flex items-center justify-center font-bold">
          <ArrowLeftRight className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              File<span className="text-rose-500">Convert</span>
            </span>
            <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              Local Browser
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
            100% Client-Side Engine · Zero Data Leaves Your Device
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <PWAInstallButton />

        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 shadow-xs">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Zero Server Uploads</span>
        </div>

        <button
          onClick={onToggleTheme}
          aria-label="Toggle theme"
          className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 transition-colors cursor-pointer"
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
        </button>
      </div>
    </header>
  );
};
