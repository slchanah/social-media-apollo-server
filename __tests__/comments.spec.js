const { createTestClient } = require('apollo-server-testing');
const mongoose = require('mongoose');
const gql = require('graphql-tag');
const sinon = require('sinon');
const jwt = require('jsonwebtoken');

const server = require('../server');
const Post = require('../models/Post');
const User = require('../models/User');

require('dotenv').config();

const originalContext = server.context;

const { mutate } = createTestClient(server);

const sampleUser = new User({
  username: 'username',
  password: 'password',
  email: 'email@email.com',
});

const sampleDecryptedToken = {
  username: sampleUser.username,
  email: sampleUser.email,
  id: mongoose.Types.ObjectId().toHexString(),
};

const samplePost = {
  body: 'body',
  username: sampleUser.username,
  comments: [
    {
      body: 'comment',
      username: sampleUser.username,
    },
  ],
  likes: [],
};

const authHeader = { req: { headers: { authorization: 'Bearer token' } } };

const constructAuthContext = (context) => context(authHeader);

const CREATE_COMMENT_MUTATION = gql`
  mutation createComment($postId: ID!, $body: String!) {
    createComment(postId: $postId, body: $body) {
      id
      comments {
        id
        body
        username
        createdAt
      }
      commentCount
    }
  }
`;

const DELETE_COMMENT_MUTATION = gql`
  mutation deleteComment($postId: ID!, $commentId: ID!) {
    deleteComment(postId: $postId, commentId: $commentId) {
      id
      comments {
        id
        body
      }
      commentCount
    }
  }
`;

const LIKE_POST_MUTATION = gql`
  mutation likePost($postId: ID!) {
    likePost(postId: $postId) {
      id
      likes {
        id
        username
      }
      likeCount
    }
  }
`;

describe('Comments tests', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URL_TEST, {
      useNewUrlParser: true,
    });
  });

  beforeEach(() => {
    server.context = originalContext;
  });

  it('should create a comment successfully', async () => {
    server.context = constructAuthContext(server.context);
    const { mutate } = createTestClient(server);

    const verify = sinon.stub(jwt, 'verify');
    verify.returns(sampleDecryptedToken);

    let savedPost = await new Post(samplePost).save();
    expect(savedPost.comments[0].body).toBe(samplePost.comments[0].body);

    const variables = {
      postId: savedPost.id,
      body: 'new comment',
    };
    await mutate({
      mutation: CREATE_COMMENT_MUTATION,
      variables,
    });

    savedPost = await Post.findById(savedPost.id);
    expect(savedPost.comments[0].body).toBe(variables.body);

    verify.restore();
  });

  it('should fail to create a comment if no token is provided', async () => {
    let savedPost = await new Post(samplePost).save();
    expect(savedPost.comments[0].body).toBe(samplePost.comments[0].body);

    const variables = {
      postId: savedPost.id,
      body: 'new comment',
    };
    const { errors } = await mutate({
      mutation: CREATE_COMMENT_MUTATION,
      variables,
    });

    expect(errors).not.toBeNull();
    expect(errors.length).not.toBe(0);

    savedPost = await Post.findById(savedPost.id);
    expect(savedPost.comments.length).toBe(1);
    expect(savedPost.comments[0].body).not.toBe(variables.body);
  });

  it('should fail to create a comment if the comment is blank', async () => {
    server.context = constructAuthContext(server.context);
    const { mutate } = createTestClient(server);

    const verify = sinon.stub(jwt, 'verify');
    verify.returns(sampleDecryptedToken);

    let savedPost = await new Post(samplePost).save();
    expect(savedPost.comments[0].body).toBe(samplePost.comments[0].body);

    const variables = {
      postId: savedPost.id,
      body: '   ',
    };
    const { errors } = await mutate({
      mutation: CREATE_COMMENT_MUTATION,
      variables,
    });

    expect(errors).not.toBeNull();
    expect(errors.length).not.toBe(0);

    savedPost = await Post.findById(savedPost.id);
    expect(savedPost.comments.length).toBe(1);
    expect(savedPost.comments[0].body).not.toBe(variables.body);

    verify.restore();
  });

  it('should fail to create a comment if the post id is not existed', async () => {
    server.context = constructAuthContext(server.context);
    const { mutate } = createTestClient(server);

    const verify = sinon.stub(jwt, 'verify');
    verify.returns(sampleDecryptedToken);

    let posts = await Post.find();
    expect(posts.length).toBe(0);

    const variables = {
      postId: mongoose.Types.ObjectId(),
      body: 'new comment',
    };
    const { errors } = await mutate({
      mutation: CREATE_COMMENT_MUTATION,
      variables,
    });

    expect(errors).not.toBeNull();
    expect(errors.length).not.toBe(0);

    posts = await Post.find();
    expect(posts.length).toBe(0);

    verify.restore();
  });

  it('should delete a comment successfully', async () => {
    server.context = constructAuthContext(server.context);
    const { mutate } = createTestClient(server);

    const verify = sinon.stub(jwt, 'verify');
    verify.returns(sampleDecryptedToken);

    const post = new Post(samplePost);
    post.comments = [
      {
        body: 'comment to be deleted',
        id: mongoose.Types.ObjectId(),
        username: sampleUser.username,
      },
    ];
    let savedPost = await post.save();
    expect(savedPost.comments.length).toBe(1);

    const variables = {
      postId: savedPost.id,
      commentId: post.comments[0].id,
    };
    await mutate({
      mutation: DELETE_COMMENT_MUTATION,
      variables,
    });

    savedPost = await Post.findById(savedPost.id);
    expect(savedPost.comments.length).toBe(0);

    verify.restore();
  });

  it('should fail to delete a comment if the token is not porvided', async () => {
    const post = new Post(samplePost);
    post.comments = [
      {
        body: 'comment to be deleted',
        id: mongoose.Types.ObjectId(),
        username: sampleUser.username,
      },
    ];
    let savedPost = await post.save();
    expect(savedPost.comments.length).toBe(1);

    const variables = {
      postId: savedPost.id,
      commentId: post.comments[0].id,
    };
    const { errors } = await mutate({
      mutation: DELETE_COMMENT_MUTATION,
      variables,
    });

    expect(errors).not.toBeNull();
    expect(errors.length).not.toBe(0);

    savedPost = await Post.findById(savedPost.id);
    expect(savedPost.comments.length).toBe(1);
  });

  it('should fail to delete a comment if the post is not existed', async () => {
    server.context = constructAuthContext(server.context);
    const { mutate } = createTestClient(server);

    const verify = sinon.stub(jwt, 'verify');
    verify.returns(sampleDecryptedToken);

    const posts = await Post.find();
    expect(posts.length).toBe(0);

    const variables = {
      postId: mongoose.Types.ObjectId(),
      commentId: mongoose.Types.ObjectId(),
    };
    const { errors } = await mutate({
      mutation: DELETE_COMMENT_MUTATION,
      variables,
    });

    expect(errors).not.toBeNull();
    expect(errors.length).not.toBe(0);

    verify.restore();
  });

  it('should fail to delete a comment if the comment is not existed', async () => {
    server.context = constructAuthContext(server.context);
    const { mutate } = createTestClient(server);

    const verify = sinon.stub(jwt, 'verify');
    verify.returns(sampleDecryptedToken);

    const post = new Post(samplePost);
    post.comments = [
      {
        body: 'comment to be deleted',
        id: mongoose.Types.ObjectId(),
        username: sampleUser.username,
      },
    ];
    let savedPost = await post.save();
    expect(savedPost.comments.length).toBe(1);

    const variables = {
      postId: savedPost.id,
      commentId: mongoose.Types.ObjectId(),
    };
    const { errors } = await mutate({
      mutation: DELETE_COMMENT_MUTATION,
      variables,
    });

    expect(errors).not.toBeNull();
    expect(errors.length).not.toBe(0);

    savedPost = await Post.findById(savedPost.id);
    expect(savedPost.comments.length).toBe(1);

    verify.restore();
  });

  it('should fail to delete a comment if the request user is not the owner of the comment', async () => {
    server.context = constructAuthContext(server.context);
    const { mutate } = createTestClient(server);

    const verify = sinon.stub(jwt, 'verify');
    verify.returns(sampleDecryptedToken);

    const post = new Post(samplePost);
    post.comments = [
      {
        body: 'comment to be deleted',
        id: mongoose.Types.ObjectId(),
        username: 'another username',
      },
    ];
    let savedPost = await post.save();
    expect(savedPost.comments.length).toBe(1);

    const variables = {
      postId: savedPost.id,
      commentId: post.comments[0].id,
    };
    const { errors } = await mutate({
      mutation: DELETE_COMMENT_MUTATION,
      variables,
    });

    expect(errors).not.toBeNull();
    expect(errors.length).not.toBe(0);

    savedPost = await Post.findById(savedPost.id);
    expect(savedPost.comments.length).toBe(1);

    verify.restore();
  });

  it('should like a post successfully', async () => {
    server.context = constructAuthContext(server.context);
    const { mutate } = createTestClient(server);

    const verify = sinon.stub(jwt, 'verify');
    verify.returns(sampleDecryptedToken);

    let savedPost = await new Post(samplePost).save();
    expect(savedPost.likes.length).toBe(0);

    const variables = {
      postId: savedPost.id,
    };
    await mutate({
      mutation: LIKE_POST_MUTATION,
      variables,
    });

    savedPost = await Post.findById(savedPost.id);
    expect(savedPost.likes.length).toBe(1);
    expect(savedPost.likes[0].username).toBe(sampleDecryptedToken.username);

    verify.restore();
  });

  it('should unlike a post successfully', async () => {
    server.context = constructAuthContext(server.context);
    const { mutate } = createTestClient(server);

    const verify = sinon.stub(jwt, 'verify');
    verify.returns(sampleDecryptedToken);

    const post = new Post(samplePost);
    post.likes.push({
      username: sampleUser.username,
    });
    let savedPost = await post.save();
    expect(savedPost.likes.length).toBe(1);
    expect(savedPost.likes[0].username).toBe(sampleUser.username);

    const variables = {
      postId: savedPost.id,
    };
    await mutate({
      mutation: LIKE_POST_MUTATION,
      variables,
    });

    savedPost = await Post.findById(savedPost.id);
    expect(savedPost.likes.length).toBe(0);

    verify.restore();
  });

  it('should fail to like or unlike a post if the token is not provided', async () => {
    let savedPost = await new Post(samplePost).save();
    expect(savedPost.likes.length).toBe(0);

    const variables = {
      postId: savedPost.id,
    };
    const { errors } = await mutate({
      mutation: LIKE_POST_MUTATION,
      variables,
    });

    expect(errors).not.toBeNull();
    expect(errors.length).not.toBe(0);

    savedPost = await Post.findById(savedPost.id);
    expect(savedPost.likes.length).toBe(0);
  });

  it('should fail to like or unlike a post if the post id is not existed', async () => {
    server.context = constructAuthContext(server.context);
    const { mutate } = createTestClient(server);

    const verify = sinon.stub(jwt, 'verify');
    verify.returns(sampleDecryptedToken);

    let savedPost = await new Post(samplePost).save();
    expect(savedPost.likes.length).toBe(0);

    const variables = {
      postId: mongoose.Types.ObjectId(),
    };
    const { errors } = await mutate({
      mutation: LIKE_POST_MUTATION,
      variables,
    });

    expect(errors).not.toBeNull();
    expect(errors.length).not.toBe(0);

    savedPost = await Post.findById(savedPost.id);
    expect(savedPost.likes.length).toBe(0);

    verify.restore();
  });

  afterEach(async () => {
    await Post.deleteMany();
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });
});
