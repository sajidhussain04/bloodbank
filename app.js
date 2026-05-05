document.addEventListener('DOMContentLoaded', function () {
  // API Configuration - FIXED: Use absolute URL instead of window.location.origin
  const API_URL = 'http://localhost:5000';
  
  // DOM Elements
  const donorForm = document.getElementById('donorRegistration');
  const bloodRequestForm = document.getElementById('bloodRequest');
  const newsletterForm = document.getElementById('newsletterForm');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mainNav = document.getElementById('mainNav');
  const refreshInventoryBtn = document.getElementById('refreshInventory');
  const updateTimeElement = document.getElementById('updateTime');

  // Initialize application
  initApp();

  function initApp() {
    setupEventListeners();
    updateInventoryTime();
    loadInventoryStats();
    
    // Update inventory time every hour
    setInterval(updateInventoryTime, 3600000);
  }

  function setupEventListeners() {
    // Mobile menu
    if (mobileMenuBtn && mainNav) {
      mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    }

    // Donor form
    if (donorForm) {
      setupFormValidation(donorForm);
      donorForm.addEventListener('submit', handleDonorRegistration);
    }

    // Blood request form
    if (bloodRequestForm) {
      setupFormValidation(bloodRequestForm);
      bloodRequestForm.addEventListener('submit', handleBloodRequest);
    }

    // Newsletter form
    if (newsletterForm) {
      newsletterForm.addEventListener('submit', handleNewsletterSubscription);
    }

    // Refresh inventory
    if (refreshInventoryBtn) {
      refreshInventoryBtn.addEventListener('click', loadInventoryStats);
    }

    // Form input validation
    setupRealTimeValidation();
  }

  function toggleMobileMenu() {
    const isExpanded = mobileMenuBtn.getAttribute('aria-expanded') === 'true';
    mobileMenuBtn.setAttribute('aria-expanded', !isExpanded);
    mainNav.classList.toggle('show');
  }

  function setupFormValidation(form) {
    const inputs = form.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
      input.addEventListener('blur', function() {
        validateField(this);
      });
      
      input.addEventListener('input', function() {
        clearFieldError(this);
      });
    });
  }

  function setupRealTimeValidation() {
    // Phone number validation
    const phoneInputs = document.querySelectorAll('input[type="tel"], input[id$="Phone"]');
    phoneInputs.forEach(input => {
      input.addEventListener('input', function(e) {
        this.value = this.value.replace(/[^0-9]/g, '');
        if (this.value.length > 10) {
          this.value = this.value.slice(0, 10);
        }
      });
    });

    // Age validation
    const ageInput = document.getElementById('donorAge');
    if (ageInput) {
      ageInput.addEventListener('input', function(e) {
        let val = parseInt(this.value);
        if (isNaN(val)) return;
        if (val < 18) this.value = 18;
        if (val > 65) this.value = 65;
      });
    }

    // Date validation - cannot select past dates
    const dateInput = document.getElementById('requiredDate');
    if (dateInput) {
      const today = new Date().toISOString().split('T')[0];
      dateInput.min = today;
    }
    
    // Units validation
    const unitsInput = document.getElementById('unitsRequired');
    if (unitsInput) {
      unitsInput.addEventListener('input', function(e) {
        let val = parseInt(this.value);
        if (isNaN(val)) return;
        if (val < 1) this.value = 1;
        if (val > 10) this.value = 10;
      });
    }
  }

  function validateField(field) {
    clearFieldError(field);

    const value = field.value.trim();
    const formGroup = field.closest('.form-group');

    // Required field validation
    if (field.hasAttribute('required') && !value) {
      showFieldError(field, 'This field is required');
      return false;
    }

    // Skip further validation if field is empty and not required
    if (!value && !field.hasAttribute('required')) {
      return true;
    }

    // Email validation
    if (field.type === 'email' && value && !isValidEmail(value)) {
      showFieldError(field, 'Please enter a valid email address');
      return false;
    }

    // Phone validation
    if ((field.type === 'tel' || field.id === 'donorPhone' || field.id === 'requesterPhone') && value && !isValidPhone(value)) {
      showFieldError(field, 'Please enter a valid 10-digit phone number');
      return false;
    }

    // Age validation
    if (field.id === 'donorAge' && value) {
      const age = parseInt(value);
      if (isNaN(age) || age < 18 || age > 65) {
        showFieldError(field, 'Age must be between 18 and 65 years');
        return false;
      }
    }

    // Units validation
    if (field.id === 'unitsRequired' && value) {
      const units = parseInt(value);
      if (isNaN(units) || units < 1 || units > 10) {
        showFieldError(field, 'Units must be between 1 and 10');
        return false;
      }
    }
    
    // Blood group validation
    if (field.id === 'donorBloodGroup' || field.id === 'bloodGroup') {
      const validGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
      if (!validGroups.includes(value)) {
        showFieldError(field, 'Please select a valid blood group');
        return false;
      }
    }

    return true;
  }

  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  function isValidPhone(phone) {
    const phoneRegex = /^\d{10}$/;
    return phoneRegex.test(phone);
  }

  function showFieldError(field, message) {
    const formGroup = field.closest('.form-group');
    if (!formGroup) return;
    
    let errorElement = formGroup.querySelector('.field-error');
    
    if (!errorElement) {
      errorElement = document.createElement('div');
      errorElement.className = 'field-error';
      formGroup.appendChild(errorElement);
    }
    
    errorElement.textContent = message;
    formGroup.classList.add('error');
    field.setAttribute('aria-invalid', 'true');
  }

  function clearFieldError(field) {
    const formGroup = field.closest('.form-group');
    if (!formGroup) return;
    
    const errorElement = formGroup.querySelector('.field-error');
    if (errorElement && errorElement.parentNode === formGroup) {
      errorElement.remove();
    }
    formGroup.classList.remove('error');
    field.removeAttribute('aria-invalid');
  }

  function validateForm(form) {
    const inputs = form.querySelectorAll('input, select, textarea');
    let isValid = true;
    
    inputs.forEach(input => {
      if (!validateField(input)) {
        isValid = false;
      }
    });
    
    return isValid;
  }

  async function handleDonorRegistration(e) {
    e.preventDefault();
    
    if (!donorForm) return;
    
    // Validate all fields before submission
    if (!validateForm(donorForm)) {
      showMessage('Please correct the errors in the form', 'error');
      return;
    }
    
    const submitBtn = donorForm.querySelector('button[type="submit"]');
    
    // Get optional email field (may not exist)
    const emailInput = document.getElementById('donorEmail');
    
    const donorData = {
      name: document.getElementById('donorName').value.trim(),
      age: parseInt(document.getElementById('donorAge').value.trim()),
      bloodGroup: document.getElementById('donorBloodGroup').value,
      phone: document.getElementById('donorPhone').value.trim(),
      email: emailInput ? emailInput.value.trim() : '',
      location: document.getElementById('donorLocation').value.trim()
    };

    if (!donorData.name || !donorData.age || !donorData.bloodGroup || !donorData.phone || !donorData.location) {
      showMessage('Please fill all required fields', 'error');
      return;
    }

    setButtonLoading(submitBtn, true);

    try {
      const response = await fetch(`${API_URL}/api/donors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(donorData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showMessage('✓ Donor registered successfully! Thank you for saving lives.', 'success');
        donorForm.reset();
        // Reload inventory stats after new donor registration
        setTimeout(loadInventoryStats, 1000);
      } else {
        showMessage(data.message || 'Error registering donor. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Donor registration error:', error);
      showMessage('Unable to connect to server. Please check your connection.', 'error');
    } finally {
      setButtonLoading(submitBtn, false);
    }
  }

  async function handleBloodRequest(e) {
    e.preventDefault();
    
    if (!bloodRequestForm) return;
    
    // Validate all fields before submission
    if (!validateForm(bloodRequestForm)) {
      showMessage('Please correct the errors in the form', 'error');
      return;
    }
    
    const submitBtn = bloodRequestForm.querySelector('button[type="submit"]');

    // Get optional email field
    const emailInput = document.getElementById('requesterEmail');
    
    const requestData = {
      patientName: document.getElementById('patientName').value.trim(),
      bloodGroup: document.getElementById('bloodGroup').value,
      unitsRequired: parseInt(document.getElementById('unitsRequired').value.trim()),
      hospitalName: document.getElementById('hospitalName').value.trim(),
      hospitalAddress: document.getElementById('hospitalAddress').value.trim(),
      city: document.getElementById('city').value.trim(),
      requiredDate: document.getElementById('requiredDate').value,
      requesterName: document.getElementById('requesterName') ? document.getElementById('requesterName').value.trim() : document.getElementById('patientName').value.trim(),
      requesterPhone: document.getElementById('requesterPhone').value.trim(),
      requesterEmail: emailInput ? emailInput.value.trim() : ''
    };

    // Validate required fields
    const requiredFields = ['patientName', 'bloodGroup', 'unitsRequired', 'hospitalName', 'hospitalAddress', 'city', 'requiredDate', 'requesterPhone'];
    let missingFields = [];
    
    for (const field of requiredFields) {
      if (!requestData[field]) {
        missingFields.push(field.replace(/([A-Z])/g, ' $1').toLowerCase());
      }
    }
    
    if (missingFields.length > 0) {
      showMessage(`Please fill all required fields: ${missingFields.join(', ')}`, 'error');
      return;
    }

    setButtonLoading(submitBtn, true);

    try {
      const response = await fetch(`${API_URL}/api/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const priorityMsg = data.request?.priority === 'Urgent' ? '⚠️ Urgent request has been sent to donors.' : '';
        showMessage(`✓ Blood request submitted successfully! ${priorityMsg} You will receive updates via SMS.`, 'success');
        bloodRequestForm.reset();
      } else {
        showMessage(data.message || 'Error submitting request. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Blood request error:', error);
      showMessage('Unable to connect to server. Please check your connection.', 'error');
    } finally {
      setButtonLoading(submitBtn, false);
    }
  }

  function handleNewsletterSubscription(e) {
    e.preventDefault();
    const emailInput = newsletterForm.querySelector('input[type="email"]');
    const email = emailInput ? emailInput.value.trim() : '';
    
    if (!email || !isValidEmail(email)) {
      showMessage('Please enter a valid email address', 'error');
      return;
    }
    
    showMessage('✓ Thank you for subscribing to our newsletter!', 'success');
    newsletterForm.reset();
  }

  function setButtonLoading(button, isLoading) {
    if (!button) return;
    
    if (isLoading) {
      button.disabled = true;
      button.classList.add('loading');
      const originalText = button.innerHTML;
      button.setAttribute('data-original-text', originalText);
      button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    } else {
      button.disabled = false;
      button.classList.remove('loading');
      const originalText = button.getAttribute('data-original-text');
      if (originalText) {
        button.innerHTML = originalText;
      }
    }
  }

  function showMessage(msg, type = 'success') {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toastContainer';
      toastContainer.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-width: 350px;
      `;
      document.body.appendChild(toastContainer);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Set icon based on message type
    let icon = 'info-circle';
    let bgColor = '#2196F3';
    
    switch (type) {
      case 'success':
        icon = 'check-circle';
        bgColor = '#4CAF50';
        break;
      case 'error':
        icon = 'exclamation-circle';
        bgColor = '#f44336';
        break;
      case 'warning':
        icon = 'exclamation-triangle';
        bgColor = '#ff9800';
        break;
    }
    
    toast.style.cssText = `
      background: ${bgColor};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: slideIn 0.3s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    toast.innerHTML = `
      <i class="fas fa-${icon}" style="font-size: 18px;"></i>
      <span style="flex: 1;">${escapeHtml(msg)}</span>
      <button onclick="this.parentElement.remove()" style="background: none; border: none; color: white; cursor: pointer; font-size: 16px;">&times;</button>
    `;
    
    toastContainer.appendChild(toast);
    
    // Remove toast after 5 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 5000);
  }
  
  // Helper function to escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function updateInventoryTime() {
    const now = new Date();
    if (updateTimeElement) {
      updateTimeElement.textContent = now.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }
  }

  async function loadInventoryStats() {
    if (refreshInventoryBtn) {
      refreshInventoryBtn.disabled = true;
      refreshInventoryBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    }

    try {
      const response = await fetch(`${API_URL}/api/inventory`);
      if (response.ok) {
        const inventory = await response.json();
        updateInventoryDisplay(inventory);
        showMessage('Inventory updated successfully', 'success');
      } else {
        console.error('Failed to load inventory:', response.status);
      }
    } catch (error) {
      console.error('Error loading inventory:', error);
      // Don't show error message for inventory - it's not critical
    } finally {
      if (refreshInventoryBtn) {
        refreshInventoryBtn.disabled = false;
        refreshInventoryBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh Inventory';
      }
      updateInventoryTime();
    }
  }

  function updateInventoryDisplay(inventory) {
    // Update blood stock displays if they exist on the page
    const bloodGroupElements = {
      'A+': document.getElementById('stock-a-positive'),
      'A-': document.getElementById('stock-a-negative'),
      'B+': document.getElementById('stock-b-positive'),
      'B-': document.getElementById('stock-b-negative'),
      'AB+': document.getElementById('stock-ab-positive'),
      'AB-': document.getElementById('stock-ab-negative'),
      'O+': document.getElementById('stock-o-positive'),
      'O-': document.getElementById('stock-o-negative')
    };
    
    // Update each blood group display
    for (const [bloodGroup, element] of Object.entries(bloodGroupElements)) {
      if (element && inventory[bloodGroup] !== undefined) {
        element.textContent = inventory[bloodGroup] + ' units';
        
        // Add color coding based on stock level
        const units = inventory[bloodGroup];
        if (units < 10) {
          element.style.color = '#f44336';
          element.style.fontWeight = 'bold';
        } else if (units < 20) {
          element.style.color = '#ff9800';
        } else {
          element.style.color = '#4CAF50';
        }
      }
    }
    
    // Update inventory stats on dashboard if present
    const inventoryStats = document.getElementById('inventoryStats');
    if (inventoryStats) {
      const totalUnits = Object.values(inventory).reduce((sum, val) => sum + val, 0);
      const lowStockCount = Object.values(inventory).filter(val => val < 10).length;
      
      inventoryStats.innerHTML = `
        <div class="stat-card">
          <h4>Total Blood Units</h4>
          <p class="stat-number">${totalUnits}</p>
        </div>
        <div class="stat-card ${lowStockCount > 0 ? 'warning' : ''}">
          <h4>Low Stock Groups</h4>
          <p class="stat-number">${lowStockCount}</p>
        </div>
      `;
    }
  }

  // Health check on load
  async function checkServerHealth() {
    try {
      const response = await fetch(`${API_URL}/api/health`);
      if (!response.ok) {
        console.warn('Server health check failed:', response.status);
        showMessage('Server connection issue detected. Some features may be limited.', 'warning');
      } else {
        const healthData = await response.json();
        console.log('Server health:', healthData);
      }
    } catch (error) {
      console.error('Health check error:', error);
      showMessage('Unable to connect to server. Please check your connection.', 'error');
    }
  }

  // Run health check after a short delay
  setTimeout(checkServerHealth, 2000);

  // Add animation styles for toasts
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
    
    .field-error {
      color: #f44336;
      font-size: 12px;
      margin-top: 4px;
      display: block;
    }
    
    .form-group.error input,
    .form-group.error select,
    .form-group.error textarea {
      border-color: #f44336;
    }
    
    button.loading {
      opacity: 0.7;
      cursor: not-allowed;
    }
    
    .toast {
      animation: slideIn 0.3s ease;
    }
    
    .toast button:hover {
      opacity: 0.8;
    }
  `;
  document.head.appendChild(style);

  // Smooth scrolling for navigation links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
        
        // Close mobile menu if open
        if (mainNav && mainNav.classList.contains('show')) {
          toggleMobileMenu();
        }
      }
    });
  });
});