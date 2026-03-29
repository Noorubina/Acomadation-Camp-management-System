import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import fetchWithAuth from '../api.js';
import './Dashboard.css'; // We'll create this CSS file for enhanced styling
import './view-buttons.css'; // Import the view buttons styles
import GroupCheckinCSVUpload from '../components/GroupCheckinCSVUpload';

// Helper function to format date as DD/MM/YYYY
const formatDateDDMMYYYY = (dateString) => {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Helper function to parse DD/MM/YYYY to YYYY-MM-DD
const parseDDMMYYYYToYYYYMMDD = (ddmmyyyy) => {
  if (!ddmmyyyy || ddmmyyyy.length !== 10) return '';
  const parts = ddmmyyyy.split('/');
  if (parts.length !== 3) return '';
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year) || day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) return '';
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [checkedInEmployees, setCheckedInEmployees] = useState([]);
  const [checkedOutEmployees, setCheckedOutEmployees] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedCheckedOutEmployees, setSelectedCheckedOutEmployees] = useState([]);
  const [selectedCheckedInEmployees, setSelectedCheckedInEmployees] = useState([]);

  const [activeTab, setActiveTab] = useState('overview');
  const [employeeListView, setEmployeeListView] = useState('checked-in'); // 'checked-in', 'checked-out', or 'all'

  const buildingIdMap = {
    'u-building': 4, // Camp 1 - Kitchen Block - U-Building
    'b-building': 5, // Camp 1 - Kitchen Block - B-Building
    'd-building': 6, // Camp 1 - Kitchen Block - D-Building
    'c-building': 7, // Camp 1 - Kitchen Block - C-Building
    'office-01-82': 8, // Camp 1 - Office Block - Rooms 01-82
    'office-a01-a18': 9, // Camp 1 - Office Block - Rooms A01-A18
    'building-1': 10, // Camp 2 - Building 1
    'building-2': 11, // Camp 2 - Building 2
    'building-3': 12, // Camp 2 - Building 3
    'building-4': 13, // Camp 2 - Building 4
    'extra-room': 14 // Camp 2 - Extra Room 62
  };

  const [checkInData, setCheckInData] = useState({
    roomId: '',
    employeeName: '',
    company_name: '',
    id_no: '',
    employeeNationality: '',
    employeePhone: '',
    status: '',
    customStatus: '',
    checkInDate: '',
    checkInTime: ''
  });

  const [checkOutData, setCheckOutData] = useState({
    employeeId: ''
  });

  // Group Check-in state
  const [groupCheckInData, setGroupCheckInData] = useState({
    company_name: ''
  });

  const [checkoutFilter, setCheckoutFilter] = useState({
    company: '',
    employeeName: ''
  });

  const [employeeFilter, setEmployeeFilter] = useState({
    company: '',
    employeeName: '',
    month: '',
    year: ''
  });

  // CSV Export function
  const handleCsvExport = (viewType) => {
    let dataToExport = [];
    let filename = '';

    if (viewType === 'checked-in') {
      dataToExport = filteredCheckedInEmployees;
      filename = 'checked-in-employees.csv';
    } else if (viewType === 'checked-out') {
      dataToExport = filteredCheckedOutEmployees;
      filename = 'checked-out-employees.csv';
    } else {
      // 'all' view - combine both arrays
      dataToExport = [
        ...filteredCheckedInEmployees.map(emp => ({ ...emp, current_status: 'Checked In' })),
        ...filteredCheckedOutEmployees.map(emp => ({ ...emp, current_status: 'Checked Out' }))
      ];
      filename = 'all-employees.csv';
    }

    if (dataToExport.length === 0) {
      alert('No data to export');
      return;
    }

    // Define CSV headers
    const headers = [
      'Employee Name',
      'Company Name',
      'ID No',
      'Nationality',
      'Status',
      'Room',
      'Building',
      'Check-In Date & Time',
      'Check-Out Date & Time',
      'Duration (Days)',
      'Current Status'
    ];

    // Convert data to CSV format
    const csvContent = [
      headers.join(','),
      ...dataToExport.map(employee => {
        const checkInDate = `${formatDateDDMMYYYY(employee.check_in_time)} ${new Date(employee.check_in_time).toLocaleTimeString()}`;
        const checkOutDate = employee.check_out_time ? `${formatDateDDMMYYYY(employee.check_out_time)} ${new Date(employee.check_out_time).toLocaleTimeString()}` : '-';
        const duration = employee.check_out_time ?
          Math.ceil((new Date(employee.check_out_time).getTime() - new Date(employee.check_in_time).getTime()) / (1000 * 3600 * 24)) + ' days' :
          'Current';

        return [
          `"${employee.name || ''}"`,
          `"${employee.company_name || ''}"`,
          `"${employee.id_no || ''}"`,
          `"${employee.nationality || ''}"`,
          `"${employee.status || ''}"`,
          `"${employee.room_number || ''}"`,
          `"${employee.building_name || ''}"`,
          `"${checkInDate}"`,
          `"${checkOutDate}"`,
          `"${duration}"`,
          `"${employee.current_status || (employee.check_out_time ? 'Checked Out' : 'Checked In')}"`
        ].join(',');
      })
    ].join('\n');

    // Create and download the CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    fetchBuildings();
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (selectedBuilding !== 'all') {
      fetchBuildingData(selectedBuilding);
      fetchEmployeesByBuilding(selectedBuilding);
    } else {
      fetchDashboardData();
      fetchCheckedInEmployees();
      fetchCheckedOutEmployees();
    }
  }, [selectedBuilding]);

  const fetchBuildings = async () => {
try {
  const response = await fetchWithAuth('/api/buildings');
  const data = await response.json();
  if (data.success) {
    setBuildings(data.data);
  }
} catch (error) {
  console.error('Error fetching buildings:', error);
}
  };

 const fetchDashboardData = async () => {
  try {
    const statsResponse = await fetchWithAuth('/api/dashboard/stats');
    const statsData = await statsResponse.json();

    const roomsResponse = await fetchWithAuth('/api/rooms');
    const roomsData = await roomsResponse.json();

    if (statsData.success && roomsData.success) {
      setStats(statsData.data);
      setRooms(roomsData.data);
    }
  } catch (error) {
    console.error('Error fetching data:', error);
  } finally {
    setLoading(false);
  }
};

 const fetchBuildingData = async (buildingId) => {
  try {
    const response = await fetchWithAuth(`/api/dashboard/stats/${buildingId}`);
    const data = await response.json();
    if (data.success) {
      setStats({
        totalRooms: data.data.totalRooms,
        totalBeds: data.data.totalBeds,
        occupiedBeds: data.data.occupiedBeds,
        vacantBeds: data.data.vacantBeds,
        buildings: []
      });
      setRooms(data.data.rooms);
    }
  } catch (error) {
    console.error('Error fetching building data:', error);
  }
};

 const fetchCheckedInEmployees = async () => {
  try {
    const response = await fetchWithAuth('/api/employees/checked-in');
    const data = await response.json();
    if (data.success) {
      setCheckedInEmployees(data.data);
    }
  } catch (error) {
    console.error('Error fetching checked-in employees:', error);
  }
};

  const handleCheckoutFromTable = async (employee) => {
  const { id } = employee;
  try {
    const response = await fetchWithAuth('/api/employees/checkout', {
      method: 'POST',
      body: JSON.stringify({ employeeId: id, phone: employee.phone })
    });
    const data = await response.json();
    alert(data.message);

    if (data.success) {
      fetchCheckedInEmployees();
      fetchDashboardData();
    }
  } catch (error) {
    console.error('Checkout error:', error);
  }
};

 const handleBulkCheckout = async () => {
  if (selectedCheckedInEmployees.length === 0) {
    alert('Please select employees to checkout.');
    return;
  }

  if (!window.confirm(`Are you sure you want to checkout ${selectedCheckedInEmployees.length} selected employee(s)?`)) {
    return;
  }

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  try {
    for (const employeeId of selectedCheckedInEmployees) {
      try {
        const employee = filteredCheckoutEmployees.find(emp => emp.id === employeeId);
        const response = await fetchWithAuth('/api/employees/checkout', {
          method: 'POST',
          body: JSON.stringify({ employeeId, phone: employee?.phone })
        });

        const data = await response.json();
        if (data.success) {
          successCount++;
        } else {
          errorCount++;
          errors.push(`Failed to checkout ${employee?.name || employeeId}: ${data.message}`);
        }
      } catch (error) {
        errorCount++;
        errors.push(`Error checking out ${employeeId}: ${error.message}`);
      }
    }

    // Show results
    let message = `Bulk checkout completed: ${successCount} successful`;
    if (errorCount > 0) {
      message += `, ${errorCount} failed`;
    }

    if (errors.length > 0 && errors.length <= 3) {
      message += '\n\nErrors:\n' + errors.join('\n');
    } else if (errors.length > 3) {
      message += '\n\nFirst 3 errors:\n' + errors.slice(0, 3).join('\n') + '\n...';
    }

    alert(message);

    if (successCount > 0) {
      setSelectedCheckedInEmployees([]);
      fetchCheckedInEmployees();
      fetchDashboardData();
    }
  } catch (error) {
    console.error('Bulk checkout error:', error);
    alert('An error occurred during bulk checkout.');
  }
};

const handleDeleteEmployee = async (employee) => {
  const { id } = employee;

  if (!window.confirm(`Are you sure you want to delete employee "${employee.name}"? This action cannot be undone.`)) {
    return;
  }

  try {
    const response = await fetchWithAuth(`/api/employees/${id}`, {
      method: 'DELETE'
    });

    const data = await response.json();
    alert(data.message);

    if (data.success) {
      fetchCheckedOutEmployees();
      fetchDashboardData();
    }
  } catch (error) {
    console.error('Delete employee error:', error);
    alert('An error occurred while deleting the employee');
  }
};

  const filteredCheckoutEmployees = (checkedInEmployees || []).filter(employee => {
    if (!employee) return false;
    const matchesCompany = (employee.company_name || '').toLowerCase().includes((checkoutFilter.company || '').toLowerCase());
    const matchesName = (employee.name || '').toLowerCase().includes((checkoutFilter.employeeName || '').toLowerCase());
    return matchesCompany && matchesName;
  });

  const filteredCheckedInEmployees = (checkedInEmployees || []).filter(employee => {
    if (!employee) return false;
    const matchesCompany = (employee.company_name || '').toLowerCase().includes((employeeFilter.company || '').toLowerCase());
    const matchesName = (employee.name || '').toLowerCase().includes((employeeFilter.employeeName || '').toLowerCase());
    const matchesMonth = employeeFilter.month === '' || (new Date(employee.check_in_time).getMonth() + 1).toString() === employeeFilter.month;
    const matchesYear = employeeFilter.year === '' || new Date(employee.check_in_time).getFullYear().toString() === employeeFilter.year;
    // Remove building filter here to avoid filtering twice
    return matchesCompany && matchesName && matchesMonth && matchesYear;
  });

  const filteredCheckedOutEmployees = (checkedOutEmployees || []).filter(employee => {
    if (!employee) return false;
    const matchesCompany = (employee.company_name || '').toLowerCase().includes((employeeFilter.company || '').toLowerCase());
    const matchesName = (employee.name || '').toLowerCase().includes((employeeFilter.employeeName || '').toLowerCase());
    const matchesMonth = employeeFilter.month === '' || (new Date(employee.check_in_time).getMonth() + 1).toString() === employeeFilter.month;
    const matchesYear = employeeFilter.year === '' || new Date(employee.check_in_time).getFullYear().toString() === employeeFilter.year;
    // Remove building filter here to avoid filtering twice
    return matchesCompany && matchesName && matchesMonth && matchesYear;
  });

const fetchCheckedOutEmployees = async () => {
  try {
    const response = await fetchWithAuth('/api/employees/checked-out');
    const data = await response.json();
    if (data.success) {
      setCheckedOutEmployees(data.data);
    }
  } catch (error) {
    console.error('Error fetching checked-out employees:', error);
  }
};

 const fetchEmployeesByBuilding = async (buildingName) => {
  const buildingId = buildingIdMap[buildingName] || null;
  if (!buildingId) return;

  try {
    const checkedInResponse = await fetchWithAuth(`/api/employees/checked-in/${buildingId}`);
    const checkedInData = await checkedInResponse.json();

    const checkedOutResponse = await fetchWithAuth(`/api/employees/checked-out/${buildingId}`);
    const checkedOutData = await checkedOutResponse.json();

    if (checkedInData.success) {
      setCheckedInEmployees(checkedInData.data);
    } else {
      setCheckedInEmployees([]);
    }
    if (checkedOutData.success) {
      setCheckedOutEmployees(checkedOutData.data);
    } else {
      setCheckedOutEmployees([]);
    }
  } catch (error) {
    console.error('Error fetching employees by building:', error);
    setCheckedInEmployees([]);
    setCheckedOutEmployees([]);
  }
};

  const addBed = async (roomId) => {
  try {
    const response = await fetchWithAuth('/api/rooms/add-bed', {
      method: 'POST',
      body: JSON.stringify({ roomId })
    });
    const data = await response.json();
    alert(data.message);
    if (selectedBuilding !== 'all') {
      fetchBuildingData(selectedBuilding);
    } else {
      fetchDashboardData();
    }
  } catch (error) {
    console.error('Error adding bed:', error);
  }
};

const removeBed = async (roomId) => {
  try {
    const response = await fetchWithAuth('/api/rooms/remove-bed', {
      method: 'POST',
      body: JSON.stringify({ roomId })
    });
    const data = await response.json();
    alert(data.message);
    if (selectedBuilding !== 'all') {
      fetchBuildingData(selectedBuilding);
    } else {
      fetchDashboardData();
    }
  } catch (error) {
    console.error('Error removing bed:', error);
  }
};

 const handleCheckIn = async (e) => {
  e.preventDefault();

  try {
    const payload = {
      roomId: checkInData.roomId,
      employeeName: checkInData.employeeName,
      employeeNationality: checkInData.employeeNationality,
      employeePhone: checkInData.employeePhone,
      company_name: checkInData.company_name,
      id_no: checkInData.id_no,
      status: checkInData.status === 'custom' ? checkInData.customStatus : checkInData.status
    };

    if (checkInData.checkInDate) {
      const convertedDate = parseDDMMYYYYToYYYYMMDD(checkInData.checkInDate);
      if (convertedDate) {
        payload.checkInDate = convertedDate;
      } else {
        alert('Invalid check-in date format. Please use DD/MM/YYYY format.');
        return;
      }
    }
    if (checkInData.checkInTime) {
      payload.checkInTime = checkInData.checkInTime;
    }

    const response = await fetchWithAuth('/api/employees/checkin', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    alert(data.message);

    if (data.success) {
      setCheckInData({ roomId: '', employeeName: '', company_name: '', id_no: '', employeeNationality: '', employeePhone: '', status: '', customStatus: '', checkInDate: '', checkInTime: '' });
      if (selectedBuilding !== 'all') {
        fetchBuildingData(selectedBuilding);
        fetchEmployeesByBuilding(selectedBuilding);
      } else {
        fetchDashboardData();
        fetchCheckedInEmployees();
      }
    }
  } catch (error) {
    console.error('Check-in error:', error);
  }
};

  const handleCheckOut = async (e) => {
  e.preventDefault();

  try {
    const response = await fetchWithAuth('/api/employees/checkout', {
      method: 'POST',
      body: JSON.stringify(checkOutData)
    });

    const data = await response.json();
    alert(data.message);

    if (data.success) {
      setCheckOutData({ employeeId: '' });
      if (selectedBuilding !== 'all') {
        fetchBuildingData(selectedBuilding);
      } else {
        fetchDashboardData();
      }
    }
  } catch (error) {
    console.error('Check-out error:', error);
  }
};

  // Group Check-in functions
  const handleCSVSubmit = async (employees, companyName) => {
    try {
      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      console.log('Starting CSV submission for', employees.length, 'employees');

      for (const employee of employees) {
        try {
          const payload = {
            roomId: employee.roomId,
            employeeName: employee.name,
            employeeNationality: employee.employeeNationality,
            employeePhone: employee.employeePhone,
            company_name: companyName,
            id_no: employee.id_no,
            status: employee.status
          };

          // Add checkInDate only if it's provided
          if (employee.checkInDate) {
            payload.checkInDate = employee.checkInDate;
          }

          console.log('Submitting employee:', employee.name, 'to room:', employee.roomId);

          const response = await fetchWithAuth(`/api/employees/checkin`, {
            method: 'POST',
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();
          if (data.success) {
            successCount++;
            console.log('Success for employee:', employee.name);
          } else {
            errorCount++;
            const errorMsg = `Failed for ${employee.name}: ${data.message || 'Unknown error'}`;
            errors.push(errorMsg);
            console.error(errorMsg);
          }
        } catch (error) {
          errorCount++;
          const errorMsg = `Error for ${employee.name}: ${error.message || error}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      // Show detailed results
      if (errors.length > 0) {
        const errorMessage = `CSV Upload failed: ${successCount} successful, ${errorCount} failed. Errors: ${errors.slice(0,3).join('; ')}${errors.length > 3 ? '...' : ''}`;
        throw new Error(errorMessage);
      } else {
        alert(`CSV Upload Complete: ${successCount} successful`);
      }

      if (successCount > 0) {
        console.log('Refreshing data after successful submissions');
        try {
          // Refresh data
          if (selectedBuilding !== 'all') {
            await fetchBuildingData(selectedBuilding);
            await fetchEmployeesByBuilding(selectedBuilding);
          } else {
            await fetchDashboardData();
            await fetchCheckedInEmployees();
          }
        } catch (refreshError) {
          console.error('Error refreshing data:', refreshError);
          // Don't show alert for refresh errors to avoid overwhelming the user
        }
      }
    } catch (globalError) {
      console.error('Global error in CSV submission:', globalError);
      alert('An unexpected error occurred during CSV submission. Please check the console for details.');
    }
  };

  const addEmployeeRow = () => {
    setGroupCheckInData({
      ...groupCheckInData,
      employees: [...groupCheckInData.employees, { name: '', id_no: '', employeeNationality: '', employeePhone: '', roomId: '', status: '', customStatus: '', checkInDate: '', checkInTime: '' }]
    });
  };

  const removeEmployeeRow = (index) => {
    if (groupCheckInData.employees.length > 1) {
      const newEmployees = groupCheckInData.employees.filter((_, i) => i !== index);
      setGroupCheckInData({
        ...groupCheckInData,
        employees: newEmployees
      });
    }
  };

  const updateEmployeeField = (index, field, value) => {
    const newEmployees = [...groupCheckInData.employees];
    newEmployees[index][field] = value;
    setGroupCheckInData({
      ...groupCheckInData,
      employees: newEmployees
    });
  };

  const handleGroupCheckIn = async (e) => {
  e.preventDefault();

    // Validate form
    if (!groupCheckInData.roomId || !groupCheckInData.company_name) {
      alert('Please select a room and enter company name');
      return;
    }

    // Filter out empty employee entries
    const validEmployees = groupCheckInData.employees.filter(emp =>
      emp.name.trim() !== '' || emp.id_no.trim() !== '' || emp.employeeNationality.trim() !== '' || emp.employeePhone.trim() !== ''
    );

    if (validEmployees.length === 0) {
      alert('Please add at least one employee');
      return;
    }

    // Prepare data for submission
    const submissionData = {
      roomId: groupCheckInData.roomId,
      company_name: groupCheckInData.company_name,
      employees: validEmployees.map(emp => ({
        name: emp.name,
        id_no: emp.id_no,
        employeeNationality: emp.employeeNationality,
        phone: emp.employeePhone,
        status: emp.status === 'custom' ? emp.customStatus : emp.status
      }))
    };

      // Add checkInDate only if it's provided
      if (groupCheckInData.checkInDate) {
        submissionData.checkInDate = groupCheckInData.checkInDate;
      }



    // Add checkInTime only if it's provided
    if (groupCheckInData.checkInTime) {
      submissionData.checkInTime = groupCheckInData.checkInTime;
    }

    setIsGroupSubmitting(true);

    try {
      const response = await fetchWithAuth(`/api/employees/bulk-checkin`, {
        method: 'POST',
        body: JSON.stringify(submissionData)
      });

      const data = await response.json();
      alert(data.message);

      if (data.success) {
        // Reset form
        setGroupCheckInData({
          roomId: '',
          company_name: '',
          checkInDate: '',
          checkInTime: '',
          employees: [{ name: '', id_no: '', employeeNationality: '', employeePhone: '', roomId: '', status: '', customStatus: '', checkInDate: '', checkInTime: '' }]
        });

        // Refresh data
        if (selectedBuilding !== 'all') {
          fetchBuildingData(selectedBuilding);
          fetchEmployeesByBuilding(selectedBuilding);
        } else {
          fetchDashboardData();
          fetchCheckedInEmployees();
        }
      }
    } catch (error) {
      console.error('Group check-in error:', error);
      alert('An error occurred during group check-in');
    } finally {
      setIsGroupSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1 className="dashboard-title">🏠 Camp Management Dashboard</h1>
          <div className="header-actions">
            <button 
              onClick={() => navigate('/change-password')} 
              className="btn btn-secondary"
            >
              🔒 Change Password
            </button>
            <button 
              onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/login'); }} 
              className="btn btn-danger"
            >
              🚪 Logout
            </button>
          </div>
        </div>
      </div>

      {/* Building Filter */}
      <div className="filter-section">
        <h3 className="filter-title">🏢 Select Camp & Building</h3>
        <div className="filter-content">
          <select 
            value={selectedBuilding} 
            onChange={(e) => setSelectedBuilding(e.target.value)}
            className="building-select"
          >
            <option value="all">All Camps & Buildings</option>
            <optgroup label="Camp 1 - Kitchen Block">
              <option value="u-building">U-Building (U01-U41)</option>
              <option value="b-building">B-Building (B01-B34)</option>
              <option value="d-building">D-Building (D01-D34)</option>
              <option value="c-building">C-Building (C01-C46)</option>
            </optgroup>
            <optgroup label="Camp 1 - Office Block">
              <option value="office-01-82">Rooms 01-82</option>
              <option value="office-a01-a18">Rooms A01-A18</option>
            </optgroup>
            <optgroup label="Camp 2">
              <option value="building-1">Building 1 (91-122)</option>
              <option value="building-2">Building 2 (63-90)</option>
              <option value="building-3">Building 3 (30-61)</option>
              <option value="building-4">Building 4 (1-29)</option>
              <option value="extra-room">Room 62</option>
            </optgroup>
          </select>
          
          {selectedBuilding !== 'all' && (
            <button 
              onClick={() => setSelectedBuilding('all')}
              className="btn btn-outline"
            >
              View All Buildings
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="tab-navigation">
        <button
          onClick={() => setActiveTab('overview')}
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
        >
          📊 Overview
        </button>
        <button
          onClick={() => setActiveTab('checkin')}
          className={`tab-btn ${activeTab === 'checkin' ? 'active' : ''}`}
        >
          ✅ Check In
        </button>
        <button
          onClick={() => setActiveTab('groupcheckin')}
          className={`tab-btn ${activeTab === 'groupcheckin' ? 'active' : ''}`}
        >
          👥 Group Check In
        </button>
        <button
          onClick={() => setActiveTab('checkout')}
          className={`tab-btn ${activeTab === 'checkout' ? 'active' : ''}`}
        >
          🚪 Check Out
        </button>
        <button
          onClick={() => setActiveTab('rooms')}
          className={`tab-btn ${activeTab === 'rooms' ? 'active' : ''}`}
        >
          🏨 Rooms
        </button>
        <button
          onClick={() => { setActiveTab('employees'); fetchCheckedInEmployees(); fetchCheckedOutEmployees(); }}
          className={`tab-btn ${activeTab === 'employees' ? 'active' : ''}`}
        >
          👥 Employee Lists
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && stats && (
        <div className="tab-content">
          <h2 className="tab-title">
            {selectedBuilding === 'all' ? 'Camp Overview' : `${(buildings || []).find(b => b && b.id == buildingIdMap[selectedBuilding])?.name || 'Selected Building'} Overview`}
          </h2>
          
          {/* Statistics Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">🏢</div>
              <div className="stat-content">
                <h3>Total Rooms</h3>
                <p className="stat-number">{stats?.totalRooms || 0}</p>
                <small>Across selected building(s)</small>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">🛏️</div>
              <div className="stat-content">
                <h3>Total Beds</h3>
                <p className="stat-number">{stats?.totalBeds || 0}</p>
                <small>Available capacity</small>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">👤</div>
              <div className="stat-content">
                <h3>Occupied Beds</h3>
                <p className="stat-number occupied">{stats?.occupiedBeds || 0}</p>
                <small>Currently in use</small>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">✅</div>
              <div className="stat-content">
                <h3>Vacant Beds</h3>
                <p className="stat-number vacant">{stats?.vacantBeds || 0}</p>
                <small>Available for check-in</small>
              </div>
            </div>
          </div>

          {/* Building-wise Statistics */}
          {selectedBuilding === 'all' && stats && stats.buildings && stats.buildings.length > 0 ? (
            <>
              <h3 className="section-title">Building-wise Statistics</h3>
              <div className="buildings-grid">
                {stats.buildings.map((building, index) => (
                  <div key={index} className="building-card">
                    <h4>{building?.name || 'Unknown Building'}</h4>
                    <div className="building-stats">
                      <div className="building-stat">
                        <span>Rooms:</span>
                        <strong>{building?.rooms || 0}</strong>
                      </div>
                      <div className="building-stat">
                        <span>Total Beds:</span>
                        <strong>{building?.totalBeds || 0}</strong>
                      </div>
                      <div className="building-stat">
                        <span>Occupied:</span>
                        <strong>{building?.occupiedBeds || 0}</strong>
                      </div>
                      <div className="building-stat">
                        <span>Vacant:</span>
                        <strong>{building?.vacantBeds || 0}</strong>
                      </div>
                      <div className="building-stat">
                        <span>Vacant:</span>
                        <strong>{building?.vacantBeds || 0}</strong>
                      </div>
                      <div className="building-stat">
                        <span>Occupancy Rate:</span>
                        <strong>{building?.totalBeds > 0 ? Math.round((building?.occupiedBeds / building?.totalBeds) * 100) : 0}%</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="rooms-section">
              <h3 className="section-title">Detailed Room Information</h3>
              <div className="rooms-grid">
                {rooms
                  .sort((a, b) => {
                    const buildingCompare = a.building_name.localeCompare(b.building_name);
                    if (buildingCompare !== 0) return buildingCompare;
                    const roomNumA = parseInt(a.room_number.replace(/\D/g, '')) || 0;
                    const roomNumB = parseInt(b.room_number.replace(/\D/g, '')) || 0;
                    return roomNumA - roomNumB;
                  })
                  .map(room => (
                    <div key={room.id} className="room-card">
                      <h5>{room.building_name} - Room {room.room_number}</h5>
                      <div className="room-stats">
                        <span className="room-stat">
                          <strong>Beds:</strong> {room.occupied_beds}/{room.total_beds} occupied
                        </span>
                        <span className={`room-status ${room.occupied_beds < room.total_beds ? 'available' : 'full'}`}>
                          {room.occupied_beds < room.total_beds ? 'Available' : 'Full'}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Check In Tab */}
      {activeTab === 'checkin' && (
        <div className="tab-content">
          <h2 className="tab-title">✅ Check In Employee</h2>
          <div className="form-section">
            <form onSubmit={handleCheckIn} className="checkin-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Room:</label>
                    <select 
                      value={checkInData.roomId} 
                      onChange={(e) => setCheckInData({...checkInData, roomId: e.target.value})}
                      className="form-input"
                      required
                    >
                      <option value="">Select Room</option>
                      {rooms
                        .filter(room => room.occupied_beds < room.total_beds)
                        .sort((a, b) => {
                          // Sort by building name first
                          const buildingCompare = a.building_name.localeCompare(b.building_name);
                          if (buildingCompare !== 0) return buildingCompare;
                          // Extract numeric part of room_number for numeric sorting
                          const numA = parseInt(a.room_number.match(/\d+/)?.[0] || '0', 10);
                          const numB = parseInt(b.room_number.match(/\d+/)?.[0] || '0', 10);
                          if (numA !== numB) return numA - numB;
                          // If numeric parts are equal, sort by full room_number string
                          return a.room_number.localeCompare(b.room_number);
                        })
                        .map(room => (
                          <option key={room.id} value={room.id}>
                            {room.building_name} - Room {room.room_number} ({room.total_beds - room.occupied_beds} beds available)
                          </option>
                        ))
                      }
                    </select>
                </div>
                <div className="form-group">
                  <label>Employee Name:</label>
                  <input 
                    type="text" 
                    value={checkInData.employeeName} 
                    onChange={(e) => setCheckInData({...checkInData, employeeName: e.target.value})}
                    className="form-input"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Company Name:</label>
                  <input 
                    type="text" 
                    value={checkInData.company_name} 
                    onChange={(e) => setCheckInData({...checkInData, company_name: e.target.value})}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>ID No (Optional):</label>
                  <input
                    type="text"
                    value={checkInData.id_no}
                    onChange={(e) => setCheckInData({...checkInData, id_no: e.target.value})}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Nationality:</label>
                  <input
                    type="text"
                    value={checkInData.employeeNationality}
                    onChange={(e) => setCheckInData({...checkInData, employeeNationality: e.target.value})}
                    className="form-input"
                    placeholder="Enter nationality"
                  />
                </div>
                <div className="form-group">
                  <label>Phone:</label>
                  <input
                    type="tel"
                    value={checkInData.employeePhone}
                    onChange={(e) => setCheckInData({...checkInData, employeePhone: e.target.value})}
                    className="form-input"
                    placeholder="Enter phone number"
                  />
                </div>
                <div className="form-group">
                  <label>Status:</label>
                  <select
                    value={checkInData.status}
                    onChange={(e) => setCheckInData({...checkInData, status: e.target.value})}
                    className="form-input"
                  >
                    <option value="">Select Status</option>
                    <option value="2 in 1">2 in 1</option>
                    <option value="4 in 1">4 in 1</option>
                    <option value="6 in 1">6 in 1</option>
                    <option value="custom">Other (type below)</option>
                  </select>
                  {checkInData.status === 'custom' && (
                    <input
                      type="text"
                      value={checkInData.customStatus || ''}
                      onChange={(e) => setCheckInData({...checkInData, customStatus: e.target.value})}
                      className="form-input"
                      placeholder="Enter custom status"
                      style={{ marginTop: '5px' }}
                    />
                  )}
                </div>
                <div className="form-group">
                  <label>Check-In Date (Optional):</label>
                  <input
                    type="text"
                    value={checkInData.checkInDate}
                    onChange={(e) => setCheckInData({...checkInData, checkInDate: e.target.value})}
                    className="form-input"
                    placeholder="DD/MM/YYYY"
                  />
                </div>
                <div className="form-group">
                  <label>Check-In Time (Optional):</label>
                  <input
                    type="time"
                    value={checkInData.checkInTime}
                    onChange={(e) => setCheckInData({...checkInData, checkInTime: e.target.value})}
                    className="form-input"
                  />
                </div>
              </div>
              
              <button type="submit" className="btn btn-primary submit-btn">
                Check In Employee
              </button>
            </form>
          </div>
          
          {/* Checked-in Employees Table */}
          <div className="table-section">
            <h3 className="section-title">Checked-In Employees</h3>
            {filteredCheckedInEmployees.length > 0 ? (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Room</th>
                      <th>Employee Name</th>
                      <th>Company Name</th>
                      <th>ID No</th>
                        <th>Nationality</th>
                        <th>Status</th>
                        <th>Check-In Time</th>
                    </tr>
                </thead>
                  <tbody>
                    {filteredCheckedInEmployees.map((employee) => (
                      <tr key={employee.id}>
                        <td>{employee.building_name} - Room {employee.room_number}</td>
                        <td>{employee.name}</td>
                        <td>{employee.company_name || '-'}</td>
                        <td>{employee.id_no || '-'}</td>
                        <td>{employee.nationality || '-'}</td>
                        <td>{employee.status || '-'}</td>
                        <td>{formatDateDDMMYYYY(employee.check_in_time)} {new Date(employee.check_in_time).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <p>No employees currently checked in.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Check Out Tab */}
      {activeTab === 'checkout' && (
        <div className="tab-content">
          <h2 className="tab-title">🚪 Check Out Employee</h2>

          {/* Filter Section */}
          <div className="filter-section">
            <h3 className="filter-title">🔍 Filter Employees</h3>
            <div className="filter-content">
              <div className="filter-row">
                <div className="filter-group">
                  <label>Filter by Company:</label>
                  <input
                    type="text"
                    value={checkoutFilter.company}
                    onChange={(e) => setCheckoutFilter({...checkoutFilter, company: e.target.value})}
                    className="filter-input"
                    placeholder="Type to filter companies"
                  />
                </div>

                <div className="filter-group">
                  <label>Filter by Employee Name:</label>
                  <input
                    type="text"
                    value={checkoutFilter.employeeName}
                    onChange={(e) => setCheckoutFilter({...checkoutFilter, employeeName: e.target.value})}
                    className="filter-input"
                    placeholder="Type to filter employees"
                  />
                </div>

                <button
                  onClick={() => setCheckoutFilter({company: '', employeeName: ''})}
                  className="btn btn-outline"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>

          {/* Checked-in Employees Table with Checkout */}
          <div className="table-section">
            <div className="section-header">
              <div className="section-title-wrapper">
                <h3 className="section-title">
                  ✅ Checked-In Employees ({filteredCheckoutEmployees.length})
                  {selectedBuilding !== 'all' && ` in ${buildings.find(b => b.id == buildingIdMap[selectedBuilding])?.name}`}
                </h3>
                {filteredCheckoutEmployees.length > 0 && (
                  <div className="section-subtitle">
                    {selectedCheckedInEmployees.length > 0 && (
                      <span className="selection-count">
                        {selectedCheckedInEmployees.length} of {filteredCheckoutEmployees.length} selected
                      </span>
                    )}
                  </div>
                )}
              </div>

              {filteredCheckoutEmployees.length > 0 && (
                <div className="bulk-actions">
                  <div className="selection-controls">
                    <label className="select-all-container">
                      <input
                        type="checkbox"
                        checked={selectedCheckedInEmployees.length === filteredCheckoutEmployees.length && filteredCheckoutEmployees.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCheckedInEmployees(filteredCheckoutEmployees.map(emp => emp.id));
                          } else {
                            setSelectedCheckedInEmployees([]);
                          }
                        }}
                        className="select-all-checkbox"
                      />
                      <span className="select-all-text">
                        Select All ({selectedCheckedInEmployees.length}/{filteredCheckoutEmployees.length})
                      </span>
                    </label>
                  </div>

                  <div className="action-buttons">
                    <button
                      onClick={handleBulkCheckout}
                      disabled={selectedCheckedInEmployees.length === 0}
                      className="btn btn-primary bulk-checkout-btn"
                    >
                      🚪 Bulk Checkout ({selectedCheckedInEmployees.length})
                    </button>
                  </div>
                </div>
              )}
            </div>

            {filteredCheckoutEmployees.length > 0 ? (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="select-column">Select</th>
                      <th>Room</th>
                      <th>Employee Name</th>
                      <th>Company Name</th>
                      <th>ID No</th>
                      <th>Nationality</th>
                      <th>Status</th>
                      <th>Check-In Time</th>
                      <th className="action-column">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCheckoutEmployees.map((employee) => {
                      const isChecked = selectedCheckedInEmployees.includes(employee.id);
                      return (
                        <tr key={employee.id} className={isChecked ? 'selected-row' : ''}>
                          <td className="select-column">
                            <label className="checkbox-container">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedCheckedInEmployees(prev => [...prev, employee.id]);
                                  } else {
                                    setSelectedCheckedInEmployees(prev => prev.filter(id => id !== employee.id));
                                  }
                                }}
                                className="employee-checkbox"
                              />
                              <span className="checkmark"></span>
                            </label>
                          </td>
                          <td>
                            <div className="room-info">
                              <span className="building-name">{employee.building_name}</span>
                              <span className="room-number">Room {employee.room_number}</span>
                            </div>
                          </td>
                          <td>
                            <div className="employee-name">{employee.name}</div>
                          </td>
                          <td>{employee.company_name || '-'}</td>
                          <td>{employee.id_no || '-'}</td>
                          <td>{employee.nationality || '-'}</td>
                          <td>
                            <span className="status-badge">{employee.status || '-'}</span>
                          </td>
                          <td>
                            <div className="datetime-info">
                              <div className="date">{formatDateDDMMYYYY(employee.check_in_time)}</div>
                              <div className="time">{new Date(employee.check_in_time).toLocaleTimeString()}</div>
                            </div>
                          </td>
                          <td className="action-column">
                            <button
                              onClick={() => handleCheckoutFromTable(employee)}
                              className="btn btn-danger checkout-btn"
                            >
                              Check Out
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">👤</div>
                <h4>No employees found</h4>
                <p>No employees found matching the current filters.</p>
                {checkoutFilter.company || checkoutFilter.employeeName ? (
                  <button
                    onClick={() => setCheckoutFilter({company: '', employeeName: ''})}
                    className="btn btn-outline"
                  >
                    Clear Filters
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rooms Tab */}
      {activeTab === 'rooms' && (
        <div className="tab-content">
          <h2 className="tab-title">🏨 Room Management</h2>
          <div className="rooms-grid">
            {rooms
              .sort((a, b) => {
                const buildingCompare = a.building_name.localeCompare(b.building_name);
                if (buildingCompare !== 0) return buildingCompare;
                const roomNumA = parseInt(a.room_number.replace(/\D/g, '')) || 0;
                const roomNumB = parseInt(b.room_number.replace(/\D/g, '')) || 0;
                return roomNumA - roomNumB;
              })
              .map(room => (
                <div key={room.id} className="room-management-card">
                  <div className="room-header">
                    <h4>{room.building_name} - Room {room.room_number}</h4>
                    <span className={`room-status-badge ${room.occupied_beds < room.total_beds ? 'available' : 'full'}`}>
                      {room.occupied_beds < room.total_beds ? 'Available' : 'Full'}
                    </span>
                  </div>
                  <div className="room-details">
                    <div className="room-stat">
                      <span>Total Beds:</span>
                      <strong>{room.total_beds}</strong>
                    </div>
                    <div className="room-stat">
                      <span>Occupied Beds:</span>
                      <strong>{room.occupied_beds}</strong>
                    </div>
                    <div className="room-stat">
                      <span>Available Beds:</span>
                      <strong>{room.total_beds - room.occupied_beds}</strong>
                    </div>
                  </div>
                  <div className="room-actions">
                    <button 
                      onClick={() => addBed(room.id)} 
                      className="btn btn-success btn-sm"
                    >
                      ➕ Add Bed
                    </button>
                    <button 
                      onClick={() => removeBed(room.id)} 
                      className="btn btn-danger btn-sm"
                    >
                      ➖ Remove Bed
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Group Check In Tab */}
      {activeTab === 'groupcheckin' && (
        <div className="tab-content">
          <h2 className="tab-title">👥 Group Check In</h2>
          <div className="form-section">
            {/* CSV Upload Component */}
            <GroupCheckinCSVUpload rooms={rooms} onSubmit={handleCSVSubmit} companyName={groupCheckInData.company_name} setCompanyName={(name) => setGroupCheckInData({...groupCheckInData, company_name: name})} />
          </div>

          {/* Checked-in Employees Table */}
          <div className="table-section">
            <h3 className="section-title">Checked-In Employees</h3>
            {filteredCheckedInEmployees.length > 0 ? (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Room</th>
                      <th>Employee Name</th>
                      <th>Company Name</th>
                      <th>ID No</th>
                      <th>Nationality</th>
                      <th>Status</th>
                      <th>Check-In Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCheckedInEmployees.map((employee) => (
                      <tr key={employee.id}>
                        <td>{employee.building_name} - Room {employee.room_number}</td>
                        <td>{employee.name}</td>
                        <td>{employee.company_name || '-'}</td>
                        <td>{employee.id_no || '-'}</td>
                        <td>{employee.nationality || '-'}</td>
                        <td>{employee.status || '-'}</td>
                        <td>{formatDateDDMMYYYY(employee.check_in_time)} {new Date(employee.check_in_time).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <p>No employees currently checked in.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Employee Lists Tab */}
      {activeTab === 'employees' && (
        <div className="tab-content">
          <h2 className="tab-title">👥 Employee Management</h2>

          {/* Statistics Cards */}
          <div className="stats-grid" style={{ marginBottom: '20px' }}>
            <div className="stat-card">
              <div className="stat-icon">✅</div>
              <div className="stat-content">
                <h3>Checked In</h3>
                <p className="stat-number">{filteredCheckedInEmployees.length}</p>
                <small>Currently active</small>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">🚪</div>
              <div className="stat-content">
                <h3>Checked Out</h3>
                <p className="stat-number">{filteredCheckedOutEmployees.length}</p>
                <small>Historical records</small>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">👥</div>
              <div className="stat-content">
                <h3>Total Employees</h3>
                <p className="stat-number">{filteredCheckedInEmployees.length + filteredCheckedOutEmployees.length}</p>
                <small>All records</small>
              </div>
            </div>
          </div>

          {/* Filter for Employees */}
          <div className="filter-section">
            <h3 className="filter-title">🔍 Filter & Search Employees</h3>
            <div className="filter-content">
              <div className="filter-row">
                <div className="filter-group">
                  <label>Search by Company:</label>
                  <input
                    type="text"
                    placeholder="Type company name..."
                    value={employeeFilter.company}
                    onChange={(e) => setEmployeeFilter({...employeeFilter, company: e.target.value})}
                    className="filter-input"
                  />
                </div>

                <div className="filter-group">
                  <label>Search by Employee:</label>
                  <input
                    type="text"
                    placeholder="Type employee name..."
                    value={employeeFilter.employeeName}
                    onChange={(e) => setEmployeeFilter({...employeeFilter, employeeName: e.target.value})}
                    className="filter-input"
                  />
                </div>

                <div className="filter-group">
                  <label>Filter by Month:</label>
                  <select
                    value={employeeFilter.month}
                    onChange={(e) => setEmployeeFilter({...employeeFilter, month: e.target.value})}
                    className="filter-input"
                  >
                    <option value="">All Months</option>
                    <option value="1">January</option>
                    <option value="2">February</option>
                    <option value="3">March</option>
                    <option value="4">April</option>
                    <option value="5">May</option>
                    <option value="6">June</option>
                    <option value="7">July</option>
                    <option value="8">August</option>
                    <option value="9">September</option>
                    <option value="10">October</option>
                    <option value="11">November</option>
                    <option value="12">December</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label>Filter by Year:</label>
                  <input
                    type="number"
                    placeholder="Enter year (e.g., 2023)"
                    value={employeeFilter.year}
                    onChange={(e) => setEmployeeFilter({...employeeFilter, year: e.target.value})}
                    className="filter-input"
                  />
                </div>

                <button
                  onClick={() => setEmployeeFilter({company: '', employeeName: '', month: '', year: ''})}
                  className="btn btn-outline"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>

          {/* Employee List View Buttons */}
          <div className="view-buttons-section">
            <div className="view-buttons">
              <button
                onClick={() => setEmployeeListView('checked-in')}
                className={`view-btn ${employeeListView === 'checked-in' ? 'active' : ''}`}
              >
                <span>✅</span>
                <span>Show Checked-In Employees ({filteredCheckedInEmployees.length})</span>
              </button>
              <button
                onClick={() => setEmployeeListView('checked-out')}
                className={`view-btn ${employeeListView === 'checked-out' ? 'active' : ''}`}
              >
                <span>🚪</span>
                <span>Show Checked-Out Employees ({filteredCheckedOutEmployees.length})</span>
              </button>
              <button
                onClick={() => setEmployeeListView('all')}
                className={`view-btn ${employeeListView === 'all' ? 'active' : ''}`}
              >
                <span>👥</span>
                <span>Show All Employees ({filteredCheckedInEmployees.length + filteredCheckedOutEmployees.length})</span>
              </button>
            </div>

            {/* CSV Export Button */}
            <div className="export-section">
              <button
                onClick={() => handleCsvExport(employeeListView)}
                className="btn btn-success export-btn"
              >
                📊 Download CSV ({employeeListView === 'checked-in' ? filteredCheckedInEmployees.length :
                                  employeeListView === 'checked-out' ? filteredCheckedOutEmployees.length :
                                  filteredCheckedInEmployees.length + filteredCheckedOutEmployees.length} records)
              </button>
            </div>
          </div>

          {/* Checked-In Employees Table */}
          {employeeListView === 'checked-in' && (
            <div className="table-section">
              <div className="section-header">
                <h3 className="section-title">
                  ✅ Checked-In Employees ({filteredCheckedInEmployees.length})
                  {selectedBuilding !== 'all' && ` in ${buildings.find(b => b.id == buildingIdMap[selectedBuilding])?.name}`}
                </h3>
              </div>

              {filteredCheckedInEmployees.length > 0 ? (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Employee Name</th>
                        <th>Company Name</th>
                        <th>ID No</th>
                        <th>Nationality</th>
                        <th>Status</th>
                        <th>Room</th>
                        <th>Check-In Date & Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCheckedInEmployees.map((employee) => (
                      <tr key={`checked-in-${employee.id}`} className="checked-in-row">
                        <td>{employee.name}</td>
                        <td>{employee.company_name || '-'}</td>
                        <td>{employee.id_no || '-'}</td>
                        <td>{employee.nationality || '-'}</td>
                        <td>{employee.status || '-'}</td>
                        <td>{employee.building_name} - Room {employee.room_number}</td>
                        <td>{formatDateDDMMYYYY(employee.check_in_time)} {new Date(employee.check_in_time).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <p>No checked-in employees found matching the current filters.</p>
                </div>
              )}
            </div>
          )}

          {/* Checked-Out Employees Table */}
          {employeeListView === 'checked-out' && (
            <div className="table-section">
              <div className="section-header">
                <h3 className="section-title">
                  🚪 Checked-Out Employees ({filteredCheckedOutEmployees.length})
                  {selectedBuilding !== 'all' && ` in ${buildings.find(b => b.id == buildingIdMap[selectedBuilding])?.name}`}
                </h3>
              </div>

              {filteredCheckedOutEmployees.length > 0 ? (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>
                          <input
                            type="checkbox"
                            checked={selectedCheckedOutEmployees.length === filteredCheckedOutEmployees.length && filteredCheckedOutEmployees.length > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCheckedOutEmployees(filteredCheckedOutEmployees.map(emp => emp.id));
                              } else {
                                setSelectedCheckedOutEmployees([]);
                              }
                            }}
                          />
                        </th>
                        <th>Employee Name</th>
                        <th>Company Name</th>
                        <th>ID No</th>
                        <th>Nationality</th>
                        <th>Status</th>
                        <th>Room</th>
                        <th>Check-In Date & Time</th>
                        <th>Check-Out Date & Time</th>
                        <th>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCheckedOutEmployees.map((employee) => {
                        const checkInDate = new Date(employee.check_in_time);
                        const checkOutDate = new Date(employee.check_out_time);
                        const timeDiff = checkOutDate.getTime() - checkInDate.getTime();
                        const daysStayed = Math.ceil(timeDiff / (1000 * 3600 * 24));
                        const isChecked = selectedCheckedOutEmployees.includes(employee.id);

                        return (
                          <tr key={`checked-out-${employee.id}`} className="checked-out-row">
                            <td>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedCheckedOutEmployees(prev => [...prev, employee.id]);
                                  } else {
                                    setSelectedCheckedOutEmployees(prev => prev.filter(id => id !== employee.id));
                                  }
                                }}
                              />
                            </td>
                            <td>{employee.name}</td>
                            <td>{employee.company_name || '-'}</td>
                            <td>{employee.id_no || '-'}</td>
                            <td>{employee.nationality || '-'}</td>
                            <td>{employee.status || '-'}</td>
                            <td>{employee.building_name} - Room {employee.room_number}</td>
                            <td>{formatDateDDMMYYYY(employee.check_in_time)} {new Date(employee.check_in_time).toLocaleTimeString()}</td>
                            <td>{formatDateDDMMYYYY(employee.check_out_time)} {new Date(employee.check_out_time).toLocaleTimeString()}</td>
                            <td>{daysStayed} days</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Bulk Delete Button */}
                  <div style={{ marginTop: '10px' }}>
                    <button
                      className="btn btn-danger"
                      disabled={selectedCheckedOutEmployees.length === 0}
                      onClick={async () => {
                        if (!window.confirm(`Are you sure you want to delete ${selectedCheckedOutEmployees.length} selected employee(s)? This action cannot be undone.`)) {
                          return;
                        }
                        try {
                          for (const id of selectedCheckedOutEmployees) {
                            const response = await fetchWithAuth(`/api/employees/${id}`, {
                              method: 'DELETE'
                            });
                            const data = await response.json();
                            if (!data.success) {
                              alert(`Failed to delete employee with ID ${id}: ${data.message}`);
                            }
                          }
                          alert('Selected employees deleted successfully.');
                          setSelectedCheckedOutEmployees([]);
                          fetchCheckedOutEmployees();
                          fetchDashboardData();
                        } catch (error) {
                          console.error('Error deleting selected employees:', error);
                          alert('An error occurred while deleting selected employees.');
                        }
                      }}
                    >
                      🗑️ Delete Selected
                    </button>
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <p>No checked-out employees found matching the current filters.</p>
                </div>
              )}
            </div>
          )}

          {/* All Employees Table */}
          {employeeListView === 'all' && (
            <div className="table-section">
              <div className="section-header">
                <h3 className="section-title">
                  👥 All Employees ({filteredCheckedInEmployees.length + filteredCheckedOutEmployees.length})
                  {selectedBuilding !== 'all' && ` in ${buildings.find(b => b.id == buildingIdMap[selectedBuilding])?.name}`}
                </h3>
              </div>

              {(filteredCheckedInEmployees.length + filteredCheckedOutEmployees.length) > 0 ? (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Employee Name</th>
                        <th>Company Name</th>
                        <th>ID No</th>
                        <th>Nationality</th>
                        <th>Status</th>
                        <th>Room</th>
                        <th>Check-In Date & Time</th>
                        <th>Check-Out Date & Time</th>
                        <th>Duration</th>
                        <th>Current Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Checked-In Employees */}
                      {filteredCheckedInEmployees.map((employee) => (
                        <tr key={`all-checked-in-${employee.id}`} className="checked-in-row">
                        <td>{employee.name}</td>
                        <td>{employee.company_name || '-'}</td>
                        <td>{employee.id_no || '-'}</td>
                        <td>{employee.nationality || '-'}</td>
                        <td>{employee.status || '-'}</td>
                        <td>{employee.building_name} - Room {employee.room_number}</td>
                        <td>{formatDateDDMMYYYY(employee.check_in_time)} {new Date(employee.check_in_time).toLocaleTimeString()}</td>
                        <td>-</td>
                        <td>Current</td>
                        <td><span className="status-badge checked-in">✅ Checked In</span></td>
                        </tr>
                      ))}

                      {/* Checked-Out Employees */}
                      {filteredCheckedOutEmployees.map((employee) => {
                        const checkInDate = new Date(employee.check_in_time);
                        const checkOutDate = new Date(employee.check_out_time);
                        const timeDiff = checkOutDate.getTime() - checkInDate.getTime();
                        const daysStayed = Math.ceil(timeDiff / (1000 * 3600 * 24));

                        return (
                          <tr key={`all-checked-out-${employee.id}`} className="checked-out-row">
                            <td>{employee.name}</td>
                            <td>{employee.company_name || '-'}</td>
                            <td>{employee.id_no || '-'}</td>
                            <td>{employee.nationality || '-'}</td>
                            <td>{employee.status || '-'}</td>
                            <td>{employee.building_name} - Room {employee.room_number}</td>
                            <td>{formatDateDDMMYYYY(employee.check_in_time)} {new Date(employee.check_in_time).toLocaleTimeString()}</td>
                            <td>{formatDateDDMMYYYY(employee.check_out_time)} {new Date(employee.check_out_time).toLocaleTimeString()}</td>
                            <td>{daysStayed} days</td>
                            <td><span className="status-badge checked-out">🚪 Checked Out</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <p>No employees found matching the current filters.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;