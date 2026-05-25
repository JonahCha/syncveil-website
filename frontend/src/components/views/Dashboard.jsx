import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Eye,
  Lock,
  LogOut,
  Menu,
  Settings,
  Shield,
} from 'lucide-react';
import { dashboardAPI } from '../../api';

const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) return '0 B';
  if (bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
  const value = bytes / (1024 ** i);
  return `${value.toFixed(value >= 100 || i === 0 ? 0 : 1)} ${sizes[i]}`;
};

const severityStyle = {
  critical: 'bg-rose-100 text-rose-700 border-rose-200',
  high: 'bg-amber-100 text-amber-700 border-amber-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

export default function Dashboard({ onLogout, onSwitchView, user }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [securityOverview, setSecurityOverview] = useState(null);
  const [securityEvents, setSecurityEvents] = useState([]);
  const [breachData, setBreachData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [monitorLoading, setMonitorLoading] = useState(false);
  const fileInputRef = useRef(null);

  const refreshOverview = async () => {
    const [dashboardResponse, filesResponse, securityResponse, eventsResponse] = await Promise.all([
      dashboardAPI.getDashboardData(),
      dashboardAPI.getVaultFiles(),
      dashboardAPI.getSecurityOverview(),
      dashboardAPI.getSecurityEvents(25),
    ]);

    setDashboardData(dashboardResponse.data);
    setUploadedFiles(
      (filesResponse.files || []).map((file) => ({
        id: file.id,
        name: file.name,
        progress: 100,
        status: 'secured',
        size: file.size,
        uploadedAt: file.uploaded_at,
        contentType: file.content_type,
      }))
    );
    setSecurityOverview(securityResponse.data);
    setSecurityEvents(eventsResponse.data?.events || []);
  };

  const refreshMonitor = async () => {
    setMonitorLoading(true);
    try {
      const response = await dashboardAPI.getBreachData();
      setBreachData(response.breaches);
    } finally {
      setMonitorLoading(false);
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      try {
        setLoading(true);
        setError(null);
        await refreshOverview();
        await refreshMonitor();
      } catch (err) {
        console.error('Failed to load dashboard:', err);
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, []);

  useEffect(() => {
    if (activeTab === 'monitor' && !breachData) {
      refreshMonitor().catch((err) => {
        console.error('Failed to load monitor data:', err);
      });
    }
  }, [activeTab, breachData]);

  const processFiles = async (files) => {
    for (const file of files) {
      const fileId = Math.random().toString(36).slice(2, 11);
      const pendingFile = {
        id: fileId,
        name: file.name,
        progress: 0,
        status: 'uploading',
        size: file.size,
      };

      setUploadedFiles((prev) => [pendingFile, ...prev]);

      try {
        const response = await dashboardAPI.uploadFile(file, (progress) => {
          setUploadedFiles((prev) =>
            prev.map((entry) =>
              entry.id === fileId
                ? { ...entry, progress: Math.round(progress), status: 'encrypting' }
                : entry
            )
          );
        });

        const uploaded = response.file;
        setUploadedFiles((prev) =>
          prev.map((entry) =>
            entry.id === fileId
              ? {
                  ...entry,
                  id: uploaded.id || fileId,
                  name: uploaded.name || entry.name,
                  size: uploaded.size ?? entry.size,
                  uploadedAt: uploaded.uploaded_at,
                  progress: 100,
                  status: 'secured',
                }
              : entry
          )
        );

        await refreshOverview();
      } catch (err) {
        console.error('Upload failed:', err);
        setUploadedFiles((prev) =>
          prev.map((entry) =>
            entry.id === fileId
              ? { ...entry, status: 'failed', error: err.message || 'Upload failed' }
              : entry
          )
        );
      }
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files || []);
    await processFiles(files);
  };

  const handleFileSelection = async (e) => {
    const files = Array.from(e.target.files || []);
    await processFiles(files);
    e.target.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const tabTitles = {
    overview: 'Overview',
    vault: 'Encrypted Vault',
    monitor: 'Security Monitor',
    settings: 'Account Settings',
  };

  const stats = dashboardData || {
    protectedRecords: 0,
    vaultFiles: 0,
    threatsDetected: 0,
  };

  const riskLevel = securityOverview?.risk_level || 'low';

  return (
    <div id="view-dashboard" className="view-section active dashboard-layout">
      <div className={`dashboard-sidebar ${!sidebarOpen ? 'hidden' : ''}`}>
        <div className="p-6 border-b">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => onSwitchView('home')}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span className="text-2xl font-bold org-name text-slate-900">SyncVeil</span>
          </div>
        </div>

        <nav className="flex-1 p-6 space-y-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`dash-nav-btn w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
              activeTab === 'overview'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'
            }`}
          >
            <Shield size={20} />
            Overview
          </button>

          <button
            onClick={() => setActiveTab('vault')}
            className={`dash-nav-btn w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
              activeTab === 'vault'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'
            }`}
          >
            <Lock size={20} />
            Encrypted Vault
          </button>

          <button
            onClick={() => setActiveTab('monitor')}
            className={`dash-nav-btn w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
              activeTab === 'monitor'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'
            }`}
          >
            <Eye size={20} />
            Security Monitor
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`dash-nav-btn w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
              activeTab === 'settings'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'
            }`}
          >
            <Settings size={20} />
            Account Settings
          </button>
        </nav>

        <div className="p-6 border-t">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <LogOut size={20} />
            Log Out
          </button>
        </div>
      </div>

      <div className="dashboard-main">
        <div className="border-b bg-white sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <h1 id="dash-header-title" className="text-2xl font-bold text-slate-900">{tabTitles[activeTab]}</h1>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 bg-white rounded-lg shadow-md"
            >
              <Menu size={24} />
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                <p className="text-slate-600 text-sm">Loading your security workspace...</p>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm">
                  {error}
                </div>
              )}

              {activeTab === 'overview' && (
                <div id="dash-tab-overview" className="dash-tab active space-y-8">
                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="p-6 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-2xl border border-indigo-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-indigo-900">Protected Records</h3>
                        <Shield className="text-indigo-600" size={20} />
                      </div>
                      <p className="text-3xl font-bold text-indigo-900">{stats.protectedRecords || 0}</p>
                      <p className="text-xs text-indigo-700 mt-2">Actively protected assets</p>
                    </div>

                    <div className="p-6 bg-gradient-to-br from-teal-50 to-teal-100 rounded-2xl border border-teal-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-teal-900">Vault Files</h3>
                        <Lock className="text-teal-600" size={20} />
                      </div>
                      <p className="text-3xl font-bold text-teal-900">{stats.vaultFiles || uploadedFiles.length || 0}</p>
                      <p className="text-xs text-teal-700 mt-2">Encrypted at rest</p>
                    </div>

                    <div className="p-6 bg-gradient-to-br from-rose-50 to-rose-100 rounded-2xl border border-rose-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-rose-900">Threats Detected</h3>
                        <AlertTriangle className="text-rose-600" size={20} />
                      </div>
                      <p className="text-3xl font-bold text-rose-900">{stats.threatsDetected || 0}</p>
                      <p className="text-xs text-rose-700 mt-2">Last 24 hours</p>
                    </div>
                  </div>

                  <div className="p-6 bg-white rounded-2xl border border-slate-200">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <h3 className="text-lg font-semibold text-slate-900">Adaptive Security Engine</h3>
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${severityStyle[riskLevel] || severityStyle.low}`}>
                        {riskLevel.toUpperCase()} RISK
                      </span>
                    </div>

                    <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-slate-500">Risk Score</p>
                        <p className="text-xl font-bold text-slate-900">{securityOverview?.risk_score ?? 0}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-slate-500">Active Sessions</p>
                        <p className="text-xl font-bold text-slate-900">{securityOverview?.active_sessions ?? 0}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-slate-500">Successes (7d)</p>
                        <p className="text-xl font-bold text-slate-900">{securityOverview?.successes_7d ?? 0}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-slate-500">Failures (7d)</p>
                        <p className="text-xl font-bold text-slate-900">{securityOverview?.failures_7d ?? 0}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'vault' && (
                <div id="dash-tab-vault" className="dash-tab active space-y-6">
                  <div
                    id="drop-zone"
                    className="drop-zone rounded-2xl p-12 text-center cursor-pointer border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50 hover:bg-indigo-50 transition-colors"
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      multiple
                      onChange={handleFileSelection}
                    />
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 text-slate-400">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <p className="text-lg font-bold text-slate-900 mb-2">Drop files to encrypt and upload</p>
                    <p className="text-sm text-slate-600">or click to select files</p>
                  </div>

                  {uploadedFiles.length > 0 ? (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-slate-900 text-sm">Vault Files</h3>
                      {uploadedFiles.map((file) => (
                        <div key={file.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                            <span className="font-medium text-slate-900 truncate">{file.name}</span>
                            <span className="text-xs text-slate-500 capitalize">{file.status}</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2">
                            <div
                              className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${file.progress}%` }}
                            />
                          </div>
                          <div className="flex flex-wrap items-center justify-between mt-2 text-xs text-slate-500">
                            <span>{formatBytes(file.size || 0)}</span>
                            {file.uploadedAt && <span>{new Date(file.uploadedAt).toLocaleString()}</span>}
                          </div>
                          {file.error && <p className="text-xs text-rose-600 mt-2">{file.error}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No files in your encrypted vault yet.</p>
                  )}
                </div>
              )}

              {activeTab === 'monitor' && (
                <div id="dash-tab-monitor" className="dash-tab active space-y-6">
                  <div className="p-6 bg-white border border-slate-200 rounded-2xl">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <h3 className="font-semibold text-slate-900">Live Security Feed</h3>
                      <button
                        type="button"
                        onClick={() => refreshMonitor().catch(() => {})}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50"
                      >
                        Refresh
                      </button>
                    </div>

                    {monitorLoading ? (
                      <p className="text-sm text-slate-500">Refreshing security feed...</p>
                    ) : (
                      <>
                        <p className="text-sm text-slate-600 mb-4">
                          {breachData?.totalEvents || 0} suspicious events captured in the latest monitoring window.
                        </p>

                        {breachData?.breaches?.length ? (
                          <div className="space-y-3">
                            {breachData.breaches.map((breach) => (
                              <div key={breach.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                                  <p className="text-sm font-semibold text-slate-900">{breach.message}</p>
                                  <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${severityStyle[breach.severity] || severityStyle.low}`}>
                                    {breach.severity?.toUpperCase() || 'LOW'}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500">Event type: {breach.type}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-emerald-600">No active security incidents detected.</p>
                        )}
                      </>
                    )}
                  </div>

                  <div className="p-6 bg-white border border-slate-200 rounded-2xl">
                    <h3 className="font-semibold text-slate-900 mb-4">Recent Authentication Events</h3>
                    {securityEvents.length ? (
                      <div className="space-y-3">
                        {securityEvents.slice(0, 10).map((event) => (
                          <div key={event.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-medium text-slate-900">
                                {event.success ? 'Successful sign-in' : event.reason || 'Failed sign-in attempt'}
                              </p>
                              <span className="text-xs text-slate-500">{new Date(event.timestamp).toLocaleString()}</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">IP: {event.ip_address || 'unknown'}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">No login events available yet.</p>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'settings' && (
                <div id="dash-tab-settings" className="dash-tab active space-y-6">
                  <div className="max-w-2xl">
                    <h3 className="text-lg font-semibold text-slate-900 mb-6">Account Information</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
                        <input
                          type="email"
                          value={user?.email || ''}
                          disabled
                          className="w-full px-4 py-3 bg-slate-100 border border-slate-300 rounded-xl text-slate-600 cursor-not-allowed"
                        />
                      </div>

                      <div className="pt-4 border-t">
                        <h4 className="text-sm font-semibold text-slate-800 mb-3">Security Status</h4>
                        <div className="grid sm:grid-cols-2 gap-3 text-sm">
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                            <p className="text-slate-500">Current Risk Level</p>
                            <p className="font-bold text-slate-900 uppercase">{securityOverview?.risk_level || 'low'}</p>
                          </div>
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                            <p className="text-slate-500">Active Sessions</p>
                            <p className="font-bold text-slate-900">{securityOverview?.active_sessions ?? 0}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
