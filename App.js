import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, update, push, set, remove } from 'firebase/database';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import emailjs from '@emailjs/browser'; 
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine';

// --- LEAFLET ASSET CONFIGURATION ---
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// --- ROAD-SNAPPING ROUTE COMPONENT ---
const RoutingEngine = ({ start, end }) => {
  const map = useMap();
  useEffect(() => {
    if (!map || !start || !end) return;
    const rc = L.Routing.control({
      waypoints: [L.latLng(start[0], start[1]), L.latLng(end[0], end[1])],
      lineOptions: { styles: [{ color: '#ef4444', weight: 6, opacity: 0.8 }] },
      show: false, addWaypoints: false, createMarker: () => null 
    }).addTo(map);
    return () => map.removeControl(rc);
  }, [map, start, end]);
  return null;
};

const firebaseConfig = {
  apiKey: "AIzaSyA1Gz-ys-SHmapDBLoo__hWOrGqbxNHS6c",
  databaseURL: "https://iaas-emergency-system-default-rtdb.firebaseio.com",
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export default function App() {
  const [view, setView] = useState('landing');
  const [allUsers, setAllUsers] = useState({});
  const [adminAuth, setAdminAuth] = useState({ user: '', pass: '' });
  const [loginCreds, setLoginCreds] = useState({ user: '', pass: '' });
  const [regData, setRegData] = useState({ name: '', email: '', phone: '', vehicle: '', docUrl: '' });
  const [newPass, setNewPass] = useState('');
  const [tempUser, setTempUser] = useState(null);
  const [vehiclePos, setVehiclePos] = useState([17.385, 78.486]);
  const signalPos = [17.6048, 78.4867];

  useEffect(() => {
    onValue(ref(db, 'users'), (snapshot) => {
      const data = snapshot.val() || {};
      setAllUsers(data);
      if (tempUser && data[tempUser.id]) setVehiclePos([data[tempUser.id].lat, data[tempUser.id].lng]);
    });
  }, [tempUser]);

  // --- EMAIL DISPATCHER ---
  const sendEmail = (params) => {
    // Replace placeholders with your real EmailJS IDs
    emailjs.send('YOUR_SERVICE_ID', 'YOUR_TEMPLATE_ID', params, 'YOUR_PUBLIC_KEY')
      .then(() => console.log("Email sent successfully"))
      .catch((err) => console.error("Email failed", err));
  };

  const handleRegister = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(regData.email) || regData.phone.length !== 10 || !regData.docUrl.startsWith('http')) {
      return alert("Invalid: Check Email format, Phone (10 digits), and Doc URL.");
    }
    const uRef = push(ref(db, 'users'));
    await set(uRef, { ...regData, status: 'pending', id: uRef.key, lat: 17.385, lng: 78.486, isEmergency: false });
    
    sendEmail({ to_email: 'samalaabhiram1686@gmail.com', message: `New signup: ${regData.name}` });
    alert("ResQFlow administration will accept your application soon.");
    setView('landing');
  };

  const handleApprove = async (user) => {
    const username = user.name.toLowerCase().replace(/\s/g, '') + Math.floor(100+Math.random()*900);
    const otp = Math.random().toString(36).slice(-8);
    await update(ref(db, `users/${user.id}`), { status: 'approved', username, password: otp, needsReset: true });
    
    sendEmail({ to_email: user.email, username, otp, message: "Your application is approved." });
    alert(`Approved! User: ${username}, OTP: ${otp}`);
  };

  const handleLogin = () => {
    const match = Object.values(allUsers).find(u => u.username === loginCreds.user && u.password === loginCreds.pass);
    if (match) {
      if (match.status !== 'approved') return alert("Access pending.");
      setTempUser(match);
      setView(match.needsReset ? 'reset-password' : 'driver-dash');
    } else alert("Invalid credentials.");
  };

  // --- ADMIN VIEW ---
  if (view === 'admin-dash') return (
    <div style={containerStyle}>
      <div style={{display:'flex', justifyContent:'space-between'}}><h2>Admin Hub</h2><button onClick={() => setView('landing')} style={btnSec}>Logout</button></div>
      <div style={mapBox}><MapContainer center={signalPos} zoom={12} style={{height:'100%'}}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {Object.values(allUsers).map(u => (
          <Marker key={u.id} position={[u.lat, u.lng]} icon={new L.Icon({iconUrl: u.isEmergency ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png' : 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png', iconSize:[25,41]})}><Popup>{u.name}</Popup></Marker>
        ))}
      </MapContainer></div>
      {Object.values(allUsers).filter(u => u.status === 'pending').map(u => (
        <div key={u.id} style={card}>
          <p><strong>{u.name}</strong> (<a href={u.docUrl} target="_blank" rel="noreferrer">Doc</a>)</p>
          <button onClick={() => handleApprove(u)} style={{background:'green', color:'white', border:'none', padding:'10px', borderRadius:'5px', marginRight:'5px'}}>Approve</button>
          <button onClick={async () => await remove(ref(db, `users/${u.id}`))} style={{background:'red', color:'white', border:'none', padding:'10px', borderRadius:'5px'}}>Reject</button>
        </div>
      ))}
    </div>
  );

  // --- DRIVER DASH ---
  if (view === 'driver-dash') return (
    <div style={{...containerStyle, padding:0}}>
      <div style={{height:'70vh'}}><MapContainer center={vehiclePos} zoom={14} style={{height:'100%'}}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <RoutingEngine start={vehiclePos} end={signalPos} />
        <Marker position={vehiclePos}><Popup>My Location</Popup></Marker>
      </MapContainer></div>
      <div style={{padding:'20px'}}>
        <button onClick={() => update(ref(db, `users/${tempUser.id}`), { isEmergency: true })} style={emergencyBtn}>START EMERGENCY</button>
        <button onClick={() => setView('landing')} style={btnSec}>Logout</button>
      </div>
    </div>
  );

  // --- OTHER VIEWS (LOGIN, REGISTER, RESET) ---
  if (view === 'register') return (
    <div style={containerStyle}><div style={card}>
      <h2>Register</h2>
      <input placeholder="Name" style={inputStyle} onChange={e => setRegData({...regData, name: e.target.value})} />
      <input placeholder="Email" style={inputStyle} onChange={e => setRegData({...regData, email: e.target.value})} />
      <input placeholder="Phone" style={inputStyle} onChange={e => setRegData({...regData, phone: e.target.value})} />
      <input placeholder="Vehicle No" style={inputStyle} onChange={e => setRegData({...regData, vehicle: e.target.value})} />
      <input placeholder="Document URL" style={inputStyle} onChange={e => setRegData({...regData, docUrl: e.target.value})} />
      <button style={btnPri} onClick={handleRegister}>Apply</button>
      <button onClick={() => setView('landing')} style={btnSec}>Back</button>
    </div></div>
  );

  if (view === 'driver-login') return (
    <div style={containerStyle}><div style={card}>
      <h2>Driver Login</h2>
      <input placeholder="Username" style={inputStyle} onChange={e => setLoginCreds({...loginCreds, user: e.target.value})} />
      <input type="password" placeholder="OTP / Password" style={inputStyle} onChange={e => setLoginCreds({...loginCreds, pass: e.target.value})} />
      <button style={btnPri} onClick={handleLogin}>Login</button>
      <button onClick={() => setView('landing')} style={btnSec}>Back</button>
    </div></div>
  );

  if (view === 'admin-login') return (
    <div style={containerStyle}><div style={card}>
      <h2>Admin Login</h2>
      <input placeholder="Admin ID" style={inputStyle} onChange={e => setAdminAuth({...adminAuth, user: e.target.value.trim()})} />
      <input type="password" placeholder="Key" style={inputStyle} onChange={e => setAdminAuth({...adminAuth, pass: e.target.value.trim()})} />
      <button style={btnPri} onClick={() => (adminAuth.user === 'admin' && adminAuth.pass === 'ResQFlow@AAMSUV') ? setView('admin-dash') : alert("Denied")}>Login</button>
    </div></div>
  );

  if (view === 'reset-password') return (
    <div style={containerStyle}><div style={card}>
      <h2>Secure Account</h2>
      <input type="password" placeholder="New Permanent Password" style={inputStyle} onChange={e => setNewPass(e.target.value)} />
      <button style={btnPri} onClick={async () => { await update(ref(db, `users/${tempUser.id}`), { password: newPass, needsReset: false }); setView('driver-dash'); }}>Set & Login</button>
    </div></div>
  );

  return (
    <div style={containerStyle}>
      <h1 style={{color:'#ef4444'}}>ResQFlow SENTINEL</h1>
      <button onClick={() => setView('driver-login')} style={btnPri}>LOGIN</button>
      <button onClick={() => setView('register')} style={btnSec}>SIGN UP</button>
      <button onClick={() => setView('admin-login')} style={{...btnSec, border:'none', marginTop:'40px', color:'#475569'}}>Admin</button>
    </div>
  );
}

// STYLES
const containerStyle = { backgroundColor: '#020617', minHeight: '100vh', color: 'white', padding: '40px', textAlign:'center', fontFamily:'sans-serif' };
const card = { backgroundColor: '#0f172a', padding: '20px', borderRadius: '12px', border: '1px solid #1e293b', maxWidth:'500px', margin:'10px auto' };
const mapBox = { height: '400px', borderRadius: '15px', overflow: 'hidden', margin: '20px 0', border: '1px solid #1e293b' };
const inputStyle = { width: '100%', padding: '12px', margin: '8px 0', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#020617', color: 'white', boxSizing:'border-box' };
const btnPri = { background: '#2563eb', color: 'white', padding: '15px', border: 'none', borderRadius: '8px', width:'100%', cursor:'pointer', fontWeight:'bold' };
const btnSec = { background: 'none', color: '#60a5fa', border: '1px solid #2563eb', padding: '15px', borderRadius: '8px', width:'100%', cursor:'pointer' };
const emergencyBtn = { width: '100%', maxWidth:'400px', height: '80px', background: '#ef4444', color: 'white', fontSize: '22px', fontWeight: 'bold', borderRadius: '15px', cursor: 'pointer' };