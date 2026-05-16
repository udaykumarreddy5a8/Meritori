const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SUBMISSIONS_FILE = path.join(__dirname, 'submissions.json');

app.use(express.json({ limit: '2mb' }));

// Serve the single-page app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'meritori.html'));
});

// Ensure submissions file exists
if (!fs.existsSync(SUBMISSIONS_FILE)) {
  fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify([], null, 2));
}

app.post('/submit', (req, res) => {
  try {
    const submission = {
      id: 'APP-' + Date.now(),
      ...req.body,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      received_at: new Date().toISOString()
    };
    const required = ['name','email','year','branch','q1','q2','q3','q4','q5','q6','q7','q8','q9','q10','q12'];
    const missing = required.filter(f => !submission[f]);
    if (missing.length > 0) return res.status(400).json({ error: 'Missing fields', fields: missing });
    const existing = JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf8'));
    existing.push(submission);
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(existing, null, 2));
    console.log('New submission:', submission.name, '<' + submission.email + '>');
    res.json({ ok: true, id: submission.id });
  } catch (err) {
    console.error('Submit error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/admin/submissions', (req, res) => {
  const token = req.query.token || req.headers['x-admin-token'];
  if (token !== (process.env.ADMIN_TOKEN || 'change-this-secret')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const data = JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf8'));
    res.json({ count: data.length, submissions: data });
  } catch { res.json({ count: 0, submissions: [] }); }
});

app.get('/admin/csv', (req, res) => {
  const token = req.query.token || req.headers['x-admin-token'];
  if (token !== (process.env.ADMIN_TOKEN || 'change-this-secret')) return res.status(401).send('Unauthorized');
  try {
    const data = JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf8'));
    if (!data.length) return res.send('No submissions yet.');
    const headers = Object.keys(data[0]);
    const csv = [headers.join(','), ...data.map(row => headers.map(h => '"' + String(row[h]||'').replace(/"/g,'""') + '"').join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="meritori-submissions.csv"');
    res.send(csv);
  } catch (err) { res.status(500).send('Error'); }
});

app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

app.listen(PORT, () => {
  console.log('\nMeritori running on http://localhost:' + PORT);
  console.log('Admin: /admin/submissions?token=<ADMIN_TOKEN>\n');
});
