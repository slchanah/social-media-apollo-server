const isBlank = (s) => s.trim() === '';

const isEmpty = (s) => s === '';

const isValidEmail = (email) => {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
  return email.match(emailRegex);
};

module.exports.validateRegisterInput = (
  username,
  email,
  password,
  confirmPassword
) => {
  const errors = {};

  if (isBlank(username)) {
    errors.username = 'Username must not be empty';
  }

  if (isBlank(email)) {
    errors.email = 'Email must not be empty';
  } else {
    if (!isValidEmail(email)) {
      errors.email = 'Email must be a valid email address';
    }
  }

  if (isEmpty(password)) {
    errors.password = 'Password must not be empty';
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords must match';
  }

  return {
    errors,
    valid: Object.keys(errors).length === 0,
  };
};

module.exports.validateLoginInput = (username, password) => {
  const errors = {};

  if (isBlank(username)) {
    errors.username = 'Username must not be empty';
  }

  if (isEmpty(password)) {
    errors.password = 'Password must not be empty';
  }

  return {
    errors,
    valid: Object.keys(errors).length === 0,
  };
};
