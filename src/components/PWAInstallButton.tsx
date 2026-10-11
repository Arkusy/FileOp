import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X, Check, Share2 } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // If already running in standalone mode as installed PWA, hide
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const installed = await install();
      if (!installed) {
        setShowGuide(true);
      }
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        onClick={handleInstallClick}
        type="button"
        title="Install FileConvert as App"
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer"
      >
        <Smartphone className="w-3.5 h-3.5 stroke-[2.5]" />
        <span>Install App</span>
      </button>

      {/* Mobile Install Guide Dialog for iOS and other browsers */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowGuide(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-500 flex items-center justify-center mb-4">
              <Download className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Install FileConvert
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Add FileConvert to your home screen to use it offline anytime like a native mobile app.
            </p>

            {isIOS ? (
              <div className="mt-4 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs space-y-2 text-slate-700 dark:text-slate-300">
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center shrink-0">1</span>
                  <span>Tap the <strong className="text-slate-900 dark:text-white">Share</strong> icon in your Safari toolbar.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center shrink-0">2</span>
                  <span>Scroll down and select <strong className="text-slate-900 dark:text-white">Add to Home Screen</strong>.</span>
                </div>
              </div>
            ) : (
              <div className="mt-4 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs space-y-2 text-slate-700 dark:text-slate-300">
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center shrink-0">1</span>
                  <span>Tap the <strong className="text-slate-900 dark:text-white">three dots menu (⋮)</strong> in Chrome.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center shrink-0">2</span>
                  <span>Tap <strong className="text-slate-900 dark:text-white">Add to Home screen</strong> or <strong className="text-slate-900 dark:text-white">Install app</strong>.</span>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-bold transition-colors cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
