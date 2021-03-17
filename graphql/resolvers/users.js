const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { UserInputError } = require('apollo-server');

const User = require('../../models/User');
const {
  validateRegisterInput,
  validateLoginInput,
} = require('../../utils/validators');

const generateJwtToken = (user) =>
  jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username,
    },
    process.env.SECRET_KEY,
    { expiresIn: '1h' }
  );

module.exports = {
  Mutation: {
    register: async (
      _,
      { registerInput: { username, email, password, confirmPassword } }
    ) => {
      const { valid, errors } = validateRegisterInput(
        username,
        email,
        password,
        confirmPassword
      );
      if (!valid) {
        throw new UserInputError('Errors', { errors });
      }

      const existingUser = await User.findOne({ username });
      if (existingUser) {
        throw new UserInputError('Username is taken', {
          errors: {
            username: 'The username is taken',
          },
        });
      }

      password = await bcrypt.hash(password, 12);

      const newUser = new User({
        username,
        email,
        password,
        createdAt: new Date().toISOString(),
      });

      const res = await newUser.save();

      const token = await generateJwtToken(res);

      return {
        ...res._doc,
        id: res._id,
        token,
      };
    },
    login: async (_, { username, password }) => {
      const { valid, errors } = validateLoginInput(username, password);
      if (!valid) {
        throw new UserInputError('Errors', { errors });
      }

      const user = await User.findOne({ username });
      if (!user) {
        errors.general = 'User not found';
        throw new UserInputError('User not found', { errors });
      }

      const isPasswordCorrect = await bcrypt.compare(password, user.password);
      if (!isPasswordCorrect) {
        errors.general = 'Wrong credentials';
        throw new UserInputError('Wrong credentials', { errors });
      }

      const token = await generateJwtToken(user);

      return {
        ...user._doc,
        id: user._id,
        token,
      };
    },
  },
};