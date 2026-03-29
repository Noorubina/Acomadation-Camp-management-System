import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';

const GroupCheckinCSVUpload = ({ rooms, onSubmit, companyName, setCompanyName }) => {
  const [csvData, setCsvData] = useState([]);
  const [showDropdown, setShowDropdown] = useState([]);
  const [error, setError] = useState('');
  const [employees, setEmployees] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkInDate, setCheckInDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedRoomNames, setSelectedRoomNames] = useState([]);

  // Parse CSV file
  const handleFileUpload = (e) => {
    setError('');
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length) {
          setError('Error parsing CSV file. Please check the file format.');
          return;
        }
        if (!results.meta || !results.meta.fields) {
          setError('Invalid CSV format: missing header row.');
          return;
        }
        // Validate required fields in CSV
        const requiredFields = ['name', 'id_no', 'employeeNationality', 'employeePhone', 'status'];
        const missingFields = requiredFields.filter(field => !results.meta.fields.includes(field));
        if (missingFields.length > 0) {
          setError(`Missing required fields in CSV: ${missingFields.join(', ')}`);
          return;
        }
        // Initialize employees with roomId empty
        const parsedEmployees = results.data.map(emp => ({
          ...emp,
          roomId: ''
        }));

        setEmployees(parsedEmployees);
        setShowDropdown(new Array(parsedEmployees.length).fill(false));
        setSelectedRoomNames(new Array(parsedEmployees.length).fill(''));
      }
    });
  };

  // Memoize current occupancy based on employees
  const currentOccupancy = useMemo(() => {
    const occupancy = {};
    employees.forEach(emp => {
      if (emp.roomId) {
        occupancy[String(emp.roomId)] = (occupancy[String(emp.roomId)] || 0) + 1;
      }
    });
    return occupancy;
  }, [employees]);

  // Update roomId for an employee and update selected room names
  const handleRoomChange = (index, newRoomId) => {
    setEmployees(prevEmployees => {
      const updatedEmployees = [...prevEmployees];
      updatedEmployees[index] = { ...updatedEmployees[index], roomId: newRoomId };
      return updatedEmployees;
    });

    setSelectedRoomNames(prevNames => {
      const newNames = [...prevNames];
      const room = rooms.find(r => String(r.id) === String(newRoomId));
      newNames[index] = room ? `${room.building_name} - Room ${room.room_number}` : '';
      return newNames;
    });
  };

  // Validate before submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setError('Please enter a company name.');
      return;
    }
    const unassigned = employees.filter(emp => !emp.roomId);
    if (unassigned.length > 0) {
      setError('Please assign a room to every employee before submitting.');
      return;
    }

    // Check for duplicate id_no within the same company
    const idCounts = {};
    const duplicates = [];
    employees.forEach((emp, index) => {
      const key = `${companyName.trim()}-${emp.id_no}`;
      if (idCounts[key]) {
        duplicates.push({ id_no: emp.id_no, row: index + 2 }); // +2 because index starts at 0 and header is row 1
      } else {
        idCounts[key] = true;
      }
    });

    if (duplicates.length > 0) {
      const duplicateList = duplicates.map(d => `ID "${d.id_no}" (row ${d.row})`).join(', ');
      setError(`Duplicate employee IDs found for company "${companyName.trim()}": ${duplicateList}. Please ensure all IDs are unique within the same company.`);
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      const employeesWithDate = employees.map(emp => ({
        ...emp,
        checkInDate: checkInDate || new Date().toISOString().split('T')[0]
      }));
      await onSubmit(employeesWithDate, companyName.trim());
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = '';
    } catch (error) {
      console.error('Submission error:', error);
      setError('An error occurred during submission. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="csv-upload-section">
      <div className="form-section">
        <h3 className="section-title">📊 CSV Upload for Group Check-In</h3>

        {/* File Upload Section */}
        <div className="form-row">
          <div className="form-group">
            <label>📁 Select CSV File:</label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="form-input"
              style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
            <small style={{ color: '#666', fontSize: '0.9em', marginTop: '5px', display: 'block' }}>
              CSV should contain: name, id_no, employeeNationality, employeePhone, status columns
            </small>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div
            className="error-message"
            style={{
              backgroundColor: '#fee',
              border: '1px solid #fcc',
              color: '#c33',
              padding: '10px',
              borderRadius: '4px',
              marginBottom: '15px'
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* Employee Assignment Table */}
        {employees.length > 0 && (
          <div className="table-section">
            <h4 className="section-title" style={{ fontSize: '1.1em', marginBottom: '15px' }}>
              👥 Assign Rooms to Employees ({employees.length} employees)
            </h4>

            {/* Check-in Date and Company Name Inputs */}
            <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div>
                <label htmlFor="checkin-date" style={{ fontWeight: '600', marginRight: '10px' }}>
                  🗓️ Check-In Date:
                </label>
                <input
                  type="date"
                  id="checkin-date"
                  value={checkInDate}
                  onChange={(e) => setCheckInDate(e.target.value)}
                  className="form-input"
                  style={{
                    padding: '6px 10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '1em',
                    minWidth: '180px'
                  }}
                />
              </div>
              <div>
                <label htmlFor="company-name" style={{ fontWeight: '600', marginRight: '10px' }}>
                  🏢 Company Name:
                </label>
                <input
                  type="text"
                  id="company-name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="form-input"
                  placeholder="Enter company name"
                  style={{
                    padding: '6px 10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '1em',
                    minWidth: '180px'
                  }}
                  required
                />
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>👤 Employee Name</th>
                      <th>🆔 ID No</th>
                      <th>🌍 Nationality</th>
                      <th>📞 Phone</th>
                      <th>🏷️ Status</th>
                      <th>🏨 Assigned Room</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: '500' }}>{emp.name}</td>
                        <td>{emp.id_no}</td>
                        <td>{emp.employeeNationality}</td>
                        <td>{emp.employeePhone}</td>
                        <td>
                          <span
                            style={{
                              backgroundColor: '#e8f5e8',
                              color: '#2e7d32',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.85em',
                              fontWeight: '500'
                            }}
                          >
                            {emp.status}
                          </span>
                        </td>
                        <td>
                          <select
                            value={emp.roomId}
                            onChange={(e) => handleRoomChange(idx, e.target.value)}
                            className="form-input"
                            required
                            style={{
                              width: '100%',
                              minWidth: '200px',
                              padding: '6px 8px',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              fontSize: '0.9em'
                            }}
                          >
                            <option value="">🏨 Select Room</option>
                            {rooms
                              .filter(room => {
                                const assigned = currentOccupancy[String(room.id)] || 0;
                                const availableBeds = room.total_beds - room.occupied_beds - assigned;
                                return availableBeds > 0 || String(room.id) === String(emp.roomId);
                              })
                              .sort((a, b) => {
                                const buildingCompare = a.building_name.localeCompare(b.building_name);
                                if (buildingCompare !== 0) return buildingCompare;
                                const numA = parseInt(a.room_number.match(/\d+/)?.[0] || '0', 10);
                                const numB = parseInt(b.room_number.match(/\d+/)?.[0] || '0', 10);
                                if (numA !== numB) return numA - numB;
                                return a.room_number.localeCompare(b.room_number);
                              })
                              .map(room => {
                                const assigned = currentOccupancy[String(room.id)] || 0;
                                const bedsAvailable = room.total_beds - room.occupied_beds - assigned;
                                return (
                                  <option key={room.id} value={room.id}>
                                    {room.building_name} - Room {room.room_number} ({bedsAvailable} beds available)
                                  </option>
                                );
                              })}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Submit Button */}
              <div className="form-actions" style={{ marginTop: '20px', textAlign: 'center' }}>
                <button
                  type="submit"
                  className="btn btn-primary submit-btn"
                  disabled={isSubmitting}
                  style={{
                    padding: '12px 30px',
                    fontSize: '1.1em',
                    fontWeight: '600',
                    borderRadius: '8px'
                  }}
                >
                  {isSubmitting ? '⏳ Processing...' : '✅ Submit Group Check-In'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Empty State */}
        {employees.length === 0 && !error && (
          <div
            className="empty-state"
            style={{
              textAlign: 'center',
              padding: '40px 20px',
              backgroundColor: '#f9f9f9',
              border: '2px dashed #ddd',
              borderRadius: '8px',
              color: '#666'
            }}
          >
            <div style={{ fontSize: '3em', marginBottom: '15px' }}>📄</div>
            <p style={{ fontSize: '1.1em', marginBottom: '10px' }}>No CSV file uploaded yet</p>
            <p style={{ fontSize: '0.9em' }}>Please select a CSV file to begin the group check-in process</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupCheckinCSVUpload;