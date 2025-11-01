// Listen for navigation events
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return; // Only handle main frame
  
  const url = details.url;
  const config = await loadConfig();
  
  if (!config || !config.rules) return;
  
  // Check each rule
  for (const rule of config.rules) {
    if (!rule.enabled) continue;
    
    try {
      const regex = new RegExp(rule.urlPattern);
      if (regex.test(url)) {
        await setCookiesForRule(details, rule.cookies);
      }
    } catch (e) {
      console.error('Invalid regex pattern:', rule.urlPattern, e);
    }
  }
});

// Load configuration from storage
async function loadConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['config'], (result) => {
      resolve(result.config || { rules: [] });
    });
  });
}

// Set cookies for a matched rule
async function setCookiesForRule(details, cookies) {
  const { url, tabId, frameId, timeStamp, processId, tab, storeId } = details;
  const urlObj = new URL(url);
  
  for (const cookie of cookies) {
    try {
      const cookieDetails = {
        url: url,
        name: cookie.name,
        value: cookie.value,
        path: cookie.path || '/',
        secure: urlObj.protocol === 'https:',
        // The API expects 'no_restriction' instead of 'none'.
        // This handles both new and legacy values from the popup.
        sameSite: cookie.sameSite === 'none' ? 'no_restriction' : (cookie.sameSite || 'lax'),
        storeId: storeId
      };
      
      // Add optional properties if specified
      if (cookie.domain) cookieDetails.domain = cookie.domain;
      if (cookie.expirationDate) cookieDetails.expirationDate = cookie.expirationDate;
      if (cookie.httpOnly !== undefined) cookieDetails.httpOnly = cookie.httpOnly;
      
      await chrome.cookies.set(cookieDetails);
      console.log('Cookie set:', cookie.name, 'for', urlObj.hostname);
    } catch (e) {
      console.error('Failed to set cookie:', cookie.name, e);
    }
  }
}

// Initialize with default config if needed
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['config'], (result) => {
    if (!result.config) {
      const defaultConfig = {
        rules: [
          {
            id: Date.now(),
            name: 'Example Rule',
            urlPattern: '^https://example\\.com.*',
            enabled: false,
            cookies: [
              {
                name: 'session_id',
                value: 'your_value_here',
                path: '/',
                sameSite: 'lax'
              }
            ]
          }
        ]
      };
      chrome.storage.local.set({ config: defaultConfig });
    }
  });
});
