import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

const TravelPlanner = () => {
  const [formData, setFormData] = useState({
    location: '',
    budget: '',
    duration: '',
    ageGroup: '',
    transport: ''
  });

  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResponse(null);
    setSubmitted(true);

    try {
      const res = await axios.post('/api/generate-plan', formData);
      setResponse(res.data);
    } catch (error) {
      console.error('Error:', error);
      setResponse({ 
        success: false, 
        error: error.response?.data?.error || error.message 
      });
    }

    setLoading(false);
  };

  return (
    <>
      <nav className="topnav">
        <div className="nav-left">
          <img src="https://img.icons8.com/ios-filled/50/ffffff/user-male-circle.png" alt="Profile" className="nav-icon" />
        </div>
        <div className="nav-right">
          <img src="https://img.icons8.com/ios-filled/50/ffffff/menu--v1.png" alt="Menu" className="nav-icon" />
        </div>
      </nav>

      <div className="travel-planner-container">
        <div className={`form-and-response ${submitted ? 'shifted' : ''}`}>
          <div className="form-container">
            <h2>Travel Plan Generator</h2>
            <form onSubmit={handleSubmit} className="travel-form">
              <input
                name="location"
                placeholder="Location"
                value={formData.location}
                onChange={handleChange}
                required
              />
              <input
                name="budget"
                placeholder="Budget"
                value={formData.budget}
                onChange={handleChange}
                required
              />
              <input
                name="duration"
                placeholder="Duration (in days)"
                value={formData.duration}
                onChange={handleChange}
                required
              />
              <input
                name="ageGroup"
                placeholder="Age Group"
                value={formData.ageGroup}
                onChange={handleChange}
                required
              />
              <input
                name="transport"
                placeholder="Transport Mode"
                value={formData.transport}
                onChange={handleChange}
                required
              />
              <button type="submit" disabled={loading}>
                {loading ? 'Generating...' : 'Generate Plan'}
              </button>
            </form>
          </div>

          <div className="response-container">
            {response && (
              <div className="response-box">
                {response.success ? (
                  <>
                    <h3>Generated Plan:</h3>
                    <p>{response.data.generatedPlan}</p>
                  </>
                ) : (
                  <p className="error-text">Error: {response.error}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default TravelPlanner;