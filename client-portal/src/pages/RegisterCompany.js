import React, { useState } from 'react';

function RegisterCompany() {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    logo: null,
    contactNumber: '',
    email: ''
  });

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: files ? files[0] : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formDataToSend = new FormData();
    Object.keys(formData).forEach((key) => {
      formDataToSend.append(key, formData[key]);
    });

    try {
      const response = await fetch('/api/register-company', {
        method: 'POST',
        body: formDataToSend
      });
      if (response.ok) {
        alert('Company registration submitted successfully!');
      } else {
        alert('Failed to submit registration.');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('An error occurred.');
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Register Your Company</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Company Name:</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange} required />
        </div>
        <div>
          <label>Description:</label>
          <textarea name="description" value={formData.description} onChange={handleChange} required />
        </div>
        <div>
          <label>Logo:</label>
          <input type="file" name="logo" onChange={handleChange} required />
        </div>
        <div>
          <label>Contact Number:</label>
          <input type="text" name="contactNumber" value={formData.contactNumber} onChange={handleChange} required />
        </div>
        <div>
          <label>Email:</label>
          <input type="email" name="email" value={formData.email} onChange={handleChange} required />
        </div>
        <button type="submit">Submit</button>
      </form>
    </div>
  );
}

export default RegisterCompany;