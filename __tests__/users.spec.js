const { createTestClient } = require('apollo-server-testing');
const mongoose = require('mongoose');
const gql = require('graphql-tag');
const bcrypt = require('bcryptjs');

const server = require('../server');
const User = require('../models/User');
const { encryptPassword } = require('../graphql/resolvers/users');

require('dotenv').config();

const { mutate } = createTestClient(server);

const REGISTER_USER = gql`
  mutation register(
    $username: String!
    $email: String!
    $password: String!
    $confirmPassword: String!
  ) {
    register(
      registerInput: {
        username: $username
        email: $email
        password: $password
        confirmPassword: $confirmPassword
      }
    ) {
      id
    }
  }
`;

const LOGIN_USER = gql`
  mutation login($username: String!, $password: String!) {
    login(username: $username, password: $password) {
      id
      email
      username
      token
    }
  }
`;

describe('User tests', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URL_TEST, {
      useNewUrlParser: true,
    });
  });

  it('should create a user successfully', async () => {
    const variables = {
      username: 'username',
      password: 'password',
      confirmPassword: 'password',
      email: 'email@email.com',
    };

    await mutate({
      mutation: REGISTER_USER,
      variables,
    });

    const user = await User.findOne({ username: variables.username });
    const isPasswordCorrect = await bcrypt.compare(
      variables.password,
      user.password
    );
    expect(user.username).toBe(variables.username);
    expect(user.email).toBe(variables.email);
    expect(isPasswordCorrect).toBe(true);
  });

  it('should throw an error if the username is taken', async () => {
    const existingUser = new User({
      username: 'username',
      password: 'password',
      email: 'email1@email.com',
    });

    await existingUser.save();

    const variables = {
      username: 'username',
      password: 'password',
      confirmPassword: 'password',
      email: 'email2@email.com',
    };

    let { errors } = await mutate({
      mutation: REGISTER_USER,
      variables,
    });

    errors = errors.filter(
      (error) => error.extensions.code === 'BAD_USER_INPUT'
    );

    const foundUser = await User.findOne({ username: variables.username });

    expect(foundUser.email).toBe(existingUser.email);
    expect(errors.length).not.toBe(0);
  });

  it('should throw an error if the passwords do not match', async () => {
    const variables = {
      username: 'username',
      password: 'password',
      confirmPassword: 'not_match',
      email: 'email@email.com',
    };

    let { errors } = await mutate({
      mutation: REGISTER_USER,
      variables,
    });

    errors = errors.filter(
      (error) => error.extensions.code === 'BAD_USER_INPUT'
    );

    const user = await User.findOne({ username: variables.username });

    expect(user).toBeNull();
    expect(errors.length).not.toBe(0);
  });

  it('should throw an error if the username is blank', async () => {
    const variables = {
      username: '  ',
      password: 'password',
      confirmPassword: 'not_match',
      email: 'email@email.com',
    };

    let { errors } = await mutate({
      mutation: REGISTER_USER,
      variables,
    });

    errors = errors.filter(
      (error) => error.extensions.code === 'BAD_USER_INPUT'
    );

    const user = await User.findOne({ username: variables.username });

    expect(user).toBeNull();
    expect(errors.length).not.toBe(0);
  });

  it('should throw an error if the email is blank', async () => {
    const variables = {
      username: 'username',
      password: 'password',
      confirmPassword: 'not_match',
      email: '   ',
    };

    let { errors } = await mutate({
      mutation: REGISTER_USER,
      variables,
    });

    errors = errors.filter(
      (error) => error.extensions.code === 'BAD_USER_INPUT'
    );

    const user = await User.findOne({ username: variables.username });

    expect(user).toBeNull();
    expect(errors.length).not.toBe(0);
  });

  it('should throw an error if the email is invalid', async () => {
    const variables = {
      username: 'username',
      password: 'password',
      confirmPassword: 'not_match',
      email: 'invalid_email',
    };

    let { errors } = await mutate({
      mutation: REGISTER_USER,
      variables,
    });

    errors = errors.filter(
      (error) => error.extensions.code === 'BAD_USER_INPUT'
    );

    const user = await User.findOne({ username: variables.username });

    expect(user).toBeNull();
    expect(errors.length).not.toBe(0);
  });

  it('should throw an error if the username is blank', async () => {
    const variables = {
      username: '   ',
      password: 'password',
    };

    let { data, errors } = await mutate({
      mutation: LOGIN_USER,
      variables,
    });

    errors = errors.filter(
      (error) => error.extensions.code === 'BAD_USER_INPUT'
    );

    expect(errors.length).not.toBe(0);
    expect(data).toBeNull();
  });

  it('should throw an error if the password is blank', async () => {
    const variables = {
      username: 'username',
      password: '   ',
    };

    let { data, errors } = await mutate({
      mutation: LOGIN_USER,
      variables,
    });

    errors = errors.filter(
      (error) => error.extensions.code === 'BAD_USER_INPUT'
    );

    expect(errors.length).not.toBe(0);
    expect(data).toBeNull();
  });

  it('should throw an error if the user does not exist', async () => {
    const variables = {
      username: 'username',
      password: 'password',
    };

    let { data, errors } = await mutate({
      mutation: LOGIN_USER,
      variables,
    });

    errors = errors.filter(
      (error) => error.extensions.code === 'BAD_USER_INPUT'
    );

    expect(errors.length).not.toBe(0);
    expect(data).toBeNull();
  });

  it('should throw an error if the password is not correct', async () => {
    const existingUser = new User({
      username: 'username',
      password: 'password',
      email: 'email1@email.com',
    });

    await existingUser.save();

    const variables = {
      username: 'username',
      password: 'wrong',
    };

    let { data, errors } = await mutate({
      mutation: LOGIN_USER,
      variables,
    });

    errors = errors.filter(
      (error) => error.extensions.code === 'BAD_USER_INPUT'
    );

    expect(errors.length).not.toBe(0);
    expect(data).toBeNull();
  });

  it('should login successfully', async () => {
    const password = await encryptPassword('password');
    const existingUser = new User({
      username: 'username',
      password,
      email: 'email1@email.com',
    });

    await existingUser.save();

    const variables = {
      username: 'username',
      password: 'password',
    };

    const { data } = await mutate({
      mutation: LOGIN_USER,
      variables,
    });

    expect(data).not.toBeNull();
    expect(data.login).not.toBeNull();
    expect(data.login.username).toBe(existingUser.username);
    expect(data.login.email).toBe(existingUser.email);
  });

  afterEach(async () => {
    await User.deleteMany();
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });
});
