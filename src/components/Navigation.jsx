import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';

export default function Navigation({ onSwitchView, onScrollToSection }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handleNavClick = (action) => {
    setMobileMenuOpen(false);
    action();
  };

  return (
    <nav id="public-nav" className="border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 md:h-20">
          <div 
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => onSwitchView('home')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-indigo-600 group-hover:scale-110 transition-transform">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span className="text-2xl font-bold org-name text-slate-900">SyncVeil</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a 
              href="javascript:void(0)" 
              onClick={() => onSwitchView('home')}
              className="text-slate-600 hover:text-indigo-600 font-medium transition-colors text-sm"
            >
              Product
            </a>
            <a 
              href="javascript:void(0)" 
              onClick={() => {
                onSwitchView('home');
                setTimeout(() => {
                  const el = document.getElementById('news-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }}
              className="text-slate-600 hover:text-indigo-600 font-medium transition-colors text-sm"
            >
              Breach News
            </a>
            <a 
              href="./auth.html"
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors text-sm"
            >
              Sign In
            </a>
          </div>

          <button 
            className="md:hidden text-slate-700 p-2 hover:bg-slate-100 rounded-lg transition-colors"
            onClick={toggleMobileMenu}
            aria-label="Open menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div id="mobile-menu" className="open px-4 pt-2 pb-6 space-y-2 md:hidden">
            <a 
              href="javascript:void(0)" 
              onClick={() => handleNavClick(() => onSwitchView('home'))}
              className="block px-3 py-2 text-base font-medium text-slate-600 hover:text-indigo-600 hover:bg-slate-50 rounded-lg"
            >
              Product
            </a>
            <a 
              href="javascript:void(0)" 
              onClick={() => {
                handleNavClick(() => {
                  onSwitchView('home');
                  setTimeout(() => {
                    const el = document.getElementById('news-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                });
              }}
              className="block px-3 py-2 text-base font-medium text-slate-600 hover:text-indigo-600 hover:bg-slate-50 rounded-lg"
            >
              Breach News
            </a>
            <a 
              href="./auth.html"
              className="block px-3 py-2 text-base font-medium text-slate-600 hover:text-indigo-600 hover:bg-slate-50 rounded-lg"
            >
              Sign In
            </a>
          </div>
        )}
      </div>
    </nav>
  );
}
