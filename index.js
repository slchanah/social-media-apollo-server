const mongoose = require('mongoose');

const server = require('./server');

require('dotenv').config();

mongoose
  .connect(process.env.MONGODB_URL, { useNewUrlParser: true })
  .then(() => {
    console.log('Mongodb conected!');
    return server.listen({ port: process.env.PORT || 5000 });
  })
  .then((res) => console.log(`Server running at ${res.url}`));
