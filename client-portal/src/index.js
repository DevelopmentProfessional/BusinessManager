// ...existing imports...
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import RegisterCompany from './pages/RegisterCompany';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <Router>
    <Routes>
      {/* ...existing routes... */}
      <Route path="/register-company" element={<RegisterCompany />} />
    </Routes>
  </Router>
);