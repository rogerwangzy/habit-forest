import PocketBase from 'pocketbase';

// Change this URL to your running PocketBase server
export const pb = new PocketBase('https://running.yiqiqq.com');

export function isLoggedIn() {
  return pb.authStore.isValid;
}

export function currentUser() {
  return pb.authStore.model;
}
