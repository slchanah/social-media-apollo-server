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

const { query, mutate } = createTestClient(server);

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

let samplePost;

const cloneAndSavePost = async (post) => {
  post._id = mongoose.Types.ObjectId();
  post.isNew = true;
  await post.save();
};

const authHeader = { req: { headers: { authorization: 'Bearer token' } } };

const constructAuthContext = (context) => context(authHeader);

const FETCH_POSTS_QUERY = gql`
  {
    getPosts {
      id
      body
      username
      likeCount
      likes {
        username
      }
      commentCount
      comments {
        id
        username
        createdAt
        body
      }
    }
  }
`;

const FETCH_POST_QUERY = gql`
  query($postId: ID!) {
    getPost(postId: $postId) {
      id
      body
      username
      likeCount
      likes {
        username
      }
      commentCount
      comments {
        id
        username
        createdAt
        body
      }
    }
  }
`;

const CREATE_POST_MUTATION = gql`
  mutation createPost($body: String!) {
    createPost(body: $body) {
      id
      body
      createdAt
      username
      likes {
        id
        username
        createdAt
      }
      likeCount
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

const DELETE_POST_MUTATION = gql`
  mutation deletePost($postId: ID!) {
    deletePost(postId: $postId)
  }
`;

describe('Posts tests', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URL_TEST, {
      useNewUrlParser: true,
    });

    await sampleUser.save();

    samplePost = new Post({
      body: 'body',
      username: sampleUser.username,
      comments: [],
      likes: [],
      user: sampleUser._id,
    });
    await cloneAndSavePost(samplePost);
    await cloneAndSavePost(samplePost);
    await cloneAndSavePost(samplePost);
  });

  beforeEach(() => {
    server.context = originalContext;
  });

  it('should get all posts successfully without token', async () => {
    const {
      data: { getPosts },
    } = await query({
      query: FETCH_POSTS_QUERY,
    });

    expect(getPosts).not.toBeNull();
    expect(getPosts.length).toBe(3);
  });

  it('should get a post by id successfully without token', async () => {
    const post = new Post({
      body: 'new post',
      username: sampleUser.username,
      comments: [],
      likes: [],
    });
    await post.save();

    const {
      data: { getPost },
    } = await query({
      query: FETCH_POST_QUERY,
      variables: {
        postId: post.id,
      },
    });

    expect(getPost.body).toBe(post.body);

    await post.delete();
  });

  it('should create a post successfully with valid token', async () => {
    server.context = constructAuthContext(server.context);
    const { mutate } = createTestClient(server);

    const variables = {
      body: 'new created post',
    };

    const verify = sinon.stub(jwt, 'verify');
    verify.returns(sampleDecryptedToken);

    const {
      data: { createPost },
    } = await mutate({
      mutation: CREATE_POST_MUTATION,
      variables,
    });

    expect(createPost.body).toBe(variables.body);
    expect(createPost.username).toBe(sampleDecryptedToken.username);

    await Post.deleteOne({ body: variables.body });
    verify.restore();
  });

  it('should fail to create a post if the token is not provided', async () => {
    const variables = {
      body: 'new created post',
    };

    const { errors } = await mutate({
      mutation: CREATE_POST_MUTATION,
      variables,
    });

    expect(errors).not.toBeNull();
    expect(errors.length).not.toBe(0);

    const post = await Post.findOne({ body: variables.body });
    expect(post).toBeNull();
  });

  it('should fail to create a post if the body is empty', async () => {
    const verify = sinon.stub(jwt, 'verify');
    verify.returns(sampleDecryptedToken);

    const variables = {
      body: '   ',
    };

    const { errors } = await mutate({
      mutation: CREATE_POST_MUTATION,
      variables,
    });

    expect(errors).not.toBeNull();
    expect(errors.length).not.toBe(0);

    const post = await Post.findOne({ body: variables.body });
    expect(post).toBeNull();

    verify.restore();
  });

  it('should delete a post successfully with a valid token', async () => {
    server.context = constructAuthContext(server.context);
    const { mutate } = createTestClient(server);

    const post = new Post({
      body: 'new post',
      username: sampleUser.username,
      comments: [],
      likes: [],
    });
    await post.save();

    const savedPost = await Post.findById(post.id);
    expect(savedPost).not.toBeNull();

    const verify = sinon.stub(jwt, 'verify');
    verify.returns(sampleDecryptedToken);

    await mutate({
      mutation: DELETE_POST_MUTATION,
      variables: {
        postId: post.id,
      },
    });

    const deletedPost = await Post.findById(post.id);
    expect(deletedPost).toBeNull();

    verify.restore();
  });

  it('should fail to delete a post if the token is not provided', async () => {
    const post = new Post({
      body: 'new post',
      username: sampleUser.username,
      comments: [],
      likes: [],
    });
    await post.save();

    const savedPost = await Post.findById(post.id);
    expect(savedPost).not.toBeNull();

    const { errors } = await mutate({
      mutation: DELETE_POST_MUTATION,
      variables: {
        postId: post.id,
      },
    });

    expect(errors).not.toBeNull();
    expect(errors.length).not.toBe(0);

    const deletedPost = await Post.findById(post.id);
    expect(deletedPost).not.toBeNull();

    await post.delete();
  });

  it('should fail to delete a post if the request user is not the owner', async () => {
    server.context = constructAuthContext(server.context);
    const { mutate } = createTestClient(server);

    const verify = sinon.stub(jwt, 'verify');
    verify.returns(sampleDecryptedToken);

    const post = new Post({
      body: 'new post',
      username: 'another user',
      comments: [],
      likes: [],
    });
    await post.save();

    const savedPost = await Post.findById(post.id);
    expect(savedPost).not.toBeNull();

    const { errors } = await mutate({
      mutation: DELETE_POST_MUTATION,
      variables: {
        postId: post.id,
      },
    });

    expect(errors).not.toBeNull();
    expect(errors.length).not.toBe(0);

    const deletedPost = await Post.findById(post.id);
    expect(deletedPost).not.toBeNull();

    await post.delete();
    verify.restore();
  });

  afterAll(async () => {
    await Post.deleteMany();
    await User.deleteMany();
    await mongoose.disconnect();
  });
});
