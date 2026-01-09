import React, { useEffect } from 'react';

export default function BreachMap() {
  let mapInstance = null;

  useEffect(() => {
    if (typeof window.jsVectorMap === 'undefined') {
      // Load jsVectorMap dynamically
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jsvectormap@2.1.1/dist/index.min.js';
      script.onload = initMap;
      document.head.appendChild(script);
    } else {
      initMap();
    }

    return () => {
      if (mapInstance && typeof mapInstance.destroy === 'function') {
        mapInstance.destroy();
      }
    };
  }, []);

  const countryCodes = ["AF","AL","DZ","AO","AR","AM","AU","AT","AZ","BS","BD","BY","BE","BZ","BJ","BT","BO","BA","BW","BR","BN","BG","BF","BI","KH","CM","CA","CV","CF","CD","CG","CR","CI","HR","CU","CY","CZ","DK","DJ","DO","EC","EG","SV","GQ","ER","EE","ET","FK","FJ","FI","FR","GA","GM","GE","DE","GH","GR","GL","GT","GN","GW","GY","HT","HN","HK","HU","IS","IN","ID","IR","IQ","IE","IL","IT","JM","JP","JO","KZ","KE","KP","KR","KW","KG","LA","LV","LB","LS","LR","LY","LT","LU","MK","MG","MW","MY","MV","ML","MT","MR","MU","MX","MD","MN","ME","MA","MZ","MM","NA","NP","NL","NC","NZ","NI","NE","NG","NO","OM","PK","PA","PG","PY","PE","PH","PL","PT","PR","QA","XK","RO","RU","RW","SA","SN","RS","SL","SG","SK","SI","SB","SO","ZA","SS","ES","LK","SD","SR","SZ","SE","CH","SY","TW","TJ","TZ","TH","TL","TG","TT","TN","TR","TM","UG","UA","AE","GB","US","UY","UZ","VU","VE","VN","YE","ZM","ZW"];

  const highRiskTargets = {
    "US": { score: 95, label: "3.2M Records" },
    "CN": { score: 88, label: "2.1M Records" },
    "RU": { score: 92, label: "1.8M Records" },
    "IN": { score: 85, label: "2.5M Records" },
    "BR": { score: 82, label: "1.2M Records" },
    "DE": { score: 75, label: "950K Records" },
    "GB": { score: 78, label: "820K Records" },
    "FR": { score: 72, label: "600K Records" },
    "AU": { score: 65, label: "450K Records" },
    "UA": { score: 85, label: "Conflict Zone Activity" },
    "IR": { score: 80, label: "Targeted Attacks" }
  };

  const breachData = {};
  countryCodes.forEach(code => {
    if (highRiskTargets[code]) {
      breachData[code] = highRiskTargets[code].score;
    } else {
      breachData[code] = Math.floor(Math.random() * 40) + 10;
    }
  });

  const initMap = () => {
    const mapEl = document.getElementById('breach-map');
    if (!mapEl || typeof window.jsVectorMap === 'undefined') return;

    try {
      mapEl.innerHTML = '';
      mapInstance = new window.jsVectorMap({
        selector: '#breach-map',
        map: 'world',
        backgroundColor: 'transparent',
        draggable: true,
        zoomButtons: false,
        zoomOnScroll: false,
        visualizeData: {
          scale: ['#e2e8f0', '#e11d48'],
          values: breachData
        },
        regionStyle: {
          initial: { fill: '#cbd5e1', stroke: '#ffffff', strokeWidth: 0.5, fillOpacity: 1 },
          hover: { fillOpacity: 0.8, cursor: 'pointer' },
          selected: { fill: '#4f46e5' }
        },
        onRegionTooltipShow(event, tooltip, code) {
          let content = `<div class="font-bold text-white mb-1">${tooltip.text()}</div>`;
          if (highRiskTargets[code]) {
            content += `<div class="text-rose-400 font-bold text-xs">⚠️ High Activity</div>`;
            content += `<div class="text-slate-300 text-xs">${highRiskTargets[code].label} exposed</div>`;
          } else {
            const count = (breachData[code] || 10) * 1240;
            content += `<div class="text-teal-400 font-bold text-xs">Low Activity</div>`;
            content += `<div class="text-slate-300 text-xs">~${(count/1000).toFixed(1)}K anomalies</div>`;
          }
          tooltip.text(content, true);
        }
      });

      window.addEventListener('resize', () => {
        if (mapInstance && typeof mapInstance.updateSize === 'function') {
          mapInstance.updateSize();
        }
      });
    } catch (error) {
      console.warn('Map initialization failed:', error);
    }
  };

  return (
    <div className="space-y-8">
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-lg">
        <div className="map-gradient-overlay absolute inset-0 pointer-events-none z-10"></div>
        <div id="breach-map" className="w-full h-96 md:h-[500px]"></div>
      </div>
      
      <div className="grid md:grid-cols-3 gap-6">
        <div className="p-6 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-sm text-slate-600 mb-2">High-Risk Regions</p>
          <p className="text-3xl font-bold text-slate-900">11+</p>
          <p className="text-xs text-rose-600 mt-2">Active threat zones</p>
        </div>
        <div className="p-6 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-sm text-slate-600 mb-2">Records Exposed</p>
          <p className="text-3xl font-bold text-slate-900">15.2M</p>
          <p className="text-xs text-amber-600 mt-2">Last 30 days</p>
        </div>
        <div className="p-6 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-sm text-slate-600 mb-2">Attacks Detected</p>
          <p className="text-3xl font-bold text-slate-900">2,847</p>
          <p className="text-xs text-indigo-600 mt-2">Daily average</p>
        </div>
      </div>
    </div>
  );
}
