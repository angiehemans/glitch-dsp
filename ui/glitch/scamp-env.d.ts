// Augments the framework's Env so `env.X` is typed in load(). Each
// adapter documents what it puts here.
declare module 'scampjs/runtime' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Env {}
}

export {};
