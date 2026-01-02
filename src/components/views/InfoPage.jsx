import React, { useState } from 'react';

export default function InfoPage({ onSwitchView }) {
  const [title, setTitle] = useState('Information');
  const [content, setContent] = useState('');

  React.useEffect(() => {
    // This would be called from the parent with actual content
    // For now, it's a placeholder
  }, []);

  return (
    <div id="view-info" className="view-section active">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <button
          onClick={() => onSwitchView('home')}
          className="mb-8 text-slate-500 hover:text-indigo-600 font-medium flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back
        </button>

        <h1 id="info-title" className="text-4xl font-bold text-slate-900 mb-8">{title}</h1>
        <div id="info-content" className="prose prose-slate max-w-none">
          {content ? (
            <div dangerouslySetInnerHTML={{ __html: content }} />
          ) : (
            <div className="text-slate-600">
              <p className="mb-4">This is a placeholder page for information content. In a production environment, this would contain specific details pertinent to the user's selection.</p>
              <p>SyncVeil is dedicated to ensuring transparency in all our operations.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
