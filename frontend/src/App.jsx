import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Clients from './pages/Clients';
import Products from './pages/Products';
import Services from './pages/Services';
import Employees from './pages/Employees';
import Schedule from './pages/Schedule';
import Inventory from './pages/Inventory';
import Assets from './pages/Assets';
import Attendance from './pages/Attendance';
import Documents from './pages/Documents';
import TableFormat from './pages/TableFormat';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Products />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/products" element={<Products />} />
          <Route path="/services" element={<Services />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/assets" element={<Assets />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/tableformat" element={<TableFormat />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
