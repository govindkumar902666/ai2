// test.js — Simple Express server test (no API keys here)
const express = require('express');
const app = express();

app.use(express.json());

app.get('/hello', (req, res) => {
    res.json({ message: 'Hello Node.js!' });
});

app.post('/data', (req, res) => {
    const name = req.body.name;
    res.json({ message: `Received from ${name}` });
});

app.listen(3001, () => {
    console.log('Test server running on port 3001');
});