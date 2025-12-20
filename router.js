// Client-side router for clean URLs
// Works on both local development and production (GitHub Pages)
// This runs immediately to catch clean URLs before the server 404s

(function() {
  // Run immediately, even before DOM is ready
  const path = window.location.pathname;
  
  // Don't route if we're already on a .html file
  if (path.includes('.html')) {
    return;
  }
  
  const routes = {
    '/album-reviews': '/index.html',
    '/personal-blog': '/blog.html',
    '/interviews': '/interviews.html',
    '/settings': '/settings.html',
    '/login': '/login.html',
    '/chat': '/chat.html',
    '/': '/index.html'
  };
  
  // Remove trailing slash for matching
  const cleanPath = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path;
  
  // Check if we have a route for this path
  if (routes[cleanPath]) {
    // Redirect immediately to the actual file
    window.location.replace(routes[cleanPath]);
    return;
  } else if (routes[path]) {
    // Try with original path
    window.location.replace(routes[path]);
    return;
  }
})();

// Convert HTML links to use .html on localhost
(function() {
  function convertLinks() {
    const isLocalhost = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1' || 
                        window.location.hostname === '';
    
    if (!isLocalhost) return; // Only convert on localhost
    
    const routes = {
      '/album-reviews': '/index.html',
      '/personal-blog': '/blog.html',
      '/interviews': '/interviews.html',
      '/settings': '/settings.html',
      '/login': '/login.html',
      '/chat': '/chat.html'
    };
    
    // Convert all links with clean URLs to .html files
    document.querySelectorAll('a[href^="/"]').forEach(link => {
      const href = link.getAttribute('href');
      if (routes[href] && !href.includes('.html')) {
        link.setAttribute('href', routes[href]);
      }
    });
  }
  
  // Run immediately and also when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', convertLinks);
  } else {
    convertLinks();
  }
  
  // Also intercept clicks as a fallback
  document.addEventListener('click', function(e) {
    const link = e.target.closest('a[href^="/"]');
    if (link && link.href) {
      const url = new URL(link.href);
      const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '';
      
      if (isLocalhost && !url.pathname.includes('.html') && url.pathname !== '/') {
        const routes = {
          '/album-reviews': '/index.html',
          '/personal-blog': '/blog.html',
          '/interviews': '/interviews.html',
          '/settings': '/settings.html',
          '/login': '/login.html',
          '/chat': '/chat.html'
        };
        
        if (routes[url.pathname]) {
          e.preventDefault();
          window.location.href = routes[url.pathname];
        }
      }
    }
  });
})();


