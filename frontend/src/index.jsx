import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const initialAuth = {
  mode: 'login',
  email: '',
  password: '',
  full_name: '',
  device_name: 'Browser',
  device_fingerprint: '',
  provider: 'google',
  id_token: '',
}

const initialRecovery = {
  email: '',
  token: '',
  password: '',
  otp_code: '',
}

function request(path, { method = 'GET', body, token, formData } = {}) {
  const headers = {}
  const options = { method, credentials: 'include' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (body && !formData) headers['Content-Type'] = 'application/json'
  if (Object.keys(headers).length) options.headers = headers
  if (formData) {
    options.body = formData
  } else if (body !== undefined) {
    options.body = JSON.stringify(body)
  }
  return fetch(`${API_BASE_URL}${path}`, options).then(async (response) => {
    const text = await response.text()
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }
    if (!response.ok) {
      const message = data?.detail || data?.message || `Request failed with ${response.status}`
      throw new Error(message)
    }
    return data
  })
}

function readStoredToken() {
  return sessionStorage.getItem('syncveil_access_token') || ''
}

function writeStoredToken(token) {
  if (token) sessionStorage.setItem('syncveil_access_token', token)
  else sessionStorage.removeItem('syncveil_access_token')
}

function readCookie(name) {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')
    .slice(1)
    .join('=') || ''
}

function formatBytes(value) {
  if (!value && value !== 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let index = 0
  let size = value
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index += 1
  }
  return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`
}

function riskLabel(score) {
  if (score >= 80) return 'Critical'
  if (score >= 50) return 'Warning'
  return 'Safe'
}

function severityTone(value) {
  const normal = String(value || '').toLowerCase()
  if (normal === 'critical') return 'tone-critical'
  if (normal === 'warning' || normal === 'high') return 'tone-warning'
  return 'tone-safe'
}

function Sparkline({ values, className = '' }) {
  const path = useMemo(() => {
    if (!values.length) return ''
    const max = Math.max(...values, 1)
    const min = Math.min(...values, 0)
    const width = 240
    const height = 72
    return values
      .map((value, index) => {
        const x = (index / Math.max(values.length - 1, 1)) * width
        const y = height - ((value - min) / Math.max(max - min, 1)) * (height - 8) - 4
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
      })
      .join(' ')
  }, [values])

  return (
    <svg viewBox="0 0 240 72" className={`sparkline ${className}`} aria-hidden="true">
      <path d={path} />
    </svg>
  )
}

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('syncveil_theme') || 'dark')
  const [auth, setAuth] = useState(initialAuth)
  const [recovery, setRecovery] = useState(initialRecovery)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [accessToken, setAccessToken] = useState(readStoredToken())
  const [profile, setProfile] = useState(null)
  const [publicSnapshot, setPublicSnapshot] = useState(null)
  const [dashboard, setDashboard] = useState(null)
  const [devices, setDevices] = useState([])
  const [files, setFiles] = useState([])
  const [events, setEvents] = useState([])
  const [uploadResult, setUploadResult] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [activeNav, setActiveNav] = useState('overview')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('syncveil_theme', theme)
  }, [theme])

  useEffect(() => {
    request('/api/public/security-snapshot')
      .then(setPublicSnapshot)
      .catch(() => setPublicSnapshot({ security_score: 78, risk_level: 'medium', recommendations: [], threat_history: [] }))
  }, [])

  useEffect(() => {
    const boot = async () => {
      const stored = readStoredToken()
      try {
        if (stored) {
          const me = await request('/auth/me', { token: stored })
          setProfile(me)
          setAccessToken(stored)
          await refreshPrivateData(stored)
          return
        }
      } catch {
        // Try cookie-based recovery below.
      }

      try {
        const refreshed = await request('/auth/refresh', {
          method: 'POST',
          body: { csrf_token: readCookie('syncveil_csrf') },
        })
        writeStoredToken(refreshed.access_token)
        setAccessToken(refreshed.access_token)
        const me = await request('/auth/me', { token: refreshed.access_token })
        setProfile(me)
        await refreshPrivateData(refreshed.access_token)
      } catch {
        writeStoredToken('')
        setAccessToken('')
        setProfile(null)
      }
    }
    boot()
  }, [])

  async function refreshPrivateData(token = accessToken) {
    const [dash, devs, filesData, eventData] = await Promise.all([
      request('/api/dashboard', { token }),
      request('/api/devices', { token }),
      request('/api/vault/files', { token }),
      request('/api/security/events', { token }),
    ])
    setDashboard(dash)
    setDevices(devs)
    setFiles(filesData)
    setEvents(eventData)
  }

  async function onAuthSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const endpoint = auth.mode === 'signup' ? '/auth/signup' : '/auth/login'
      const payload = {
        email: auth.email,
        password: auth.password,
        full_name: auth.full_name,
        device_name: auth.device_name,
        device_fingerprint: auth.device_fingerprint,
      }
      const result = await request(endpoint, { method: 'POST', body: payload })
      if (result.status === 'mfa_required' || result.status === 'challenge_required') {
        setMessage('High-risk sign-in detected. Complete the challenge below.')
        setRecovery((current) => ({ ...current, email: auth.email, token: result.challenge_token || '' }))
        setLoading(false)
        return
      }
      writeStoredToken(result.access_token)
      setAccessToken(result.access_token)
      setProfile(await request('/auth/me', { token: result.access_token }))
      await refreshPrivateData(result.access_token)
      setMessage(auth.mode === 'signup' ? 'Account created and signed in.' : 'Signed in successfully.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function onOAuthSubmit(provider) {
    if (!auth.id_token.trim()) {
      setError('Paste a valid provider ID token to complete real OAuth validation.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await request(`/auth/oauth/${provider}`, {
        method: 'POST',
        body: {
          id_token: auth.id_token,
          device_name: auth.device_name,
          device_fingerprint: auth.device_fingerprint,
        },
      })
      writeStoredToken(result.access_token)
      setAccessToken(result.access_token)
      setProfile(await request('/auth/me', { token: result.access_token }))
      await refreshPrivateData(result.access_token)
      setMessage(`${provider[0].toUpperCase()}${provider.slice(1)} OAuth validated.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function onRecoverySubmit(action) {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      if (action === 'forgot') {
        await request('/auth/forgot-password', { method: 'POST', body: { email: recovery.email } })
        setMessage('Password reset instructions requested.')
      } else if (action === 'otp') {
        await request('/auth/otp/request', { method: 'POST', body: { email: recovery.email } })
        setMessage('OTP requested. Check the email inbox configured for your account.')
      } else if (action === 'verify-otp') {
        await request('/auth/otp/verify', {
          method: 'POST',
          body: { email: recovery.email, code: recovery.otp_code },
        })
        setMessage('OTP verified.')
      } else if (action === 'reset') {
        await request('/auth/reset-password', {
          method: 'POST',
          body: { token: recovery.token, password: recovery.password },
        })
        setMessage('Password reset complete.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function onMfaVerify() {
    setLoading(true)
    setError('')
    try {
      const result = await request('/auth/login/challenge', {
        method: 'POST',
        body: { email: auth.email, code: recovery.otp_code },
      })
      writeStoredToken(result.access_token)
      setAccessToken(result.access_token)
      setProfile(await request('/auth/me', { token: result.access_token }))
      await refreshPrivateData(result.access_token)
      setMessage('Challenge completed and session created.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function onUpload(event) {
    event.preventDefault()
    if (!selectedFile) return
    setLoading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', selectedFile)
      const result = await request('/api/vault/upload', {
        method: 'POST',
        token: accessToken,
        formData: form,
      })
      setUploadResult(result)
      await refreshPrivateData(accessToken)
      setMessage('File uploaded, encrypted, and analyzed.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function toggleDeviceTrust(deviceId, action) {
    setLoading(true)
    try {
      await request(`/api/devices/${deviceId}/${action}`, { method: 'POST', token: accessToken })
      await refreshPrivateData(accessToken)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const threatValues = useMemo(() => {
    const series = dashboard?.user_activity || []
    return series.map((row) => row.count || 0)
  }, [dashboard])

  const storageValues = useMemo(() => {
    const totals = dashboard?.storage_usage || []
    return totals.map((row) => row.value || 0)
  }, [dashboard])

  const fileRiskTone = uploadResult ? severityTone(uploadResult.risk_score >= 80 ? 'critical' : uploadResult.risk_score >= 40 ? 'warning' : 'safe') : 'tone-safe'
  const guardianStatus = uploadResult ? riskLabel(uploadResult.risk_score) : 'Safe'

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">SyncVeil AI Security Center</p>
          <h1>Security intelligence, privacy guardianship, and device trust in one console.</h1>
        </div>
        <div className="topbar-actions">
          <button className="ghost-button" onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}>
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <span className={`pill ${publicSnapshot ? severityTone(publicSnapshot.risk_level) : 'tone-safe'}`}>
            API {publicSnapshot ? 'online' : 'checking'}
          </span>
        </div>
      </header>

      <main className="dashboard">
        <aside className="sidebar">
          <nav className="nav-rail" aria-label="Primary">
            {['overview', 'auth', 'files', 'devices', 'recovery', 'settings'].map((item) => (
              <button
                key={item}
                className={`nav-item ${activeNav === item ? 'active' : ''}`}
                onClick={() => setActiveNav(item)}
              >
                {item}
              </button>
            ))}
          </nav>
          <section className="auth-card">
            <div className="section-head">
              <h2>{auth.mode === 'signup' ? 'Create account' : 'Sign in'}</h2>
              <button className="link-button" onClick={() => setAuth((current) => ({ ...current, mode: current.mode === 'signup' ? 'login' : 'signup' }))}>
                {auth.mode === 'signup' ? 'Use login' : 'Need signup?'}
              </button>
            </div>
            <form className="stack" onSubmit={onAuthSubmit}>
              {auth.mode === 'signup' && (
                <input
                  placeholder="Full name"
                  value={auth.full_name}
                  onChange={(e) => setAuth((current) => ({ ...current, full_name: e.target.value }))}
                />
              )}
              <input
                type="email"
                placeholder="Email"
                value={auth.email}
                onChange={(e) => setAuth((current) => ({ ...current, email: e.target.value }))}
              />
              <input
                type="password"
                placeholder="Password"
                value={auth.password}
                onChange={(e) => setAuth((current) => ({ ...current, password: e.target.value }))}
              />
              <input
                placeholder="Device name"
                value={auth.device_name}
                onChange={(e) => setAuth((current) => ({ ...current, device_name: e.target.value }))}
              />
              <input
                placeholder="Device fingerprint"
                value={auth.device_fingerprint}
                onChange={(e) => setAuth((current) => ({ ...current, device_fingerprint: e.target.value }))}
              />
              <button className="primary-button" type="submit" disabled={loading}>
                {loading ? 'Working…' : auth.mode === 'signup' ? 'Create account' : 'Sign in'}
              </button>
            </form>
            {auth.mode === 'signup' && (
              <p className="fine-print">
                Account creation uses Argon2id, session rotation, and server-side audit logging.
              </p>
            )}
          </section>
          <section className="auth-card">
            <h2>OAuth</h2>
            <p className="fine-print">
              Paste a real provider ID token here to validate Google, Microsoft, or Apple login server-side.
            </p>
            <input
              placeholder="Provider ID token"
              value={auth.id_token}
              onChange={(e) => setAuth((current) => ({ ...current, id_token: e.target.value }))}
            />
            <div className="oauth-row">
              {['google', 'microsoft', 'apple'].map((provider) => (
                <button key={provider} className="ghost-button" onClick={() => onOAuthSubmit(provider)} type="button">
                  {provider}
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="content">
          <section className="hero-card">
            <div className="hero-copy">
              <p className="eyebrow">AI Security Score</p>
              <div className="score-row">
                <div>
                  <h2>{dashboard?.security_score ?? publicSnapshot?.security_score ?? 0}</h2>
                  <p>{dashboard?.risk_level || publicSnapshot?.risk_level || 'unknown'} risk level</p>
                </div>
                <span className={`risk-badge ${severityTone(dashboard?.risk_level || publicSnapshot?.risk_level)}`}>
                  {riskLabel(100 - (dashboard?.security_score ?? publicSnapshot?.security_score ?? 0))}
                </span>
              </div>
              <p className="lede">
                {profile
                  ? `Signed in as ${profile.email}. The platform is monitoring login anomalies, device trust, file intelligence, and privacy guardianship.`
                  : 'Sign in to unlock personalized analytics, device risk analysis, file intelligence, and recovery tools.'}
              </p>
              <div className="message-row">
                {message && <div className="toast success">{message}</div>}
                {error && <div className="toast error">{error}</div>}
              </div>
            </div>
            <div className="hero-meta">
              <Sparkline values={threatValues.length ? threatValues : [0, 1, 2, 3, 5, 4]} />
              <ul className="recommendations">
                {(dashboard?.recommendations || publicSnapshot?.recommendations || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </section>

          <section className="grid-3">
            <article className="panel">
              <h3>Threat history</h3>
              <div className="list">
                {(dashboard?.threat_history || publicSnapshot?.threat_history || []).slice(0, 5).map((item, index) => (
                  <div key={`${item.event_type || item.description}-${index}`} className="list-item">
                    <div>
                      <strong>{item.event_type || item.severity || 'event'}</strong>
                      <p>{item.description || item.note || 'No recent threat recorded.'}</p>
                    </div>
                    <span className={`pill ${severityTone(item.severity)}`}>{item.severity || 'info'}</span>
                  </div>
                ))}
              </div>
            </article>
            <article className="panel">
              <h3>Upload activity</h3>
              <Sparkline values={threatValues.length ? threatValues : [0, 1, 1, 2, 3, 5]} />
              <p className="fine-print">Upload volume and behavior activity are tracked server-side.</p>
            </article>
            <article className="panel">
              <h3>Storage usage</h3>
              <Sparkline values={storageValues.length ? storageValues : [1024, 2048, 768, 4096]} />
              <p className="fine-print">Encrypted file storage is counted per file type.</p>
            </article>
          </section>

          <section className="grid-2">
            <article className="panel" id="files">
              <div className="section-head">
                <h3>AI File Intelligence</h3>
                <span className={`pill ${fileRiskTone}`}>{guardianStatus}</span>
              </div>
              <form className="stack" onSubmit={onUpload}>
                <input type="file" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
                <button className="primary-button" type="submit" disabled={!accessToken || loading}>
                  Upload and analyze
                </button>
              </form>
              {uploadResult && (
                <div className="analysis-card">
                  <p><strong>Type:</strong> {uploadResult.file_type}</p>
                  <p><strong>Tags:</strong> {(uploadResult.tags || []).join(', ') || 'none'}</p>
                  <p><strong>Categories:</strong> {(uploadResult.categories || []).join(', ') || 'none'}</p>
                  <p><strong>Summary:</strong> {uploadResult.summary}</p>
                  <p><strong>Sensitive findings:</strong> {(uploadResult.sensitive_findings || []).length || 0}</p>
                  <p><strong>Suspicious content:</strong> {(uploadResult.suspicious_findings || []).join('; ') || 'none'}</p>
                  <p><strong>Risk score:</strong> {uploadResult.risk_score}</p>
                </div>
              )}
              <div className="table">
                {(files || []).slice(0, 5).map((file) => (
                  <div key={file.id} className="table-row">
                    <div>
                      <strong>{file.name}</strong>
                      <p>{file.type}</p>
                    </div>
                    <div className="right">
                      <span>{formatBytes(file.size_bytes)}</span>
                      <small>Risk {file.risk_score}</small>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel" id="devices">
              <h3>Device management</h3>
              <div className="table">
                {devices.length ? devices.map((device) => (
                  <div key={device.id} className="table-row">
                    <div>
                      <strong>{device.name}</strong>
                      <p>{device.fingerprint}</p>
                    </div>
                    <div className="right">
                      <span className={`pill ${severityTone(device.trust_level === 'trusted' ? 'safe' : device.trust_level)}`}>
                        {device.trust_level}
                      </span>
                      <div className="button-row">
                        <button className="ghost-button" type="button" onClick={() => toggleDeviceTrust(device.id, 'trust')}>
                          Trust
                        </button>
                        <button className="ghost-button" type="button" onClick={() => toggleDeviceTrust(device.id, 'revoke')}>
                          Revoke
                        </button>
                      </div>
                    </div>
                  </div>
                )) : (
                  <p className="fine-print">No devices recorded yet. Sign in to populate device trust state.</p>
                )}
              </div>
              <div className="list">
                {(events || []).slice(0, 5).map((event) => (
                  <div key={event.id} className="list-item">
                    <div>
                      <strong>{event.event_type}</strong>
                      <p>{event.description}</p>
                    </div>
                    <span className={`pill ${severityTone(event.severity)}`}>{event.severity}</span>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="grid-2" id="recovery">
            <article className="panel">
              <h3>Account recovery</h3>
              <form className="stack" onSubmit={(e) => { e.preventDefault(); onRecoverySubmit('forgot') }}>
                <input
                  type="email"
                  placeholder="Recovery email"
                  value={recovery.email}
                  onChange={(e) => setRecovery((current) => ({ ...current, email: e.target.value }))}
                />
                <button className="ghost-button" type="submit">Send reset link</button>
              </form>
              <div className="split-row">
                <button className="ghost-button" type="button" onClick={() => onRecoverySubmit('otp')}>
                  Send OTP
                </button>
                <button className="ghost-button" type="button" onClick={() => onRecoverySubmit('verify-otp')}>
                  Verify OTP
                </button>
              </div>
              <input
                placeholder="OTP code"
                value={recovery.otp_code}
                onChange={(e) => setRecovery((current) => ({ ...current, otp_code: e.target.value }))}
              />
              <form className="stack" onSubmit={(e) => { e.preventDefault(); onRecoverySubmit('reset') }}>
                <input
                  placeholder="Reset token"
                  value={recovery.token}
                  onChange={(e) => setRecovery((current) => ({ ...current, token: e.target.value }))}
                />
                <input
                  type="password"
                  placeholder="New password"
                  value={recovery.password}
                  onChange={(e) => setRecovery((current) => ({ ...current, password: e.target.value }))}
                />
                <button className="primary-button" type="submit">Reset password</button>
              </form>
            </article>

            <article className="panel" id="auth">
              <h3>MFA challenge</h3>
              <p className="fine-print">Use this after the login flow returns a challenge token or when MFA is required.</p>
              <form className="stack" onSubmit={(e) => { e.preventDefault(); onMfaVerify() }}>
                <input
                  type="email"
                  placeholder="Email"
                  value={auth.email}
                  onChange={(e) => setAuth((current) => ({ ...current, email: e.target.value }))}
                />
                <input
                  placeholder="One-time code"
                  value={recovery.otp_code}
                  onChange={(e) => setRecovery((current) => ({ ...current, otp_code: e.target.value }))}
                />
                <button className="ghost-button" type="submit">Verify challenge</button>
              </form>
              <div className="panel-footer">
                <div>
                  <strong>Session persistence</strong>
                  <p>Refresh tokens remain in HttpOnly cookies and access tokens are persisted locally.</p>
                </div>
              </div>
            </article>
          </section>

          <section className="panel" id="overview">
            <div className="section-head">
              <h3>Smart dashboard</h3>
              <button className="ghost-button" onClick={() => refreshPrivateData(accessToken)} disabled={!accessToken}>
                Refresh data
              </button>
            </div>
            <div className="grid-4">
              <div className="metric">
                <span>Uploads</span>
                <strong>{(dashboard?.upload_activity || []).reduce((sum, row) => sum + (row.count || 0), 0)}</strong>
              </div>
              <div className="metric">
                <span>Files</span>
                <strong>{files.length}</strong>
              </div>
              <div className="metric">
                <span>Devices</span>
                <strong>{devices.length}</strong>
              </div>
              <div className="metric">
                <span>Events</span>
                <strong>{events.length}</strong>
              </div>
            </div>
            <div className="timeline">
              {(dashboard?.security_events || []).slice(0, 6).map((event) => (
                <div key={`${event.event_type}-${event.created_at}`} className="timeline-item">
                  <div>
                    <strong>{event.event_type}</strong>
                    <p>{event.description}</p>
                  </div>
                  <span className={`pill ${severityTone(event.severity)}`}>{event.severity}</span>
                </div>
              ))}
            </div>
          </section>
        </section>
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
