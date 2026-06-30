const escape = (value = '') =>
  String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);

let currentProfile = null;
let isEditing = false;

function getToken() {
  return localStorage.getItem('sas_token');
}

function renderAdminBar() {
  const token = getToken();
  if (!token) return '';
  return `
    <div class="admin-bar">
      <div>Logged in as <span>Admin (Jackie)</span></div>
      <div>
        ${isEditing 
          ? `<button class="btn btn-secondary" id="exit-edit-btn">View Profile</button>` 
          : `<button class="btn btn-primary" id="enter-edit-btn">Edit Profile</button>`
        }
        <button class="btn btn-danger" id="logout-btn">Logout</button>
      </div>
    </div>
  `;
}

function renderProfile(profile) {
  const skills = (profile.skills || []).map((s) => `<li>${escape(s)}</li>`).join('');

  const experience = (profile.experience || [])
    .map(
      (job) => `
        <div class="entry">
          <h3>${escape(job.role)} · ${escape(job.company)}</h3>
          <div class="meta">${escape(job.period)}</div>
          <ul>${(job.highlights || []).map((h) => `<li>${escape(h)}</li>`).join('')}</ul>
        </div>`
    )
    .join('');

  const projects = (profile.projects || [])
    .map(
      (p) => `
        <div class="entry">
          <h3><a href="${escape(p.url)}" target="_blank" rel="noopener">${escape(p.name)}</a></h3>
          <div class="meta">${escape(p.description)}</div>
        </div>`
    )
    .join('');

  const contact = profile.contact || {};
  const contactLinks = Object.entries(contact)
    .map(([key, value]) => {
      const href = key === 'email' ? `mailto:${value}` : value;
      return `<a href="${escape(href)}" target="_blank" rel="noopener">${escape(key)}</a>`;
    })
    .join('');

  return `
    ${renderAdminBar()}
    <header class="header">
      <img src="${escape(profile.avatar || '/assets/avatar.svg')}" alt="${escape(profile.name)}" />
      <div>
        <h1>${escape(profile.name)}</h1>
        <div class="title">${escape(profile.title)}</div>
        <p class="tagline">${escape(profile.tagline || '')}</p>
        <p class="location">${escape(profile.location || '')}</p>
      </div>
    </header>

    <section><h2>About</h2><p>${escape(profile.summary || '')}</p></section>
    <section><h2>Skills</h2><ul class="skills">${skills}</ul></section>
    <section><h2>Experience</h2>${experience}</section>
    <section><h2>Projects</h2>${projects}</section>
    <section><h2>Contact</h2><div class="contact">${contactLinks}</div></section>

    ${!getToken() ? `<div class="admin-footer"><span class="admin-link" id="admin-login-link">Admin System Access</span></div>` : ''}
  `;
}

function renderEditForm(profile) {
  const advanceData = {
    contact: profile.contact || {},
    experience: profile.experience || [],
    projects: profile.projects || []
  };
  const advanceJson = JSON.stringify(advanceData, null, 2);

  return `
    ${renderAdminBar()}
    <header class="header">
      <img src="${escape(profile.avatar || '/assets/avatar.svg')}" alt="${escape(profile.name)}" />
      <div>
        <h1>Configure Profile</h1>
        <div class="title">Developer & Admin Console</div>
      </div>
    </header>

    <form id="edit-profile-form" class="edit-form">
      <div class="form-group">
        <label for="form-name">Name</label>
        <input type="text" id="form-name" value="${escape(profile.name)}" required />
      </div>

      <div class="form-group">
        <label for="form-title">Title</label>
        <input type="text" id="form-title" value="${escape(profile.title)}" required />
      </div>

      <div class="form-group">
        <label for="form-tagline">Tagline</label>
        <input type="text" id="form-tagline" value="${escape(profile.tagline || '')}" />
      </div>

      <div class="form-group">
        <label for="form-location">Location</label>
        <input type="text" id="form-location" value="${escape(profile.location || '')}" />
      </div>

      <div class="form-group">
        <label for="form-avatar">Avatar URL / SVG Path</label>
        <input type="text" id="form-avatar" value="${escape(profile.avatar || '')}" />
      </div>

      <div class="form-group">
        <label for="form-summary">About / Summary</label>
        <textarea id="form-summary" rows="4">${escape(profile.summary || '')}</textarea>
      </div>

      <div class="form-group">
        <label for="form-skills">Skills (comma-separated)</label>
        <input type="text" id="form-skills" value="${escape((profile.skills || []).join(', '))}" />
      </div>

      <div class="form-group">
        <label for="form-advanced">Advanced Structs (Contact, Experience, Projects) — JSON</label>
        <textarea id="form-advanced" rows="12" class="json-textarea">${escape(advanceJson)}</textarea>
        <p class="help-text">Validate raw structures with maximum power. Must be compliant JSON.</p>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary">Save Changes</button>
        <button type="button" id="cancel-edit-btn" class="btn btn-secondary">Cancel</button>
      </div>
    </form>
  `;
}

const app = document.getElementById('app');

function setupEventListeners() {
  // Login handler
  const loginLink = document.getElementById('admin-login-link');
  if (loginLink) {
    loginLink.addEventListener('click', () => {
      const token = prompt('Enter Admin Access Token:');
      if (token) {
        localStorage.setItem('sas_token', token);
        render();
      }
    });
  }

  // Logout handler
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('sas_token');
      isEditing = false;
      render();
    });
  }

  // Edit toggles
  const enterEditBtn = document.getElementById('enter-edit-btn');
  if (enterEditBtn) {
    enterEditBtn.addEventListener('click', () => {
      isEditing = true;
      render();
    });
  }

  const exitEditBtn = document.getElementById('exit-edit-btn');
  if (exitEditBtn) {
    exitEditBtn.addEventListener('click', () => {
      isEditing = false;
      render();
    });
  }

  const cancelEditBtn = document.getElementById('cancel-edit-btn');
  if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', () => {
      isEditing = false;
      render();
    });
  }

  // Submit handler
  const form = document.getElementById('edit-profile-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const name = document.getElementById('form-name').value.trim();
      const title = document.getElementById('form-title').value.trim();
      const tagline = document.getElementById('form-tagline').value.trim();
      const location = document.getElementById('form-location').value.trim();
      const avatar = document.getElementById('form-avatar').value.trim();
      const summary = document.getElementById('form-summary').value.trim();
      const skillsStr = document.getElementById('form-skills').value;
      const advancedStr = document.getElementById('form-advanced').value;

      const skills = skillsStr
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      let advanced;
      try {
        advanced = JSON.parse(advancedStr);
      } catch (err) {
        alert('Invalid JSON in Advanced Structs field. Please correct it before saving.');
        return;
      }

      const updatedPayload = {
        name,
        title,
        tagline,
        location,
        avatar,
        summary,
        skills,
        contact: advanced.contact || {},
        experience: advanced.experience || [],
        projects: advanced.projects || []
      };

      try {
        const token = getToken();
        const res = await fetch('/api/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify(updatedPayload)
        });

        if (!res.ok) {
          if (res.status === 401) {
            localStorage.removeItem('sas_token');
            alert('Unauthorized session expired. Please log in again.');
            isEditing = false;
            render();
            return;
          }
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.message || `Server responded with ${res.status}`);
        }

        const { data } = await res.json();
        currentProfile = data;
        isEditing = false;
        alert('Profile saved successfully with maximum power!');
        render();
      } catch (err) {
        alert(`Error saving profile: ${err.message}`);
      }
    });
  }
}

function render() {
  if (!currentProfile) return;
  document.title = `${currentProfile.name} — Profile`;
  if (isEditing && getToken()) {
    app.innerHTML = renderEditForm(currentProfile);
  } else {
    app.innerHTML = renderProfile(currentProfile);
  }
  setupEventListeners();
}

async function init() {
  try {
    const res = await fetch('/api/profile');
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    const { data } = await res.json();
    currentProfile = data;
    render();
  } catch (err) {
    app.innerHTML = `<p class="error">Could not load profile: ${escape(err.message)}</p>`;
  }
}

init();
