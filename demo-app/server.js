const express = require('express');
const traceflow = require('./traceflow');

const app = express();
const PORT = 3000;

app.use(express.json());

// Apply TraceFlow middleware
app.use(traceflow.traceflow);

// Demo endpoints
app.get('/', (req, res) => {
  res.json({ message: 'Hello from TraceFlow Demo App' });
});

app.get('/api/users', (req, res) => {
  res.json({ users: [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }] });
});

app.post('/api/users', (req, res) => {
  res.json({ message: 'User created', user: req.body });
});

app.get('/api/slow', (req, res) => {
  setTimeout(() => {
    res.json({ message: 'Slow response' });
  }, 1000);
});

app.post('/checkout', (req, res) => {
  setTimeout(() => {
    res.json({ message: 'Checkout successful' });
  }, 1500);
});

app.listen(PORT, () => {
  console.log(`Demo app running on http://localhost:${PORT}`);
});
