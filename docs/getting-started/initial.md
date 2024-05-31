# Installation
As of early june 2024, this is now published to npm under [`react-admin-contraption-unstable`](https://npmjs.com/react-admin-contraption-unstable).

~The core code currently lives within the https://github.com/MadeByBread/react-admin-contraption
repository, inside the admin/ directory at the root (note that this currently a symlink to
example/src/admin). As of late may 2024, this package is not published anywhere, so copy this code
into a project's `src` directory to add this to a project.~

# Creating data models
Next, to power the admin interface, you'll want to make some `DataModel`s.

Data models can be server driven or client driven (or, somewhere in between!):

### Server driven 
Server driven data models allow one to accomplish django admin / active admin like behavior where
newly created models automatically get new pages created. In order to implement this though, some
`react-admin-contraption`-specific code must run serverside.

To continue, pick your tech stack:
- [TRPC + Prisma](./trpc-prisma.md)
- React Server Actions + Prisma (somebody needs to implement the adapter and write this!)
- [Rest API + Prisma (guide focuses on express, but parts are relevant with other tools)](./rest.md)
- If none of these apply (or if you'd prefer to define data models locally) - keep reading!

### Client driven
Client driven data models don't have any requirements on custom server code, but as a tradeoff,
require more code to be written client side to "adapt" a custom api to the data model interface.

For more information, read the [`DataModel`](../data-models/DataModel.md) documentation.
