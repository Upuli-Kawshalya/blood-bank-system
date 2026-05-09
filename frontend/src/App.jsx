import { useState, useEffect } from 'react';
import axios from 'axios';

// Create Axios instance with base URL + token auto-attachment
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' }
});

// Auto-attach token to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function App() {
  // Navigation state
  const [view, setView] = useState('dashboard');
  
  // User & Auth states
  const [user, setUser] = useState(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  // Appointment states
  const [appointments, setAppointments] = useState([]);
  const [formData, setFormData] = useState({ appointment_date: '', time_slot: '' });
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  // Inventory states
  const [inventory, setInventory] = useState([]);
  const [newBlood, setNewBlood] = useState({ blood_group: 'O+', units_available: 10, expiry_date: '' });

  // Check login on load
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/users/profile')
        .then(res => {
          setUser(res.data.user);
          setIsAdmin(res.data.user.role === 'admin');
          fetchAppointments();
        })
        .catch(() => localStorage.removeItem('token'));
    }
    fetchInventory();
  }, []);

  // Fetch Appointments
  const fetchAppointments = async () => {
    try {
      const res = await api.get('/appointments/my');
      setAppointments(res.data.appointments || []);
    } catch (err) { console.error('Error fetching appointments', err); }
  };

  // Fetch Inventory
  const fetchInventory = async () => {
    try {
      const res = await api.get('/inventory');
      setInventory(res.data.inventory || []);
    } catch (err) { console.error('Error fetching inventory', err); }
  };

  // Handle Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setStatus('Logging in...');
    try {
      const res = await api.post('/users/login', { email: loginEmail, password: loginPassword });
      localStorage.setItem('token', res.data.token);
      setUser(res.data.user);
      fetchAppointments();
      setStatus('✅ Login successful!');
    } catch (err) {
      setStatus('❌ ' + (err.response?.data?.error || 'Login failed'));
    }
  };

  // Handle Booking
  const handleBook = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus('Booking...');
    try {
      await api.post('/appointments', formData);
      setStatus('✅ Appointment booked!');
      setFormData({ appointment_date: '', time_slot: '' });
      fetchAppointments();
    } catch (err) {
      setStatus('❌ ' + (err.response?.data?.error || 'Booking failed'));
    } finally {
      setLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setAppointments([]);
    setView('dashboard');
  };

  // 🔐 LOGIN FORM (shown when NOT logged in)
  if (!user) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '400px', margin: 'auto' }}>
        <h1>🩸 Blood Bank Login</h1>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '1rem' }}>
            <label>Email:</label><br />
            <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required style={{ width: '100%', padding: '8px', marginTop: '4px' }} />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label>Password:</label><br />
            <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required style={{ width: '100%', padding: '8px', marginTop: '4px' }} />
          </div>
          <button type="submit" style={{ padding: '10px 20px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Login</button>
        </form>
        {status && <p style={{ marginTop: '1rem', color: status.includes('✅') ? 'green' : 'red', fontWeight: 'bold' }}>{status}</p>}
      </div>
    );
  }

  // ✅ MAIN APP (shown when logged in)
  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '800px', margin: 'auto', padding: '1rem' }}>
      
      {/* 🧭 NAVIGATION BAR */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', background: '#f8f9fa', padding: '1rem', borderRadius: '8px' }}>
        <div>
          <button onClick={() => setView('dashboard')} style={{ marginRight: '10px', padding: '8px 16px', background: view === 'dashboard' ? '#007bff' : 'white', color: view === 'dashboard' ? 'white' : 'black', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>🏠 Dashboard</button>
          <button onClick={() => setView('inventory')} style={{ padding: '8px 16px', background: view === 'inventory' ? '#007bff' : 'white', color: view === 'inventory' ? 'white' : 'black', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>🩸 Inventory</button>
        </div>
        <div>
          <span style={{ marginRight: '1rem', fontWeight: 'bold' }}>👋 {user.full_name}</span>
          <button onClick={handleLogout} style={{ padding: '8px 16px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Logout</button>
        </div>
      </nav>

      {/* VIEW: Dashboard */}
      {view === 'dashboard' && (
        <div>
          <div style={{ background: '#f8f9fa', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
            <h2>📅 Book Donation Appointment</h2>
            <form onSubmit={handleBook}>
              <div style={{ marginBottom: '1rem' }}>
                <label>Date:</label><br />
                <input type="date" value={formData.appointment_date} onChange={e => setFormData({...formData, appointment_date: e.target.value})} min={new Date().toISOString().split('T')[0]} required style={{ width: '100%', padding: '8px', marginTop: '4px' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label>Time Slot:</label><br />
                <select value={formData.time_slot} onChange={e => setFormData({...formData, time_slot: e.target.value})} required style={{ width: '100%', padding: '8px', marginTop: '4px' }}>
                  <option value="">Select a time</option>
                  <option value="09:00-10:00">09:00 - 10:00</option>
                  <option value="10:00-11:00">10:00 - 11:00</option>
                  <option value="11:00-12:00">11:00 - 12:00</option>
                  <option value="14:00-15:00">14:00 - 15:00</option>
                  <option value="15:00-16:00">15:00 - 16:00</option>
                </select>
              </div>
              <button type="submit" disabled={loading} style={{ padding: '10px 20px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>{loading ? 'Booking...' : 'Book Appointment'}</button>
            </form>
            {status && <p style={{ marginTop: '1rem', color: status.includes('✅') ? 'green' : 'red', fontWeight: 'bold' }}>{status}</p>}
          </div>
          <div>
            <h2>🗓️ Your Appointments</h2>
            {appointments.length === 0 ? <p style={{ color: '#666' }}>No appointments yet.</p> : (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {appointments.map(apt => (
                  <li key={apt.id} style={{ background: '#fff', padding: '1rem', marginBottom: '0.5rem', borderRadius: '4px', borderLeft: `4px solid ${apt.status === 'confirmed' ? '#28a745' : apt.status === 'cancelled' ? '#dc3545' : '#ffc107'}` }}>
                    <strong>{apt.appointment_date}</strong> • {apt.time_slot}<br />
                    <span style={{ fontSize: '0.9rem', color: '#666', textTransform: 'capitalize' }}>Status: {apt.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* VIEW: Inventory */}
      {view === 'inventory' && (
        <div>
          <h2>🩸 Available Blood Stock</h2>
          
          {/* ✅ Admin: Add Blood Form (Only shows for admins) */}
          {isAdmin && (
            <div style={{ background: '#e3f2fd', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem 0' }}>➕ Add Blood Batch (Admin)</h3>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <select 
                  value={newBlood.blood_group} 
                  onChange={e => setNewBlood({...newBlood, blood_group: e.target.value})}
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                </select>
                <input 
                  type="number" 
                  placeholder="Units" 
                  value={newBlood.units_available} 
                  onChange={e => setNewBlood({...newBlood, units_available: parseInt(e.target.value) || 0})}
                  min="1"
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '80px' }}
                />
                <input 
                  type="date" 
                  value={newBlood.expiry_date} 
                  onChange={e => setNewBlood({...newBlood, expiry_date: e.target.value})}
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
                <button 
                  onClick={async () => {
                    try {
                      await api.post('/inventory', newBlood);
                      setNewBlood({ blood_group: 'O+', units_available: 10, expiry_date: '' });
                      fetchInventory();
                      alert('✅ Blood added!');
                    } catch (err) {
                      alert('❌ Error: ' + (err.response?.data?.error || 'Failed to add'));
                    }
                  }}
                  style={{ padding: '8px 16px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Add Blood
                </button>
              </div>
            </div>
          )}
          
          {/* Inventory List or Empty Message */}
          {inventory.length === 0 ? (
            <p style={{ color: '#666', background: '#f8f9fa', padding: '1rem', borderRadius: '8px' }}>
              No blood in stock yet. (Admin needs to add blood batches).
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
              {inventory.map(item => (
                <div key={item.id} style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', textAlign: 'center' }}>
                  <h3 style={{ fontSize: '2rem', margin: '0.5rem 0' }}>🩸 {item.blood_group}</h3>
                  <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{item.units_available} Units</p>
                  <p style={{ fontSize: '0.8rem', color: '#666' }}>Expires: {item.expiry_date}</p>
                  {item.units_available < 5 && <span style={{ color: 'red', fontWeight: 'bold' }}>⚠️ Low Stock!</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;