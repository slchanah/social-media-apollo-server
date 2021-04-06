const { AuthenticationError } = require('apollo-server-errors');
const jwt = require('jsonwebtoken');

module.exports = (context) => {
  const authHeader = context?.req?.headers?.authorization;

  const token = authHeader?.split('Bearer ')[1];

  if (!authHeader || !token) {
    throw new Error(`Authentication token must be ${'Bearer <token>'}`);
  }

  try {
    const user = jwt.verify(token, process.env.SECRET_KEY);
    return user;
  } catch (err) {
    throw new AuthenticationError('Invalid/Expired token');
  }
};
