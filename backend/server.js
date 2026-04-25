const express = require('express');
const app = express();
const PORT = 5000;

// Middleware to parse JSON data (needed for APIs)
app.use(express.json());

// Basic route to test if server works
app.get('/', (req, res) => {
  res.json({ message: 'Blood Bank Backend is running!' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});