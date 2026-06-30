const escape = (value = '') =>
  String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);

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
  `;
}

async function init() {
  const app = document.getElementById('app');
  try {
    const res = await fetch('/api/profile');
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    const { data } = await res.json();
    document.title = `${data.name} — Profile`;
    app.innerHTML = renderProfile(data);
  } catch (err) {
    app.innerHTML = `<p class="error">Could not load profile: ${escape(err.message)}</p>`;
  }
}

init();
