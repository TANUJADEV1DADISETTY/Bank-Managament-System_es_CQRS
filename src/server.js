const express = require('express');
const app = express();
const accountRoutes = require('./routes/accountRoutes');
const projectionRoutes = require('./routes/projectionRoutes');
const dotenv = require('dotenv');

dotenv.config();

app.use(express.json());

app.use('/api/accounts', accountRoutes);
app.use('/api/projections', projectionRoutes);

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

const PORT = process.env.API_PORT || 8080;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});