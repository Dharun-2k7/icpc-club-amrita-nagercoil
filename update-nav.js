const fs = require('fs');
const path = require('path');

const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.html'));

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace the Nav Join Us button
  // Existing: <a href="join-us.html" class="btn btn-join">Join Us</a>
  const searchFor = '<a href="join-us.html" class="btn btn-join">Join Us</a>';
  const replaceWith = `
          <a href="login.html" class="btn btn-outline" id="nav-login-btn">Log In</a>
          <a href="register.html" class="btn btn-join" id="nav-register-btn">Register</a>
          <a href="dashboard.html" class="btn btn-join" id="nav-dashboard-btn" style="display: none;">Dashboard</a>
          <button class="btn btn-outline" id="nav-logout-btn" style="display: none;">Log Out</button>
  `.trim();
  
  // This will also require a CSS class `btn-outline` if not exists, but we can just use inline styles or existing classes
  
  if (content.includes(searchFor)) {
    content = content.replace(searchFor, replaceWith);
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
});
