import React from 'react';

export default function Footer() {
  return (
    <footer className="border-t mt-20">
      <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-sm text-slate-600">
        <div>© 2025 SyncVeil Inc.</div>
        <nav className="flex flex-wrap gap-4">
          <a href="/" className="hover:text-indigo-600">Home</a>
          <a href="/" className="hover:text-indigo-600">Open App</a>
          <a href="./privacy-policy.html" className="hover:text-indigo-600">Privacy Policy</a>
          <a href="./terms-of-service.html" className="hover:text-indigo-600">Terms of Service</a>
          <a href="./cookie-policy.html" className="hover:text-indigo-600">Cookie Policy</a>
        </nav>
      </div>
    </footer>
  );
}
