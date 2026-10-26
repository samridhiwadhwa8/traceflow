const express = require('express');
const { traceflow, withSpan } = require('./traceflow');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Apply TraceFlow middleware
app.use(traceflow);

// Demo endpoints
app.get('/', (req, res) => {
  res.json({ message: 'Hello from TraceFlow Demo App' });
});

app.get('/api/users', async (req, res) => {
  try {
    await withSpan('fetch_users', async () => {
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    res.json({ users: [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    await withSpan('create_user', async () => {
      // Simulate user creation
      await new Promise(resolve => setTimeout(resolve, 30));
    });

    res.json({ message: 'User created', user: req.body });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.get('/api/slow', async (req, res) => {
  try {
    await withSpan('delay_operation', async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));
    });

    res.json({ message: 'Slow response' });
  } catch (error) {
    res.status(500).json({ error: 'Slow operation failed' });
  }
});

app.post('/checkout', async (req, res) => {
  try {
    // Checkout process with multiple operations
    await withSpan('validate_request', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    await withSpan('process_payment', async () => {
      await new Promise(resolve => setTimeout(resolve, 800));
    });

    await withSpan('update_inventory', async () => {
      await new Promise(resolve => setTimeout(resolve, 400));
    });

    await withSpan('send_confirmation', async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    res.json({ message: 'Checkout successful' });
  } catch (error) {
    res.status(500).json({ error: 'Checkout failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Demo app running on http://localhost:${PORT}`);
});
