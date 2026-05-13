import { Link } from 'react-router-dom';

function App() {
  return (
    <div>
      {/* ...existing code... */}
      <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)' }}>
        <Link to="/register-company">
          <button style={{ padding: '10px 20px', backgroundColor: '#007BFF', color: '#FFF', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
            Register Company
          </button>
        </Link>
      </div>
    </div>
  );
}

export default App;