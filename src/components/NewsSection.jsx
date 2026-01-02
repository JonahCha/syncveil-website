import React from 'react';

export default function NewsSection() {
  const breachNews = [
    {
      title: "Major Healthcare Provider Reports Data Breach",
      date: "2025-01-15",
      severity: "Critical",
      recordsAffected: "2.1M",
      icon: "⚠️"
    },
    {
      title: "Financial Services Sector Under Attack",
      date: "2025-01-14",
      severity: "High",
      recordsAffected: "850K",
      icon: "💳"
    },
    {
      title: "Social Media Platform Patches Vulnerability",
      date: "2025-01-13",
      severity: "Medium",
      recordsAffected: "5.3M",
      icon: "👥"
    },
    {
      title: "Retail Chain Confirms Customer Data Exposure",
      date: "2025-01-12",
      severity: "High",
      recordsAffected: "1.2M",
      icon: "🛍️"
    }
  ];

  const getSeverityColor = (severity) => {
    switch(severity) {
      case 'Critical': return 'bg-red-100 text-red-700';
      case 'High': return 'bg-orange-100 text-orange-700';
      case 'Medium': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-blue-100 text-blue-700';
    }
  };

  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-extrabold text-slate-900 mb-6">Latest Breach Intelligence</h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">Stay informed about the latest data breaches and cyber threats affecting organizations worldwide.</p>
        </div>

        <div className="space-y-4">
          {breachNews.map((news, idx) => (
            <div key={idx} className="p-6 bg-gradient-to-r from-slate-50 to-white rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-lg transition-all duration-300">
              <div className="flex items-start gap-4">
                <div className="text-3xl">{news.icon}</div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{news.title}</h3>
                  <p className="text-sm text-slate-600 mb-3">Reported on {new Date(news.date).toLocaleDateString()}</p>
                  <div className="flex flex-wrap gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getSeverityColor(news.severity)}`}>
                      {news.severity}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                      {news.recordsAffected} Records
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
