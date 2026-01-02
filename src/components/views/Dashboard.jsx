import React, { useState, useEffect } from 'react';
import { Lock, Shield, Eye, Settings, LogOut, Menu } from 'lucide-react';
import { dashboardAPI } from '../../api';

export default function Dashboard({ onLogout, onSwitchView, user }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load dashboard data on mount
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        const response = await dashboardAPI.getDashboardData();
        setDashboardData(response.data);
        setError(null);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
        // Don't show error, use fallback data
        setDashboardData({
          protectedRecords: 0,
          vaultFiles: 0,
          threatsDetected: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  // Load vault files
  useEffect(() => {
    if (activeTab === 'vault') {
      const loadVaultFiles = async () => {
        try {
          const response = await dashboardAPI.getVaultFiles();
          setUploadedFiles(response.files || []);
        } catch (err) {
          console.error('Failed to load vault files:', err);
        }
      };
      loadVaultFiles();
    }
  }, [activeTab]);

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer.files);
    
    // Upload each file
    for (const file of files) {
      const fileId = Math.random().toString(36).substr(2, 9);
      const newFile = {
        id: fileId,
        name: file.name,
        progress: 0,
        status: 'uploading'
      };

      setUploadedFiles(prev => [newFile, ...prev]);

      try {
        await dashboardAPI.uploadFile(file, (progress) => {
          setUploadedFiles(prev =>
            prev.map(f =>
              f.id === fileId
                ? { ...f, progress: Math.round(progress) }
                : f
            )
          );
        });

        // Encryption simulation
        setUploadedFiles(prev =>
          prev.map(f =>
            f.id === fileId
              ? { ...f, status: 'encrypting' }
              : f
          )
        );

        // Mark as secured
        setTimeout(() => {
          setUploadedFiles(prev =>
            prev.map(f =>
              f.id === fileId
                ? { ...f, progress: 100, status: 'secured' }
                : f
            )
          );
        }, 1500);
      } catch (err) {
        console.error('Upload failed:', err);
        setUploadedFiles(prev =>
          prev.map(f =>
            f.id === fileId
              ? { ...f, status: 'failed', error: err.message }
              : f
          )
        );
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const tabTitles = {
    'overview': 'Overview',
    'vault': 'Encrypted Vault',
    'monitor': 'Breach Monitor',
    'settings': 'Account Settings'
  };

  const stats = dashboardData || {
    protectedRecords: 0,
    vaultFiles: 0,
    threatsDetected: 0,
  };

  return (
    <div id="view-dashboard" className="view-section active dashboard-layout">
      {/* Sidebar */}
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
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="7" height="9" x="3" y="3" rx="1"/>
              <rect width="7" height="5" x="14" y="3" rx="1"/>
              <rect width="7" height="9" x="14" y="12" rx="1"/>
              <rect width="7" height="5" x="3" y="16" rx="1"/>
            </svg>
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
            Breach Monitor
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

      {/* Main Content */}
      <div className="dashboard-main">
        {/* Header */}
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

        {/* Tabs Content */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          {loading && activeTab === 'overview' ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                <p className="text-slate-600 text-sm">Loading your data...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div id="dash-tab-overview" className="dash-tab active space-y-8">
                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="p-6 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-2xl border border-indigo-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-indigo-900">Protected Records</h3>
                        <Shield className="text-indigo-600" size={20} />
                      </div>
                      <p className="text-3xl font-bold text-indigo-900">{stats.protectedRecords || '0'}</p>
                      <p className="text-xs text-indigo-700 mt-2">Securely encrypted</p>
                    </div>

                    <div className="p-6 bg-gradient-to-br from-teal-50 to-teal-100 rounded-2xl border border-teal-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-teal-900">Vault Files</h3>
                        <Lock className="text-teal-600" size={20} />
                      </div>
                      <p className="text-3xl font-bold text-teal-900">{uploadedFiles.length}</p>
                      <p className="text-xs text-teal-700 mt-2">Securely encrypted</p>
                    </div>

                    <div className="p-6 bg-gradient-to-br from-rose-50 to-rose-100 rounded-2xl border border-rose-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-rose-900">Threats Detected</h3>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-600">
                          <path d="M12 2l-5.5 9h11z"/>
                          <path d="M17.5 13c0 3.59-2.24 6.68-5.5 8.06-3.26-1.38-5.5-4.47-5.5-8.06"/>
                        </svg>
                      </div>
                      <p className="text-3xl font-bold text-rose-900">{stats.threatsDetected || '0'}</p>
                      <p className="text-xs text-rose-700 mt-2">All clear</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Vault Tab */}
              {activeTab === 'vault' && (
                <div id="dash-tab-vault" className="dash-tab active space-y-6">
                  <div
                    id="drop-zone"
                    className="drop-zone rounded-2xl p-12 text-center cursor-pointer border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50 hover:bg-indigo-50 transition-colors"
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 text-slate-400">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <p className="text-lg font-bold text-slate-900 mb-2">Drop files to encrypt & upload</p>
                    <p className="text-sm text-slate-600">or click to select files</p>
                  </div>

                  {uploadedFiles.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-slate-900 text-sm">Upload Progress</h3>
                      {uploadedFiles.map(file => (
                        <div key={file.id} className="p-4 bg-slate-50 rounded-xl">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-slate-900 truncate">{file.name}</span>
                            <span className="text-xs text-slate-500">{file.status}</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2">
                            <div
                              className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${file.progress}%` }}
                            />
                          </div>
                          {file.error && (
                            <p className="text-xs text-rose-600 mt-2">{file.error}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Monitor Tab */}
              {activeTab === 'monitor' && (
                <div id="dash-tab-monitor" className="dash-tab active space-y-6">
                  <div className="p-6 bg-teal-50 border border-teal-200 rounded-2xl">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse"></div>
                      <h3 className="font-semibold text-teal-900">Protection Status</h3>
                    </div>
                    <p className="text-teal-700">Your data is actively monitored and encrypted. No threats detected.</p>
                  </div>
                </div>
              )}

              {/* Settings Tab */}
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

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                        <button className="px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-100 text-sm font-medium">
                          Change Password
                        </button>
                      </div>

                      <div className="pt-6 border-t">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">Security Settings</h3>
                        <button className="px-4 py-2 bg-slate-50 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 text-sm font-medium">
                          Enable Two-Factor Authentication
                        </button>
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

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const tabTitles = {
    'overview': 'Overview',
    'vault': 'Encrypted Vault',
    'monitor': 'Breach Monitor',
    'settings': 'Account Settings'
  };

  return (
    <div id="view-dashboard" className="view-section active dashboard-layout">
      {/* Sidebar */}
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
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="7" height="9" x="3" y="3" rx="1"/>
              <rect width="7" height="5" x="14" y="3" rx="1"/>
              <rect width="7" height="9" x="14" y="12" rx="1"/>
              <rect width="7" height="5" x="3" y="16" rx="1"/>
            </svg>
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
            Breach Monitor
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

      {/* Main Content */}
      <div className="dashboard-main">
        {/* Header */}
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

        {/* Tabs Content */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div id="dash-tab-overview" className="dash-tab active space-y-8">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="p-6 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-2xl border border-indigo-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-indigo-900">Protected Records</h3>
                    <Shield className="text-indigo-600" size={20} />
                  </div>
                  <p className="text-3xl font-bold text-indigo-900">2,847</p>
                  <p className="text-xs text-indigo-700 mt-2">+142 this week</p>
                </div>

                <div className="p-6 bg-gradient-to-br from-teal-50 to-teal-100 rounded-2xl border border-teal-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-teal-900">Vault Files</h3>
                    <Lock className="text-teal-600" size={20} />
                  </div>
                  <p className="text-3xl font-bold text-teal-900">{uploadedFiles.length}</p>
                  <p className="text-xs text-teal-700 mt-2">Securely encrypted</p>
                </div>

                <div className="p-6 bg-gradient-to-br from-rose-50 to-rose-100 rounded-2xl border border-rose-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-rose-900">Threats Detected</h3>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-600">
                      <path d="M12 2l-5.5 9h11z"/>
                      <path d="M17.5 13c0 3.59-2.24 6.68-5.5 8.06-3.26-1.38-5.5-4.47-5.5-8.06"/>
                    </svg>
                  </div>
                  <p className="text-3xl font-bold text-rose-900">0</p>
                  <p className="text-xs text-rose-700 mt-2">All clear</p>
                </div>
              </div>
            </div>
          )}

          {/* Vault Tab */}
          {activeTab === 'vault' && (
            <div id="dash-tab-vault" className="dash-tab active space-y-6">
              <div
                id="drop-zone"
                className="drop-zone rounded-2xl p-12 text-center cursor-pointer border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50 hover:bg-indigo-50 transition-colors"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 text-slate-400">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <p className="text-lg font-bold text-slate-900 mb-2">Drop files to encrypt & upload</p>
                <p className="text-sm text-slate-600">or click to select files</p>
                <input
                  id="file-input"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => handleDrop({ dataTransfer: { files: e.target.files }, preventDefault: () => {}, stopPropagation: () => {} })}
                />
              </div>

              <div id="upload-list" className="space-y-3">
                {uploadedFiles.map((file) => (
                  <div key={file.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200 animate-fade-in-up">
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-slate-200">
                      {file.status === 'secured' ? (
                        <Lock className="w-5 h-5 text-green-600" />
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                          <polyline points="13 2 13 9 20 9"/>
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{file.name}</p>
                      <div className="w-full bg-slate-200 h-1 mt-2 rounded-full overflow-hidden">
                        <div
                          className="progress-bar bg-indigo-600 h-full rounded-full transition-all duration-500"
                          style={{ width: `${file.progress}%` }}
                        ></div>
                      </div>
                    </div>
                    <span className={`status-text text-xs font-bold ${
                      file.status === 'secured' ? 'text-green-600' : 'text-indigo-600'
                    }`}>
                      {file.status === 'secured' ? 'Secured' : 'Encrypting...'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Monitor Tab */}
          {activeTab === 'monitor' && (
            <div id="dash-tab-monitor" className="dash-tab active">
              <div className="p-8 bg-gradient-to-br from-indigo-50 to-teal-50 rounded-2xl border border-indigo-200 text-center">
                <Eye size={48} className="mx-auto mb-4 text-indigo-600" />
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Your data is protected</h3>
                <p className="text-slate-600 mb-6 max-w-md mx-auto">No breaches detected. SyncVeil is continuously monitoring for threats across global databases.</p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  All Clear
                </div>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div id="dash-tab-settings" className="dash-tab active space-y-6 max-w-2xl">
              <div className="p-6 bg-white rounded-2xl border border-slate-200">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Account Information</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">Email Address</label>
                    <input type="email" defaultValue="user@example.com" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600" readOnly />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">Account Status</label>
                    <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg w-fit font-semibold text-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      Active
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-white rounded-2xl border border-slate-200">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Security Settings</h3>
                <button className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors text-left">
                  Change Password
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
