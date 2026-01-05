/**
 * RESQFLOW SENTINEL - ENTERPRISE INTERFACE v6.0
 * Logic: Firebase Realtime DB Sync | Auth: Dual-Mailing Integration
 */
import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, update, push, set, remove } from 'firebase/database';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// --- ENTERPRISE THEME CONFIGURATION ---
const THEME = {
  bg: '#020617',
  surface: '#0f172a',
  border: '#1e293b',
  primary: '#2563eb',
  danger: '#ef4444',
  success: '#10b981',
  text: '#f8fafc',
  muted: '#94a3b8'
};

// --- FIREBASE INFRASTRUCTURE ---
const firebaseConfig = {
  apiKey: "AIzaSyA1Gz-ys-SHmapDBLoo__hWOrGqbxNHS6c",
  authDomain: "iaas-emergency-system.firebaseapp.com",
  databaseURL: "https://iaas-emergency-system-default-rtdb.firebaseio.com",
  projectId: "iaas-emergency-system",
  storageBucket: "iaas-emergency-system.firebasestorage.app",
  appId: "1:929039028:web:bf1a328f2e4b1fd0370de1"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Leaflet Marker Correction
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

/**
 * MODULAR UI COMPONENTS
 */
const SentinelInput = ({ label, ...props }) => (
  <div style={{ marginBottom: '20px', textAlign: 'left' }}>
    <label style={{ color: THEME.muted, fontSize: '12px', fontWeight: 'bold' }}>{label}</label>
    <input {...props} style={styles.inp} />
  </div>
);

const SentinelButton = ({ label, onClick, variant = 'primary', loading = false }) => (
  <button onClick={onClick} disabled={loading} style={{ ...styles.btn, background: THEME[variant] }}>
    {loading ? 'SYNCHRONIZING...' : label}
  </button>
);

export default function App() {
  // --- STATE MANAGEMENT ---
  const [view, setView] = useState('landing');
  const [users, setUsers] = useState({});
  const [regForm, setRegForm] = useState({ name: '', email: '', vehicle: '', doc: '' });
  const [loginForm, setLoginForm] = useState({ u: '', p: '' });
  const [session, setSession] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- DATABASE LISTENER ---
  useEffect(() => {
    const usersRef = ref(db, 'users');
    return onValue(usersRef, (snapshot) => { setUsers(snapshot.val() || {}); });
  }, []);

  /**
   * CORE BRIDGE: EMAIL API DISPATCHER
   */
  const callEmailService = async (endpoint, data) => {
    try {
      await fetch(`http://localhost:5000/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } catch (e) { console.error("Local Mail Server is offline."); }
  };

  /**
   * BUSINESS LOGIC: REGISTRATION
   */
  const handleReg = async () => {
    if (!regForm.name || !regForm.email) return alert("All fields are mandatory.");
    setIsProcessing(true);
    const newRef = push(ref(db, 'users'));
    const entry = { ...regForm, id: newRef.key, status: 'pending', lat: 17.38, lng: 78.48, isEmergency: false };
    await set(newRef, entry);
    await callEmailService('notify-admin', { userName: regForm.name, vehicle: regForm.vehicle, docUrl: regForm.doc });
    setIsProcessing(false); alert("Request Logged. Admin Alert Sent."); setView('landing');
  };

  /**
   * BUSINESS LOGIC: LOGIN
   */
  const handleLogin = () => {
    const user = Object.values(users).find(x => x.username === loginForm.u && x.password === loginForm.p);
    if (!user) return alert("Unauthorized Credentials.");
    if (user.status !== 'approved') return alert("Access Pending Administrative Review.");
    setSession(user); setView('operator-dash');
  };

  /**
   * BUSINESS LOGIC: ADMIN HUB ACTIONS
   */
  const onApprove = async (u) => {
    const un = u.name.split(' ')[0].toLowerCase() + Math.floor(1000 + Math.random() * 9000);
    const pw = Math.random().toString(36).slice(-8);
    await update(ref(db, `users/${u.id}`), { status: 'approved', username: un, password: pw, needsReset: true });
    await callEmailService('approve-user', { userEmail: u.email, userName: u.name, username: un, tempPass: pw });
    alert("Authorization Granted. Email Dispatched.");
  };

  const onReject = async (u) => {
    if (!window.confirm(`Reject ${u.name}'s application?`)) return;
    await callEmailService('reject-user', { userEmail: u.email, userName: u.name });
    await remove(ref(db, `users/${u.id}`));
    alert("Application Denied & Purged.");
  };

  const onRevoke = async (u) => {
    if (!window.confirm("Immediately Revoke Network Access?")) return;
    await callEmailService('revoke-user', { userEmail: u.email, userName: u.name });
    await remove(ref(db, `users/${u.id}`));
    alert("Sentinel Module Deactivated.");
  };

  // --- RENDERING SUB-VIEWS ---

  const AdminHub = () => (
    <div style={styles.container}>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
        <h2>Sentinel Command Hub</h2> <button style={styles.miniBtn} onClick={() => setView('landing')}>Logout</button>
      </div>
      <div style={styles.mapWrap}>
        <MapContainer center={[17.6, 78.4]} zoom={11} style={{ height: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {Object.values(users).map(u => (
            <Marker key={u.id} position={[u.lat, u.lng]}><Popup>{u.name} - {u.status}</Popup></Marker>
          ))}
        </MapContainer>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', width: '100%' }}>
        <div style={styles.card}>
          <h3>Verification Queue</h3>
          {Object.values(users).filter(u => u.status === 'pending').map(u => (
            <div key={u.id} style={styles.item}>
              <p><b>{u.name}</b> ({u.vehicle})</p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button style={styles.btnApp} onClick={() => onApprove(u)}>Approve</button>
                <button style={styles.btnRej} onClick={() => onReject(u)}>Reject</button>
              </div>
            </div>
          ))}
        </div>
        <div style={styles.card}>
          <h3>Authorized Network</h3>
          {Object.values(users).filter(u => u.status === 'approved').map(u => (
            <div key={u.id} style={styles.item}>
              <p>{u.name} (Active)</p>
              <button style={styles.btnRej} onClick={() => onRevoke(u)}>Revoke Access</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div style={styles.main}>
      {view === 'landing' && (
        <div style={{ textAlign: 'center', marginTop: '15vh' }}>
          <h1 style={{ fontSize: '5rem', color: THEME.danger, margin: 0 }}>ResQFlow</h1>
          <p style={{ color: THEME.muted, fontSize: '20px' }}>SENTINEL EMERGENCY NETWORK v6.0</p>
          <div style={{ maxWidth: '400px', margin: '40px auto' }}>
            <SentinelButton label="OPERATOR LOGIN" onClick={() => setView('login')} />
            <SentinelButton label="REGISTER MODULE" variant="success" onClick={() => setView('signup')} />
            <p onClick={() => { if (prompt("Access Key") === "ResQFlow@AAMSUV") setView('admin') }} style={styles.link}>Admin Access</p>
          </div>
        </div>
      )}

      {view === 'signup' && (
        <div style={styles.container}><div style={styles.card}>
          <h2>New Registration</h2>
          <SentinelInput label="Full Name" onChange={e => setRegForm({...regForm, name: e.target.value})} />
          <SentinelInput label="Official Email" onChange={e => setRegForm({...regForm, email: e.target.value})} />
          <SentinelInput label="Vehicle ID" onChange={e => setRegForm({...regForm, vehicle: e.target.value})} />
          <SentinelInput label="Document URL" onChange={e => setRegForm({...regForm, doc: e.target.value})} />
          <SentinelButton label="SUBMIT APPLICATION" onClick={handleReg} loading={isProcessing} />
          <p onClick={() => setView('landing')} style={styles.link}>Cancel</p>
        </div></div>
      )}

      {view === 'login' && (
        <div style={styles.container}><div style={styles.card}>
          <h2>Operator Authenticator</h2>
          <SentinelInput label="Username" onChange={e => setLoginForm({...loginForm, u: e.target.value})} />
          <SentinelInput label="Credentials (OTP)" type="password" onChange={e => setLoginForm({...loginForm, p: e.target.value})} />
          <SentinelButton label="AUTHENTICATE" onClick={handleLogin} />
          <p onClick={() => setView('landing')} style={styles.link}>Back</p>
        </div></div>
      )}

      {view === 'admin' && <AdminHub />}
    </div>
  );
}

// --- STYLING LOGIC ---
const styles = {
  main: { background: THEME.bg, minHeight: '100vh', color: THEME.text, fontFamily: 'Segoe UI, sans-serif' },
  container: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px' },
  card: { background: THEME.surface, padding: '30px', borderRadius: '15px', border: `1px solid ${THEME.border}`, width: '100%', maxWidth: '500px' },
  inp: { width: '100%', padding: '14px', margin: '8px 0', background: THEME.bg, border: `1px solid ${THEME.border}`, color: 'white', borderRadius: '10px', boxSizing: 'border-box' },
  btn: { width: '100%', padding: '16px', border: 'none', borderRadius: '10px', color: 'white', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' },
  btnApp: { background: THEME.success, color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' },
  btnRej: { background: THEME.danger, color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' },
  item: { padding: '15px', borderBottom: `1px solid ${THEME.border}`, marginBottom: '10px' },
  mapWrap: { height: '350px', width: '100%', borderRadius: '15px', overflow: 'hidden', border: `1px solid ${THEME.border}`, margin: '20px 0' },
  link: { marginTop: '30px', cursor: 'pointer', color: THEME.muted, fontSize: '12px' },
  miniBtn: { background: 'transparent', color: THEME.danger, border: `1px solid ${THEME.danger}`, padding: '8px 16px', borderRadius: '5px', cursor: 'pointer' }
};