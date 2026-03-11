import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';

const httpLink = createHttpLink({
  uri: 'http://localhost:3000/graphql',
});

export const apolloClient = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: true,
  errorPolicy: 'all',
  notifyOnNetworkStatusChange: true,
  connectToDevTools: true,
  queryDeduplication: true,
  defaultContext: {
    headers: {
      'Content-Type': 'application/json',
    },
  },
  ssrMode: false,
});

export * from './queries';
