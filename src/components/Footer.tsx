import React from 'react';
import { Heart } from 'lucide-react';

/**
 * Global site footer.
 * Shows on every page (landing, login, admin, student).
 * Respects the existing dark-mode palette (html.dark overrides).
 */
export function Footer() {
  const year = 2026;
  return (
    <footer className="mt-auto w-full border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          {/* Copyright / Faculty line */}
          <p className="text-center text-xs font-medium text-slate-500 sm:text-left sm:text-sm">
            &copy; {year}{' '}
            <span className="font-bold text-slate-700">The Apex World</span>
            {' • '}
            Faculty: Mr. Subhamoy Mondal. All rights reserved.
          </p>

          {/* Built with love line */}
          <p className="flex items-center gap-1.5 text-center text-xs text-slate-500 sm:text-sm">
            Built with
            <Heart
              className="h-3.5 w-3.5 fill-rose-500 text-rose-500"
              aria-hidden="true"
            />
            by
            <span className="font-bold text-slate-700">A&amp;T Tech Firm</span>
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
