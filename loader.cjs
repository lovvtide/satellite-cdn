import('./index.js').then(module => {

  module.start();

}).catch(error => {

  console.error(error);
  process.exit(1);
});
