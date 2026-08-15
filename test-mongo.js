import mongoose from 'mongoose';
import { config } from './src/config.js';

if (!config.mongoUri) {
  console.error('MONGODB_URI not set');
  process.exit(1);
}

mongoose
  .connect(config.mongoUri)
  .then(() => {
    console.log('MongoDB test connection successful');
    process.exit(0);
  })
  .catch(err => {
    console.error('MongoDB test connection failed:', err);
    process.exit(1);
  });
