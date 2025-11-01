let config = { rules: [] };

// Load configuration on popup open
document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  renderRules();
  
  // Setup event listeners
  document.getElementById('add-rule').addEventListener('click', addNewRule);
  document.getElementById('save').addEventListener('click', saveConfig);
  const rulesContainer = document.getElementById('rules-container');
  document.getElementById('export-config').addEventListener('click', exportConfig);
  document.getElementById('import-config-input').addEventListener('change', importConfig);
  rulesContainer.addEventListener('click', handleRuleContainerClick);
  rulesContainer.addEventListener('change', handleRuleContainerChange);
});

async function loadConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['config'], (result) => {
      config = result.config || { rules: [] };
      resolve();
    });
  });
}

function renderRules() {
  const container = document.getElementById('rules-container');
  container.innerHTML = '';
  
  config.rules.forEach((rule, index) => {
    const ruleDiv = createRuleElement(rule, index);
    container.appendChild(ruleDiv);
  });
}

function createRuleElement(rule, index) {
  const div = document.createElement('div');
  div.className = 'rule';
  
  div.innerHTML = `
    <div class="rule-header">
      <span class="rule-name">${rule.name || 'Unnamed Rule'}</span>
      <label>
        <input type="checkbox" ${rule.enabled ? 'checked' : ''}
               data-action="toggle-rule" data-rule-index="${index}"> Enabled
      </label>
      <button class="btn-delete" data-action="delete-rule" data-rule-index="${index}">Delete</button>
    </div>
    
    <label>Rule Name:</label>
    <input type="text" value="${rule.name || ''}" 
           data-action="update-rule-name" data-rule-index="${index}"
           placeholder="My Rule">
    
    <label>URL Pattern (RegEx):</label>
    <input type="text" value="${rule.urlPattern || ''}" 
           data-action="update-rule-pattern" data-rule-index="${index}"
           placeholder="^https://example\\.com.*">
    
    <label>Cookies:</label>
    <div id="cookies-${index}">
      ${rule.cookies.map((cookie, cookieIndex) => 
        createCookieHtml(cookie, index, cookieIndex)
      ).join('')}
    </div>
    <button class="btn-secondary" data-action="add-cookie" data-rule-index="${index}">+ Add Cookie</button>
  `;
  
  return div;
}

function createCookieHtml(cookie, ruleIndex, cookieIndex) {
  return `
    <div class="cookie-item">
      <label>Cookie Name:</label>
      <input type="text" value="${cookie.name || ''}" 
             data-action="update-cookie" data-rule-index="${ruleIndex}" data-cookie-index="${cookieIndex}" data-field="name"
             placeholder="cookie_name">
      
      <label>Cookie Value:</label>
      <input type="text" value="${cookie.value || ''}" 
             data-action="update-cookie" data-rule-index="${ruleIndex}" data-cookie-index="${cookieIndex}" data-field="value"
             placeholder="cookie_value">
      
      <label>Path (optional):</label>
      <input type="text" class="small-input" value="${cookie.path || '/'}" 
             data-action="update-cookie" data-rule-index="${ruleIndex}" data-cookie-index="${cookieIndex}" data-field="path"
             placeholder="/">
      
      <label>SameSite (optional):</label>
      <select class="small-input" 
              data-action="update-cookie" data-rule-index="${ruleIndex}" data-cookie-index="${cookieIndex}" data-field="sameSite">
        <option value="lax" ${cookie.sameSite === 'lax' ? 'selected' : ''}>Lax</option>
        <option value="strict" ${cookie.sameSite === 'strict' ? 'selected' : ''}>Strict</option>
        <option value="no_restriction" ${cookie.sameSite === 'no_restriction' || cookie.sameSite === 'none' ? 'selected' : ''}>None</option>
      </select>
      
      <button class="btn-delete" data-action="delete-cookie" data-rule-index="${ruleIndex}" data-cookie-index="${cookieIndex}">
        Remove Cookie
      </button>
    </div>
  `;
}

function addNewRule() {
  const newRule = {
    id: Date.now(),
    name: 'New Rule',
    urlPattern: '',
    enabled: true,
    cookies: []
  };
  config.rules.push(newRule);
  renderRules();
}

function saveConfig() {
  chrome.storage.local.set({ config }, () => {
    // The callback is required, but we don't need to do anything here.
  });
}

function exportConfig() {
  const configString = JSON.stringify(config, null, 2);
  const blob = new Blob([configString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cookie-injector-config.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showStatus('Configuration exported.', 'success');
}

function importConfig(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const importedConfig = JSON.parse(e.target.result);
      // Basic validation
      if (importedConfig && Array.isArray(importedConfig.rules)) {
        config = importedConfig;
        chrome.storage.local.set({ config }); // Save directly
        renderRules();
        showStatus('Configuration imported successfully!', 'success');
      } else {
        throw new Error('Invalid config file format.');
      }
    } catch (error) {
      showStatus(`Error importing file: ${error.message}`, 'error');
    }
  };
  reader.readAsText(file);
  // Reset file input to allow importing the same file again
  event.target.value = '';
}

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;
}

// --- Event Handlers using Delegation ---

function handleRuleContainerClick(e) {
  const target = e.target;
  const action = target.dataset.action;
  if (!action) return;

  const ruleIndex = parseInt(target.dataset.ruleIndex, 10);

  if (action === 'delete-rule') {
    config.rules.splice(ruleIndex, 1);
    renderRules();
  } else if (action === 'add-cookie') {
    config.rules[ruleIndex].cookies.push({
      name: '', value: '', path: '/', sameSite: 'lax'
    });
    renderRules();
  } else if (action === 'delete-cookie') {
    const cookieIndex = parseInt(target.dataset.cookieIndex, 10);
    config.rules[ruleIndex].cookies.splice(cookieIndex, 1);
    renderRules();
  }
}

function handleRuleContainerChange(e) {
  const target = e.target;
  const action = target.dataset.action;
  if (!action) return;

  const ruleIndex = parseInt(target.dataset.ruleIndex, 10);
  
  if (action === 'toggle-rule') {
    config.rules[ruleIndex].enabled = target.checked;
    // No re-render needed for a checkbox toggle
  } else if (action === 'update-rule-name') {
    config.rules[ruleIndex].name = target.value;
    // Re-render to update the header span
    renderRules();
  } else if (action === 'update-rule-pattern') {
    config.rules[ruleIndex].urlPattern = target.value;
  } else if (action === 'update-cookie') {
    const cookieIndex = parseInt(target.dataset.cookieIndex, 10);
    const field = target.dataset.field;
    if (field) {
      config.rules[ruleIndex].cookies[cookieIndex][field] = target.value;
    }
  }
}