const { UserInputError, AuthenticationError } = require('apollo-server-errors');
const Post = require('../../models/Post');
const checkAuth = require('../../utils/check-auth');

module.exports = {
  Mutation: {
    createComment: async (_, { postId, body }, context) => {
      const { username } = checkAuth(context);

      if (body.trim() === '') {
        throw new UserInputError('Empty comment', {
          errors: {
            body: 'Comment must not be empty',
          },
        });
      }

      const post = await Post.findById(postId);
      if (!post) {
        throw new UserInputError('Post not found');
      }
      post.comments.unshift({
        body,
        username,
        createdAt: new Date().toISOString(),
      });
      return await post.save();
    },
    deleteComment: async (_, { postId, commentId }, context) => {
      const { username } = checkAuth(context);

      const post = await Post.findById(postId);
      if (!post) {
        throw new UserInputError('Post not found');
      }

      const commentIndex = post.comments.findIndex(
        (comment) => comment.id === commentId
      );
      if (commentIndex === -1) {
        throw new UserInputError('Comment not found');
      }

      if (post.comments[commentIndex].username !== username) {
        throw new AuthenticationError('Action not allowed');
      }

      post.comments.splice(commentIndex, 1);
      return await post.save();
    },
    likePost: async (_, { postId }, context) => {
      const { username } = checkAuth(context);

      const post = await Post.findById(postId);
      if (!post) {
        throw new UserInputError('Post not found');
      }

      const likeIndex = post.likes.findIndex(
        (like) => like.username === username
      );
      if (likeIndex > -1) {
        post.likes.splice(likeIndex, 1);
      } else {
        post.likes.push({
          username,
          createdAt: new Date().toISOString(),
        });
      }

      return await post.save();
    },
  },
};
