const { ApolloServer, PubSub } = require('apollo-server');

const typeDefs = require('./graphql/typeDefs');
const resolvers = require('./graphql/resolvers');

const pubSub = new PubSub();

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ req }) => ({ req, pubSub }),
});

module.exports = server;
